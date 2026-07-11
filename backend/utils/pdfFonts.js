const fs = require("fs");
const path = require("path");
const { StandardFonts } = require("pdf-lib");

function existingFontPath() {
  const candidates = [
    process.env.ISGPANEL_BOLD_FONT,
    path.join(process.cwd(), "backend", "fonts", "NotoSans-Bold.ttf"),
    path.join(process.cwd(), "fonts", "NotoSans-Bold.ttf"),
    path.join(__dirname, "..", "fonts", "NotoSans-Bold.ttf"),
    path.join(process.cwd(), "isg_prosedur_template", "fonts", "NotoSans-Bold.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
    "C:\\Windows\\Fonts\\arialbd.ttf",
    "C:\\Windows\\Fonts\\calibrib.ttf",
  ].filter(Boolean);

  return candidates.find((fontPath) => {
    try {
      return fs.existsSync(fontPath) && fs.statSync(fontPath).size > 0;
    } catch {
      return false;
    }
  });
}

async function embedBoldFont(pdfDoc, fontkit) {
  const fontPath = existingFontPath();

  if (fontPath) {
    if (fontkit) pdfDoc.registerFontkit(fontkit);
    const fontBytes = fs.readFileSync(fontPath);
    return pdfDoc.embedFont(fontBytes);
  }

  return pdfDoc.embedFont(StandardFonts.HelveticaBold);
}

module.exports = {
  embedBoldFont,
  existingFontPath,
};
