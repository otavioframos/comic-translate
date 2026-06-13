# QA Report — Local Web Server Step 1

Date: 2026-06-13
Branch: `add-local-web-server`
Host: MacBook Air, Apple Silicon
Model: `qwen2.5:7b` via local Ollama

## Summary

Step 1 is functionally passing for the supplied Japanese and Korean samples: the server boots, `/health` returns OK, page POSTs return HTTP 200, detection finds text blocks, OCR produces non-empty source text, Ollama returns non-empty translations, and inpainting returns cleaned images. The render step remains intentionally stubbed.

The first Desktop file named `korean sample.jpg` exercised the Korean route but was not a strong Korean-language quality sample. The replacement Desktop file `korean sample.webp` is a stronger Korean sample and passed the same detection, OCR, translation, and inpainting path.

## Acceptance Criteria

1. PASS — Checked out on `add-local-web-server` and worked from repo root `/Users/otavioramos/Documents/Pessoal/comic-translate`.
2. PASS — `web_server/setup_mac.sh` completed. Created Python 3.12 `.venv`, installed `requirements.txt` and `web_server/requirements-webserver.txt`, installed Ollama with Homebrew, started Ollama for setup, and pulled `qwen2.5:7b`.
3. PASS — `./web_server/run.sh` starts the server. `curl http://127.0.0.1:8000/health` returned `{"status":"ok","model":"qwen2.5:7b",...}`.
4. PASS — `/Users/otavioramos/Desktop/japanese sample.jpg` sent with `Japanese English` returned HTTP 200 and wrote `translated_japanese sample.jpg`.
5. PASS — `web_server/debug_out/01_blocks.png` showed green boxes over the visible Japanese text bubbles/regions.
6. PASS — Server log showed non-empty OCR text for Japanese: `フロントはもらったぜ`, `鉄雄！`, `あの野郎`, `たまにはろうわる側にならねーとな`, `ならねーよ`.
7. PASS — Server log showed local Ollama translations from `qwen2.5:7b`, e.g. `Got the front, alright.`, `That bastard!`, `You gotta play the bad guy every once in a while.`
8. PASS WITH NOTE — `02_inpainted.png` erased the detected text regions. Japanese output had a small residual mark in one right-side bubble, but the original text was materially removed.
9. PASS — No `Shim incomplete` / HTTP 501 errors remain in tested paths.
10. PASS — Wrong or incomplete `(VERIFY)` assumptions were corrected in `server.py` and `headless_main_page.py`.
11. PASS — `/Users/otavioramos/Desktop/korean sample.webp` sent with `Korean English` returned HTTP 200. It produced Korean OCR text and non-empty English translations for all detected blocks.
12. PASS — This report exists.
13. PASS — `PROGRESS.md` updated.
14. PASS — Code changes committed and pushed. No `.env`, `debug_out/`, `.venv/`, downloaded models, or generated translated images are included.

## Runs And Latency

- Cold setup/model path: `setup_mac.sh` pulled Ollama `qwen2.5:7b`; first synthetic Japanese run was 115.67s and included first-time detection/OCR downloads.
- Japanese real sample first run after model downloads: 25.80s.
- Japanese real sample warm run: 16.08s.
- First Korean-named sample first run: 54.59s, including first-time Korean PPOCR and AOT inpainting downloads.
- First Korean-named sample warm run: 20.94s.
- Replacement Korean WebP sample run: 42.24s.

## Shim Attributes Added

Added or completed in `web_server/headless_main_page.py`:

- `settings_page.ui.tr`
- `settings_page.is_gpu_enabled`
- `settings_page.get_hd_strategy_settings`
- `settings_page.get_llm_settings()["extra_context"]`
- `settings_page.get_tool_selection("inpainter")`
- `image_viewer.empty`
- `image_viewer.rectangles`
- `image_viewer.selected_rect`
- `image_viewer.hasPhoto`
- `image_viewer.clear_rectangles`
- `image_viewer.clear_rectangles_in_visible_area`
- `image_viewer.add_rectangle`
- `image_viewer.select_rectangle`
- `image_viewer.sync_rectangles_from_blocks`
- `image_viewer.get_mask_for_inpainting`
- `image_viewer.clear_brush_strokes`
- `pipeline`
- `image_skipped`
- `file_handler`
- `progress_update`
- `patches_processed`
- `blk_rendered`
- `render_state_ready`
- `undo_group`
- `rect_item_ctrl`
- `image_ctrl`
- `webtoon_mode`
- `button_to_alignment`
- `apply_inpaint_patches`
- `connect_rect_item_signals`
- `set_tool`
- `render_settings`

## VERIFY Corrections

- `ComicTranslatePipeline` import path verified as `from pipeline.main_pipeline import ComicTranslatePipeline`; no change needed.
- `detect_blocks()` verified to return a result tuple rather than directly populating `main_page.blk_list` in this synchronous server path. Server now calls `p.detect_blocks(load_rects=False)` followed by `p.on_blk_detect_complete(...)`.
- OCR precondition verified: `OCR_image()` requires `image_viewer.rectangles` to be truthy. Server now syncs rectangle placeholders from detected blocks before OCR.
- Block text attribute verified as `.text`.
- Block translation attribute verified as `.translation`.
- Box attributes verified as `.bubble_xyxy` and `.xyxy`; debug drawing now prefers `bubble_xyxy` without NumPy truth-value errors.
- `inpaint()` verified to return patches instead of mutating the image directly. The shim now applies returned patches to the current image.
- Render intentionally remains stubbed and returns the inpainted image.
- Uploaded grayscale images are normalized to RGB before detection.
- Server uses repo-native `imkit` decode/encode/write helpers instead of an undeclared `cv2` dependency.
- `setup_mac.sh` now enforces Python 3.12 and starts Ollama before `ollama pull`.

## Evidence Snippets

Japanese sample:

```text
[detect] blocks=5
[ocr] 1: 'フロントはもらったぜ'
[ocr] 2: '鉄雄！'
[ocr] 3: 'あの野郎'
[ocr] 4: 'たまにはろうわる側にならねーとな'
[ocr] 5: 'ならねーよ'
[ollama:qwen2.5:7b] 1: 'Got the front, alright.'
[ollama:qwen2.5:7b] 2: 'Ishigoura!'
[ollama:qwen2.5:7b] 3: 'That bastard!'
[ollama:qwen2.5:7b] 4: 'You gotta play the bad guy every once in a while.'
[ollama:qwen2.5:7b] 5: "I ain't playing that."
[inpaint] patches=5
```

Replacement Korean sample:

```text
[detect] blocks=4
[ocr] 1: "가볍게 그리고'과거에'는 무슨 말이야?"
[ocr] 2: '대학 갈돈 없어. 이 얘기는 이미 몇 번이나 했잖아-'
[ocr] 3: '대단한 일이야, 히로! 내가 년*대성할* 우명이라고늘 말해장아!'
[ocr] 4: '-뭐? 무슨 새 월급?'
[ollama:qwen2.5:7b] 1: "Gently and 'past'—what are you talking about?"
[ollama:qwen2.5:7b] 2: "I don't have money for college. I've already told this story a few times-"
[ollama:qwen2.5:7b] 3: "It's huge, Hiro! My name is Won-myeong, the one who will become an adult!"
[ollama:qwen2.5:7b] 4: '-What? A new paycheck?'
[inpaint] patches=4
```

Visual note: `01_blocks.png` put green boxes over the Korean speech regions. `02_inpainted.png` cleared the main text areas, with faint residual characters still visible at the bottom edge of one lower bubble.

## Files Touched

- `web_server/server.py`
- `web_server/headless_main_page.py`
- `web_server/setup_mac.sh`
- `web_server/run.sh` mode made executable
- `web_server/.gitignore`
- `web_server/qa/QA_REPORT.md`
- `web_server/qa/PROGRESS.md`
- `web_server/qa/DECISIONS.md`
