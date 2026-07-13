const ISG_KATIP_URLS = [
  "https://*.isgkatip.csgb.gov.tr/*",
  "https://isgkatip.csgb.gov.tr/*",
];

function normalizeApiBase(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function apiUrl(apiBase, path) {
  const base = normalizeApiBase(apiBase);
  if (base.endsWith("/api")) return `${base}${path.replace(/^\/api/, "")}`;
  return `${base}${path}`;
}

async function readApiJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_error) {
    throw new Error(`API JSON donmedi. Cevap: ${text.slice(0, 160)}`);
  }
}

async function findIsgKatipTab() {
  const tabs = await chrome.tabs.query({ url: ISG_KATIP_URLS });
  return (
    tabs.find((tab) => tab.active && tab.url?.includes("isgkatip")) ||
    tabs.find((tab) => tab.url?.includes("isgkatip")) ||
    null
  );
}

async function sendIsgKatipMessage(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (_error) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
    return chrome.tabs.sendMessage(tabId, message);
  }
}

async function syncOpenIsgKatipPage({ apiBase, token }) {
  const normalizedApiBase = normalizeApiBase(apiBase);
  if (!normalizedApiBase || !token) {
    throw new Error("API adresi ve panel tokeni zorunlu.");
  }

  const tab = await findIsgKatipTab();
  if (!tab?.id) {
    throw new Error("Acik ISG-KATIP sekmesi bulunamadi. ISG-KATIP'e girip tekrar deneyin.");
  }

  const snapshot = await sendIsgKatipMessage(tab.id, { type: "READ_ISG_KATIP_ROWS" });
  if (!snapshot?.ok) {
    throw new Error(snapshot?.message || "ISG-KATIP sayfasi okunamadi.");
  }
  if (!snapshot.rows?.length) {
    throw new Error("Acik ISG-KATIP sayfasinda SGK sicil numarasi olan kayit okunamadi.");
  }

  const response = await fetch(apiUrl(normalizedApiBase, "/api/isg-katip/extension-sync"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      rows: snapshot.rows,
      source: {
        url: snapshot.url,
        title: snapshot.title,
        capturedAt: snapshot.capturedAt,
        pageGorevTuru: snapshot.pageGorevTuru,
      },
    }),
  });

  const data = await readApiJson(response);
  if (!response.ok) {
    throw new Error(data?.message || "Panel senkronizasyon kaydi basarisiz.");
  }

  return {
    ...data,
    scannedRows: snapshot.rows.length,
    tabUrl: tab.url,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "PANEL_ISG_KATIP_SYNC") return false;

  syncOpenIsgKatipPage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, message: error?.message || "Senkronizasyon basarisiz." }));

  return true;
});
