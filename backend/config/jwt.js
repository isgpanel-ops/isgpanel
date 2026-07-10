function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || String(secret).trim().length < 10) {
    throw new Error("JWT_SECRET env eksik veya çok kısa");
  }

  return secret;
}

module.exports = { getJwtSecret };
