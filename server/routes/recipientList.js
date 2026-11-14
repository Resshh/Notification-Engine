const router = require('express').Router()
const mongoose = require('mongoose')
const { RecipientList } = require('../models')
const { requireAuth, requireAdmin } = require('../middleware/auth')

// Email validation
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function badRequest(message) {
  const error = new Error(message)
  error.status = 400
  return error
}

// Validate and prepare recipient list input
function readListInput(body, { creating = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Request body must be a JSON object.')
  }

  const input = {}

  // Validate list name
  if (creating || Object.hasOwn(body, 'name')) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      throw badRequest('List name is required.')
    }

    input.name = body.name.trim()
  }

  // Validate To, CC and BCC email arrays
  for (const field of ['emails', 'cc', 'bcc']) {
    if (creating && !Object.hasOwn(body, field)) {
      input[field] = []
      continue
    }

    if (!Object.hasOwn(body, field)) continue

    if (!Array.isArray(body[field])) {
      throw badRequest(
        `${field} must be an array of email addresses.`
      )
    }

    input[field] = body[field].map((value, index) => {
      if (
        typeof value !== 'string' ||
        !emailPattern.test(value.trim())
      ) {
        throw badRequest(
          `Invalid email address in ${field} at position ${index + 1}.`
        )
      }

      return value.trim()
    })
  }

  // At least one To email address is required
  if (
    Object.hasOwn(input, 'emails') &&
    input.emails.length === 0
  ) {
    throw badRequest('At least one To email address is required.')
  }

  // Prevent an update without any fields
  if (!creating && Object.keys(input).length === 0) {
    throw badRequest(
      'Provide a list name, emails, cc, or bcc to update.'
    )
  }

  return input
}

// Handle database validation and duplicate-name errors
function handleWriteError(error, res, next) {
  if (error.code === 11000) {
    return res.status(409).json({
      error: 'A recipient list with this name already exists.',
    })
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: error.message,
    })
  }

  return next(error)
}

// GET: Any authenticated user can view recipient lists
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const lists = await RecipientList.find()
      .sort({ name: 1 })
      .lean()

    res.json({ lists })
  } catch (error) {
    next(error)
  }
})

// POST: Admin only - Create recipient list
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const input = readListInput(req.body, { creating: true })

    const list = await RecipientList.create(input)

    res.status(201).json({ list })
  } catch (error) {
    handleWriteError(error, res, next)
  }
})

// PUT: Admin only - Update recipient list
router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: 'Invalid recipient list ID.',
      })
    }

    const input = readListInput(req.body)

    const list = await RecipientList.findById(req.params.id)

    if (!list) {
      return res.status(404).json({
        error: 'Recipient list not found.',
      })
    }

    Object.assign(list, input)

    await list.save()

    res.json({ list })
  } catch (error) {
    handleWriteError(error, res, next)
  }
})

// DELETE: Admin only - Delete recipient list
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: 'Invalid recipient list ID.',
      })
    }

    const list = await RecipientList.findByIdAndDelete(req.params.id)

    if (!list) {
      return res.status(404).json({
        error: 'Recipient list not found.',
      })
    }

    res.json({
      message: 'Recipient list deleted.',
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
