# Comic-Translate — Local Web Server (Step 1)

A small headless server that runs the comic-translate **pipeline without the GUI**
and translates pages **for free** using a local Ollama model (no API key, no
credits, nothing leaves the machine). This is the engine a browser extension
will later call so you can read in-browser while paying $0 per page.

## Where this goes
Copy the whole `web_server/` folder **into your comic-translate fork**, next to
`pipeline/` and `controller.py`:

```
comic-translate/
├── controller.py
├── comic.py
├── pipeline/
│   └── main_pipeline.py
└── web_server/          <-- this folder
    ├── server.py
    ├── headless_main_page.py
    ├── ollama_translator.py
    ├── config.py
    ├── discover_main_page_attrs.py
    ├── test_pipeline.py
    ├── setup_mac.sh
    ├── run.sh
    ├── .env.example
    ├── requirements-webserver.txt
    ├── TEST_CHECKLIST.md
    └── README.md
```

## Quick start (on the Mac)
```bash
cd /path/to/comic-translate
chmod +x web_server/*.sh          # first time only
./web_server/setup_mac.sh         # one-time install
./web_server/run.sh               # start the server
# then follow web_server/TEST_CHECKLIST.md
```

## What each file does
| File | Role |
|------|------|
| `server.py` | The web server. One endpoint: `POST /translate` (image in → image out). |
| `headless_main_page.py` | **The one file you finish by hand.** Fakes the GUI window so the pipeline runs headless. |
| `ollama_translator.py` | Free local translation via Ollama (replaces paid GPT/Claude/Gemini). |
| `config.py` | Reads all settings from `.env`. |
| `discover_main_page_attrs.py` | Lists every `main_page.*` the real code needs → tells you what the shim must provide. |
| `test_pipeline.py` | Sends one image to the server and saves the result (the acceptance test). |
| `setup_mac.sh` / `run.sh` | One-time setup, and start the server. |
| `.env` | The only file you edit to change model/languages/port. |

## The single config you change between machines
In `.env`, the line `OLLAMA_MODEL`:
- **MacBook Air (test):** `qwen2.5:7b`
- **iMac 24 GB (production):** `qwen2.5:14b` (or `:32b` for top quality)

No code changes — same files run on both machines.

## Honesty about what's stubbed
This is **Step 1**: the pipeline runs end-to-end *except* the final "draw the
translation back onto the page" (render) step, which returns the inpainted image
as a placeholder. Detection, OCR and translation are real. Every spot that calls
into the comic-translate codebase is marked `(VERIFY)` because exact method names
can differ by fork — confirm them with `discover_main_page_attrs.py`.

## Languages
- **Japanese** → manga-ocr (clean install) ✅
- **Korean** → Pororo (validate install early)
- **Chinese** → PaddleOCR (the fiddly one — add only when you actually need it)

## After Step 1 passes
1. Wire the real **render** step in `server.py:_render()`.
2. Build the **browser extension** (capture page image → POST here → overlay).
3. Package as a **menu-bar app + launchd auto-start** for the end user.
