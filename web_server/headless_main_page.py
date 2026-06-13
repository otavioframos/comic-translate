"""
HeadlessMainPage — a stand-in for the comic-translate GUI window.

WHY THIS EXISTS
---------------
The translation pipeline (pipeline/main_pipeline.py -> ComicTranslatePipeline)
was written to read ALL of its state off the GUI window object, which the code
calls "main_page": the current image, the detected text blocks, the chosen
languages, the OCR/translator selection, and (normally) the API keys.

This class fakes that object so the pipeline runs WITHOUT opening the GUI.

>>> THIS IS THE ONE FILE YOU FINISH BY HAND. <<<
We cannot know every attribute the pipeline reads in advance. The good news:
each missing one produces a crystal-clear error, e.g.

    AttributeError: 'HeadlessMainPage' object has no attribute 'blk_list'

...which names EXACTLY what to add. The loop (see TEST_CHECKLIST.md, Appendix):

    1. Start the server, send one image.
    2. Read the error -> it names a missing attribute.
    3. Run:  python web_server/discover_main_page_attrs.py
       (prints every main_page.* the real code touches + where).
    4. Add that attribute here, copying how controller.py sets it up.
    5. Repeat until a translated PNG comes back.

Attributes marked (VERIFY) are educated guesses from the public code — confirm
each against YOUR fork before trusting it.
"""
import numpy as np

from config import CONFIG
from modules.utils.image_utils import generate_mask


def _alignment_map():
    from PySide6 import QtCore

    return {
        0: QtCore.Qt.AlignmentFlag.AlignLeft,
        1: QtCore.Qt.AlignmentFlag.AlignCenter,
        2: QtCore.Qt.AlignmentFlag.AlignRight,
    }


class _Combo:
    """Fakes a Qt combo box: real code reads the language via .currentText()."""

    def __init__(self, value):
        self._value = value

    def currentText(self):
        return self._value

    def setCurrentText(self, value):
        self._value = value


class _UI:
    """Tiny translation shim for settings code that calls settings_page.ui.tr()."""

    @staticmethod
    def tr(value):
        return value


class _UndoStack:
    def push(self, _command):
        return None

    def beginMacro(self, _name):
        return None

    def endMacro(self):
        return None


class _UndoGroup:
    def __init__(self):
        self._stack = _UndoStack()

    def activeStack(self):
        return self._stack


class _RectController:
    def __init__(self, main_page):
        self.main_page = main_page

    def find_corresponding_rect(self, block, _iou_threshold=0.5):
        return block

    def find_corresponding_text_block(self, rect, _iou_threshold=0.5):
        for block in self.main_page.blk_list:
            if tuple(getattr(block, "xyxy", ())) == tuple(rect):
                return block
        return None


class _Signal:
    def emit(self, *args, **kwargs):
        return None


class _ImageViewer:
    """Fakes main_page.image_viewer — the on-screen canvas holding the page."""

    def __init__(self, main_page):
        self.main_page = main_page
        self._img = None  # current page as a BGR numpy array (OpenCV order)
        self.rectangles = []
        self.selected_rect = None
        self.empty = True

    def set_image_array(self, img):
        self._img = img
        self.empty = img is None

    def get_image_array(self, *_, **__):
        return self._img

    def hasPhoto(self):
        return self._img is not None

    def clear_rectangles(self, *_, **__):
        self.rectangles = []
        self.selected_rect = None

    def clear_rectangles_in_visible_area(self):
        self.clear_rectangles()

    def add_rectangle(self, _rect, _position, *_args, **_kwargs):
        marker = object()
        self.rectangles.append(marker)
        return marker

    def select_rectangle(self, rect):
        self.selected_rect = rect

    def sync_rectangles_from_blocks(self, blocks):
        self.rectangles = list(blocks or [])
        self.selected_rect = self.rectangles[0] if self.rectangles else None

    def get_mask_for_inpainting(self):
        blocks = [
            blk for blk in self.main_page.blk_list
            if getattr(blk, "text", "").strip()
            and getattr(blk, "translation", "").strip()
        ]
        if self._img is None:
            return None
        return generate_mask(self._img, blocks, default_padding=9)

    def clear_brush_strokes(self, *_, **__):
        return None


class _Settings:
    """
    Fakes main_page.settings_page — where the pipeline reads engine choices,
    languages and (normally) API keys. For headless use we hard-wire it:
    OCR stays on the free local models; translation is done by the server via
    Ollama, so no paid translator and no keys are needed.
    """

    def __init__(self, source_lang, target_lang):
        self.ui = _UI()
        self.source_lang = source_lang
        self.target_lang = target_lang

    # (VERIFY) Real method names — grep settings_page / the handlers for `def get_`
    def get_tool_selection(self, key=""):
        return {
            "translator": "Custom",  # we translate ourselves via Ollama
            "ocr": "Default",        # Default => manga-ocr / Pororo / PPOCRv5
            "detector": "Default",
            "inpainter": "AOT",
        }.get(key, "Default")

    def get_credentials(self, service=""):
        return {}  # keyless: Ollama needs no credentials

    def get_llm_settings(self):
        return {"extra_context": "", "temperature": 0.3, "image_input_enabled": False}

    def is_gpu_enabled(self):
        return False

    def get_hd_strategy_settings(self):
        return {"strategy": "Original"}


class HeadlessMainPage:
    def __init__(self, source_lang=None, target_lang=None):
        self.source_lang = source_lang or CONFIG.source_lang
        self.target_lang = target_lang or CONFIG.target_lang

        # ---- core state the pipeline reads and mutates -----------------------
        self.image_viewer = _ImageViewer(self)
        self.settings_page = _Settings(self.source_lang, self.target_lang)
        self.pipeline = None
        self.blk_list = []        # detected text blocks land here
        self.curr_img_idx = 0
        self.image_files = ["headless-page.png"]
        self.image_states = {"headless-page.png": {}}
        self.image_skipped = {}
        self.file_handler = None
        self.progress_update = _Signal()
        self.patches_processed = _Signal()
        self.blk_rendered = _Signal()
        self.render_state_ready = _Signal()
        self.undo_group = _UndoGroup()
        self.rect_item_ctrl = _RectController(self)
        self.image_ctrl = None
        self.webtoon_mode = False

        # ---- language plumbing (VERIFY names against controller.py) ----------
        self.lang_mapping = {
            "Japanese": "Japanese",
            "Korean": "Korean",
            "English": "English",
        }
        self.s_combo = _Combo(self.source_lang)      # source-language widget
        self.t_combo = _Combo(self.target_lang)      # target-language widget
        self.button_to_alignment = _alignment_map()

    # ---- convenience helpers the SERVER calls (not part of the GUI API) ------
    def load_image(self, bgr_img):
        self.image_viewer.set_image_array(bgr_img)
        self.blk_list = []
        self.image_viewer.clear_rectangles()

    def apply_inpaint_patches(self, patches):
        image = self.current_image()
        if image is None:
            return
        for patch in patches or []:
            x, y, w, h = [int(v) for v in patch["bbox"]]
            patch_img = patch.get("image")
            if patch_img is None:
                continue
            image[y:y + h, x:x + w] = patch_img
        self.image_viewer.set_image_array(np.ascontiguousarray(image))

    def current_image(self):
        return self.image_viewer.get_image_array()

    def set_languages(self, src, tgt):
        self.source_lang, self.target_lang = src, tgt
        self.settings_page.source_lang = src
        self.settings_page.target_lang = tgt
        self.s_combo.setCurrentText(src)
        self.t_combo.setCurrentText(tgt)

    def connect_rect_item_signals(self, *_args, **_kwargs):
        return None

    def set_tool(self, *_args, **_kwargs):
        return None

    def render_settings(self):
        from modules.rendering.render import TextRenderingSettings
        from modules.utils.language_utils import get_layout_direction

        target_lang = self.lang_mapping.get(self.t_combo.currentText(), self.t_combo.currentText())
        return TextRenderingSettings(
            alignment_id=1,
            font_family="",
            min_font_size=6,
            max_font_size=28,
            color="#000000",
            upper_case=False,
            outline=True,
            outline_color="#ffffff",
            outline_width="1.0",
            bold=False,
            italic=False,
            underline=False,
            line_spacing="1.0",
            direction=get_layout_direction(target_lang),
        )
