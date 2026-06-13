"""
Comic-Translate local web server.

Exposes ONE endpoint, POST /translate, that takes a comic page image and returns
the translated image. No GUI, no cloud, no API keys: OCR runs locally and the
translation is done locally by Ollama. The final render step draws translated
text back onto the inpainted page. This is the engine the browser extension will
later call.

Start it with:   ./web_server/run.sh
"""
import sys
import time
import os
import threading
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import Response

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

# This file lives in web_server/. The repo root (with pipeline/, controller.py)
# is its parent — add it so we can import the real pipeline.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import imkit as imk

from config import CONFIG
from headless_main_page import HeadlessMainPage
from ollama_translator import translate_lines

# The real pipeline from the comic-translate repo. (VERIFY this import path
# matches your fork — it may be `from modules... ` in some versions.)
from pipeline.main_pipeline import ComicTranslatePipeline

app = FastAPI(title="Comic-Translate Local Server")

# The ML models are heavy and not safe to run twice at once -> build the pipeline
# ONCE at startup and serve a single request at a time behind this lock.
_LOCK = threading.Lock()
_main_page = None
_pipeline = None
_qt_app = None


def _warm():
    global _main_page, _pipeline
    start = time.time()
    _main_page = HeadlessMainPage(CONFIG.source_lang, CONFIG.target_lang)
    _pipeline = ComicTranslatePipeline(_main_page)
    _main_page.pipeline = _pipeline
    print(f"[warm] pipeline ready in {time.time() - start:.1f}s "
          f"(translator = Ollama:{CONFIG.ollama_model})")


@app.on_event("startup")
def _startup():
    if CONFIG.debug:
        CONFIG.debug_dir.mkdir(parents=True, exist_ok=True)
    _warm()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": CONFIG.ollama_model,
        "source_default": CONFIG.source_lang,
        "target_default": CONFIG.target_lang,
        "debug": CONFIG.debug,
    }


@app.post("/translate")
async def translate(
    file: UploadFile = File(...),
    src: str = Form(None),
    tgt: str = Form(None),
):
    src = src or CONFIG.source_lang
    tgt = tgt or CONFIG.target_lang

    raw = await file.read()
    try:
        img = imk.decode_image(raw)
    except Exception:
        raise HTTPException(400, "Could not read that file as an image.")
    if img.ndim == 2:
        img = imk.merge_channels([img, img, img])

    with _LOCK:  # one page at a time
        try:
            out = _run_pipeline(img, src, tgt)
        except AttributeError as exc:
            # Almost always a missing HeadlessMainPage attribute.
            raise HTTPException(
                501,
                f"Shim incomplete: {exc}. Run "
                f"`python web_server/discover_main_page_attrs.py` and add the "
                f"missing attribute to web_server/headless_main_page.py.",
            )

    try:
        buf = imk.encode_image(out, ".png")
    except Exception as exc:
        print(f"[encode] failed: {exc}")
        raise HTTPException(500, "Failed to encode the output image.")
    return Response(content=buf, media_type="image/png")


# ---------------------------------------------------------------------------
# The pipeline sequence. Each step that touches the real comic-translate code
# is marked (VERIFY) — confirm the method/attribute names against your fork.
# ---------------------------------------------------------------------------
def _run_pipeline(img, src, tgt):
    p, mp = _pipeline, _main_page
    mp.set_languages(src, tgt)
    mp.load_image(img)
    _dump("00_input.png", img)

    # 1) find text blocks
    detect_result = p.detect_blocks(load_rects=False)
    p.on_blk_detect_complete(detect_result)
    mp.image_viewer.sync_rectangles_from_blocks(mp.blk_list)
    print(f"[detect] blocks={len(mp.blk_list)}")
    _dump("01_blocks.png", _draw_boxes(img, mp.blk_list))

    # 2) OCR each block -> fills block.text
    p.OCR_image()
    sources = [getattr(b, "text", "") for b in mp.blk_list]
    for idx, text in enumerate(sources, 1):
        print(f"[ocr] {idx}: {text!r}")

    # 3) translate locally via Ollama (the $0 path) -> write block.translation
    translations = translate_lines(sources, src, tgt)
    for block, text in zip(mp.blk_list, translations):
        setattr(block, "translation", text)
        setattr(block, "source_lang", src)
        setattr(block, "target_lang", tgt)
    for idx, text in enumerate(translations, 1):
        print(f"[ollama:{CONFIG.ollama_model}] {idx}: {text!r}")

    # 4) erase the original text
    patches = p.inpaint()
    mp.apply_inpaint_patches(patches)
    print(f"[inpaint] patches={len(patches or [])}")
    _dump("02_inpainted.png", mp.current_image())

    # 5) render the translated text back on
    out = _render(p, mp)
    _dump("03_output.png", out)
    return out


def _render(pipeline, main_page):
    """Render translated text back onto the inpainted page."""
    _ensure_qt_app()

    from PySide6.QtGui import QColor

    from app.ui.canvas.save_renderer import ImageSaveRenderer
    from app.ui.canvas.text.text_item_properties import TextItemProperties
    from app.ui.canvas.text_item import OutlineInfo, OutlineType
    from modules.rendering.render import (
        get_best_render_area,
        is_vertical_block,
        pyside_word_wrap,
    )
    from modules.utils.image_utils import get_smart_text_color
    from modules.utils.language_utils import get_language_code, is_no_space_lang
    from modules.utils.translator_utils import format_translations

    image = main_page.current_image()
    if image is None:
        return image

    settings = main_page.render_settings()
    target_lang = main_page.lang_mapping.get(
        main_page.t_combo.currentText(),
        main_page.t_combo.currentText(),
    )
    target_lang_code = get_language_code(target_lang)

    format_translations(
        main_page.blk_list,
        target_lang_code,
        upper_case=settings.upper_case,
    )
    get_best_render_area(main_page.blk_list, image)

    alignment = main_page.button_to_alignment[settings.alignment_id]
    font_family = settings.font_family
    base_font_color = QColor(settings.color)
    outline_color = QColor(settings.outline_color) if settings.outline else None
    outline_width = float(settings.outline_width)
    line_spacing = float(settings.line_spacing)

    text_items_state = []
    rendered_count = 0
    for block in main_page.blk_list:
        translation = getattr(block, "translation", "")
        if not translation or len(translation) == 1:
            continue

        x1, y1, width, height = block.xywh
        vertical = is_vertical_block(block, target_lang_code)
        wrapped, font_size, rendered_width, rendered_height = pyside_word_wrap(
            translation,
            font_family,
            int(max(1, width)),
            int(max(1, height)),
            line_spacing,
            outline_width,
            settings.bold,
            settings.italic,
            settings.underline,
            alignment,
            settings.direction,
            settings.max_font_size,
            settings.min_font_size,
            vertical,
            is_no_space_lang(target_lang_code),
            return_metrics=True,
        )

        font_color = get_smart_text_color(block.font_color, base_font_color)
        text_props = TextItemProperties(
            text=wrapped,
            font_family=font_family,
            font_size=font_size,
            text_color=font_color,
            alignment=alignment,
            line_spacing=line_spacing,
            outline_color=outline_color,
            outline_width=outline_width,
            bold=settings.bold,
            italic=settings.italic,
            underline=settings.underline,
            position=(float(x1), float(y1)),
            rotation=float(getattr(block, "angle", 0) or 0),
            scale=1.0,
            transform_origin=getattr(block, "tr_origin_point", None) or (0, 0),
            width=rendered_width,
            height=rendered_height,
            direction=settings.direction,
            vertical=vertical,
            selection_outlines=[
                OutlineInfo(
                    0,
                    len(wrapped),
                    outline_color,
                    outline_width,
                    OutlineType.Full_Document,
                )
            ] if settings.outline else [],
        )
        text_items_state.append(text_props.to_dict())
        rendered_count += 1

    renderer = ImageSaveRenderer(image)
    renderer.add_state_to_image({"text_items_state": text_items_state})
    out = renderer.render_to_image()
    print(f"[render] text_items={rendered_count}")
    return out


def _ensure_qt_app():
    global _qt_app
    from PySide6.QtWidgets import QApplication

    app = QApplication.instance()
    if app is None:
        _qt_app = QApplication([])
    else:
        _qt_app = app


def _dump(name, img):
    if CONFIG.debug and img is not None:
        CONFIG.debug_dir.mkdir(parents=True, exist_ok=True)
        imk.write_image(str(CONFIG.debug_dir / name), img)


def _draw_boxes(img, blk_list):
    vis = img.copy()
    for block in blk_list:
        xyxy = getattr(block, "bubble_xyxy", None)
        if xyxy is None:
            xyxy = getattr(block, "xyxy", None)
        if xyxy is not None:
            x1, y1, x2, y2 = map(int, xyxy)
            vis = imk.rectangle(vis, (x1, y1), (x2, y2), (0, 255, 0), 2)
    return vis
