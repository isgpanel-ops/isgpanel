const apiBaseInput = document.getElementById("apiBase");
const tokenInput = document.getElementById("token");
const detectPanelBtn = document.getElementById("detectPanelBtn");
const syncBtn = document.getElementById("syncBtn");
const nextJobBtn = document.getElementById("nextJobBtn");
const fillJobBtn = document.getElementById("fillJobBtn");
const doneJobBtn = document.getElementById("doneJobBtn");
const failJobBtn = document.getElementById("failJobBtn");
const jobBox = document.getElementById("jobBox");
const statusEl = document.getElementById("status");
let currentJob = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#be123c" : "#047857";
}

function normalizeApiBase(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function getConfig() {
  return {
    apiBase: normalizeApiBase(apiBaseInput.value),
    token: tokenInput.value.trim(),
  };
}

function requireConfig() {
  const config = getConfig();
  if (!config.apiBase || !config.token) {
    throw new Error("API adresi ve panel tokenı zorunlu.");
  }
  return config;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderJob(job) {
  currentJob = job || null;
  if (!currentJob) {
    jobBox.style.display = "none";
    jobBox.innerHTML = "";
    fillJobBtn.style.display = "none";
    doneJobBtn.style.display = "none";
    failJobBtn.style.display = "none";
    return;
  }

  jobBox.style.display = "block";
  jobBox.innerHTML = `
    <b>${escapeHtml(currentJob.gorevTuruLabel || currentJob.gorevTuru || "Atama Görevi")}</b>
    <div><strong>Firma:</strong> ${escapeHtml(currentJob.firmaAdi || "-")}</div>
    <div><strong>SGK:</strong> ${escapeHtml(currentJob.sgkNo || "-")}</div>
    <div><strong>Kişi:</strong> ${escapeHtml(currentJob.assigneeName || "-")}</div>
    <div><strong>TC:</strong> ${escapeHtml(currentJob.assigneeTcKimlik || "-")}</div>
    <div><strong>Durum:</strong> ${escapeHtml(currentJob.status || "-")}</div>
  `;
  fillJobBtn.style.display = "block";
  doneJobBtn.style.display = "block";
  failJobBtn.style.display = "block";
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

async function readApiJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (_error) {
    const preview = text.replace(/\s+/g, " ").slice(0, 120);
    throw new Error(
      `API JSON dönmedi. API adresini kontrol edin veya backend değişikliklerini canlıya alın. Gelen cevap: ${preview}`
    );
  }
}

async function panelFetch(path, options = {}) {
  const { apiBase, token } = requireConfig();
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await readApiJson(response);
  if (!response.ok) throw new Error(data?.message || "Panel isteği başarısız.");
  return data;
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

    const data = await readApiJson(syncResponse);
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

nextJobBtn.addEventListener("click", async () => {
  nextJobBtn.disabled = true;
  setStatus("Bekleyen atama görevi alınıyor...");

  try {
    const data = await panelFetch("/api/isg-katip/jobs/next");
    if (!data.job) {
      renderJob(null);
      setStatus("Bekleyen atama görevi yok.");
      return;
    }

    const claimed = await panelFetch(`/api/isg-katip/jobs/${data.job.id}/claim`, {
      method: "POST",
      body: JSON.stringify({ note: "Eklenti görevi aldı" }),
    });
    renderJob(claimed.job);
    setStatus("Atama görevi alındı. İSG-KATİP sayfasında Sayfaya SGK/TC Doldur butonunu kullanın.");
  } catch (error) {
    setStatus(error?.message || "Bekleyen atama görevi alınamadı.", true);
  } finally {
    nextJobBtn.disabled = false;
  }
});

fillJobBtn.addEventListener("click", async () => {
  if (!currentJob) {
    setStatus("Önce bekleyen atama görevini alın.", true);
    return;
  }

  fillJobBtn.disabled = true;
  setStatus("Açık İSG-KATİP sayfasına bilgiler hazırlanıyor...");

  try {
    const tab = await getActiveTab();
    if (!tab?.url || !tab.url.includes("isgkatip")) {
      throw new Error("Önce açık İSG-KATİP sekmesine geçin.");
    }

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, {
        type: "FILL_ISG_KATIP_JOB",
        job: currentJob,
      });
    } catch (_error) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      response = await chrome.tabs.sendMessage(tab.id, {
        type: "FILL_ISG_KATIP_JOB",
        job: currentJob,
      });
    }

    if (!response?.ok) throw new Error(response?.message || "Sayfaya bilgi doldurulamadı.");
    setStatus(
      `Hazırlandı.\nSGK alanı: ${response.filled?.sgk ? "dolduruldu" : "bulunamadı"}\nTC alanı: ${
        response.filled?.tc ? "dolduruldu" : "bulunamadı"
      }\nSon resmi kontrol ve onay kullanıcıda.`
    );
  } catch (error) {
    setStatus(error?.message || "Sayfaya bilgi doldurulamadı.", true);
  } finally {
    fillJobBtn.disabled = false;
  }
});

doneJobBtn.addEventListener("click", async () => {
  if (!currentJob) return;
  doneJobBtn.disabled = true;
  try {
    const data = await panelFetch(`/api/isg-katip/jobs/${currentJob.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "done",
        note: "Kullanıcı İSG-KATİP işlem adımını tamamlandı işaretledi",
      }),
    });
    renderJob(data.job);
    setStatus("Görev tamamlandı işaretlendi. Sonrasında açık sayfayı senkronize edin.");
  } catch (error) {
    setStatus(error?.message || "Görev tamamlandı işaretlenemedi.", true);
  } finally {
    doneJobBtn.disabled = false;
  }
});

failJobBtn.addEventListener("click", async () => {
  if (!currentJob) return;
  failJobBtn.disabled = true;
  try {
    const data = await panelFetch(`/api/isg-katip/jobs/${currentJob.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "failed",
        error: "Kullanıcı eklenti üzerinden hatalı işaretledi",
      }),
    });
    renderJob(data.job);
    setStatus("Görev hatalı işaretlendi. Tekrar denemek için Bekleyen Atamayı Al diyebilirsiniz.", true);
  } catch (error) {
    setStatus(error?.message || "Görev hatalı işaretlenemedi.", true);
  } finally {
    failJobBtn.disabled = false;
  }
});
