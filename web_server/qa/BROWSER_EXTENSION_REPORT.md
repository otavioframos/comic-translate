# QA Report — Browser Extension Prototype

Date: 2026-06-13
Branch: `add-local-web-server`

## Summary

Added a Chromium Manifest V3 prototype in `browser_extension/`. It sends comic
images to the local `POST /translate` server and replaces the page image with
the translated PNG response. It also includes viewport capture for canvas,
CSS-background, and protected reader pages.

## What Works

- Right-click an image and choose "Translate this image".
- Use the popup button to translate the largest visible image in the current tab.
- Use "Translate Viewport" to capture the visible browser area, translate that
  screenshot, and overlay the translated result on top of the page.
- Use "Start Reading Mode" for a click-through translated overlay that refreshes
  after scrolling stops.
- Use "Start Whole Page Slices" to capture viewport-sized document slices
  without scrolling the live page, translate the current slice first, and fill
  nearby slices as they complete.
- Configure local server URL, source language, and target language in the popup.
- Defaults to `http://127.0.0.1:8000`, `Japanese` to `English`.
- Uses the local server only; no cloud translator or API key is introduced.

## Validation

- `node --check` passed for:
  - `browser_extension/background.js`
  - `browser_extension/content_script.js`
  - `browser_extension/popup.js`
- `python3 -m json.tool browser_extension/manifest.json` passed.
- Google Chrome successfully packaged the extension with `--pack-extension`,
  which validates the Manifest V3 structure. Generated `.crx` and `.pem`
  artifacts were deleted and are ignored by git.

## Known Limitations

- Requires the local server to be running first.
- Whole Page Slices depends on Chrome's `debugger` permission and may show a
  debugging warning while active.
- Earlier whole-page slice overlays used a document-height absolute layer; on
  some readers that can interfere with normal scrolling even when pointer events
  are disabled. The overlay is now fixed to the viewport and slices are
  repositioned as the page scrolls so it does not mutate document layout.
- Slice overlays assume normal document scrolling and may need site-specific
  alignment work for readers with nested scroll containers.
- Very large images may be slow because the server processes one image at a time.
- Some protected sites may still block browser-level capture or overlays; this
  should be tested on the target comic reader sites.
