# Test Checklist — Comic-Translate Local Server (Step 1)

This guide takes you from nothing to **"I sent a comic page and got a translated
image back."** No coding needed for the main path. Follow it top to bottom and
tick each box.

> **What you are testing:** the *engine* — find text, read it, translate it for
> free with Ollama, erase the original. The browser part comes later. If this
> works, the hard 80% is done.

---

## Part A — Before you start (one time)

You need:

- [ ] A Mac with **Apple Silicon** (M1/M2/M3/M4).
      Check:  menu → **About This Mac** → "Chip" should say *Apple M…*.
- [ ] The **comic-translate project folder** already on the Mac
      (the folder that contains `pipeline` and `controller.py`).
- [ ] This `web_server` folder copied **inside** that project folder.
- [ ] **Ollama** installed — the free translator. If you don't have it:
      download from **https://ollama.com/download**, install like any app.
- [ ] One **test comic page** saved as a `.png` or `.jpg` (Japanese or Korean).
      Save it somewhere easy, e.g. your Desktop, as `page.png`.

How to open **Terminal** (you'll type a few commands there):
press **⌘ (Command) + Space**, type `Terminal`, press **Return**.

---

## Part B — One-time setup

1. In Terminal, go into the project folder. Type `cd ` (with a space), then drag
   the project folder from Finder onto the Terminal window, then press Return:
   ```
   cd /path/to/comic-translate
   ```
   - [ ] Done. (If you type `ls` and see `pipeline` and `controller.py`, you're
     in the right place.)

2. Run the setup script:
   ```
   ./web_server/setup_mac.sh
   ```
   - [ ] It finishes with **"Setup complete."**
   - If it stops asking you to install Ollama, install it, then run this again.
   - This downloads a few GB the first time — that's normal.

---

## Part C — Start the server

1. Run:
   ```
   ./web_server/run.sh
   ```
2. Watch for these two lines:
   - [ ] `Comic-Translate server -> http://127.0.0.1:8000`
   - [ ] `[warm] pipeline ready in … (translator = Ollama:qwen2.5:7b)`

   **Leave this window open.** The server runs here. To stop it later: press
   **Ctrl + C** in this window.

3. Quick "is it alive?" check — open a **new** Terminal window
   (⌘+Space → Terminal) and type:
   ```
   curl http://127.0.0.1:8000/health
   ```
   - [ ] You see something like `{"status":"ok","model":"qwen2.5:7b",...}`

---

## Part D — Run the translation test

In the **new** Terminal window (not the one running the server):

1. Go to the project folder again (`cd …` like in Part B).
2. Send your test page (replace the path with your real file):
   ```
   ./.venv/bin/python web_server/test_pipeline.py ~/Desktop/page.png Japanese English
   ```
   - For Korean:  end the line with `Korean English`
   - For Chinese: end the line with `Chinese English`

3. Watch the output:
   - [ ] `server: {...}` — it found the server.
   - [ ] `sending … (Japanese -> English) ...`
   - [ ] `OK  ->  saved translated_page.png`

---

## Part E — What success looks like  ✅

Open the files and check, in order. Each lives in `web_server/debug_out/`:

| File | What you should see | Proves |
|------|--------------------|--------|
| `00_input.png` | your original page | image arrived |
| `01_blocks.png` | **green boxes around each speech bubble** | text **detection** works |
| `02_inpainted.png` | the page with **original text erased** | **inpainting** works |
| `translated_page.png` | the result the server returned | full round-trip works |

And in the server window:
- [ ] No red error text appeared.

> **Note for Step 1:** the translated text may **not be drawn back onto the
> page yet** — the "render" step is wired in the next pass. That's expected.
> If you see green boxes on the right bubbles and the original text erased,
> **detection + OCR + translation are working** — Step 1 has passed.

To confirm the **translation itself** is happening, look at the server window
while a page runs, or add your test page and watch Ollama get called. You can
also test Ollama alone:
```
ollama run qwen2.5:7b "Translate to English: こんにちは"
```
- [ ] It replies "Hello" (or similar). Translator is alive and free.

---

## Part F — The "gold standard" comparison (optional but powerful)

The original **desktop app already produces correct results** — use it as truth:

1. Open the same `page.png` in the normal comic-translate desktop app, translate
   it there, and save the result.
2. Compare it with your `translated_page.png`.
   - [ ] Same bubbles detected? Same text erased? Similar translation?

If they match, your server is faithfully doing what the real app does — just
without the window. That's the strongest possible pass.

---

## Part G — If something goes wrong

| What you see | What it means | What to do |
|--------------|---------------|-----------|
| `command not found: ./web_server/setup_mac.sh` | scripts aren't executable | run `chmod +x web_server/*.sh` once, then retry |
| Stops asking to **install Ollama** | translator missing | install from ollama.com/download, run setup again |
| `the server is not answering on port 8000` | server not running | go to the server window; is it still open? rerun `./web_server/run.sh` |
| Server window shows **`Shim incomplete: … no attribute 'X'`** | the GUI stand-in needs one more field | see **Appendix** below (this is the expected Step-1 dev loop) |
| `web_server/debug_out` is empty | debug is off | open `web_server/.env`, set `CT_DEBUG=true`, restart the server |
| Very slow on the **MacBook Air** | fanless throttling + small model | normal; the iMac will be faster. For now use the small `qwen2.5:7b` |
| Out of memory | model too big for this Mac | in `web_server/.env` set `OLLAMA_MODEL=qwen2.5:7b` (smaller) |

---

## Appendix — Finishing the "shim" (the one technical loop)

`HeadlessMainPage` (in `web_server/headless_main_page.py`) pretends to be the
app's window so the pipeline runs without it. It may be missing an attribute the
pipeline wants. Each time, the server tells you exactly which one:

```
Shim incomplete: 'HeadlessMainPage' object has no attribute 'XYZ'
```

Fix loop:

1. See which attribute name `XYZ` is in the error.
2. List every attribute the real code uses (run from the project folder):
   ```
   ./.venv/bin/python web_server/discover_main_page_attrs.py
   ```
   This prints each `main_page.something` and the file that uses it.
3. Open `web_server/headless_main_page.py` and add `XYZ`, copying how
   `controller.py` sets it up.
4. Restart the server (`Ctrl+C`, then `./web_server/run.sh`) and test again.
5. Repeat until `translated_page.png` comes back. Usually only a handful of
   attributes are needed.

When the boxes are right and the text is erased, **Step 1 is complete** and you
move on to wiring the render step and then the browser extension.
