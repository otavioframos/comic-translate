const DEFAULT_SETTINGS = {
  serverUrl: "http://127.0.0.1:8000",
  sourceLang: "Japanese",
  targetLang: "English"
};
const viewportJobs = new Set();

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ct-translate-image",
    title: "Translate this image",
    contexts: ["image"]
  });
  chrome.contextMenus.create({
    id: "ct-translate-viewport",
    title: "Translate visible viewport",
    contexts: ["page"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) {
    return;
  }
  if (info.menuItemId === "ct-translate-image" && info.srcUrl) {
    translateImage(tab.id, info.srcUrl);
  } else if (info.menuItemId === "ct-translate-viewport") {
    translateViewport(tab.id, tab.windowId);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ct-translate-image") {
    const tabId = sender.tab?.id ?? message.tabId;
    if (!tabId || !message.srcUrl) {
      sendResponse({ ok: false, error: "No image selected." });
      return false;
    }

    translateImage(tabId, message.srcUrl)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "ct-translate-viewport") {
    const tabId = sender.tab?.id ?? message.tabId;
    const windowId = sender.tab?.windowId ?? message.windowId;
    if (!tabId) {
      sendResponse({ ok: false, error: "No active tab." });
      return false;
    }

    translateViewport(tabId, windowId, { readingMode: Boolean(message.readingMode) })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "ct-start-reading-mode" || message?.type === "ct-stop-reading-mode") {
    const tabId = sender.tab?.id ?? message.tabId;
    if (!tabId) {
      sendResponse({ ok: false, error: "No active tab." });
      return false;
    }

    forwardToContentScript(tabId, { type: message.type })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function translateImage(tabId, srcUrl) {
  await ensureContentScript(tabId);
  await notifyTab(tabId, {
    type: "ct-translation-status",
    srcUrl,
    status: "Translating image..."
  });

  try {
    const settings = await getSettings();
    const inputBlob = await fetchImageBlob(srcUrl);
    const outputBlob = await postToLocalServer(inputBlob, srcUrl, settings);
    const dataUrl = await blobToDataUrl(outputBlob, "image/png");

    await notifyTab(tabId, {
      type: "ct-translation-complete",
      srcUrl,
      dataUrl
    });
  } catch (error) {
    await notifyTab(tabId, {
      type: "ct-translation-error",
      srcUrl,
      error: error.message
    });
    throw error;
  }
}

async function translateViewport(tabId, windowId, options = {}) {
  if (viewportJobs.has(tabId)) {
    return;
  }
  viewportJobs.add(tabId);
  try {
    const settings = await getSettings();
    await ensureContentScript(tabId);

    await notifyTab(tabId, {
      type: "ct-viewport-status",
      status: options.readingMode
        ? "Refreshing translated viewport..."
        : "Translating visible viewport..."
    });
    await notifyTab(tabId, { type: "ct-before-viewport-capture" });

    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
    const inputBlob = dataUrlToBlob(dataUrl);

    const outputBlob = await postToLocalServer(inputBlob, "viewport.png", settings);
    const translatedDataUrl = await blobToDataUrl(outputBlob, "image/png");

    await notifyTab(tabId, {
      type: "ct-viewport-complete",
      dataUrl: translatedDataUrl,
      readingMode: Boolean(options.readingMode)
    });
  } catch (error) {
    await notifyTab(tabId, {
      type: "ct-viewport-error",
      error: error.message
    });
    throw error;
  } finally {
    viewportJobs.delete(tabId);
  }
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "ct-ping" });
    return;
  } catch {
    // The content script is not present in tabs opened before extension reload.
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content_script.js"]
    });
  } catch {
    // Browser pages and some restricted pages cannot receive content scripts.
  }
}

async function forwardToContentScript(tabId, message) {
  await ensureContentScript(tabId);
  await chrome.tabs.sendMessage(tabId, message);
}

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    serverUrl: normalizeServerUrl(stored.serverUrl || DEFAULT_SETTINGS.serverUrl)
  };
}

function normalizeServerUrl(value) {
  return String(value || DEFAULT_SETTINGS.serverUrl).replace(/\/+$/, "");
}

async function fetchImageBlob(srcUrl) {
  const response = await fetch(srcUrl, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Could not read image: HTTP ${response.status}`);
  }
  return response.blob();
}

async function postToLocalServer(inputBlob, srcUrl, settings) {
  const form = new FormData();
  form.append("file", inputBlob, filenameFromUrl(srcUrl));
  form.append("src", settings.sourceLang);
  form.append("tgt", settings.targetLang);

  const response = await fetch(`${settings.serverUrl}/translate`, {
    method: "POST",
    body: form
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Local server failed: HTTP ${response.status}${text ? ` ${text}` : ""}`);
  }

  return response.blob();
}

function filenameFromUrl(srcUrl) {
  try {
    const url = new URL(srcUrl);
    const name = url.pathname.split("/").filter(Boolean).pop();
    return name || "comic-page.png";
  } catch {
    return "comic-page.png";
  }
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const contentType = header.match(/data:(.*?);base64/)?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: contentType });
}

async function blobToDataUrl(blob, fallbackType) {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return `data:${blob.type || fallbackType};base64,${btoa(binary)}`;
}

async function notifyTab(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // The tab may not have the content script, for example on browser pages.
  }
}
