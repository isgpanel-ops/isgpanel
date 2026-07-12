const GOREV_TURLERI = {
  is_guvenligi_uzmani: "İş Güvenliği Uzmanı",
  isyeri_hekimi: "İşyeri Hekimi",
  diger_saglik_personeli: "Diğer Sağlık Personeli",
};

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function lowerTR(value) {
  return cleanText(value).toLocaleLowerCase("tr-TR");
}

function normalizeStatus(text) {
  const value = lowerTR(text);
  if (value.includes("onaylandı") || value.includes("aktif sözleşme") || value.includes("aktif atama")) {
    return "atama_onaylandi";
  }
  if (value.includes("işveren") && (value.includes("bek") || value.includes("onay"))) {
    return "isveren_onayi_bekliyor";
  }
  if (
    (value.includes("profesyonel") || value.includes("uzman") || value.includes("hekim") || value.includes("dsp")) &&
    (value.includes("bek") || value.includes("onay"))
  ) {
    return "profesyonel_onayi_bekliyor";
  }
  if (value.includes("düşt") || value.includes("iptal") || value.includes("pasif") || value.includes("sonlandı")) {
    return "atama_dustu";
  }
  if (value.includes("atama yok") || value.includes("bulunamadı") || value.includes("sözleşme yok")) {
    return "atama_yok";
  }
  return "kontrol_edilmedi";
}

function detectGorevTuru(text) {
  const value = lowerTR(text);
  if (value.includes("diğer sağlık") || value.includes("dsp")) return "diger_saglik_personeli";
  if (value.includes("işyeri hekimi") || value.includes("hekim")) return "isyeri_hekimi";
  return "is_guvenligi_uzmani";
}

function findSgkNo(text) {
  const numbers = cleanText(text).match(/\d{16,26}/g) || [];
  return numbers.find((number) => number.length >= 18) || "";
}

function findTcKimlik(text) {
  const numbers = cleanText(text).match(/\b\d{11}\b/g) || [];
  return numbers[0] || "";
}

function findEmployeeCount(text) {
  const value = cleanText(text);
  const patterns = [
    /(?:çalışan|kişi|personel)\s*(?:sayısı|adedi)?\s*[:\-]?\s*(\d{1,6})/i,
    /(\d{1,6})\s*(?:çalışan|kişi|personel)/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return Number(match[1]);
  }
  return null;
}

function findHazardClass(text) {
  const value = lowerTR(text);
  if (value.includes("çok tehlikeli")) return "Çok Tehlikeli";
  if (value.includes("az tehlikeli")) return "Az Tehlikeli";
  if (value.includes("tehlikeli")) return "Tehlikeli";
  return "";
}

function findDuration(text) {
  const value = cleanText(text);
  const patterns = [
    /(?:süre|çalışma süresi|hizmet süresi)\s*[:\-]?\s*([0-9.,]+\s*(?:dk|dakika|saat|ay|gün))/i,
    /([0-9.,]+\s*(?:dk|dakika|saat|ay|gün))\s*(?:süre|hizmet)/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return cleanText(match[1]);
  }
  return "";
}

function findContractId(text) {
  const match = cleanText(text).match(/(?:sözleşme|atama)\s*(?:no|id|numarası)?\s*[:\-]?\s*([A-Z0-9\-]{5,})/i);
  return match?.[1] || "";
}

function findCompanyName(cells, rowText) {
  const companyCell = cells.find((cell) =>
    /(ltd|limited|a\.ş|anonim|şirket|sanayi|ticaret|hizmet|inşaat|sağlık)/i.test(cell)
  );
  if (companyCell) return companyCell;
  const beforeSgk = rowText.split(findSgkNo(rowText))[0];
  return cleanText(beforeSgk).slice(0, 180);
}

function rowToRecord(cells) {
  const rawText = cleanText(cells.join(" "));
  const sgkNo = findSgkNo(rawText);
  if (!sgkNo) return null;

  return {
    sgkNo,
    firmaAdi: findCompanyName(cells, rawText),
    gorevTuru: detectGorevTuru(rawText),
    isgKatipStatus: normalizeStatus(rawText),
    personelTcKimlik: findTcKimlik(rawText),
    calisanSayisi: findEmployeeCount(rawText),
    tehlike: findHazardClass(rawText),
    calismaSuresi: findDuration(rawText),
    sozlesmeId: findContractId(rawText),
    rawText: rawText.slice(0, 1200),
  };
}

function readRowsFromTables() {
  const rows = Array.from(document.querySelectorAll("table tbody tr, table tr"));
  return rows
    .map((row) => {
      const cells = Array.from(row.querySelectorAll("td, th")).map((cell) => cleanText(cell.innerText));
      if (cells.length < 2) return null;
      return rowToRecord(cells);
    })
    .filter(Boolean);
}

function readCardsFromPage() {
  const candidates = Array.from(
    document.querySelectorAll("[class*='card'], [class*='panel'], [class*='result'], [class*='sonuc'], section, form")
  );
  return candidates
    .map((node) => {
      const text = cleanText(node.innerText);
      if (!findSgkNo(text)) return null;
      return rowToRecord([text]);
    })
    .filter(Boolean);
}

function dedupeRows(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = `${row.sgkNo}:${row.gorevTuru}:${row.personelTcKimlik || ""}:${row.isgKatipStatus}`;
    const prev = map.get(key);
    if (!prev || row.rawText.length > prev.rawText.length) map.set(key, row);
  });
  return Array.from(map.values());
}

function readIsgKatipSnapshot() {
  const tableRows = readRowsFromTables();
  const cardRows = tableRows.length > 0 ? [] : readCardsFromPage();
  const pageText = cleanText(document.body?.innerText || "");

  return {
    url: location.href,
    title: document.title || "",
    pageGorevTuru: detectGorevTuru(pageText),
    rows: dedupeRows([...tableRows, ...cardRows]),
    capturedAt: new Date().toISOString(),
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "READ_ISG_KATIP_ROWS") return false;

  try {
    sendResponse({ ok: true, ...readIsgKatipSnapshot() });
  } catch (error) {
    sendResponse({ ok: false, message: error?.message || "Sayfa okunamadı" });
  }

  return true;
});
