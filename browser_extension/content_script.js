chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ct-ping") {
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "ct-translation-status") {
    markImage(message.srcUrl, "translating");
    showToast(message.status || "Translating image...");
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "ct-translation-complete") {
    replaceImage(message.srcUrl, message.dataUrl);
    showToast("Translation complete.");
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "ct-translation-error") {
    markImage(message.srcUrl, "error");
    showToast(message.error || "Translation failed.", true);
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "ct-viewport-status") {
    showToast(message.status || "Translating visible viewport...");
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "ct-viewport-complete") {
    showViewportOverlay(message.dataUrl);
    showToast("Viewport translation complete.");
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "ct-viewport-error") {
    showToast(message.error || "Viewport translation failed.", true);
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "ct-translate-largest") {
    const image = findLargestVisibleImage();
    if (!image) {
      showToast("No visible image found.", true);
      sendResponse({ ok: false, error: "No visible image found." });
      return false;
    }
    requestTranslation(image.currentSrc || image.src);
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

function requestTranslation(srcUrl) {
  showToast("Sending image to local server...");
  chrome.runtime.sendMessage({ type: "ct-translate-image", srcUrl }, (response) => {
    if (chrome.runtime.lastError) {
      showToast(chrome.runtime.lastError.message, true);
      return;
    }
    if (response && response.ok === false) {
      showToast(response.error || "Translation failed.", true);
    }
  });
}

function showViewportOverlay(dataUrl) {
  removeViewportOverlay();

  const overlay = document.createElement("div");
  overlay.id = "ct-viewport-overlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "2147483646";
  overlay.style.background = "#000";
  overlay.style.overflow = "hidden";

  const image = document.createElement("img");
  image.src = dataUrl;
  image.alt = "Translated viewport";
  image.style.width = "100vw";
  image.style.height = "100vh";
  image.style.objectFit = "fill";
  image.style.display = "block";

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.style.position = "fixed";
  close.style.top = "12px";
  close.style.right = "12px";
  close.style.zIndex = "2147483647";
  close.style.border = "0";
  close.style.borderRadius = "6px";
  close.style.padding = "8px 10px";
  close.style.background = "rgba(17, 24, 39, .9)";
  close.style.color = "#fff";
  close.style.font = "13px/1 system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  close.style.cursor = "pointer";
  close.addEventListener("click", removeViewportOverlay);

  overlay.append(image, close);
  document.documentElement.appendChild(overlay);
}

function removeViewportOverlay() {
  document.getElementById("ct-viewport-overlay")?.remove();
}

function replaceImage(srcUrl, dataUrl) {
  const image = findImageBySource(srcUrl);
  if (!image) {
    showToast("Translated image returned, but the source image was no longer visible.", true);
    return;
  }

  if (!image.dataset.ctOriginalSrc) {
    image.dataset.ctOriginalSrc = image.currentSrc || image.src;
  }
  image.dataset.ctTranslated = "true";
  image.style.outline = "2px solid #35c46f";
  image.style.outlineOffset = "2px";
  image.src = dataUrl;
  image.srcset = "";
}

function markImage(srcUrl, state) {
  const image = findImageBySource(srcUrl);
  if (!image) {
    return;
  }
  if (state === "translating") {
    image.style.outline = "2px solid #2f7cf6";
    image.style.outlineOffset = "2px";
  } else if (state === "error") {
    image.style.outline = "2px solid #d33";
    image.style.outlineOffset = "2px";
  }
}

function findImageBySource(srcUrl) {
  const images = Array.from(document.images);
  return images.find((image) => {
    const current = image.currentSrc || image.src;
    return current === srcUrl || image.src === srcUrl || image.dataset.ctOriginalSrc === srcUrl;
  });
}

function findLargestVisibleImage() {
  return Array.from(document.images)
    .filter((image) => {
      const rect = image.getBoundingClientRect();
      return rect.width >= 80 && rect.height >= 80 && rect.bottom > 0 && rect.right > 0
        && rect.top < window.innerHeight && rect.left < window.innerWidth;
    })
    .sort((a, b) => {
      const areaA = visibleArea(a.getBoundingClientRect());
      const areaB = visibleArea(b.getBoundingClientRect());
      return areaB - areaA;
    })[0] || null;
}

function visibleArea(rect) {
  const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
  const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
  return width * height;
}

function showToast(text, isError = false) {
  const id = "ct-local-toast";
  let toast = document.getElementById(id);
  if (!toast) {
    toast = document.createElement("div");
    toast.id = id;
    toast.style.position = "fixed";
    toast.style.zIndex = "2147483647";
    toast.style.right = "16px";
    toast.style.bottom = "16px";
    toast.style.maxWidth = "360px";
    toast.style.padding = "10px 12px";
    toast.style.borderRadius = "6px";
    toast.style.font = "13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    toast.style.boxShadow = "0 8px 24px rgba(0,0,0,.18)";
    document.documentElement.appendChild(toast);
  }
  toast.textContent = text;
  toast.style.background = isError ? "#b3261e" : "#1f2937";
  toast.style.color = "#fff";
  toast.style.display = "block";

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.style.display = "none";
  }, isError ? 8000 : 3500);
}
