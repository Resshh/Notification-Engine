const mongoose = require("mongoose");

const templateSchema = new mongoose.Schema(
  {
    queryId: {
      type: String,
      required: true,
    },
    templateName: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Use a separate model name to avoid conflict
const Template = mongoose.model("EmailTemplate", templateSchema);

module.exports = Template;