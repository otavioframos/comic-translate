(() => {
  if (window.__ctLocalContentScriptLoaded) {
    return;
  }
  window.__ctLocalContentScriptLoaded = true;

  const state = {
    readingMode: false,
    refreshTimer: null,
    pendingRefresh: false
  };

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

    if (message?.type === "ct-before-viewport-capture") {
      hideViewportOverlayForCapture();
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "ct-viewport-status") {
      state.pendingRefresh = true;
      showReadingToolbar(message.status || "Translating visible viewport...");
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "ct-viewport-complete") {
      state.pendingRefresh = false;
      state.readingMode = Boolean(message.readingMode || state.readingMode);
      showViewportOverlay(message.dataUrl);
      showReadingToolbar(state.readingMode ? "Reading mode active" : "Viewport translated");
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "ct-viewport-error") {
      state.pendingRefresh = false;
      showReadingToolbar("Translation failed");
      showToast(message.error || "Viewport translation failed.", true);
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "ct-start-reading-mode") {
      state.readingMode = true;
      showReadingToolbar("Reading mode starting...");
      requestViewportTranslation(true);
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "ct-stop-reading-mode") {
      stopReadingMode();
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "ct-page-slice-start") {
      startPageSliceOverlay(message);
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "ct-page-slice-status") {
      showPageSliceToolbar(message.status || "Translating page slices...");
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "ct-page-slice-complete") {
      addPageSlice(message);
      showPageSliceToolbar(`Loaded ${message.index + 1} of ${message.total} slices`);
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "ct-page-slice-error") {
      showPageSliceToolbar("Whole-page translation failed");
      showToast(message.error || "Whole-page translation failed.", true);
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "ct-page-slice-stop") {
      stopPageSliceMode();
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

  window.addEventListener("scroll", scheduleReadingRefresh, { passive: true });
  window.addEventListener("resize", scheduleReadingRefresh, { passive: true });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      stopReadingMode();
      stopPageSliceMode();
    }
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

  function requestViewportTranslation(readingMode = false) {
    if (state.pendingRefresh) {
      return;
    }
    state.pendingRefresh = true;
    chrome.runtime.sendMessage(
      { type: "ct-translate-viewport", readingMode },
      (response) => {
        if (chrome.runtime.lastError) {
          state.pendingRefresh = false;
          showReadingToolbar("Translation failed");
          showToast(chrome.runtime.lastError.message, true);
          return;
        }
        if (response && response.ok === false) {
          state.pendingRefresh = false;
          showReadingToolbar("Translation failed");
          showToast(response.error || "Translation failed.", true);
        }
      }
    );
  }

  function scheduleReadingRefresh() {
    if (!state.readingMode) {
      removeViewportOverlay();
      return;
    }
    removeViewportOverlay();
    showReadingToolbar("Waiting for scroll to settle...");
    clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(() => {
      requestViewportTranslation(true);
    }, 900);
  }

  function showViewportOverlay(dataUrl) {
    removeViewportOverlay();

    const overlay = document.createElement("div");
    overlay.id = "ct-viewport-overlay";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "2147483645";
    overlay.style.pointerEvents = "none";
    overlay.style.overflow = "hidden";

    const image = document.createElement("img");
    image.src = dataUrl;
    image.alt = "Translated viewport";
    image.style.width = "100vw";
    image.style.height = "100vh";
    image.style.objectFit = "fill";
    image.style.display = "block";
    image.style.pointerEvents = "none";

    overlay.append(image);
    document.documentElement.appendChild(overlay);
  }

  function hideViewportOverlayForCapture() {
    const overlay = document.getElementById("ct-viewport-overlay");
    if (overlay) {
      overlay.style.display = "none";
    }
    const toolbar = document.getElementById("ct-reading-toolbar");
    if (toolbar) {
      toolbar.style.display = "none";
    }
  }

  function removeViewportOverlay() {
    document.getElementById("ct-viewport-overlay")?.remove();
  }

  function showReadingToolbar(text) {
    let toolbar = document.getElementById("ct-reading-toolbar");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.id = "ct-reading-toolbar";
      toolbar.style.position = "fixed";
      toolbar.style.right = "12px";
      toolbar.style.top = "12px";
      toolbar.style.zIndex = "2147483647";
      toolbar.style.display = "flex";
      toolbar.style.alignItems = "center";
      toolbar.style.gap = "8px";
      toolbar.style.padding = "8px 10px";
      toolbar.style.borderRadius = "6px";
      toolbar.style.background = "rgba(17, 24, 39, .9)";
      toolbar.style.color = "#fff";
      toolbar.style.font = "13px/1 system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      toolbar.style.boxShadow = "0 8px 24px rgba(0,0,0,.2)";

      const label = document.createElement("span");
      label.dataset.role = "label";

      const refresh = document.createElement("button");
      refresh.type = "button";
      refresh.textContent = "Refresh";
      refresh.style.border = "0";
      refresh.style.borderRadius = "4px";
      refresh.style.padding = "5px 7px";
      refresh.style.background = "#eef2f7";
      refresh.style.color = "#111827";
      refresh.style.cursor = "pointer";
      refresh.addEventListener("click", () => requestViewportTranslation(state.readingMode));

      const stop = document.createElement("button");
      stop.type = "button";
      stop.textContent = "Stop";
      stop.style.border = "0";
      stop.style.borderRadius = "4px";
      stop.style.padding = "5px 7px";
      stop.style.background = "#ef4444";
      stop.style.color = "#fff";
      stop.style.cursor = "pointer";
      stop.addEventListener("click", () => stopReadingMode());

      toolbar.append(label, refresh, stop);
      document.documentElement.appendChild(toolbar);
    }

    toolbar.style.display = "flex";
    toolbar.querySelector("[data-role='label']").textContent = text;
  }

  function stopReadingMode(silent = false) {
    state.readingMode = false;
    state.pendingRefresh = false;
    clearTimeout(state.refreshTimer);
    removeViewportOverlay();
    document.getElementById("ct-reading-toolbar")?.remove();
    if (!silent) {
      showToast("Reading mode stopped.");
    }
  }

  function startPageSliceOverlay({ width, height, total }) {
    stopReadingMode(true);
    removePageSliceOverlay();

    const overlay = document.createElement("div");
    overlay.id = "ct-page-slice-overlay";
    overlay.style.position = "absolute";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;
    overlay.style.minHeight = `${height}px`;
    overlay.style.zIndex = "2147483644";
    overlay.style.pointerEvents = "none";
    overlay.style.overflow = "hidden";

    document.documentElement.appendChild(overlay);
    showPageSliceToolbar(`Preparing ${total} slices...`);
  }

  function addPageSlice({ dataUrl, y, width, height }) {
    const overlay = document.getElementById("ct-page-slice-overlay");
    if (!overlay) {
      return;
    }

    const slice = document.createElement("img");
    slice.src = dataUrl;
    slice.alt = "Translated page slice";
    slice.style.position = "absolute";
    slice.style.left = "0";
    slice.style.top = `${y}px`;
    slice.style.width = `${width}px`;
    slice.style.height = `${height}px`;
    slice.style.display = "block";
    slice.style.objectFit = "fill";
    slice.style.pointerEvents = "none";
    overlay.appendChild(slice);
  }

  function showPageSliceToolbar(text) {
    let toolbar = document.getElementById("ct-page-slice-toolbar");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.id = "ct-page-slice-toolbar";
      toolbar.style.position = "fixed";
      toolbar.style.left = "12px";
      toolbar.style.top = "12px";
      toolbar.style.zIndex = "2147483647";
      toolbar.style.display = "flex";
      toolbar.style.alignItems = "center";
      toolbar.style.gap = "8px";
      toolbar.style.padding = "8px 10px";
      toolbar.style.borderRadius = "6px";
      toolbar.style.background = "rgba(17, 24, 39, .9)";
      toolbar.style.color = "#fff";
      toolbar.style.font = "13px/1 system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      toolbar.style.boxShadow = "0 8px 24px rgba(0,0,0,.2)";

      const label = document.createElement("span");
      label.dataset.role = "label";

      const stop = document.createElement("button");
      stop.type = "button";
      stop.textContent = "Stop";
      stop.style.border = "0";
      stop.style.borderRadius = "4px";
      stop.style.padding = "5px 7px";
      stop.style.background = "#ef4444";
      stop.style.color = "#fff";
      stop.style.cursor = "pointer";
      stop.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "ct-stop-page-slice-mode" });
        stopPageSliceMode();
      });

      toolbar.append(label, stop);
      document.documentElement.appendChild(toolbar);
    }

    toolbar.style.display = "flex";
    toolbar.querySelector("[data-role='label']").textContent = text;
  }

  function stopPageSliceMode() {
    removePageSliceOverlay();
    document.getElementById("ct-page-slice-toolbar")?.remove();
    showToast("Whole-page slice mode stopped.");
  }

  function removePageSliceOverlay() {
    document.getElementById("ct-page-slice-overlay")?.remove();
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

  function markImage(srcUrl, imageState) {
    const image = findImageBySource(srcUrl);
    if (!image) {
      return;
    }
    if (imageState === "translating") {
      image.style.outline = "2px solid #2f7cf6";
      image.style.outlineOffset = "2px";
    } else if (imageState === "error") {
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
})();
