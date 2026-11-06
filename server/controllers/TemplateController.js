const Template = require("../models/Template");

// Create template
exports.createTemplate = async (req, res) => {
  try {
    const { queryId, templateName, subject, body } = req.body;

    if (
      !queryId ||
      !templateName?.trim() ||
      !subject?.trim() ||
      !body?.trim()
    ) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const template = await Template.create({
      queryId,
      templateName: templateName.trim(),
      subject: subject.trim(),
      body,
    });

    res.status(201).json({
      message: "Template created successfully",
      template,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error creating template",
      error: error.message,
    });
  }
};

// Get template
exports.getTemplate = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        message: "Template not found",
      });
    }

    res.status(200).json({
      message: "Template retrieved successfully",
      template,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving template",
      error: error.message,
    });
  }
};

// Update template
exports.updateTemplate = async (req, res) => {
  try {
    const { templateName, subject, body } = req.body;

    if (
      typeof templateName !== "string" ||
      typeof subject !== "string" ||
      typeof body !== "string" ||
      !templateName.trim() ||
      !subject.trim() ||
      !body.trim()
    ) {
      return res.status(400).json({
        message: "Template name, subject, and body are required",
      });
    }

    const template = await Template.findByIdAndUpdate(
      req.params.id,
      {
        templateName: templateName.trim(),
        subject,
        body,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!template) {
      return res.status(404).json({
        message: "Template not found",
      });
    }

    res.status(200).json({
      message: "Template updated successfully",
      template,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating template",
      error: error.message,
    });
  }
};

// Preview template
exports.previewTemplate = async (req, res) => {
  try {
    const { subject, body } = req.body;

    if (
      typeof subject !== "string" ||
      typeof body !== "string"
    ) {
      return res.status(400).json({
        message: "Subject and body are required",
      });
    }

    res.status(200).json({
      message: "Preview generated successfully",
      preview: {
        subject,
        body,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error generating preview",
      error: error.message,
    });
  }
};