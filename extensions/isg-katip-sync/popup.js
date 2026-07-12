const apiBaseInput = document.getElementById("apiBase");
const tokenInput = document.getElementById("token");
const syncBtn = document.getElementById("syncBtn");
const statusEl = document.getElementById("status");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#be123c" : "#047857";
}

function normalizeApiBase(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function readActiveIsgKatipPage(tab) {
  try {
    return await chrome.tabs.sendMessage(tab.id, { type: "READ_ISG_KATIP_ROWS" });
  } catch (_error) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    return chrome.tabs.sendMessage(tab.id, { type: "READ_ISG_KATIP_ROWS" });
  }
}

function roleSummary(rows) {
  const labels = {
    is_guvenligi_uzmani: "Uzman",
    isyeri_hekimi: "Hekim",
    diger_saglik_personeli: "DSP",
  };
  const counts = rows.reduce((acc, row) => {
    const key = row.gorevTuru || "is_guvenligi_uzmani";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([key, count]) => `${labels[key] || key}: ${count}`)
    .join(", ");
}

chrome.storage.local.get(["apiBase", "token"], (stored) => {
  if (stored.apiBase) apiBaseInput.value = stored.apiBase;
  if (stored.token) tokenInput.value = stored.token;
});

syncBtn.addEventListener("click", async () => {
  const apiBase = normalizeApiBase(apiBaseInput.value);
  const token = tokenInput.value.trim();

  if (!apiBase || !token) {
    setStatus("API adresi ve panel tokenı zorunlu.", true);
    return;
  }

  syncBtn.disabled = true;
  setStatus("İSG-KATİP sayfası okunuyor...");

  try {
    await chrome.storage.local.set({ apiBase, token });
    const tab = await getActiveTab();

    if (!tab?.url || !tab.url.includes("isgkatip")) {
      throw new Error("Önce açık İSG-KATİP sekmesine geçin.");
    }

    const response = await readActiveIsgKatipPage(tab);

    if (!response?.ok) throw new Error(response?.message || "Sayfa okunamadı");
    if (!response.rows?.length) throw new Error("Bu sayfada SGK sicil numarası bulunan kayıt okunamadı.");

    setStatus(`${response.rows.length} kayıt panele gönderiliyor...\n${roleSummary(response.rows)}`);

    const syncResponse = await fetch(`${apiBase}/api/isg-katip/extension-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        rows: response.rows,
        source: {
          url: response.url,
          title: response.title,
          capturedAt: response.capturedAt,
          pageGorevTuru: response.pageGorevTuru,
        },
      }),
    });

    const data = await syncResponse.json();
    if (!syncResponse.ok) throw new Error(data?.message || "Panel kaydı başarısız");

    setStatus(
      `Tamamlandı.\nOkunan: ${data.received || 0}\nEşleşen: ${data.matched || 0}\nEşleşmeyen: ${data.unmatched || 0}`
    );
  } catch (error) {
    setStatus(error?.message || "Senkronizasyon başarısız.", true);
  } finally {
    syncBtn.disabled = false;
  }
});
