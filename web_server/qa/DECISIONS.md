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
