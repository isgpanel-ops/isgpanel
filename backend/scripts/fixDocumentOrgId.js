// backend/scripts/fixDocumentOrgId.js
require("dotenv").config();
const mongoose = require("mongoose");
const Document = require("../models/Document");
const Firma = require("../models/Firma");

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("DB connected");

    let fixed = 0;

    const docs = await Document.find({
      $or: [
        { organizationId: { $exists: false } },
        { organizationId: null },
        { organizationId: "" },
      ],
    });

    console.log("Eksik org doc:", docs.length);

    for (const doc of docs) {
      if (!doc.firmaId) continue;

      const firma = await Firma.findById(doc.firmaId).lean();
      if (!firma || !firma.organization) continue;

      doc.organizationId = String(firma.organization);
      await doc.save();
      fixed++;
    }

    console.log("Fixed:", fixed);
    process.exit();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();