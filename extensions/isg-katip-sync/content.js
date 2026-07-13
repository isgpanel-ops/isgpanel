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
    rawText: rawText.slice(0, 240),
  };
}

function readRowsFromTables() {
  const rows = Array.from(document.querySelectorAll("table tbody tr, table tr"));
  return rows
    .map((row) => {
      const cells = Array.from(row.querySelectorAll("td, th")).map((cell) => cellTextForSync(cell));
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
      !field.disabled &&
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
  const wanted = normalizeSearchText(text);
  const candidates = visibleElements("li, a, button, [role='option'], [role='menuitem'], .ant-select-item-option, div, span")
    .filter((element) => !isDisabledElement(element))
    .sort((a, b) => {
      const aRoleScore = a.matches("li, a, button, [role='option'], [role='menuitem'], .ant-select-item-option") ? 0 : 1;
      const bRoleScore = b.matches("li, a, button, [role='option'], [role='menuitem'], .ant-select-item-option") ? 0 : 1;
      return aRoleScore - bRoleScore || a.children.length - b.children.length;
    });
  const option = candidates.find((element) => {
    const value = normalizeSearchText(element.innerText || element.textContent || "");
    return value === wanted || value.includes(wanted);
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

function isSuccessfulTerminalPage() {
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

function durationFromRawText(rawText) {
  const text = cleanText(rawText);
  const patterns = [
    /GEREKL[İI]\s+TOPLAM\s+(?:İSG|ISG)\s+S[ÜU]RES[İI]\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i,
    /TOPLAM\s+(?:İSG|ISG)\s+S[ÜU]RES[İI]\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i,
    /DEVAM\s+EDEN\s+TOPLAM\s+(?:İSG|ISG)\s+S[ÜU]RES[İI]\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].replace(",", ".");
  }
  return "";
}

function findValueNearLabel(patterns) {
  const normalizedPatterns = patterns.map(normalizeSearchText);
  const rows = Array.from(document.querySelectorAll("tr, .row, .form-group, .form-line, .ant-row, div"));
  for (const row of rows) {
    const rowRawText = elementTextWithValues(row);
    const directDuration = durationFromRawText(rowRawText);
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

  if (!clickFirstVisibleByText(processText)) {
    return { ok: false, message: "Görev türüne uygun süreç seçeneği bulunamadı." };
  }
  steps.push(`${GOREV_TURLERI[gorevTuru] || "Görev"} süreci seçildi`);

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
  steps.push(
    sgkFilled.segmentCount > 0
      ? `SGK sicil no yazıldı (${sgkFilled.segmentCount} parça)`
      : "SGK sicil no yazıldı"
  );

  if (!clickButtonByText(["Bul"])) {
    return { ok: false, message: "SGK Bul butonu bulunamadı." };
  }
  steps.push("Firma sorgulandı");

  await delay(1600);
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

async function fillDurationStep(steps) {
  const duration = await waitFor(
    () =>
      isSuccessfulTerminalPage() ||
      findValueNearLabel([
        "gerekli toplam isg suresi",
        "gerekli toplam i̇sg süresi",
        "gerekli toplam iş güvenliği süresi",
        "devam eden toplam isg suresi",
      ]),
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
  return { ok: true, duration: parseNumberFromText(duration) };
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

  const durationResult = await fillDurationStep(steps);
  if (!durationResult.ok) return { ok: false, steps, message: durationResult.message };

  return {
    ok: true,
    steps,
    duration: durationResult.duration,
    message: "Atama son kontrol ekranına kadar hazırlandı.",
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

  autoPrepareAssignmentJob(message.job)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({ ok: false, message: error?.message || "Atama otomasyonu çalıştırılamadı." });
    });

  return true;
});
