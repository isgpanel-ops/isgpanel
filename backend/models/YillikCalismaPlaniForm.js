const mongoose = require(mongoose);

const YillikCalismaPlaniRowSchema = new mongoose.Schema(
  {
    id { type String, default  },
    siraNo { type Number, default 0 },
    name { type String, default  },
    months { type mongoose.Schema.Types.Mixed, default {} },
  },
  { _id false }
);

const YillikCalismaPlaniFormSchema = new mongoose.Schema(
  {
    organizationId { type String, required true, index true },
    firmaId { type String, required true, index true },
    firmaAdi { type String, default  },

    type {
      type String,
      default yillik-calisma-plani,
      index true,
    },

    planYear { type Number, default new Date().getFullYear() },
    startDate { type String, default  },
    monthMode { type String, default fromStart },
    customMonths { type [String], default [] },

    activities {
      type [YillikCalismaPlaniRowSchema],
      default [],
    },
  },
  { timestamps true }
);

YillikCalismaPlaniFormSchema.index(
  { organizationId 1, firmaId 1, type 1 },
  { unique true }
);

module.exports =
  mongoose.models.YillikCalismaPlaniForm 
  mongoose.model(YillikCalismaPlaniForm, YillikCalismaPlaniFormSchema);