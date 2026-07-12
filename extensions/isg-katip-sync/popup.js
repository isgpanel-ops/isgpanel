const apiBaseInput = document.getElementById("apiBase");
const tokenInput = document.getElementById("token");
const detectPanelBtn = document.getElementById("detectPanelBtn");
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

async function readPanelToken(tab) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const directKeys = ["token", "isgpanelToken", "authToken", "accessToken", "jwt"];
      const readDirect = (storage) => {
        for (const key of directKeys) {
          const value = storage.getItem(key);
          if (value) return value;
        }
        return "";
      };
      const readNamespaced = (storage) => {
        for (let i = 0; i < storage.length; i += 1) {
          const key = storage.key(i);
          if (!key) continue;
          if (key.endsWith(":token") || key.endsWith(":authToken") || key.endsWith(":accessToken")) {
            const value = storage.getItem(key);
            if (value) return value;
          }
        }
        return "";
      };

      return (
        readDirect(window.sessionStorage) ||
        readDirect(window.localStorage) ||
        readNamespaced(window.sessionStorage) ||
        readNamespaced(window.localStorage)
      );
    },
  });

  return String(result?.result || "").trim();
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

detectPanelBtn.addEventListener("click", async () => {
  detectPanelBtn.disabled = true;
  setStatus("Panel oturumu aranıyor...");

  try {
    const tab = await getActiveTab();
    if (!tab?.url || !tab.url.includes("isgpanel.tr")) {
      throw new Error("Önce giriş yapılmış İSG Panel sekmesini açın.");
    }

    const token = await readPanelToken(tab);
    if (!token) {
      throw new Error("Bu sekmede panel oturumu bulunamadı. İSG Panel'e tekrar giriş yapıp deneyin.");
    }

    tokenInput.value = token;
    await chrome.storage.local.set({
      apiBase: normalizeApiBase(apiBaseInput.value),
      token,
    });
    setStatus("Panel oturumu tanındı. Şimdi İSG-KATİP sekmesinde senkronize edebilirsiniz.");
  } catch (error) {
    setStatus(error?.message || "Panel oturumu tanınamadı.", true);
  } finally {
    detectPanelBtn.disabled = false;
  }
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
