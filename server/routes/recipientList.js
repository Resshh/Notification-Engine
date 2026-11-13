const router = require('express').Router()
const mongoose = require('mongoose')
const { RecipientList } = require('../models')
const { requireAuth, requireAdmin } = require('../middleware/auth')

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function badRequest(message) {
  const error = new Error(message)
  error.status = 400
  return error
}

function readListInput(body, { creating = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Request body must be a JSON object.')
  }

  const input = {}

  if (creating || Object.hasOwn(body, 'name')) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      throw badRequest('List name is required.')
    }
    input.name = body.name.trim()
  }

  for (const field of ['emails', 'cc', 'bcc']) {
    if (creating && !Object.hasOwn(body, field)) {
      input[field] = []
      continue
    }

    if (!Object.hasOwn(body, field)) continue

    if (!Array.isArray(body[field])) {
      throw badRequest(`${field} must be an array of email addresses.`)
    }

    input[field] = body[field].map((value, index) => {
      if (typeof value !== 'string' || !emailPattern.test(value.trim())) {
        throw badRequest(`Invalid email address in ${field} at position ${index + 1}.`)
      }
      return value.trim()
    })
  }

  if (!creating && Object.keys(input).length === 0) {
    throw badRequest('Provide a list name, emails, cc, or bcc to update.')
  }

  return input
}

function handleWriteError(error, res, next) {
  if (error.code === 11000) {
    return res.status(409).json({
      error: 'A recipient list with this name already exists.',
    })
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({ error: error.message })
  }

  return next(error)
}

// Any logged-in user can view the lists.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const lists = await RecipientList.find().sort({ name: 1 }).lean()
    res.json({ lists })
  } catch (error) {
    next(error)
  }
})

// Only admins can create lists.
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const input = readListInput(req.body, { creating: true })
    const list = await RecipientList.create(input)
    res.status(201).json({ list })
  } catch (error) {
    handleWriteError(error, res, next)
  }
})

// Only admins can update lists. Omitted fields are left unchanged.
router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid recipient list ID.' })
    }

    const input = readListInput(req.body)
    const list = await RecipientList.findById(req.params.id)

    if (!list) {
      return res.status(404).json({ error: 'Recipient list not found.' })
    }

    Object.assign(list, input)
    await list.save()
    res.json({ list })
  } catch (error) {
    handleWriteError(error, res, next)
  }
})

// Only admins can delete lists.
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid recipient list ID.' })
    }

    const list = await RecipientList.findByIdAndDelete(req.params.id)

    if (!list) {
      return res.status(404).json({ error: 'Recipient list not found.' })
    }

    res.json({ message: 'Recipient list deleted.' })
  } catch (error) {
    next(error)
  }
})

module.exports = router

const jwt = require("jsonwebtoken");

// Verify JWT token and identify the logged-in user.
function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    return res.status(401).json({
      error: "Authentication required"
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      error: "Server authentication is not configured"
    });
  }

  try {
    const decoded = jwt.verify(match[1], process.env.JWT_SECRET, {
      algorithms: ["HS256"]
    });

    if (!decoded.id || !decoded.role) {
      return res.status(401).json({
        error: "Invalid authentication token"
      });
    }

    req.user = {
      _id: decoded.id,
      username: decoded.name || "",
      role: decoded.role
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      error: "Invalid or expired authentication token"
    });
  }
}

// Only authenticated administrators can access protected routes.
function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        error: "Admin access required"
      });
    }

    return next();
  });
}

// Default export supports existing Batch 2 connectionRoutes.js.
module.exports = requireAuth;

// Named exports support Batch 1 recipientList.js.
module.exports.requireAuth = requireAuth;
module.exports.requireAdmin = requireAdmin;
