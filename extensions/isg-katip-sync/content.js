function normalizeStatus(text) {
  const value = String(text || "").toLocaleLowerCase("tr-TR");
  if (value.includes("onaylandı") || value.includes("aktif")) return "atama_onaylandi";
  if (value.includes("işveren") && value.includes("bek")) return "isveren_onayi_bekliyor";
  if (value.includes("profesyonel") && value.includes("bek")) return "profesyonel_onayi_bekliyor";
  if (value.includes("düşt") || value.includes("iptal") || value.includes("pasif")) return "atama_dustu";
  if (value.includes("yok") || value.includes("bulunamadı")) return "atama_yok";
  return "kontrol_edilmedi";
}

function findSgkNo(text) {
  const compact = String(text || "").replace(/\D/g, "");
  const match = compact.match(/\d{20,26}/);
  return match ? match[0] : "";
}

function readRowsFromPage() {
  const rows = Array.from(document.querySelectorAll("table tbody tr"));
  const source = rows.length > 0 ? rows : Array.from(document.querySelectorAll("tr"));

  return source
    .map((row) => {
      const cells = Array.from(row.querySelectorAll("td, th")).map((cell) =>
        cell.innerText.replace(/\s+/g, " ").trim()
      );
      const text = cells.join(" ");
      const sgkNo = findSgkNo(text);
      if (!sgkNo) return null;

      return {
        sgkNo,
        firmaAdi: cells.find((cell) => /ltd|a\.ş|anonim|limited|şirket/i.test(cell)) || "",
        isgKatipStatus: normalizeStatus(text),
        rawText: text.slice(0, 1000),
      };
    })
    .filter(Boolean);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "READ_ISG_KATIP_ROWS") return false;

  try {
    sendResponse({ ok: true, rows: readRowsFromPage() });
  } catch (error) {
    sendResponse({ ok: false, message: error?.message || "Sayfa okunamadı" });
  }

  return true;
});
