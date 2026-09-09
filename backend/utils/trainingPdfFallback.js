const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const { embedBoldFont } = require("./pdfFonts");

const text = (value) => String(value ?? "").trim();

function isBrowserUnavailableError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return [
    "could not find expected browser",
    "failed to launch the browser",
    "chromium revision",
    "executable doesn't exist",
    "did not find any executable",
  ].some((part) => message.includes(part));
}

function imageData(value) {
  const source = text(value?.dataUrl || value?.imza?.dataUrl || value?.imza || value);
  if (!source) return "";
  if (source.startsWith("data:image/")) return source;
  return /^[A-Za-z0-9+/=\r\n]+$/.test(source) && source.length > 100
    ? `data:image/png;base64,${source.replace(/\s/g, "")}`
    : "";
}

async function embedImage(pdfDoc, dataUrl) {
  const [meta, base64] = text(dataUrl).split(",");
  if (!base64) return null;
  const bytes = Buffer.from(base64, "base64");
  try {
    return meta.includes("jpeg") || meta.includes("jpg")
      ? await pdfDoc.embedJpg(bytes)
      : await pdfDoc.embedPng(bytes);
  } catch {
    return null;
  }
}

function fit(font, value, size, width) {
  let out = text(value) || "-";
  while (out.length > 1 && font.widthOfTextAtSize(out, size) > width) {
    out = `${out.slice(0, -2).trim()}...`;
  }
  return out;
}

function roleData(payload, role) {
  const aliases = role === "uzman"
    ? ["uzman", "isgUzmani", "isg_uzmani"]
    : role === "hekim"
      ? ["hekim", "isyeriHekimi", "isyeri_hekimi"]
      : ["isveren", "isverenVekili", "isveren_vekili"];
  const sources = [payload?.imzalar, payload?.firmaImzalari, payload?.firma?.imzalar, payload];
  const signature = sources.map((source) => aliases.map((key) => source?.[key]).find(Boolean)).find(Boolean);
  const people = payload?.kisiler || payload?.riskKisiler || {};
  const name = aliases.map((key) => people?.[key] || payload?.[`${key}AdSoyad`]).find(Boolean) || "";
  return { name: text(name).split("/")[0].trim(), signature: imageData(signature) };
}

async function drawSignature(page, pdfDoc, dataUrl, x, y, width, height) {
  const image = await embedImage(pdfDoc, dataUrl);
  if (!image) return;
  const ratio = Math.min(width / image.width, height / image.height);
  page.drawImage(image, {
    x: x + (width - image.width * ratio) / 2,
    y: y + (height - image.height * ratio) / 2,
    width: image.width * ratio,
    height: image.height * ratio,
  });
}

async function createTrainingFallbackPdf(payload = {}, { title = "EĞİTİM BELGESİ", landscape = false } = {}) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await embedBoldFont(pdfDoc, fontkit);
  const page = pdfDoc.addPage(landscape ? [841.89, 595.28] : [595.28, 841.89]);
  const width = page.getWidth();
  const navy = rgb(0.04, 0.19, 0.31);
  const line = rgb(0.65, 0.7, 0.76);
  const firma = text(payload?.firma?.firmaAdi || payload?.kurumsal?.firmaAdi || payload?.firmaAdi);
  const people = Array.isArray(payload?.katilimcilar) && payload.katilimcilar.length
    ? payload.katilimcilar
    : payload?.personel ? [payload.personel] : [{}];

  page.drawRectangle({ x: 30, y: page.getHeight() - 66, width: width - 60, height: 36, color: navy });
  const titleSize = 14;
  page.drawText(fit(font, title, titleSize, width - 90), { x: 45, y: page.getHeight() - 53, size: titleSize, font, color: rgb(1, 1, 1) });
  page.drawText(fit(font, firma, 10, width - 90), { x: 40, y: page.getHeight() - 88, size: 10, font, color: navy });

  const headers = ["No", "T.C. Kimlik No", "Ad Soyad", "Görevi", "İşe Giriş Tarihi"];
  const tableX = 30;
  const tableWidth = width - 60;
  const columnWidths = [30, 110, 170, 130, tableWidth - 440];
  let x = tableX;
  const top = page.getHeight() - 118;
  headers.forEach((header, index) => {
    page.drawRectangle({ x, y: top - 22, width: columnWidths[index], height: 22, color: rgb(0.9, 0.93, 0.96), borderWidth: 0.5, borderColor: line });
    page.drawText(fit(font, header, 7, columnWidths[index] - 6), { x: x + 3, y: top - 14, size: 7, font, color: navy });
    x += columnWidths[index];
  });

  people.slice(0, 8).forEach((person, index) => {
    const y = top - 22 - (index + 1) * 43;
    const values = [index + 1, person?.tc || person?.tcKimlikNo, person?.adSoyad, person?.gorev || person?.unvan, person?.iseGirisTarihiTR || person?.iseGirisTarihi];
    let cellX = tableX;
    values.forEach((value, cellIndex) => {
      page.drawRectangle({ x: cellX, y, width: columnWidths[cellIndex], height: 43, borderWidth: 0.5, borderColor: line });
      page.drawText(fit(font, value, 7, columnWidths[cellIndex] - 6), { x: cellX + 3, y: y + 18, size: 7, font, color: navy });
      cellX += columnWidths[cellIndex];
    });
  });

  const roles = ["isveren", "uzman", "hekim"].map((role) => ({ role, ...roleData(payload, role) }));
  const signatureY = 110;
  const gap = (width - 80) / 3;
  for (let index = 0; index < roles.length; index += 1) {
    const role = roles[index];
    const xPos = 40 + index * gap;
    const label = role.role === "uzman" ? "İŞ GÜVENLİĞİ UZMANI" : role.role === "hekim" ? "İŞYERİ HEKİMİ" : "İŞVEREN / VEKİLİ";
    page.drawText(label, { x: xPos, y: signatureY + 88, size: 8, font, color: navy });
    page.drawText(fit(font, role.name, 8, gap - 20), { x: xPos, y: signatureY + 73, size: 8, font, color: navy });
    await drawSignature(page, pdfDoc, role.signature, xPos + 10, signatureY + 12, gap - 40, 52);
    page.drawLine({ start: { x: xPos, y: signatureY + 8 }, end: { x: xPos + gap - 25, y: signatureY + 8 }, thickness: 0.5, color: line });
  }

  page.drawText("Bu belge İSG Panel üzerinden oluşturulmuştur.", { x: 40, y: 35, size: 7, font, color: rgb(0.3, 0.35, 0.4) });
  return Buffer.from(await pdfDoc.save());
}

module.exports = { isBrowserUnavailableError, createTrainingFallbackPdf };
