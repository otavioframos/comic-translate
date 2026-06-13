# QA Report — Local Web Server Step 2 Render

Date: 2026-06-13
Branch: `add-local-web-server`
Host: MacBook Air, Apple Silicon
Model: `qwen2.5:7b` via local Ollama

## Summary

Step 2 is functionally passing: `_render()` no longer returns the inpainted
placeholder. It wraps, sizes, and draws translated text back onto the cleaned
page using the repo's Qt save-rendering stack.

## Results

- PASS — `web_server/server.py:_render()` creates Qt text item state and renders
  it through `ImageSaveRenderer`.
- PASS — `./web_server/run.sh` exports `QT_QPA_PLATFORM=offscreen` so the Qt
  renderer can run without opening the GUI.
- PASS — `/Users/otavioramos/Desktop/japanese sample.jpg` with `Japanese English`
  returned HTTP 200 and produced `03_output.png` with 5 rendered English text
  items.
- PASS — `/Users/otavioramos/Desktop/korean sample.webp` with `Korean English`
  returned HTTP 200 and produced `03_output.png` with 4 rendered English text
  items.
- PASS — Translation remained local through Ollama; no cloud translator or API
  key was introduced.
- PASS — Syntax check completed with
  `.venv/bin/python -m py_compile web_server/server.py web_server/headless_main_page.py`.

## Latency

- Japanese sample with render: 30.64s.
- Korean WebP sample with render: 30.42s.

## Visual Notes

- Japanese output has translated text visible in all detected bubbles. Placement
  is usable, but not fully polished; some text sits close to bubble edges.
- Korean output has translated text visible in all detected bubbles. The lower
  left partial bubble still shows faint residual Korean at the bottom edge
  because the original inpaint mask did not fully cover that region.

## Evidence Snippets

Japanese sample:

```text
[detect] blocks=5
[inpaint] patches=5
[render] text_items=5
HTTP 200
```

Korean sample:

```text
[detect] blocks=4
[inpaint] patches=4
[render] text_items=4
HTTP 200
```

## Files Touched

- `web_server/server.py`
- `web_server/headless_main_page.py`
- `web_server/run.sh`
- `web_server/README.md`
- `.gitignore`
- `web_server/qa/STEP2_RENDER_REPORT.md`
