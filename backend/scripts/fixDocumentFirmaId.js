// backend/scripts/fixDocumentOrgId.js
require("dotenv").config();
const mongoose = require("mongoose");

const Document = require("../models/Document");
const Firma = require("../models/Firma");

async function main() {
  const MONGO =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.DATABASE_URL ||
    "mongodb://127.0.0.1:27017/isgpanel";

  await mongoose.connect(MONGO);
  console.log("DB connected");

  // organizationId olmayan dokümanları bul
  const docs = await Document.find({
    $or: [{ organizationId: { $exists: false } }, { organizationId: null }, { organizationId: "" }],
  })
    .select("_id firmaId")
    .lean();

  let ok = 0;
  let fail = 0;

  for (const d of docs) {
    try {
      if (!d.firmaId) {
        fail++;
        continue;
      }

      // firmaId string ama firma _id ObjectId
      const firm = await Firma.findById(d.firmaId).select("organization").lean();
      if (!firm?.organization) {
        fail++;
        continue;
      }

      await Document.updateOne(
        { _id: d._id },
        { $set: { organizationId: String(firm.organization) } }
      );

      ok++;
    } catch (e) {
      fail++;
    }
  }

  console.log("Fixed:", ok, "Fail:", fail);
  await mongoose.disconnect();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});