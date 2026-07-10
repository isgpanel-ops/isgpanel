const Iyzipay = require("iyzipay");

const apiKey = process.env.IYZICO_API_KEY;
const secretKey = process.env.IYZICO_SECRET_KEY;
const baseUrl = process.env.IYZICO_BASE_URL;

if (!apiKey || !secretKey || !baseUrl) {
  console.log("⚠️ Iyzico ENV eksik! (Ödeme devre dışı)");
  console.log("IYZICO_API_KEY:", apiKey ? "VAR" : "YOK");
  console.log("IYZICO_SECRET_KEY:", secretKey ? "VAR" : "YOK");
  console.log("IYZICO_BASE_URL:", baseUrl ? "VAR" : "YOK");

  // ✅ env yokken server çökmesin diye null export ediyoruz
  module.exports = null;
} else {
  module.exports = new Iyzipay({
    apiKey,
    secretKey,
    uri: baseUrl,
  });
}