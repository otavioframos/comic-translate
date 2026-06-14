# QA Report — Browser Extension Prototype

Date: 2026-06-13
Branch: `add-local-web-server`

## Summary

Added a Chromium Manifest V3 prototype in `browser_extension/`. It sends comic
images to the local `POST /translate` server and replaces the page image with
the translated PNG response.

## What Works

- Right-click an image and choose "Translate this image".
- Use the popup button to translate the largest visible image in the current tab.
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
- Replaces regular `<img>` elements only.
- Canvas-based readers and CSS-background image readers are not supported yet.
- Very large images may be slow because the server processes one image at a time.
- Some websites may block replacement images through page-level security policy;
  this should be tested on the target comic reader sites.
