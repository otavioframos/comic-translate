"""
Comic-Translate local web server — STEP 1.

Exposes ONE endpoint, POST /translate, that takes a comic page image and returns
the translated image. No GUI, no cloud, no API keys: OCR runs locally and the
translation is done locally by Ollama. This is the engine the browser extension
will later call.

Start it with:   ./web_server/run.sh
"""
import sys
import time
import threading
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import Response

# This file lives in web_server/. The repo root (with pipeline/, controller.py)
# is its parent — add it so we can import the real pipeline.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

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


def _warm():
    global _main_page, _pipeline
    start = time.time()
    _main_page = HeadlessMainPage(CONFIG.source_lang, CONFIG.target_lang)
    _pipeline = ComicTranslatePipeline(_main_page)
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
    img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Could not read that file as an image.")

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

    ok, buf = cv2.imencode(".png", out)
    if not ok:
        raise HTTPException(500, "Failed to encode the output image.")
    return Response(content=buf.tobytes(), media_type="image/png")


# ---------------------------------------------------------------------------
# The pipeline sequence. Each step that touches the real comic-translate code
# is marked (VERIFY) — confirm the method/attribute names against your fork.
# ---------------------------------------------------------------------------
def _run_pipeline(img, src, tgt):
    p, mp = _pipeline, _main_page
    mp.set_languages(src, tgt)
    mp.load_image(img)
    _dump("00_input.png", img)

    # 1) find text blocks                            (VERIFY method signature)
    p.detect_blocks()
    _dump("01_blocks.png", _draw_boxes(img, mp.blk_list))

    # 2) OCR each block -> fills block.text          (VERIFY .text attribute)
    p.OCR_image()

    # 3) translate locally via Ollama (the $0 path) -> write block.translation
    sources = [getattr(b, "text", "") for b in mp.blk_list]   # (VERIFY .text)
    translations = translate_lines(sources, src, tgt)
    for block, text in zip(mp.blk_list, translations):
        setattr(block, "translation", text)                   # (VERIFY .translation)

    # 4) erase the original text
    p.inpaint()
    _dump("02_inpainted.png", mp.current_image())

    # 5) render the translated text back on
    out = _render(p, mp)
    _dump("03_output.png", out)
    return out


def _render(pipeline, main_page):
    """
    TODO (VERIFY): rendering lives OUTSIDE main_pipeline.py — usually in
    controller.py or a modules/rendering file. Grep for "render" and wire the
    real call here.

    Until that's wired, we return the inpainted image so the whole pipeline is
    testable end-to-end (you'll see erased bubbles + correct boxes, just no
    typeset text yet). That still proves detection + OCR + translation work.
    """
    return main_page.current_image()


def _dump(name, img):
    if CONFIG.debug and img is not None:
        cv2.imwrite(str(CONFIG.debug_dir / name), img)


def _draw_boxes(img, blk_list):
    vis = img.copy()
    for block in blk_list:
        xyxy = getattr(block, "xyxy", None)        # (VERIFY box attribute)
        if xyxy is not None:
            x1, y1, x2, y2 = map(int, xyxy)
            cv2.rectangle(vis, (x1, y1), (x2, y2), (0, 255, 0), 2)
    return vis
