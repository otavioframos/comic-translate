# Goal

Verify that **Step 1 of the comic-translate local web server works end to end on this MacBook (Apple Silicon)**, and finish the small amount of hands-on code needed to get it there. "Working" means: the headless server boots, accepts a comic page image, and runs the real pipeline — **text detection → OCR → translation via a local Ollama model → inpainting** — returning a result, with no paid API and no `Shim incomplete` errors. When done, produce a QA report stating PASS/FAIL against every acceptance criterion below, listing exactly which shim attributes and `(VERIFY)` names you had to fill in. The render step (drawing translated text back onto the page) is **intentionally stubbed** and is **out of scope** — do not block on it.

# Acceptance criteria

1. The repo is checked out on branch `add-local-web-server` and you are working from its root.
2. `web_server/setup_mac.sh` completes successfully: a `.venv` exists, `requirements.txt` + `web_server/requirements-webserver.txt` are installed, Ollama is installed, and the model from `web_server/.env` (`OLLAMA_MODEL`, default `qwen2.5:7b`) is pulled.
3. `./web_server/run.sh` starts the server and `curl http://127.0.0.1:8000/health` returns JSON with `"status":"ok"` and the configured model name.
4. Sending a Japanese test page via `python web_server/test_pipeline.py <page> Japanese English` returns **HTTP 200** and writes a PNG.
5. `web_server/debug_out/01_blocks.png` shows green boxes correctly enclosing the speech bubbles → **detection works**.
6. There is concrete evidence (server logs you add if needed) that **OCR produced non-empty source text** for the detected blocks.
7. There is concrete evidence that **Ollama was actually called and returned non-empty translations** for that OCR text → the **$0 local translation path works**.
8. `web_server/debug_out/02_inpainted.png` shows the **original text erased** → inpainting works.
9. No `Shim incomplete: … no attribute 'X'` (HTTP 501) errors remain. Every attribute you added to `web_server/headless_main_page.py` is documented in the QA report.
10. Every spot marked `(VERIFY)` in `web_server/server.py` and `web_server/headless_main_page.py` that turned out wrong has been corrected to match the real code (e.g. the `ComicTranslatePipeline` import path, the block `.text` / `.translation` / `.xyxy` attribute names, method signatures).
11. A Korean page is run the same way **if a Korean sample is available**; otherwise the report explicitly records "Korean: not tested — no sample."
12. A QA report exists at `web_server/qa/QA_REPORT.md` containing: PASS/FAIL per criterion, the list of shim attributes added, the `(VERIFY)` corrections made, the exact Ollama model used, and cold-start vs warm per-page latency.
13. `web_server/qa/PROGRESS.md` is fully checked or annotated with the blocker for any unchecked item.
14. All code changes are committed to `add-local-web-server` with clear messages and pushed. **No** `.env`, `debug_out/`, `.venv/`, or downloaded model files are committed.

# Constraints

- **Translation MUST stay local via Ollama.** Do **not** "make it pass" by switching to OpenAI / Anthropic / Gemini or any paid/cloud translator. The entire purpose is $0, key-free, on-device translation. If Ollama misbehaves, fix Ollama — never substitute a cloud key.
- **No secrets or junk in git.** Never commit `.env`, `web_server/debug_out/`, `.venv/`, or model weights. The `.gitignore` already covers these — keep it that way.
- **Adapt the shim, not the pipeline.** Prefer surgical edits to `headless_main_page.py` / `server.py` to match the real code. Do **not** rewrite or destructively refactor `pipeline/` or the handler modules. If a real method signature differs from a `(VERIFY)` guess, change the *caller* to fit the real code.
- **Stack:** Python 3.12, `venv` (not conda), the repo's `requirements.txt` + `web_server/requirements-webserver.txt`, Ollama for translation. Apple Silicon → the server already exports `PYTORCH_ENABLE_MPS_FALLBACK=1`; keep it.
- **Localhost only.** The server binds `127.0.0.1`. Do not expose it to the network.
- **Chinese / PaddleOCR is out of scope** for this QA — do not install or wire it. Japanese (manga-ocr) and Korean (Pororo) only.
- **Do not touch the render step.** `_render()` returning the inpainted image is deliberate for Step 1. You may write `web_server/qa/RENDER_NOTES.md` documenting where the real renderer lives, but do not wire it.
- **Do not rename or relocate** any `web_server/` file.

# Context

- This is a fork of `ogkalu2/comic-translate` (a PySide6 desktop app). The `web_server/` folder wraps its pipeline so it runs **headless** and translates for **free** via Ollama — the engine a browser extension will later call for in-browser, $0-per-page translation.
- The pipeline (`pipeline/main_pipeline.py` → class `ComicTranslatePipeline`) was written to read all state off the GUI window object (`main_page`): current image, detected blocks, languages, engine choice, API keys. `web_server/headless_main_page.py` is a **stand-in for that window**, and is the one file expected to need hand-finishing. Each missing field raises a clear `AttributeError` naming exactly what to add.
- `web_server/discover_main_page_attrs.py` greps the real code for every `main_page.<attr>` access and prints them with the file that uses each — run it to know what the shim must provide.
- The pipeline exposes step methods (verify exact signatures in the source): `detect_blocks()`, `OCR_image()`, `translate_image()`, `inpaint()`. The server **bypasses the app's own translator** and instead calls Ollama itself (`web_server/ollama_translator.py`), writing each block's translation back — so paid translators are never touched.
- Read `web_server/TEST_CHECKLIST.md` first: it is the human acceptance guide and its Parts C–E map directly to criteria 3–8 here.
- Machine: **MacBook Air, Apple Silicon** (this is the test box; production is a 24 GB iMac). First run will download detection/OCR models (manga-ocr etc.) — several minutes, normal. The Air is fanless and will be slower than the iMac; treat latency as a pessimistic floor, not a verdict.
- A **test comic page is required** and the session will not have one. Assumption: the user drops one (Japanese, `.png`/`.jpg`) into `web_server/samples/` (gitignored). If none is present, ask the user **once** for a path, then proceed autonomously.

# Resources

- `web_server/README.md` — file-by-file map and quick start.
- `web_server/TEST_CHECKLIST.md` — the human test walkthrough + troubleshooting table.
- `web_server/discover_main_page_attrs.py` — generates the shim attribute checklist.
- `controller.py` — the real GUI controller; copy how it sets up `main_page` fields when filling the shim.
- `pipeline/main_pipeline.py`, `pipeline/ocr_handler.py`, `pipeline/block_detection.py`, `pipeline/translation_handler.py`, `pipeline/inpainting.py` — the real step implementations; source of truth for method/attribute names.
- Ollama docs: `https://ollama.com` (the local translator; `/api/chat` endpoint).

# Plan of attack (suggested)

1. Confirm branch + `chmod +x web_server/*.sh`. Run `web_server/setup_mac.sh`; if it stops for Ollama, install Ollama and rerun.
2. Start the server with `./web_server/run.sh`; confirm `/health`.
3. Obtain a Japanese test page (ask the user once if absent). Run `web_server/test_pipeline.py`.
4. Work the shim loop: read each `Shim incomplete`/`AttributeError`, run `discover_main_page_attrs.py`, add the field to `headless_main_page.py` modelled on `controller.py`, restart, repeat until HTTP 200.
5. Open `controller.py` / the handlers and correct any wrong `(VERIFY)` names in `server.py` (import path, `.text`/`.translation`/`.xyxy`, method signatures). Add temporary logging to capture OCR text and Ollama output as evidence for criteria 6–7.
6. Inspect each `debug_out/` stage image against criteria 5 & 8. Re-run; record cold vs warm latency.
7. Write `QA_REPORT.md`, update `PROGRESS.md` and `DECISIONS.md`, commit + push. Optionally write `RENDER_NOTES.md`.
8. Revise this plan as you learn the real code.

# Authorisation

- **Working directory:** the comic-translate repo clone on this Mac (e.g. `~/comic-translate`). If it is not present, clone it: `git clone -b add-local-web-server https://github.com/otavioframos/comic-translate.git`. Run all commands from the repo root.
- You are authorised to **run for as long as needed**, install OS/Python dependencies, pull Ollama models, start/stop the server, add logging, and **commit + push to the `add-local-web-server` branch** without checking in between steps.
- Make judgement calls autonomously and log non-trivial ones to `DECISIONS.md`. The only thing to pause for is obtaining a test image if none is provided.
- **Do not**: merge to `main` or open a PR (ask first), use any paid/cloud API, expose the server beyond localhost, or commit secrets/large files.
- Prior contents of the branch are intentional — do not delete unrelated files.

# What "good" looks like

A teammate opens this repo on the Air, runs `./web_server/setup_mac.sh` then `./web_server/run.sh`, and from a second terminal sends one Japanese page. Within a couple of minutes the server returns 200; `debug_out/01_blocks.png` has tight green boxes on every bubble, `02_inpainted.png` has the original text wiped clean, and the server log shows English strings that came back from a **local Ollama call** — no API key, no credits, no 501s. `web_server/qa/QA_REPORT.md` reads **PASS**, lists the four or five shim attributes that were needed, and notes the warm per-page time. The engine is proven; only the browser extension and the render step remain.
