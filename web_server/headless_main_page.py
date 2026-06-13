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
from config import CONFIG


class _Combo:
    """Fakes a Qt combo box: real code reads the language via .currentText()."""

    def __init__(self, value):
        self._value = value

    def currentText(self):
        return self._value

    def setCurrentText(self, value):
        self._value = value


class _ImageViewer:
    """Fakes main_page.image_viewer — the on-screen canvas holding the page."""

    def __init__(self):
        self._img = None  # current page as a BGR numpy array (OpenCV order)

    # (VERIFY) The real viewer exposes the current image through one of these.
    # Grep controller.py / the handlers for:  image_viewer.<something>
    def set_image_array(self, img):
        self._img = img

    def get_image_array(self):
        return self._img

    # Some code paths also call .hasPhoto() / read .photo — add them here as the
    # AttributeError messages demand. Keep them no-ops or simple returns.


class _Settings:
    """
    Fakes main_page.settings_page — where the pipeline reads engine choices,
    languages and (normally) API keys. For headless use we hard-wire it:
    OCR stays on the free local models; translation is done by the server via
    Ollama, so no paid translator and no keys are needed.
    """

    def __init__(self, source_lang, target_lang):
        self.source_lang = source_lang
        self.target_lang = target_lang

    # (VERIFY) Real method names — grep settings_page / the handlers for `def get_`
    def get_tool_selection(self, key=""):
        return {
            "translator": "Custom",  # we translate ourselves via Ollama
            "ocr": "Default",        # Default => manga-ocr / Pororo / PPOCRv5
            "detector": "Default",
        }.get(key, "Default")

    def get_credentials(self, service=""):
        return {}  # keyless: Ollama needs no credentials

    def get_llm_settings(self):
        return {"temperature": 0.3, "image_input_enabled": False}


class HeadlessMainPage:
    def __init__(self, source_lang=None, target_lang=None):
        self.source_lang = source_lang or CONFIG.source_lang
        self.target_lang = target_lang or CONFIG.target_lang

        # ---- core state the pipeline reads and mutates -----------------------
        self.image_viewer = _ImageViewer()
        self.settings_page = _Settings(self.source_lang, self.target_lang)
        self.blk_list = []        # detected text blocks land here
        self.curr_img_idx = 0
        self.image_files = []     # (VERIFY) some steps index into this
        self.image_states = {}    # (VERIFY) per-image state cache

        # ---- language plumbing (VERIFY names against controller.py) ----------
        self.lang_mapping = {}                       # display name -> code
        self.s_combo = _Combo(self.source_lang)      # source-language widget
        self.t_combo = _Combo(self.target_lang)      # target-language widget

    # ---- convenience helpers the SERVER calls (not part of the GUI API) ------
    def load_image(self, bgr_img):
        self.image_viewer.set_image_array(bgr_img)
        self.blk_list = []

    def current_image(self):
        return self.image_viewer.get_image_array()

    def set_languages(self, src, tgt):
        self.source_lang, self.target_lang = src, tgt
        self.settings_page.source_lang = src
        self.settings_page.target_lang = tgt
        self.s_combo.setCurrentText(src)
        self.t_combo.setCurrentText(tgt)
