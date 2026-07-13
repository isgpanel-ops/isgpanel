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
  field.focus();
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
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

function fillAssignmentJob(job) {
  const sgkNo = String(job?.sgkNo || "").replace(/\D/g, "");
  const tcKimlik = String(job?.assigneeTcKimlik || "").replace(/\D/g, "");
  if (!sgkNo || !tcKimlik) {
    return { ok: false, message: "Görevde SGK veya TC bilgisi eksik." };
  }

  const filled = {
    sgk: fillBestField(["sgk", "sicil", "detsis"], sgkNo),
    tc: fillBestField(["tc", "kimlik", "gorevlendirilen"], tcKimlik),
  };

  return { ok: true, filled };
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
  const candidates = visibleElements("button, a, [role='button'], input[type='button'], input[type='submit']");
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
  const candidates = visibleElements("li, div, span, a, button, [role='option'], [role='menuitem']");
  const option = candidates.find((element) => {
    const value = normalizeSearchText(element.innerText || element.textContent || "");
    return value === wanted || value.includes(wanted);
  });
  if (!option) return false;
  clickElement(option);
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

function findValueNearLabel(patterns) {
  const normalizedPatterns = patterns.map(normalizeSearchText);
  const rows = Array.from(document.querySelectorAll("tr, .row, .form-group, div"));
  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll("td, th, label, span, div")).filter(isVisibleElement);
    if (cells.length >= 2) {
      const firstText = normalizeSearchText(cells[0].innerText || cells[0].textContent || "");
      if (normalizedPatterns.some((pattern) => firstText.includes(pattern))) {
        const value = cleanText(cells[cells.length - 1].innerText || cells[cells.length - 1].textContent || "");
        if (parseNumberFromText(value)) return value;
      }
    }

    const rowText = normalizeSearchText(row.innerText || row.textContent || "");
    if (normalizedPatterns.some((pattern) => rowText.includes(pattern))) {
      const rawText = cleanText(row.innerText || row.textContent || "");
      const afterLabel = rawText.split(/GEREKLİ TOPLAM İSG SÜRESİ|GEREKLI TOPLAM ISG SURESI/i).pop();
      const number = parseNumberFromText(afterLabel || rawText);
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

  await waitFor(() => normalizeSearchText(document.body.innerText).includes("surec secimi"), 8000);
  const searchField =
    findField(["lutfen surec seciniz", "süreç seçiniz", "surec seciniz"]) || findFirstEmptyTextField();
  if (searchField) {
    setFieldValue(searchField, processText);
    clickElement(searchField);
  } else {
    clickFirstVisibleByText("Lütfen Süreç Seçiniz");
  }
  await delay(500);

  if (!clickFirstVisibleByText(processText)) {
    return { ok: false, message: "Görev türüne uygun süreç seçeneği bulunamadı." };
  }
  steps.push(`${GOREV_TURLERI[gorevTuru] || "Görev"} süreci seçildi`);

  await delay(500);
  if (!clickButtonByText(["Başlat", "Baslat"])) {
    return { ok: false, message: "Başlat butonu bulunamadı." };
  }
  steps.push("Süreç başlatıldı");
  return { ok: true };
}

async function approveInfoScreen(steps) {
  const hasInfoScreen = await waitFor(
    () => normalizeSearchText(document.body.innerText).includes("okudum") || normalizeSearchText(document.body.innerText).includes("bilgilendirme"),
    10000
  );
  if (!hasInfoScreen) return { ok: true };

  const checkbox = visibleElements("input[type='checkbox']").find((input) => !input.checked);
  if (checkbox) {
    clickElement(checkbox);
    steps.push("Bilgilendirme metni işaretlendi");
  }

  if (clickButtonByText(["Başlat", "Baslat", "İleri", "Ileri"])) {
    steps.push("Bilgilendirme ekranı geçildi");
    return { ok: true };
  }

  return { ok: false, message: "Bilgilendirme ekranında ilerleme butonu bulunamadı." };
}

async function fillCompanyStep(job, steps) {
  const sgkNo = String(job?.sgkNo || "").replace(/\D/g, "");
  if (!sgkNo) return { ok: false, message: "Görevde SGK sicil no yok." };

  const ready = await waitFor(() => findField(["sgk", "sicil", "detsis", "26 hane"]), 10000);
  if (!ready) return { ok: false, message: "SGK sicil no alanı bulunamadı." };

  fillFieldByPatterns(["sgk", "sicil", "detsis", "26 hane"], sgkNo);
  steps.push("SGK sicil no yazıldı");

  if (!clickButtonByText(["Bul"])) {
    return { ok: false, message: "SGK Bul butonu bulunamadı." };
  }
  steps.push("Firma sorgulandı");

  await delay(1600);
  if (!clickButtonByText(["İleri", "Ileri"])) {
    return { ok: false, message: "Firma ekranında İleri butonu bulunamadı." };
  }
  steps.push("Firma ekranı geçildi");
  return { ok: true };
}

async function fillPersonStep(job, steps) {
  const tcKimlik = String(job?.assigneeTcKimlik || "").replace(/\D/g, "");
  if (!tcKimlik) return { ok: false, message: "Görevde atanacak kişinin TC kimlik no bilgisi yok." };

  const ready = await waitFor(() => findField(["tc", "tckn", "kimlik", "kisi tckn", "kişi tckn"]), 10000);
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
      findValueNearLabel([
        "gerekli toplam isg suresi",
        "gerekli toplam i̇sg süresi",
        "gerekli toplam iş güvenliği süresi",
      ]),
    10000
  );
  if (!duration) return { ok: false, message: "Gerekli toplam İSG süresi okunamadı." };

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

  try {
    sendResponse(fillAssignmentJob(message.job));
  } catch (error) {
    sendResponse({ ok: false, message: error?.message || "Sayfaya bilgi doldurulamadı" });
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
