const DEFAULT_SETTINGS = {
  serverUrl: "http://127.0.0.1:8000",
  sourceLang: "Japanese",
  targetLang: "English"
};

const els = {
  serverUrl: document.getElementById("serverUrl"),
  sourceLang: document.getElementById("sourceLang"),
  targetLang: document.getElementById("targetLang"),
  save: document.getElementById("save"),
  translateViewport: document.getElementById("translateViewport"),
  startReading: document.getElementById("startReading"),
  stopReading: document.getElementById("stopReading"),
  startPageSlices: document.getElementById("startPageSlices"),
  stopPageSlices: document.getElementById("stopPageSlices"),
  translateLargest: document.getElementById("translateLargest"),
  status: document.getElementById("status")
};

loadSettings();

els.save.addEventListener("click", async () => {
  await saveSettings();
  setStatus("Settings saved.");
});

els.translateLargest.addEventListener("click", async () => {
  await saveSettings();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("No active tab.", true);
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "ct-translate-largest" }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message, true);
      return;
    }
    if (response?.ok) {
      setStatus("Sent visible image to the local server.");
    } else {
      setStatus(response?.error || "No visible image found.", true);
    }
  });
});

els.translateViewport.addEventListener("click", async () => {
  await saveSettings();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("No active tab.", true);
    return;
  }

  chrome.runtime.sendMessage(
    { type: "ct-translate-viewport", tabId: tab.id, windowId: tab.windowId },
    (response) => {
      if (chrome.runtime.lastError) {
        setStatus(chrome.runtime.lastError.message, true);
        return;
      }
      if (response?.ok) {
        setStatus("Sent visible viewport to the local server.");
      } else {
        setStatus(response?.error || "Viewport translation failed.", true);
      }
    }
  );
});

els.startReading.addEventListener("click", async () => {
  await saveSettings();
  sendRuntimeTabMessage({ type: "ct-start-reading-mode" }, "Reading mode started.");
});

els.stopReading.addEventListener("click", async () => {
  sendRuntimeTabMessage({ type: "ct-stop-reading-mode" }, "Reading mode stopped.");
});

els.startPageSlices.addEventListener("click", async () => {
  await saveSettings();
  sendRuntimeTabMessage({ type: "ct-start-page-slice-mode" }, "Whole page slice mode started.");
});

els.stopPageSlices.addEventListener("click", async () => {
  sendRuntimeTabMessage({ type: "ct-stop-page-slice-mode" }, "Whole page slice mode stopped.");
});

async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  els.serverUrl.value = settings.serverUrl;
  els.sourceLang.value = settings.sourceLang;
  els.targetLang.value = settings.targetLang;
}

async function saveSettings() {
  await chrome.storage.sync.set({
    serverUrl: els.serverUrl.value.replace(/\/+$/, "") || DEFAULT_SETTINGS.serverUrl,
    sourceLang: els.sourceLang.value,
    targetLang: els.targetLang.value
  });
}

function setStatus(text, isError = false) {
  els.status.textContent = text;
  els.status.style.color = isError ? "#b3261e" : "#475569";
}

async function sendRuntimeTabMessage(message, successText) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("No active tab.", true);
    return;
  }

  chrome.runtime.sendMessage({ ...message, tabId: tab.id }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message, true);
      return;
    }
    if (response?.ok) {
      setStatus(successText);
    } else {
      setStatus(response?.error || "Action failed.", true);
    }
  });
}
