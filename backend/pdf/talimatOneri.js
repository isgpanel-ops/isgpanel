/**
 * backend/pdf/talimatOneri.js
 *
 * Amaç:
 * - server.js içindeki require("./pdf/talimatOneri") hatasını kaldırmak
 * - /api/talimat/oneri/pdf ve /api/talimat/oneri/pdf-bulk çağrılarını çalıştırmak
 *
 * Not:
 * - Şimdilik "öneri talimat" PDF’i, inşaat talimat PDF’i ile aynı içerik ve isimlendirme ile üretilir.
 * - İleride ayrı şablon/isim istenirse bu dosya genişletilir.
 */

const {
  insaatTalimatPdf,
  insaatTalimatPdfBulk,
} = require("./talimatInsaat");

// Tekli PDF -> inşaat talimatı üret
async function oneriTalimatPdf(req, res) {
  return insaatTalimatPdf(req, res);
}

// Toplu ZIP -> inşaat talimatı üret
async function oneriTalimatPdfBulk(req, res) {
  return insaatTalimatPdfBulk(req, res);
}

module.exports = {
  oneriTalimatPdf,
  oneriTalimatPdfBulk,
};
