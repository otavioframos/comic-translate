# Decisions log — Step 1 QA

Append non-trivial judgement calls here as you make them.

Schema: `## YYYY-MM-DD — title — verdict`

<!-- e.g.
## 2026-06-13 — pipeline import path — resolved
server.py assumed `from pipeline.main_pipeline import ComicTranslatePipeline`;
real path matched, no change needed.
-->

## 2026-06-13 — Python runtime — resolved
The setup script used macOS `/usr/bin/python3` (3.9.6), which cannot install `numpy>=2.2.6`. The script now requires/prefers Python 3.12 and reports a clear Homebrew install command when unavailable.

## 2026-06-13 — Ollama setup — resolved
`ollama pull` failed when the Ollama server was not already running. `setup_mac.sh` now starts `ollama serve` in the background before pulling the configured model.

## 2026-06-13 — server image stack — resolved
OpenCV was not a declared dependency, so the server now uses repo-native `imkit` helpers for decoding, encoding, debug writes, and rectangle drawing.

## 2026-06-13 — headless pipeline lifecycle — resolved
The desktop app runs detection and inpainting through callbacks. The server now mirrors that lifecycle synchronously: apply detection results with `on_blk_detect_complete`, provide rectangle state for OCR, and apply inpaint patches to the current image.

## 2026-06-13 — Korean sample caveat — noted
The Desktop file named `korean sample.jpg` returned HTTP 200 through the Korean path, but the visible content appears mostly Japanese/Instagram text. It is useful for route coverage, not strong Korean OCR quality validation.

## 2026-06-13 — replacement Korean sample — resolved
The Desktop file `korean sample.webp` is a stronger Korean sample. It returned HTTP 200 through the Korean path, produced Korean OCR for 4 detected blocks, returned non-empty Ollama translations, and produced inpaint patches for all 4 blocks.

## 2026-06-13 — Step 2 renderer — resolved
The server now renders translated text through the repo's Qt save-rendering path (`ImageSaveRenderer` plus `TextItemProperties`) instead of a separate Pillow-only renderer. This keeps the headless output closer to desktop/batch export behavior while avoiding GUI window setup.

## 2026-06-13 — partial-bubble residual text — deferred
The replacement Korean sample has a cut-off lower bubble where leftover source glyphs sit outside the detected text block. Wider text masks and conservative render backplates improve normal bubbles but do not fully solve this edge case. Defer a full fix unless it appears frequently; the proper solution is a bubble-shape cleanup mask, not aggressive rectangular erasing.

## 2026-06-13 — browser extension scope — resolved
The first extension prototype targets standard `<img>` comic pages via a right-click context menu and a popup action for the largest visible image. Canvas-based readers and CSS-background readers are deferred until real target-site testing shows they are needed.

## 2026-06-13 — whole-page slice capture — resolved
Whole-page-style reading uses Chrome's debugger screenshot API (`Page.captureScreenshot`) to capture viewport-sized document slices beyond the visible viewport without scrolling the live page. This adds a debugger-permission warning, but avoids the jank caused by programmatic scroll-and-capture.

## 2026-06-13 — page-slice overlay scrolling — resolved
The first whole-page slice overlay was an absolute document-height layer. Even with `pointer-events: none`, that can change scrollable overflow or confuse protected readers. The overlay is now fixed to the viewport and translated slices are repositioned on scroll, so the extension no longer changes document layout.
