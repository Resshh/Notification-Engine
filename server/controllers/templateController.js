const mongoose = require("mongoose");
const { Template, Job } = require("../models");
const { render } = require("../engine/template");

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function readTemplateInput(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createError(400, "Request body must be an object.");
  }

  const template = {};
  for (const field of ["name", "subject", "body"]) {
    if (partial && !Object.hasOwn(body, field)) {
      continue;
    }

    if (typeof body[field] !== "string" || !body[field].trim()) {
      throw createError(400, `${field} is required.`);
    }

    template[field] = body[field].trim();
  }

  if (partial && Object.keys(template).length === 0) {
    throw createError(400, "Provide at least one template field to update.");
  }

  return template;
}

function handleWriteError(error, next) {
  if (error.code === 11000) {
    error.statusCode = 409;
    error.message = "A template with this name already exists.";
  }

  next(error);
}

async function getTemplates(req, res, next) {
  try {
    const templates = await Template.find().sort({ name: 1 }).lean();
    return res.json({ templates });
  } catch (error) {
    return next(error);
  }
}

async function createTemplate(req, res, next) {
  try {
    const input = readTemplateInput(req.body);
    const template = await Template.create(input);
    return res.status(201).json({ template });
  } catch (error) {
    return handleWriteError(error, next);
  }
}

async function updateTemplate(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw createError(400, "Invalid template ID.");
    }

    const input = readTemplateInput(req.body, { partial: true });
    const template = await Template.findByIdAndUpdate(
      req.params.id,
      input,
      { new: true, runValidators: true }
    );

    if (!template) {
      throw createError(404, "Template not found.");
    }

    return res.json({ template });
  } catch (error) {
    return handleWriteError(error, next);
  }
}

async function deleteTemplate(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw createError(400, "Invalid template ID.");
    }

    const jobs = await Job.find({ templateId: req.params.id }, "name").lean();
    if (jobs.length) {
      throw createError(409, `Cannot delete this template: used by job(s) ${jobs.map((j) => j.name).join(", ")}. Change those jobs first.`);
    }

    const template = await Template.findByIdAndDelete(req.params.id);
    if (!template) {
      throw createError(404, "Template not found.");
    }

    return res.json({ message: "Template deleted." });
  } catch (error) {
    return next(error);
  }
}

function previewTemplate(req, res, next) {
  try {
    const { subject, body, row } = req.body || {};
    if (
      typeof subject !== "string" ||
      typeof body !== "string" ||
      !row ||
      typeof row !== "object" ||
      Array.isArray(row)
    ) {
      throw createError(400, "Subject, body, and a sample row are required.");
    }

    const renderedSubject = render(subject, row);
    const renderedBody = render(body, row);
    return res.json({
      preview: {
        subject: renderedSubject.text,
        body: renderedBody.text
      },
      missing: [...new Set([...renderedSubject.missing, ...renderedBody.missing])]
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  previewTemplate
};
