const apiBaseInput = document.getElementById("apiBase");
const tokenInput = document.getElementById("token");
const syncBtn = document.getElementById("syncBtn");
const statusEl = document.getElementById("status");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#be123c" : "#047857";
}

chrome.storage.local.get(["apiBase", "token"], (stored) => {
  if (stored.apiBase) apiBaseInput.value = stored.apiBase;
  if (stored.token) tokenInput.value = stored.token;
});

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

syncBtn.addEventListener("click", async () => {
  const apiBase = apiBaseInput.value.replace(/\/$/, "");
  const token = tokenInput.value.trim();

  if (!apiBase || !token) {
    setStatus("API adresi ve panel tokenı zorunlu.", true);
    return;
  }

  syncBtn.disabled = true;
  setStatus("Sayfa okunuyor...");

  try {
    await chrome.storage.local.set({ apiBase, token });
    const tab = await getActiveTab();

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "READ_ISG_KATIP_ROWS",
    });

    if (!response?.ok) throw new Error(response?.message || "Sayfa okunamadı");
    if (!response.rows?.length) throw new Error("Bu sayfada SGK satırı bulunamadı");

    setStatus(`${response.rows.length} kayıt panele gönderiliyor...`);

    const syncResponse = await fetch(`${apiBase}/api/isg-katip/extension-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ rows: response.rows }),
    });

    const data = await syncResponse.json();
    if (!syncResponse.ok) throw new Error(data?.message || "Panel kaydı başarısız");

    setStatus(`Tamam: ${data.matched || 0} eşleşti, ${data.unmatched || 0} eşleşmedi.`);
  } catch (error) {
    setStatus(error?.message || "Senkronizasyon başarısız.", true);
  } finally {
    syncBtn.disabled = false;
  }
});
