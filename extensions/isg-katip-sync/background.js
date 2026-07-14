const ISG_KATIP_URLS = [
  "https://*.isgkatip.csgb.gov.tr/*",
  "https://isgkatip.csgb.gov.tr/*",
];
const GOREV_TURLERI = ["is_guvenligi_uzmani", "isyeri_hekimi", "diger_saglik_personeli"];

function normalizeGorevTuru(value) {
  return GOREV_TURLERI.includes(value) ? value : "";
}

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

async function syncOpenIsgKatipPage({ apiBase, token, gorevTuru }) {
  const normalizedApiBase = normalizeApiBase(apiBase);
  const requestedGorevTuru = normalizeGorevTuru(gorevTuru);
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
  const rows = requestedGorevTuru
    ? (snapshot.rows || []).filter((row) => !row.gorevTuru || row.gorevTuru === requestedGorevTuru)
    : snapshot.rows || [];
  if (!rows.length) {
    throw new Error("Acik ISG-KATIP sayfasinda SGK sicil numarasi olan kayit okunamadi.");
  }

  const response = await fetch(apiUrl(normalizedApiBase, "/api/isg-katip/extension-sync"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      rows,
      source: {
        url: snapshot.url,
        title: snapshot.title,
        capturedAt: snapshot.capturedAt,
        pageGorevTuru: snapshot.pageGorevTuru,
        requestedGorevTuru,
      },
    }),
  });

  const data = await readApiJson(response);
  if (!response.ok) {
    throw new Error(data?.message || "Panel senkronizasyon kaydi basarisiz.");
  }

  return {
    ...data,
    scannedRows: rows.length,
    tabUrl: tab.url,
  };
}

async function panelFetchJson(apiBase, token, path, options = {}) {
  const response = await fetch(apiUrl(apiBase, path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await readApiJson(response);
  if (!response.ok) throw new Error(data?.message || "Panel API islemi basarisiz.");
  return data;
}

async function runNextIsgKatipJob({ apiBase, token, gorevTuru }) {
  const normalizedApiBase = normalizeApiBase(apiBase);
  if (!normalizedApiBase || !token) {
    throw new Error("API adresi ve panel tokeni zorunlu.");
  }

  const tab = await findIsgKatipTab();
  if (!tab?.id) {
    throw new Error("Acik ISG-KATIP sekmesi bulunamadi. ISG-KATIP'e girip tekrar deneyin.");
  }

  const query = gorevTuru ? `?gorevTuru=${encodeURIComponent(gorevTuru)}` : "";
  const nextData = await panelFetchJson(normalizedApiBase, token, `/api/isg-katip/jobs/next${query}`);
  if (!nextData?.job?.id) {
    return { message: "Bekleyen eklenti gorevi bulunamadi.", job: null };
  }

  const claimData = await panelFetchJson(normalizedApiBase, token, `/api/isg-katip/jobs/${nextData.job.id}/claim`, {
    method: "POST",
    body: JSON.stringify({ note: "Panelden otomatik baslatildi" }),
  });
  const job = claimData.job;
  const automation = await sendIsgKatipMessage(tab.id, {
    type: "AUTO_PREPARE_ISG_KATIP_JOB",
    job,
  });

  if (!automation?.ok) {
    await panelFetchJson(normalizedApiBase, token, `/api/isg-katip/jobs/${job.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "failed",
        error: automation?.message || "Eklenti atama otomasyonunu tamamlayamadi.",
      }),
    });
    throw new Error(automation?.message || "Eklenti atama otomasyonunu tamamlayamadi.");
  }

  const doneData = await panelFetchJson(normalizedApiBase, token, `/api/isg-katip/jobs/${job.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "done",
      note: "Eklenti ISG-KATIP atama islemini otomatik tamamladi",
    }),
  });

  return {
    job: doneData.job,
    automation,
    message: automation.message || "Atama otomatik tamamlandi.",
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "PANEL_ISG_KATIP_SYNC") return false;

  syncOpenIsgKatipPage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, message: error?.message || "Senkronizasyon basarisiz." }));

  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "PANEL_ISG_KATIP_RUN_NEXT_JOB") return false;

  runNextIsgKatipJob(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, message: error?.message || "Atama otomasyonu basarisiz." }));

  return true;
});
