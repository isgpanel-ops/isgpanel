const express = require("express");
const app = express();

app.get("/ping", (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

app.listen(5050, () => {
  console.log("PING test http://127.0.0.1:5050");
});
// --- en alt ---
const PORT = process.env.PORT || 5000;
const HOST = "127.0.0.1";

const server = app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});

// Dinleme sırasında bir hata olursa ekrana bas ve süreci kapatma
server.on("error", (err) => {
  console.error("Listen error:", err);
});

// Sürecin istemeden kapanmasını engelleyen küçük bekleme (gerekirse)
setInterval(() => {}, 1 << 30);
