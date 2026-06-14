const DEFAULT_SETTINGS = {
  serverUrl: "http://127.0.0.1:8000",
  sourceLang: "Japanese",
  targetLang: "English"
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ct-translate-image",
    title: "Translate this image",
    contexts: ["image"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "ct-translate-image" || !tab?.id || !info.srcUrl) {
    return;
  }
  translateImage(tab.id, info.srcUrl);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "ct-translate-image") {
    return false;
  }

  const tabId = sender.tab?.id ?? message.tabId;
  if (!tabId || !message.srcUrl) {
    sendResponse({ ok: false, error: "No image selected." });
    return false;
  }

  translateImage(tabId, message.srcUrl)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

async function translateImage(tabId, srcUrl) {
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
