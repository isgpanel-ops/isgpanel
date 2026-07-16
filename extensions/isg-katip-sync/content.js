const GOREV_TURLERI = {
  is_guvenligi_uzmani: "İş Güvenliği Uzmanı",
  isyeri_hekimi: "İşyeri Hekimi",
  diger_saglik_personeli: "Diğer Sağlık Personeli",
};

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function asciiSearchText(value) {
  return normalizeSearchText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u011f/g, "g")
    .replace(/\u00fc/g, "u")
    .replace(/\u015f/g, "s")
    .replace(/\u0131/g, "i")
    .replace(/\u00f6/g, "o")
    .replace(/\u00e7/g, "c");
}

function lowerTR(value) {
  return cleanText(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function normalizeSearchText(value) {
  return lowerTR(value)
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/i̇/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function normalizeStatus(text) {
  const value = lowerTR(text);
  const normalized = normalizeSearchText(text);
  if (
    normalized.includes("sozlesme onaylandi") ||
    normalized.includes("atama onaylandi") ||
    normalized.includes("aktif sozlesme") ||
    normalized.includes("aktif atama")
  ) {
    return "atama_onaylandi";
  }
  if (normalized.includes("isveren") && (normalized.includes("bek") || normalized.includes("onay"))) {
    return "isveren_onayi_bekliyor";
  }
  if (
    (normalized.includes("profesyonel") ||
      normalized.includes("uzman") ||
      normalized.includes("hekim") ||
      normalized.includes("dsp")) &&
    (normalized.includes("bek") || normalized.includes("onay"))
  ) {
    return "profesyonel_onayi_bekliyor";
  }
  if (
    normalized.includes("dust") ||
    normalized.includes("iptal") ||
    normalized.includes("pasif") ||
    normalized.includes("sonlandi")
  ) {
    return "atama_dustu";
  }
  if (normalized.includes("atama yok") || normalized.includes("bulunamadi") || normalized.includes("sozlesme yok")) {
    return "atama_yok";
  }
  if (
    value.includes("fa-check") ||
    value.includes("glyphicon-ok") ||
    value.includes("check_circle") ||
    value.includes("text-success") ||
    value.includes("success")
  ) {
    return "atama_onaylandi";
  }
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

function hasGenericPendingText(text) {
  const normalized = normalizeSearchText(text);
  return (
    normalized.includes("sozlesme onay bekliyor") ||
    normalized.includes("onay bekleyen sozlesme") ||
    normalized.includes("onay bekliyor")
  );
}

function rgbTone(value) {
  const match = String(value || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return "";
  const red = Number(match[1]);
  const green = Number(match[2]);
  const blue = Number(match[3]);
  if (red > 170 && green < 150 && blue < 150) return "red";
  if (green > 120 && red < 170 && blue < 170) return "green";
  return "";
}

function visualStatusFromRow(row) {
  if (!row) return "";

  const tokens = normalizeSearchText(
    [
      row.className,
      row.getAttribute("style"),
      row.getAttribute("title"),
      row.getAttribute("aria-label"),
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (/(danger|error|red|rose|kirmizi|bg-danger|table-danger)/.test(tokens)) {
    return "profesyonel_onayi_bekliyor";
  }
  if (/(success|green|emerald|yesil|bg-success|table-success)/.test(tokens)) {
    return "isveren_onayi_bekliyor";
  }

  const rowStyle = window.getComputedStyle(row);
  const rowTone =
    rgbTone(rowStyle.backgroundColor) ||
    rgbTone(rowStyle.borderLeftColor) ||
    rgbTone(rowStyle.borderColor);
  if (rowTone === "red") return "profesyonel_onayi_bekliyor";
  if (rowTone === "green") return "isveren_onayi_bekliyor";

  for (const cell of Array.from(row.querySelectorAll("td, th"))) {
    const cellStyle = window.getComputedStyle(cell);
    const cellTone =
      rgbTone(cellStyle.backgroundColor) ||
      rgbTone(cellStyle.borderLeftColor) ||
      rgbTone(cellStyle.borderColor);
    if (cellTone === "red") return "profesyonel_onayi_bekliyor";
    if (cellTone === "green") return "isveren_onayi_bekliyor";
  }

  return "";
}

function cellTextForSync(cell) {
  const parts = [
    cell.innerText,
    cell.getAttribute("title"),
    cell.getAttribute("aria-label"),
    cell.className,
  ];
  cell.querySelectorAll("[title], [aria-label], [class]").forEach((node) => {
    parts.push(node.getAttribute("title"));
    parts.push(node.getAttribute("aria-label"));
    parts.push(node.className);
  });
  return cleanText(parts.filter(Boolean).join(" "));
}

function detectGorevTuru(text) {
  const normalized = normalizeSearchText(text);
  if (normalized.includes("diger saglik") || normalized.includes("dsp")) return "diger_saglik_personeli";
  if (normalized.includes("isyeri hekim") || normalized.includes("hekimlik") || normalized.includes("hekim")) {
    return "isyeri_hekimi";
  }
  if (
    normalized.includes("is guvenligi uzman") ||
    normalized.includes("igu") ||
    normalized.includes("isg profesyoneli")
  ) {
    return "is_guvenligi_uzmani";
  }
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

function findHazardClassSafe(text) {
  const value = normalizeSearchText(text);
  if (value.includes("cok tehlikeli")) return "Çok Tehlikeli";
  if (value.includes("az tehlikeli")) return "Az Tehlikeli";
  if (value.includes("tehlikeli")) return "Tehlikeli";
  return findHazardClass(text);
}

function headerValue(cells, headers, patterns) {
  const normalizedHeaders = (headers || []).map((header) => normalizeSearchText(header));
  const index = normalizedHeaders.findIndex((header) => patterns.some((pattern) => header.includes(pattern)));
  if (index < 0) return "";
  return cleanText(cells[index] || "");
}

function findEmployeeCountFromCells(cells, headers, rawText) {
  const value = headerValue(cells, headers, ["calisan"]);
  const match = value.match(/\d{1,6}/);
  if (match) return Number(match[0]);
  return findEmployeeCount(rawText);
}

function findHazardClassFromCells(cells, headers, rawText) {
  const value = headerValue(cells, headers, ["tehlike"]);
  return findHazardClassSafe(value) || findHazardClassSafe(rawText);
}

function detectGorevTuruFromCells(cells, headers, rawText) {
  const sertifika = headerValue(cells, headers, ["sertifika"]);
  const sozlesme = headerValue(cells, headers, ["sozlesme"]);
  return detectGorevTuru([sertifika, sozlesme, rawText].filter(Boolean).join(" "));
}

function rowToRecord(cells, statusHint = "", row = null, headers = []) {
  const rawText = cleanText(cells.join(" "));
  const sgkNo = findSgkNo(rawText);
  if (!sgkNo) return null;
  const visualStatus = visualStatusFromRow(row);
  const genericPending = hasGenericPendingText(rawText);
  const isPendingPage = statusHint === "profesyonel_onayi_bekliyor" || statusHint === "isveren_onayi_bekliyor";
  const ignoredPending = genericPending && !visualStatus;
  const textStatus = normalizeStatus(rawText);
  const detectedStatus =
    genericPending && visualStatus
      ? visualStatus
      : textStatus === "kontrol_edilmedi" && isPendingPage && visualStatus
      ? visualStatus
      : textStatus;

  return {
    sgkNo,
    firmaAdi: findCompanyName(cells, rawText),
    gorevTuru: detectGorevTuruFromCells(cells, headers, rawText),
    isgKatipStatus: ignoredPending
      ? "kontrol_edilmedi"
      : detectedStatus === "kontrol_edilmedi" && statusHint
      ? statusHint
      : detectedStatus,
    personelTcKimlik: findTcKimlik(rawText),
    calisanSayisi: findEmployeeCountFromCells(cells, headers, rawText),
    tehlike: findHazardClassFromCells(cells, headers, rawText),
    calismaSuresi: findDuration(rawText),
    sozlesmeId: findContractId(rawText),
    ignoredPending,
    rawText: rawText.slice(0, 240),
  };
}

function inferStatusFromActiveTab() {
  const activeCandidates = visibleElements(
    ".active, [aria-selected='true'], [class*='active'], [class*='selected'], a, button, li"
  );
  const activeText = normalizeSearchText(
    activeCandidates
      .map((node) => cleanText(node.innerText || node.textContent || ""))
      .filter(Boolean)
      .join(" ")
  );
  if (activeText.includes("devam eden")) return "atama_onaylandi";
  if (activeText.includes("onay bekleyen")) return "profesyonel_onayi_bekliyor";
  if (activeText.includes("guncellenmesi gereken") || activeText.includes("sure guncellemesi")) return "atama_dustu";
  return "";
}

function readRowsFromTables(statusHint = "") {
  const rows = Array.from(document.querySelectorAll("table tbody tr, table tr"));
  return rows
    .map((row) => {
      const cells = Array.from(row.querySelectorAll("td, th")).map((cell) => cellTextForSync(cell));
      if (cells.length < 2) return null;
      const table = row.closest("table");
      let headers = Array.from(table?.querySelectorAll("thead th") || []).map((cell) => cellTextForSync(cell));
      if (!headers.length) {
        const firstRow = table?.querySelector("tr");
        headers = Array.from(firstRow?.querySelectorAll("th") || []).map((cell) => cellTextForSync(cell));
      }
      return rowToRecord(cells, statusHint, row, headers);
    })
    .filter(Boolean);
}

function readCardsFromPage(statusHint = "") {
  const candidates = Array.from(
    document.querySelectorAll("[class*='card'], [class*='panel'], [class*='result'], [class*='sonuc'], section, form")
  );
  return candidates
    .map((node) => {
      const text = cleanText(node.innerText);
      if (!findSgkNo(text)) return null;
      return rowToRecord([text], statusHint, node);
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
  const statusHint = inferStatusFromActiveTab();
  const tableRows = readRowsFromTables(statusHint);
  const cardRows = tableRows.length > 0 ? [] : readCardsFromPage(statusHint);
  const pageText = cleanText(document.body?.innerText || "");

  return {
    url: location.href,
    title: document.title || "",
    pageGorevTuru: detectGorevTuru(pageText),
    rows: dedupeRows([...tableRows, ...cardRows]),
    capturedAt: new Date().toISOString(),
  };
}

function activePageNumber() {
  const candidates = visibleElements(
    ".active, [aria-current='page'], [aria-selected='true'], [class*='active'], [class*='current']"
  );
  const page = candidates
    .map((node) => cleanText(node.innerText || node.textContent || ""))
    .find((text) => /^\d+$/.test(text));
  return page || "";
}

function pageSignature() {
  const snapshot = readIsgKatipSnapshot();
  const rowKey = snapshot.rows.map((row) => `${row.sgkNo}:${row.personelTcKimlik}:${row.rawText}`).join("|");
  return `${activePageNumber()}::${rowKey}`;
}

function pageControlText(element) {
  return cleanText(
    [
      element.innerText,
      element.textContent,
      element.value,
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.className,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function paginationControls() {
  return visibleElements("button, a, li, [role='button']")
    .filter((element) => !isDisabledElement(element))
    .filter((element) => {
      const text = pageControlText(element);
      return /(^|\s)(pagination|pager|page|next|prev|sonraki|önceki|onceki)(\s|$)/i.test(text) || /^[0-9<>»›‹«]+$/.test(cleanText(element.innerText || element.textContent || ""));
    })
    .sort((a, b) => {
      const aText = pageControlText(a);
      const bText = pageControlText(b);
      const aScore = /pagination|pager|next/i.test(aText) ? 0 : 1;
      const bScore = /pagination|pager|next/i.test(bText) ? 0 : 1;
      return aScore - bScore || b.getBoundingClientRect().top - a.getBoundingClientRect().top;
    });
}

function clickPageControl(element) {
  const target = element.querySelector?.("button, a") || element;
  clickElement(target);
}

function clickPageNumber(pageNumber) {
  const target = paginationControls().find((element) => cleanText(element.innerText || element.textContent || "") === String(pageNumber));
  if (!target) return false;
  clickPageControl(target);
  return true;
}

function isNextPageControl(element) {
  const raw = cleanText(element.innerText || element.textContent || "");
  const meta = normalizeSearchText(pageControlText(element));
  return raw === ">" || raw === "›" || meta.includes("pagination-next") || meta.includes("pager-next") || meta.includes("sonraki");
}

function clickNextPage() {
  const target = paginationControls().find(isNextPageControl);
  if (!target) return false;
  clickPageControl(target);
  return true;
}

async function goFirstPageIfPossible() {
  if (activePageNumber() === "1") return;
  const before = pageSignature();
  if (!clickPageNumber(1)) return;
  await waitFor(() => pageSignature() !== before, 8000, 250);
  await delay(300);
}

async function readIsgKatipSnapshotAllPages() {
  await goFirstPageIfPossible();
  const rows = [];
  const pageSignatures = new Set();
  let pageCount = 0;

  for (let i = 0; i < 80; i += 1) {
    const before = pageSignature();
    if (pageSignatures.has(before)) break;
    pageSignatures.add(before);

    const snapshot = readIsgKatipSnapshot();
    rows.push(...snapshot.rows);
    pageCount += 1;

    if (!clickNextPage()) break;
    const changed = await waitFor(() => pageSignature() !== before, 10000, 300);
    if (!changed) break;
    await delay(500);
  }

  const base = readIsgKatipSnapshot();
  return {
    ...base,
    rows: dedupeRows(rows),
    pageCount,
    capturedAt: new Date().toISOString(),
  };
}

function normalizeFieldHint(value) {
  return normalizeSearchText(value);
}

function fieldContext(field) {
  const id = field.id || "";
  const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
  const wrapper = field.closest("label, .form-group, .form-row, .row, div");
  return normalizeFieldHint(
    [
      field.name,
      field.id,
      field.placeholder,
      field.getAttribute("aria-label"),
      field.getAttribute("title"),
      label?.innerText,
      wrapper?.innerText,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function isUsableField(field) {
  const style = window.getComputedStyle(field);
  return (
    !field.disabled &&
    !field.readOnly &&
    field.type !== "hidden" &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    field.offsetParent !== null
  );
}

function setFieldValue(field, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  const nativeTextAreaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  const wasDisabled = field.disabled;
  const wasReadOnly = field.readOnly;
  if (wasDisabled) field.disabled = false;
  if (wasReadOnly) field.readOnly = false;
  field.focus();
  if (field instanceof HTMLInputElement && nativeSetter) {
    nativeSetter.call(field, value);
  } else if (field instanceof HTMLTextAreaElement && nativeTextAreaSetter) {
    nativeTextAreaSetter.call(field, value);
  } else {
    field.value = value;
  }
  field.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: String(value).slice(-1) || "0" }));
  field.dispatchEvent(new KeyboardEvent("keypress", { bubbles: true, key: String(value).slice(-1) || "0" }));
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: String(value).slice(-1) || "0" }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
  field.blur();
  if (wasReadOnly) field.readOnly = true;
  if (wasDisabled) field.disabled = true;
}

function fillBestField(patterns, value) {
  const fields = Array.from(document.querySelectorAll("input, textarea")).filter(isUsableField);
  const field = fields.find((candidate) => {
    const context = fieldContext(candidate);
    return patterns.some((pattern) => context.includes(pattern));
  });
  if (!field) return false;
  setFieldValue(field, value);
  return true;
}

function sgkSegments(sgkNo) {
  const value = String(sgkNo || "").replace(/\D/g, "");
  const lengths = [1, 4, 2, 2, 7, 3, 2, 2, 3];
  const segments = [];
  let index = 0;
  lengths.forEach((length) => {
    segments.push(value.slice(index, index + length));
    index += length;
  });
  return segments;
}

function findFieldByAny(patternGroups) {
  return patternGroups.map((patterns) => findField(patterns)).find(Boolean) || null;
}

function visibleTextFields() {
  return Array.from(document.querySelectorAll("input, textarea")).filter((field) => {
    const style = window.getComputedStyle(field);
    const tag = field.tagName.toLowerCase();
    const type = String(field.type || "").toLowerCase();
    return (
      type !== "hidden" &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      field.offsetParent !== null &&
      (tag === "textarea" || ["", "text", "search", "number", "tel"].includes(type))
    );
  });
}

function findSgkMainField() {
  return (
    findFieldByAny([
      ["sgk", "sicil", "detsis", "26 hane"],
      ["sgk sicil no"],
      ["26 hane"],
    ]) || null
  );
}

function isSgkSegmentCandidate(field, mainField) {
  if (!field || field === mainField) return false;
  const context = fieldContext(field);
  const placeholder = normalizeFieldHint(field.placeholder || "");
  const maxLength = Number(field.getAttribute("maxlength") || field.maxLength || 0);
  const labels = [
    "mahiyet",
    "is kolu",
    "iş kolu",
    "yeni su",
    "yeni şube",
    "yeni sub",
    "eski sub",
    "eski şube",
    "sira no",
    "sıra no",
    "il kodu",
    "ilce kodu",
    "ilçe kodu",
    "kontrol",
    "araci",
    "aracı",
  ];
  return (
    labels.some((label) => context.includes(label)) ||
    /\d+\s*hane/i.test(context) ||
    /\d+\s*hane/i.test(placeholder) ||
    [1, 2, 3, 4, 7].includes(maxLength)
  );
}

function fillSgkSegmentFields(sgkNo, mainField) {
  const segments = sgkSegments(sgkNo);
  if (segments.some((part) => !part)) return 0;

  const fields = visibleTextFields();
  const mainIndex = mainField ? fields.indexOf(mainField) : -1;
  const orderedFields = mainIndex >= 0 ? fields.slice(mainIndex + 1) : fields;
  const candidates = orderedFields.filter((field) => isSgkSegmentCandidate(field, mainField));
  const selected = candidates.slice(0, segments.length);

  selected.forEach((field, index) => {
    setFieldValue(field, segments[index]);
  });

  return selected.length;
}

function fillSgkFields(sgkNo) {
  const mainField = findSgkMainField() || findFirstEmptyTextField();
  let mainFilled = false;
  if (mainField) {
    setFieldValue(mainField, sgkNo);
    mainFilled = true;
  }

  const segmentCount = fillSgkSegmentFields(sgkNo, mainField);
  return { mainFilled, segmentCount };
}

async function fillAssignmentJob(job) {
  const sgkNo = String(job?.sgkNo || "").replace(/\D/g, "");
  const tcKimlik = String(job?.assigneeTcKimlik || "").replace(/\D/g, "");
  if (!sgkNo || !tcKimlik) {
    return { ok: false, message: "Görevde SGK veya TC bilgisi eksik." };
  }

  const steps = [];
  const filled = { sgk: false, tc: false };

  if (isCompanySelectionPage()) {
    const companyResult = await fillCompanyStep(job, steps);
    if (!companyResult.ok) return { ok: false, steps, message: companyResult.message };
    filled.sgk = true;
  }

  if (isPersonSelectionPage()) {
    const personResult = await fillPersonStep(job, steps);
    if (!personResult.ok) return { ok: false, steps, message: personResult.message };
    filled.tc = true;
  }

  if (!filled.sgk && !filled.tc) {
    filled.sgk = fillSgkFields(sgkNo).mainFilled;
    filled.tc = fillBestField(["tc", "kimlik", "gorevlendirilen"], tcKimlik);
  }

  return { ok: true, filled, steps };
}

const PROCESS_TEXT_BY_ROLE = {
  is_guvenligi_uzmani: "OSGB İLE ÖZEL İŞYERİ ARASINDA İŞ GÜVENLİĞİ UZMANI HİZMET ALIMI SÖZLEŞMESİ",
  isyeri_hekimi: "OSGB İLE ÖZEL İŞYERİ ARASINDA İŞYERİ HEKİMLİĞİ HİZMET ALIMI SÖZLEŞMESİ",
  diger_saglik_personeli: "OSGB İLE ÖZEL İŞYERİ ARASINDA DİĞER SAĞLIK PERSONELİ HİZMETİ ALIMI SÖZLEŞMESİ",
};

const PROCESS_KEYWORDS_BY_ROLE = {
  is_guvenligi_uzmani: ["osgb", "ozel isyeri", "is guvenligi uzmani", "hizmet alimi sozlesmesi"],
  isyeri_hekimi: ["osgb", "ozel isyeri", "isyeri hekimligi", "hizmet alimi sozlesmesi"],
  diger_saglik_personeli: ["osgb", "ozel isyeri", "diger saglik personeli", "hizmeti alimi sozlesmesi"],
};

PROCESS_TEXT_BY_ROLE.is_guvenligi_uzmani = "OSGB ILE OZEL ISYERI ARASINDA IS GUVENLIGI UZMANI HIZMET ALIMI SOZLESMESI";
PROCESS_TEXT_BY_ROLE.isyeri_hekimi = "OSGB ILE OZEL ISYERI ARASINDA ISYERI HEKIMLIGI HIZMET ALIMI SOZLESMESI";
PROCESS_TEXT_BY_ROLE.diger_saglik_personeli = "OSGB ILE OZEL ISYERI ARASINDA DIGER SAGLIK PERSONELI HIZMETI ALIMI SOZLESMESI";

const PROCESS_SEARCH_TEXT_BY_ROLE = {
  is_guvenligi_uzmani: "\u0130\u015f G\u00fcvenli\u011fi Uzman\u0131",
  isyeri_hekimi: "\u0130\u015fyeri Hekimli\u011fi",
  diger_saglik_personeli: "Di\u011fer Sa\u011fl\u0131k Personeli",
};

PROCESS_KEYWORDS_BY_ROLE.is_guvenligi_uzmani = ["osgb", "ozel isyeri", "is guvenligi uzmani", "hizmet alimi sozlesmesi"];
PROCESS_KEYWORDS_BY_ROLE.isyeri_hekimi = ["osgb", "ozel isyeri", "isyeri hekimligi", "hizmet alimi sozlesmesi"];
PROCESS_KEYWORDS_BY_ROLE.diger_saglik_personeli = ["osgb", "ozel isyeri", "diger saglik personeli", "hizmeti alimi sozlesmesi"];

const DURATION_LABELS_BY_ROLE = {
  is_guvenligi_uzmani: [
    "gerekli toplam igu suresi",
    "gerekli toplam isg suresi",
    "devam eden toplam igu suresi",
    "devam eden toplam isg suresi",
  ],
  isyeri_hekimi: [
    "gerekli toplam ih suresi",
    "gerekli toplam isyeri hekimi suresi",
    "devam eden toplam ih suresi",
  ],
  diger_saglik_personeli: [
    "gerekli toplam dsp suresi",
    "gerekli toplam diger saglik personeli suresi",
    "devam eden toplam dsp suresi",
  ],
};

function roleLabel(gorevTuru) {
  return GOREV_TURLERI[gorevTuru] || GOREV_TURLERI.is_guvenligi_uzmani || "Görev";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check, timeoutMs = 8000, intervalMs = 250) {
  const startedAt = Date.now();
  let lastValue = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastValue = check();
    if (lastValue) return lastValue;
    await delay(intervalMs);
  }
  return lastValue;
}

function isVisibleElement(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}

function isDisabledElement(element) {
  return (
    element.disabled ||
    element.getAttribute("aria-disabled") === "true" ||
    element.classList.contains("disabled") ||
    element.classList.contains("ant-btn-disabled")
  );
}

function visibleElements(selector) {
  return Array.from(document.querySelectorAll(selector)).filter(isVisibleElement);
}

function clickElement(element) {
  element.scrollIntoView({ block: "center", inline: "center" });
  element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  element.click();
}

function clickButtonByText(texts) {
  const wanted = texts.map(normalizeSearchText);
  const candidates = visibleElements("button, a, [role='button'], input[type='button'], input[type='submit']").filter(
    (element) => !isDisabledElement(element)
  );
  const button = candidates.find((element) => {
    const text = normalizeSearchText(element.innerText || element.value || element.getAttribute("aria-label") || "");
    return wanted.some((item) => text === item || text.includes(item));
  });
  if (!button) return false;
  clickElement(button);
  return true;
}

function clickFirstVisibleByText(text) {
  const wanted = asciiSearchText(text);
  const candidates = visibleElements("li, a, button, [role='option'], [role='menuitem'], .ant-select-item-option, div, span")
    .filter((element) => !isDisabledElement(element))
    .sort((a, b) => {
      const aRoleScore = a.matches("li, a, button, [role='option'], [role='menuitem'], .ant-select-item-option") ? 0 : 1;
      const bRoleScore = b.matches("li, a, button, [role='option'], [role='menuitem'], .ant-select-item-option") ? 0 : 1;
      return aRoleScore - bRoleScore || a.children.length - b.children.length;
    });
  const option = candidates.find((element) => {
    const value = asciiSearchText(element.innerText || element.textContent || "");
    return value === wanted || value.includes(wanted);
  });
  if (!option) return false;
  clickElement(option);
  return true;
}

function isPrivateOsgbWorkplaceProcessText(text) {
  const value = asciiSearchText(text);
  return value.includes("osgb") && value.includes("ozel isyeri") && !value.includes("kamu isyeri");
}

function clickProcessOption(gorevTuru) {
  const processText = PROCESS_TEXT_BY_ROLE[gorevTuru] || PROCESS_TEXT_BY_ROLE.is_guvenligi_uzmani;
  if (clickFirstVisibleByText(processText)) return true;

  const keywords = (PROCESS_KEYWORDS_BY_ROLE[gorevTuru] || PROCESS_KEYWORDS_BY_ROLE.is_guvenligi_uzmani).map(asciiSearchText);
  const candidates = visibleElements(
    "li, a, button, [role='option'], [role='menuitem'], .ant-select-item-option, .select2-results__option, .mat-option, mat-option, div"
  )
    .filter((element) => !isDisabledElement(element))
    .sort((a, b) => {
      const aRoleScore = a.matches("li, a, button, [role='option'], [role='menuitem'], .ant-select-item-option, .select2-results__option, .mat-option, mat-option")
        ? 0
        : 1;
      const bRoleScore = b.matches("li, a, button, [role='option'], [role='menuitem'], .ant-select-item-option, .select2-results__option, .mat-option, mat-option")
        ? 0
        : 1;
      return aRoleScore - bRoleScore || a.children.length - b.children.length;
    });

  const option = candidates.find((element) => {
    const text = asciiSearchText(element.innerText || element.textContent || "");
    if (!isPrivateOsgbWorkplaceProcessText(text)) return false;
    return keywords.every((keyword) => text.includes(keyword));
  });
  if (!option) return false;
  clickElement(option);
  return true;
}

function clickTextContainer(text) {
  const wanted = normalizeSearchText(text);
  const candidates = visibleElements("label, span, div, p, input, .ant-checkbox-wrapper, .checkbox, [class*='checkbox']")
    .filter((element) => !isDisabledElement(element))
    .sort((a, b) => a.children.length - b.children.length);
  const element = candidates.find((candidate) => {
    const value = normalizeSearchText(candidate.innerText || candidate.textContent || candidate.value || "");
    return value.includes(wanted);
  });
  if (!element) return false;
  clickElement(element);
  return true;
}

function getAllFields() {
  return Array.from(document.querySelectorAll("input, textarea, select")).filter(isUsableField);
}

function findField(patterns) {
  const normalizedPatterns = patterns.map(normalizeSearchText);
  return getAllFields().find((candidate) => {
    const context = fieldContext(candidate);
    return normalizedPatterns.some((pattern) => context.includes(pattern));
  });
}

function findFirstEmptyTextField() {
  return getAllFields().find((field) => {
    const type = String(field.type || "").toLowerCase();
    return (type === "text" || type === "search" || !type) && !field.value;
  });
}

function fillFieldByPatterns(patterns, value, options = {}) {
  const field = findField(patterns) || (options.allowFallback === false ? null : findFirstEmptyTextField());
  if (!field) return false;
  setFieldValue(field, value);
  return true;
}

function parseNumberFromText(value) {
  const match = cleanText(value).match(/\d+(?:[.,]\d+)?/);
  return match ? match[0].replace(",", ".") : "";
}

function elementTextWithValues(element) {
  const values = [element.innerText, element.textContent];
  if (element.matches?.("input, textarea, select")) {
    values.push(element.value);
    if (element.selectedOptions?.[0]) values.push(element.selectedOptions[0].textContent);
  }
  element.querySelectorAll("input, textarea, select").forEach((field) => {
    values.push(field.value);
    if (field.selectedOptions?.[0]) values.push(field.selectedOptions[0].textContent);
  });
  return cleanText(values.filter(Boolean).join(" "));
}

let assignmentDetailsAutoRun = false;

function kickAssignmentDetailsStepIfNeeded() {
  if (assignmentDetailsAutoRun || !isAssignmentDetailsPage()) return;
  assignmentDetailsAutoRun = true;
  fillAssignmentDetailsStep([])
    .catch(() => {})
    .finally(() => {
      assignmentDetailsAutoRun = false;
    });
}

function isSuccessfulTerminalPage() {
  kickAssignmentDetailsStepIfNeeded();
  const pageText = normalizeSearchText(document.body?.innerText || "");
  return (
    pageText.includes("isleminiz basariyla gerceklestirilmistir") ||
    pageText.includes("basvuruya ait bir sonraki ekranda islem yapma yetkiniz olmadigindan")
  );
}

function isContractListPage() {
  const pageText = normalizeSearchText(document.body?.innerText || "");
  return (
    (pageText.includes("bu sayfayi disa aktar") || pageText.includes("tumunu disa aktar")) &&
    (pageText.includes("hizmet sozlesmeleri") || pageText.includes("toplam")) &&
    pageText.includes("gorevlendirilen kisi")
  );
}

function isProcessSelectionPage() {
  return normalizeSearchText(document.body?.innerText || "").includes("surec secimi");
}

function isCompanySelectionPage() {
  const pageText = normalizeSearchText(document.body?.innerText || "");
  return (
    (pageText.includes("sgk sicil no") || pageText.includes("26 hane")) &&
    (pageText.includes("taraf tipi") || Boolean(findField(["sgk", "sicil", "detsis", "26 hane"])))
  );
}

function isPersonSelectionPage() {
  const pageText = normalizeSearchText(document.body?.innerText || "");
  return (
    pageText.includes("gorevlendirilecek is guvenligi uzmani") ||
    pageText.includes("gorevlendirilecek isyeri hekimi") ||
    pageText.includes("gorevlendirilecek diger saglik personeli") ||
    pageText.includes("kisi tckn")
  );
}

function isInfoApprovalPage() {
  const pageText = normalizeSearchText(document.body?.innerText || "");
  return pageText.includes("okudum") || pageText.includes("bilgilendirme metni") || pageText.includes("yonetmelik kapsaminda");
}

function isAssignmentDetailsPage() {
  const pageText = normalizeSearchText(document.body?.innerText || "");
  return (
    pageText.includes("sozlesme bilgileri giris sayfasi") ||
    (pageText.includes("gorevlendirme tipi") && pageText.includes("calisma suresi"))
  );
}

function isCheckedElement(element) {
  return (
    element.checked ||
    element.getAttribute("aria-checked") === "true" ||
    element.classList.contains("checked") ||
    element.classList.contains("ant-checkbox-checked")
  );
}

function checkInfoApprovalBox() {
  const nativeCheckbox = visibleElements("input[type='checkbox']").find((input) => !input.checked);
  if (nativeCheckbox) {
    clickElement(nativeCheckbox);
    nativeCheckbox.checked = true;
    nativeCheckbox.dispatchEvent(new Event("input", { bubbles: true }));
    nativeCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  const customCheckbox = visibleElements(
    "[role='checkbox'], .ant-checkbox, .ant-checkbox-wrapper, .checkbox, [class*='checkbox']"
  ).find((element) => !isCheckedElement(element));
  if (customCheckbox) {
    clickElement(customCheckbox);
    return true;
  }

  return clickTextContainer("okudum ve onaylıyorum") || clickTextContainer("okudum");
}

function currentPagePreview() {
  return cleanText(document.body?.innerText || "")
    .replace(/\s+/g, " ")
    .slice(0, 220);
}

function durationLabelsForRole(gorevTuru) {
  return [
    ...(DURATION_LABELS_BY_ROLE[gorevTuru] || DURATION_LABELS_BY_ROLE.is_guvenligi_uzmani),
    "gerekli toplam sure",
    "devam eden toplam sure",
  ];
}

function durationFromRawText(rawText, gorevTuru = "is_guvenligi_uzmani") {
  const text = cleanText(rawText);
  const normalizedText = normalizeSearchText(text);
  for (const label of durationLabelsForRole(gorevTuru)) {
    const index = normalizedText.indexOf(label);
    if (index >= 0) {
      const nearby = text.slice(Math.max(0, index), index + 180);
      const value = parseNumberFromText(nearby);
      if (value) return value;
    }
  }

  const patterns = [
    /GEREKL[İI]\s+TOPLAM\s+(?:İGU|IGU|İSG|ISG|İH|IH|DSP)\s+S[ÜU]RES[İI]\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i,
    /TOPLAM\s+(?:İGU|IGU|İSG|ISG|İH|IH|DSP)\s+S[ÜU]RES[İI]\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i,
    /DEVAM\s+EDEN\s+TOPLAM\s+(?:İGU|IGU|İSG|ISG|İH|IH|DSP)\s+S[ÜU]RES[İI]\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].replace(",", ".");
  }
  return "";
}

function findValueNearLabel(patterns, gorevTuru = "is_guvenligi_uzmani") {
  const normalizedPatterns = patterns.map(normalizeSearchText);
  const rows = Array.from(document.querySelectorAll("tr, .row, .form-group, .form-line, .ant-row, div"));
  for (const row of rows) {
    const rowRawText = elementTextWithValues(row);
    const directDuration = durationFromRawText(rowRawText, gorevTuru);
    if (directDuration) return directDuration;

    const directCells = Array.from(row.children).filter(isVisibleElement);
    if (directCells.length >= 2) {
      const labelText = normalizeSearchText(elementTextWithValues(directCells[0]));
      if (normalizedPatterns.some((pattern) => labelText.includes(pattern))) {
        for (let i = 1; i < directCells.length; i += 1) {
          const value = parseNumberFromText(elementTextWithValues(directCells[i]));
          if (value) return value;
        }
      }
    }

    const cells = Array.from(row.querySelectorAll("td, th, label, span, div, input, textarea, select")).filter(
      isVisibleElement
    );
    if (cells.length >= 2) {
      const firstText = normalizeSearchText(elementTextWithValues(cells[0]));
      if (normalizedPatterns.some((pattern) => firstText.includes(pattern))) {
        for (let i = 1; i < cells.length; i += 1) {
          const value = parseNumberFromText(elementTextWithValues(cells[i]));
          if (value) return value;
        }
      }
    }

    const rowText = normalizeSearchText(rowRawText);
    if (normalizedPatterns.some((pattern) => rowText.includes(pattern))) {
      const number = parseNumberFromText(rowRawText);
      if (number) return number;
    }
  }
  return "";
}

function fillDurationField(duration) {
  const cleanDuration = parseNumberFromText(duration);
  if (!cleanDuration) return false;
  return fillFieldByPatterns(["calisma suresi", "çalışma süresi"], cleanDuration, { allowFallback: false });
}

function setSelectOptionByText(select, texts) {
  const wanted = texts.map(normalizeSearchText);
  const option = Array.from(select.options || []).find((item) => {
    const text = normalizeSearchText([item.textContent, item.label, item.value].filter(Boolean).join(" "));
    return wanted.some((pattern) => text.includes(pattern));
  });
  if (!option) return false;

  const wasDisabled = select.disabled;
  if (wasDisabled) select.disabled = false;
  select.focus();
  select.value = option.value;
  option.selected = true;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
  select.blur();
  if (wasDisabled) select.disabled = true;
  return true;
}

async function clickDropdownOptionByText(texts) {
  const wanted = texts.map(asciiSearchText);
  await delay(350);
  const candidates = visibleElements(
    "li, a, button, [role='option'], [role='menuitem'], .ant-select-item-option, .select2-results__option, .ng-option, .dropdown-item, .mat-option, mat-option, div, span"
  )
    .filter((element) => !isDisabledElement(element))
    .sort((a, b) => {
      const aRoleScore = a.matches("li, a, button, [role='option'], [role='menuitem'], .ant-select-item-option, .select2-results__option, .ng-option, .dropdown-item, .mat-option, mat-option")
        ? 0
        : 1;
      const bRoleScore = b.matches("li, a, button, [role='option'], [role='menuitem'], .ant-select-item-option, .select2-results__option, .ng-option, .dropdown-item, .mat-option, mat-option")
        ? 0
        : 1;
      return aRoleScore - bRoleScore || a.children.length - b.children.length;
    });
  const option = candidates.find((element) => {
    const text = asciiSearchText(element.innerText || element.textContent || element.value || "");
    return wanted.some((pattern) => text.includes(pattern));
  });
  if (!option) return false;
  clickElement(option);
  return true;
}

async function clickPartialTimeOption() {
  await delay(350);
  const optionSelectors = [
    "[role='option']",
    "[role='menuitem']",
    ".ant-select-item-option",
    ".select2-results__option",
    ".ng-option",
    ".dropdown-item",
    ".mat-option",
    "mat-option",
    "li",
    "button",
    "a",
  ].join(", ");

  const exactOptions = visibleElements(optionSelectors)
    .filter((element) => !isDisabledElement(element))
    .filter((element) => {
      const text = asciiSearchText(element.innerText || element.textContent || element.value || "");
      return text.includes("kismi") && !text.includes("tam");
    })
    .sort((a, b) => {
      const aText = cleanText(a.innerText || a.textContent || a.value || "");
      const bText = cleanText(b.innerText || b.textContent || b.value || "");
      return aText.length - bText.length || a.children.length - b.children.length;
    });

  if (exactOptions[0]) {
    clickElement(exactOptions[0]);
    await delay(250);
    return true;
  }

  const looseOptions = visibleElements("div, span")
    .filter((element) => !isDisabledElement(element))
    .filter((element) => {
      const rawText = cleanText(element.innerText || element.textContent || element.value || "");
      const text = asciiSearchText(rawText);
      return rawText.length <= 40 && text.includes("kismi") && !text.includes("tam");
    })
    .sort((a, b) => {
      const aText = cleanText(a.innerText || a.textContent || a.value || "");
      const bText = cleanText(b.innerText || b.textContent || b.value || "");
      return aText.length - bText.length || a.children.length - b.children.length;
    });

  if (looseOptions[0]) {
    clickElement(looseOptions[0]);
    await delay(250);
    return true;
  }

  return false;
}

async function selectPartialTimeAssignmentType() {
  const optionTexts = ["kismi sureli", "kÄ±smi sÃ¼reli", "kismi", "kÄ±smi"];
  const field = findField(["gorevlendirme tipi", "gÃ¶revlendirme tipi", "gorevlendirme"]);
  if (field) {
    const currentValue = normalizeSearchText(elementTextWithValues(field));
    if (currentValue.includes("kismi")) return true;

    if (field instanceof HTMLSelectElement && setSelectOptionByText(field, optionTexts)) {
      return true;
    }

    const control =
      field.closest(".ant-select, .select2, .ng-select, [role='combobox'], [class*='select']") ||
      field.closest(".form-group, .form-line, .ant-form-item, .row") ||
      field;
    clickElement(control);
    if (await clickPartialTimeOption()) return true;
    if (await clickDropdownOptionByText(optionTexts)) return true;

    clickElement(field);
    if (await clickPartialTimeOption()) return true;
    if (await clickDropdownOptionByText(optionTexts)) return true;
  }

  const nativeSelect = getAllFields().find(
    (candidate) => candidate instanceof HTMLSelectElement && fieldContext(candidate).includes("gorevlendirme")
  );
  if (nativeSelect && setSelectOptionByText(nativeSelect, optionTexts)) return true;

  const dropdown = visibleElements("[role='combobox'], .ant-select, .select2, .select2-selection, .ng-select, .form-control")
    .filter((element) => !isDisabledElement(element))
    .find(
      (element) =>
        fieldContext(element).includes("gorevlendirme") ||
        normalizeSearchText(elementTextWithValues(element)).includes("seciniz")
    );
  if (dropdown) {
    clickElement(dropdown);
    if (await clickPartialTimeOption()) return true;
    if (await clickDropdownOptionByText(optionTexts)) return true;
  }

  return false;
}

async function fillAssignmentDetailsStep(steps) {
  const ready = await waitFor(() => isAssignmentDetailsPage(), 10000);
  if (!ready) return { ok: true, skipped: true };

  let selected = false;
  for (let attempt = 0; attempt < 10 && !selected; attempt += 1) {
    selected = await selectPartialTimeAssignmentType();
    if (!selected) await delay(500);
  }
  if (!selected) {
    return {
      ok: false,
      message: `GÃ¶revlendirme tipi KÄ±smi SÃ¼reli seÃ§ilemedi. Ekran Ã¶zeti: ${currentPagePreview()}`,
    };
  }
  steps.push("GÃ¶revlendirme tipi KÄ±smi SÃ¼reli seÃ§ildi");

  const continued = await waitFor(() => clickButtonByText(["Ä°leri", "Ileri"]), 6000);
  if (!continued) {
    return { ok: false, message: "SÃ¶zleÅŸme bilgileri ekranÄ±nda Ä°leri butonu bulunamadÄ±." };
  }
  steps.push("SÃ¶zleÅŸme bilgileri ekranÄ± geÃ§ildi");

  const succeeded = await waitFor(() => isSuccessfulTerminalPage() || isContractListPage(), 15000, 300);
  if (isSuccessfulTerminalPage()) {
    steps.push("Ä°SG-KATÄ°P baÅŸarÄ± mesajÄ± gÃ¶rÃ¼ldÃ¼");
    return { ok: true };
  }
  if (succeeded && isContractListPage()) {
    return {
      ok: false,
      message: `Ä°SG-KATÄ°P liste ekranÄ±na dÃ¶ndÃ¼; baÅŸarÄ± mesajÄ± gÃ¶rÃ¼lemedi. Ekran Ã¶zeti: ${currentPagePreview()}`,
    };
  }
  return {
    ok: false,
    message: `SÃ¶zleÅŸme bilgileri gÃ¶nderildi ama baÅŸarÄ± mesajÄ± gÃ¶rÃ¼lemedi. Ekran Ã¶zeti: ${currentPagePreview()}`,
  };
}

async function chooseProcessForRole(gorevTuru, steps) {
  const processText = PROCESS_TEXT_BY_ROLE[gorevTuru] || PROCESS_TEXT_BY_ROLE.is_guvenligi_uzmani;

  if (!clickButtonByText(["Yeni", "+ Yeni"])) {
    return { ok: false, message: "Yeni butonu bulunamadı." };
  }
  steps.push("Yeni butonu açıldı");

  const processSelectionOpened = await waitFor(() => isProcessSelectionPage(), 8000);
  if (!processSelectionOpened) {
    return { ok: false, message: `Süreç seçimi ekranı açılmadı. Ekran özeti: ${currentPagePreview()}` };
  }
  const searchField =
    findField(["lutfen surec seciniz", "süreç seçiniz", "surec seciniz"]) || findFirstEmptyTextField();
  if (searchField) {
    setFieldValue(searchField, processText);
    clickElement(searchField);
    searchField.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter" }));
  } else {
    clickFirstVisibleByText("Lütfen Süreç Seçiniz");
  }
  await delay(900);

  if (!clickProcessOption(gorevTuru)) {
    return { ok: false, message: "Görev türüne uygun süreç seçeneği bulunamadı." };
  }
  steps.push(`${roleLabel(gorevTuru)} süreci seçildi`);

  const startReady = await waitFor(() => clickButtonByText(["Başlat", "Baslat"]), 5000);
  if (!startReady) {
    return { ok: false, message: `Başlat butonu aktif bulunamadı. Ekran özeti: ${currentPagePreview()}` };
  }
  steps.push("Süreç başlatıldı");
  const moved = await waitFor(() => isCompanySelectionPage() || isInfoApprovalPage() || isSuccessfulTerminalPage(), 12000);
  if (!moved) {
    return { ok: false, message: `Süreç başlatıldı ama SGK ekranı açılmadı. Ekran özeti: ${currentPagePreview()}` };
  }
  return { ok: true };
}

async function approveInfoScreen(steps) {
  const hasInfoScreen = await waitFor(
    () =>
      isCompanySelectionPage() ||
      isInfoApprovalPage(),
    10000
  );
  if (hasInfoScreen && isCompanySelectionPage()) return { ok: true };
  if (!hasInfoScreen) return { ok: true };

  if (checkInfoApprovalBox()) {
    steps.push("Bilgilendirme metni işaretlendi");
  }

  const continued = await waitFor(() => clickButtonByText(["Başlat", "Baslat", "İleri", "Ileri"]), 6000);
  if (continued) {
    steps.push("Bilgilendirme ekranı geçildi");
    const moved = await waitFor(() => isCompanySelectionPage() || isSuccessfulTerminalPage(), 12000);
    if (!moved) {
      return {
        ok: false,
        message: `Bilgilendirme ekranı geçildi ama SGK ekranı açılmadı. Ekran özeti: ${currentPagePreview()}`,
      };
    }
    return { ok: true };
  }

  return { ok: false, message: `Bilgilendirme ekranında aktif ilerleme butonu bulunamadı. Ekran özeti: ${currentPagePreview()}` };
}

async function fillCompanyStep(job, steps) {
  const sgkNo = String(job?.sgkNo || "").replace(/\D/g, "");
  if (!sgkNo) return { ok: false, message: "Görevde SGK sicil no yok." };

  const ready = await waitFor(
    () => isCompanySelectionPage() && findField(["sgk", "sicil", "detsis", "26 hane"]),
    10000
  );
  if (!ready) return { ok: false, message: `SGK sicil no alanı bulunamadı. Ekran özeti: ${currentPagePreview()}` };

  const sgkFilled = fillSgkFields(sgkNo);
  if (!sgkFilled.mainFilled && sgkFilled.segmentCount === 0) {
    return { ok: false, message: "SGK sicil no alanı doldurulamadı." };
  }
  if (sgkFilled.segmentCount > 0 && sgkFilled.segmentCount < 9) {
    await delay(300);
    const retryFilled = fillSgkFields(sgkNo);
    sgkFilled.segmentCount = Math.max(sgkFilled.segmentCount, retryFilled.segmentCount);
  }
  steps.push(
    sgkFilled.segmentCount > 0
      ? `SGK sicil no yazıldı (${sgkFilled.segmentCount} parça)`
      : "SGK sicil no yazıldı"
  );

  if (!clickButtonByText(["Bul"])) {
    return { ok: false, message: "SGK Bul butonu bulunamadı." };
  }
  steps.push("Firma sorgulandı");

  await delay(900);
  const afterSearchFilled = fillSgkFields(sgkNo);
  if (afterSearchFilled.segmentCount > 0) {
    steps.push(`Firma sorgusu sonrası SGK parçaları doğrulandı (${afterSearchFilled.segmentCount} parça)`);
  }
  await delay(900);
  if (!clickButtonByText(["İleri", "Ileri"])) {
    return { ok: false, message: "Firma ekranında İleri butonu bulunamadı." };
  }
  steps.push("Firma ekranı geçildi");
  const moved = await waitFor(() => isPersonSelectionPage() || isSuccessfulTerminalPage(), 10000);
  if (!moved) {
    return {
      ok: false,
      message: `Firma ekranı geçilemedi. SGK parçalı alanları ve İSG-KATİP uyarılarını kontrol edin. Ekran özeti: ${currentPagePreview()}`,
    };
  }
  return { ok: true };
}

async function fillPersonStep(job, steps) {
  const tcKimlik = String(job?.assigneeTcKimlik || "").replace(/\D/g, "");
  if (!tcKimlik) return { ok: false, message: "Görevde atanacak kişinin TC kimlik no bilgisi yok." };

  const ready = await waitFor(
    () => isPersonSelectionPage() && findField(["tc", "tckn", "kimlik", "kisi tckn", "kişi tckn"]),
    10000
  );
  if (!ready) return { ok: false, message: "TC kimlik no alanı bulunamadı." };

  fillFieldByPatterns(["tc", "tckn", "kimlik", "kisi tckn", "kişi tckn"], tcKimlik);
  steps.push("TC kimlik no yazıldı");

  if (!clickButtonByText(["Bul"])) {
    return { ok: false, message: "TC Bul butonu bulunamadı." };
  }
  steps.push("Personel sorgulandı");

  await delay(1600);
  if (!clickButtonByText(["İleri", "Ileri"])) {
    return { ok: false, message: "Personel ekranında İleri butonu bulunamadı." };
  }
  steps.push("Personel ekranı geçildi");
  return { ok: true };
}

async function fillDurationStep(steps, gorevTuru = "is_guvenligi_uzmani") {
  const durationLabels = durationLabelsForRole(gorevTuru);
  const duration = await waitFor(
    () =>
      isSuccessfulTerminalPage() ||
      findValueNearLabel(durationLabels, gorevTuru),
    10000
  );
  if (duration === true) {
    if (isSuccessfulTerminalPage()) {
      steps.push("İSG-KATİP işlemi başarılı mesajı verdi");
      return { ok: true, duration: "", skipped: true };
    }
  }
  if (isContractListPage()) {
    return {
      ok: false,
      message: `İSG-KATİP liste ekranına döndü; atama kaydı oluşmadı. Ekran özeti: ${currentPagePreview()}`,
    };
  }
  if (!duration) {
    return {
      ok: false,
      message: `Gerekli toplam İSG süresi okunamadı. Ekran özeti: ${currentPagePreview()}`,
    };
  }

  if (!fillDurationField(duration)) {
    return { ok: false, message: "Çalışma süresi alanı bulunamadı." };
  }

  steps.push("Gerekli toplam süre çalışma süresine yazıldı");
  const continued = await waitFor(() => clickButtonByText(["İleri", "Ileri"]), 6000);
  if (!continued) {
    return { ok: false, message: "Süre ekranında son İleri butonu bulunamadı." };
  }
  steps.push("Süre ekranı geçildi");

  const succeeded = await waitFor(() => isSuccessfulTerminalPage() || isContractListPage(), 15000, 300);
  if (isSuccessfulTerminalPage()) {
    steps.push("İSG-KATİP başarı mesajı görüldü");
    return { ok: true, duration: parseNumberFromText(duration) };
  }
  if (succeeded && isContractListPage()) {
    return {
      ok: false,
      message: `İSG-KATİP liste ekranına döndü; başarı mesajı görülemedi. Ekran özeti: ${currentPagePreview()}`,
    };
  }
  return {
    ok: false,
    message: `Süre gönderildi ama başarı mesajı görülemedi. Ekran özeti: ${currentPagePreview()}`,
  };
}

function jobOperation(job) {
  return String(job?.operation || "create_assignment");
}

function clickTabByText(texts) {
  const wanted = texts.map(normalizeSearchText);
  const candidates = visibleElements("a, button, li, [role='tab'], .nav-link, .ant-tabs-tab, span, div")
    .filter((element) => !isDisabledElement(element))
    .sort((a, b) => {
      const aScore = a.matches("a, button, li, [role='tab'], .nav-link, .ant-tabs-tab") ? 0 : 1;
      const bScore = b.matches("a, button, li, [role='tab'], .nav-link, .ant-tabs-tab") ? 0 : 1;
      return aScore - bScore || a.children.length - b.children.length;
    });
  const tab = candidates.find((element) => {
    const text = normalizeSearchText(element.innerText || element.textContent || "");
    return wanted.some((item) => text.includes(item));
  });
  if (!tab) return false;
  clickElement(tab);
  return true;
}

function rowMatchesJob(row, job, usePrevious = false) {
  const text = normalizeSearchText(elementTextWithValues(row));
  const digits = elementTextWithValues(row).replace(/\D/g, "");
  const sgkNo = String(job?.sgkNo || "").replace(/\D/g, "");
  const firmaAdi = normalizeSearchText(job?.firmaAdi || "");
  const tcKimlik = String(
    usePrevious ? job?.previousAssigneeTcKimlik || job?.assigneeTcKimlik || "" : job?.assigneeTcKimlik || ""
  ).replace(/\D/g, "");
  const name = normalizeSearchText(usePrevious ? job?.previousAssigneeName || job?.assigneeName || "" : job?.assigneeName || "");
  const roleKeywords = PROCESS_KEYWORDS_BY_ROLE[job?.gorevTuru] || [];

  const firmMatched = (sgkNo && digits.includes(sgkNo)) || (firmaAdi && text.includes(firmaAdi.slice(0, 24)));
  const personMatched = !tcKimlik || digits.includes(tcKimlik) || (name && text.includes(name));
  const roleMatched =
    !roleKeywords.length ||
    roleKeywords.some((keyword) => text.includes(keyword)) ||
    text.includes("is guvenligi") ||
    text.includes("isyeri hekim") ||
    text.includes("diger saglik");

  return firmMatched && personMatched && roleMatched;
}

function findMatchingContractRow(job, usePrevious = false) {
  const rows = visibleElements("table tbody tr, table tr").filter((row) => row.querySelector("td"));
  return rows.find((row) => rowMatchesJob(row, job, usePrevious)) || null;
}

function checkContractRow(row) {
  const checkbox =
    row.querySelector("input[type='checkbox']") ||
    row.querySelector("[role='checkbox'], .ant-checkbox, .checkbox, [class*='checkbox']");
  if (!checkbox) return false;
  if (!isCheckedElement(checkbox)) {
    clickElement(checkbox);
    if ("checked" in checkbox) {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("input", { bubbles: true }));
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
  return true;
}

async function confirmOpenDialog(steps) {
  const confirmed = await waitFor(
    () => clickButtonByText(["Evet", "Tamam", "Onayla"]),
    7000,
    250
  );
  if (confirmed) {
    steps.push("Onay penceresi onaylandı");
    return true;
  }
  return false;
}

async function waitForSuccessToastOrList(steps, actionName) {
  const result = await waitFor(
    () => isSuccessfulTerminalPage() || isContractListPage() || normalizeSearchText(document.body?.innerText || "").includes("basari"),
    15000,
    300
  );
  if (result) {
    steps.push(`${actionName} sonucu alındı`);
    return true;
  }
  return false;
}

async function cancelPendingAssignment(job, steps) {
  clickTabByText(["Onay Bekleyen Sözleşmeler", "Onay Bekleyen"]);
  await waitFor(() => isContractListPage(), 10000);
  const row = await waitFor(() => findMatchingContractRow(job, true), 10000);
  if (!row) {
    return { ok: false, message: `Onay bekleyen sözleşme satırı bulunamadı. Ekran özeti: ${currentPagePreview()}` };
  }
  if (!checkContractRow(row)) return { ok: false, message: "Onay bekleyen satır seçilemedi." };
  steps.push("Onay bekleyen eski atama seçildi");

  if (!clickButtonByText(["İptal Et", "Iptal Et", "İptal", "Iptal"])) {
    return { ok: false, message: "İptal Et butonu bulunamadı." };
  }
  await confirmOpenDialog(steps);
  const ok = await waitForSuccessToastOrList(steps, "İptal işlemi");
  if (!ok) return { ok: false, message: `İptal sonucu görülemedi. Ekran özeti: ${currentPagePreview()}` };
  return { ok: true };
}

async function terminateActiveAssignment(job, steps) {
  clickTabByText(["Devam Eden Sözleşmeler", "Tüm Sözleşmeler"]);
  await waitFor(() => isContractListPage(), 10000);
  const row = await waitFor(() => findMatchingContractRow(job, true), 10000);
  if (!row) {
    return { ok: false, message: `Aktif sözleşme satırı bulunamadı. Ekran özeti: ${currentPagePreview()}` };
  }
  if (!checkContractRow(row)) return { ok: false, message: "Aktif sözleşme satırı seçilemedi." };
  steps.push("Aktif eski atama seçildi");

  if (!clickButtonByText(["Sözleşmeyi Sonlandır", "Sozlesmeyi Sonlandir", "Sonlandır", "Sonlandir"])) {
    return { ok: false, message: "Sözleşmeyi Sonlandır butonu bulunamadı." };
  }
  const confirmed = await confirmOpenDialog(steps);
  if (!confirmed) return { ok: false, message: "Sonlandırma onay penceresi onaylanamadı." };
  const ok = await waitForSuccessToastOrList(steps, "Sonlandırma işlemi");
  if (!ok) return { ok: false, message: `Sonlandırma sonucu görülemedi. Ekran özeti: ${currentPagePreview()}` };
  return { ok: true };
}

async function autoPrepareAssignmentJob(job) {
  const steps = [];
  const gorevTuru = job?.gorevTuru || "is_guvenligi_uzmani";

  const processResult = await chooseProcessForRole(gorevTuru, steps);
  if (!processResult.ok) return { ok: false, steps, message: processResult.message };

  const infoResult = await approveInfoScreen(steps);
  if (!infoResult.ok) return { ok: false, steps, message: infoResult.message };

  const companyResult = await fillCompanyStep(job, steps);
  if (!companyResult.ok) return { ok: false, steps, message: companyResult.message };

  const personResult = await fillPersonStep(job, steps);
  if (!personResult.ok) return { ok: false, steps, message: personResult.message };

  const durationResult = await fillDurationStep(steps, gorevTuru);
  if (!durationResult.ok) return { ok: false, steps, message: durationResult.message };

  return {
    ok: true,
    steps,
    duration: durationResult.duration,
    message: "Atama İSG-KATİP tarafında oluşturuldu ve onay sürecine alındı.",
  };
}

async function runAssignmentJob(job) {
  const operation = jobOperation(job);
  const steps = [];

  if (operation !== "create_assignment") {
    return {
      ok: false,
      steps,
      message:
        "Guvenlik nedeniyle iptal/sonlandirma otomasyonu kapali. Eklenti yalnizca yeni atama olusturur.",
    };
  }
  const createResult = await autoPrepareAssignmentJob(job);
  return {
    ...createResult,
    steps: [...steps, ...(createResult.steps || [])],
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "READ_ISG_KATIP_ROWS") return false;

  readIsgKatipSnapshotAllPages()
    .then((snapshot) => sendResponse({ ok: true, ...snapshot }))
    .catch((error) => {
      sendResponse({ ok: false, message: error?.message || "Sayfa okunamadÄ±" });
    });

  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "READ_ISG_KATIP_ROWS_LEGACY") return false;

  try {
    sendResponse({ ok: true, ...readIsgKatipSnapshot() });
  } catch (error) {
    sendResponse({ ok: false, message: error?.message || "Sayfa okunamadı" });
  }

  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "FILL_ISG_KATIP_JOB") return false;

  fillAssignmentJob(message.job)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({ ok: false, message: error?.message || "Sayfaya bilgi doldurulamadı" });
    });

  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "VERIFY_ISG_KATIP_ASSIGNMENT_DONE") return false;

  try {
    const ok = isSuccessfulTerminalPage();
    sendResponse({
      ok,
      message: ok
        ? "ISG-KATIP basari ekrani goruldu."
        : `ISG-KATIP basari ekrani gorulmedi. Ekran ozeti: ${currentPagePreview()}`,
    });
  } catch (error) {
    sendResponse({ ok: false, message: error?.message || "ISG-KATIP ekran durumu okunamadi." });
  }

  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "AUTO_PREPARE_ISG_KATIP_JOB") return false;

  runAssignmentJob(message.job)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({ ok: false, message: error?.message || "Atama otomasyonu çalıştırılamadı." });
    });

  return true;
});
