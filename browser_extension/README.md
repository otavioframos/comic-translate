# Comic Translate Local Browser Extension

Chromium extension prototype for the local web server.

## Install

1. Start the local server from the repo root:

   ```bash
   ./web_server/run.sh
   ```

2. Open `chrome://extensions` in Chrome, Edge, or Brave.
3. Enable Developer mode.
4. Choose "Load unpacked".
5. Select this folder: `browser_extension/`.

## Use

- Right-click a comic image and choose "Translate this image".
- Or open the extension popup and choose "Translate Visible Image" to send the
  largest visible image on the current page.

The extension sends the image to `http://127.0.0.1:8000/translate` by default,
then replaces the page image with the translated PNG returned by the server.

## Notes

- The local server must already be running.
- Translation stays local through Ollama.
- The prototype replaces regular `<img>` elements. Canvas-based readers and
  sites that render pages as CSS backgrounds are not supported yet.
- Very large pages may take a while because the server processes one image at a
  time.
