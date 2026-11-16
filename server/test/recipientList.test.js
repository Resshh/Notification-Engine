const request = require('http')
const express = require('express')
const jwt = require('jsonwebtoken')

const { RecipientList } = require('../models')
const recipientListRouter = require('../routes/recipientList')

// Test JWT secret
process.env.JWT_SECRET = 'test-secret'

// Test Express application
const app = express()

app.use(express.json())
app.use('/api/recipient-lists', recipientListRouter)

// Error handler for unexpected errors
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  })
})

// Generate authentication token
function createToken(role = 'admin') {
  return jwt.sign(
    { id: '123456789012345678901234', role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )
}

// HTTP request helper
async function makeRequest(method, path, body, token) {
  const server = app.listen(0)

  try {
    const port = server.address().port

    return await new Promise((resolve, reject) => {
      const data = body === undefined
        ? null
        : JSON.stringify(body)

      const options = {
        hostname: '127.0.0.1',
        port,
        path: `/api/recipient-lists${path}`,
        method,
        headers: {},
      }

      if (data !== null) {
        options.headers['Content-Type'] = 'application/json'
        options.headers['Content-Length'] = Buffer.byteLength(data)
      }

      if (token) {
        options.headers.Authorization = `Bearer ${token}`
      }

      const req = request.request(options, (res) => {
        let responseData = ''

        res.on('data', (chunk) => {
          responseData += chunk
        })

        res.on('end', () => {
          let parsedData = {}

          try {
            parsedData = responseData
              ? JSON.parse(responseData)
              : {}
          } catch {
            parsedData = { raw: responseData }
          }

          resolve({
            status: res.statusCode,
            body: parsedData,
          })
        })
      })

      req.on('error', reject)

      if (data !== null) {
        req.write(data)
      }

      req.end()
    })
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

// Common valid recipient list
const validList = {
  name: 'Marketing Team',
  emails: ['test@example.com'],
  cc: ['cc@example.com'],
  bcc: ['bcc@example.com'],
}

// Valid MongoDB ObjectId
const validId = '507f1f77bcf86cd799439011'

afterEach(() => {
  jest.restoreAllMocks()
})

// --------------------------------------------------
// GET TESTS
// --------------------------------------------------

describe('GET /api/recipient-lists', () => {
  test('should return 401 when no token is provided', async () => {
    const response = await makeRequest(
      'GET',
      '/',
      undefined,
      undefined
    )

    expect(response.status).toBe(401)
    expect(response.body.error).toBe('Please log in')
  })

  test('should return 401 when an invalid token is provided', async () => {
    const response = await makeRequest(
      'GET',
      '/',
      undefined,
      'invalid-token'
    )

    expect(response.status).toBe(401)
  })

  test('should allow an authenticated user to view recipient lists', async () => {
    const lists = [
      { name: 'Marketing Team', emails: ['a@example.com'] },
      { name: 'Sales Team', emails: ['b@example.com'] },
    ]

    const lean = jest.fn().mockResolvedValue(lists)
    const sort = jest.fn().mockReturnValue({ lean })

    jest.spyOn(RecipientList, 'find').mockReturnValue({ sort })

    const response = await makeRequest(
      'GET',
      '/',
      undefined,
      createToken('user')
    )

    expect(response.status).toBe(200)
    expect(response.body.lists).toEqual(lists)
    expect(RecipientList.find).toHaveBeenCalled()
    expect(sort).toHaveBeenCalledWith({ name: 1 })
  })
})

// --------------------------------------------------
// POST TESTS
// --------------------------------------------------

describe('POST /api/recipient-lists', () => {
  test('should create a recipient list successfully', async () => {
    jest.spyOn(RecipientList, 'create').mockResolvedValue({
      _id: validId,
      ...validList,
    })

    const response = await makeRequest(
      'POST',
      '/',
      validList,
      createToken('admin')
    )

    expect(response.status).toBe(201)
    expect(response.body.list.name).toBe('Marketing Team')
    expect(RecipientList.create).toHaveBeenCalledWith(validList)
  })

  test('should return 401 when no token is provided', async () => {
    const response = await makeRequest(
      'POST',
      '/',
      validList
    )

    expect(response.status).toBe(401)
  })

  test('should return 403 when a normal user tries to create a list', async () => {
    const response = await makeRequest(
      'POST',
      '/',
      validList,
      createToken('user')
    )

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('Admins only')
  })

  test('should return 400 when list name is missing', async () => {
    const response = await makeRequest(
      'POST',
      '/',
      {
        emails: ['test@example.com'],
      },
      createToken('admin')
    )

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('List name is required.')
  })

  test('should return 400 when list name is empty', async () => {
    const response = await makeRequest(
      'POST',
      '/',
      {
        name: '  ',
        emails: ['test@example.com'],
      },
      createToken('admin')
    )

    expect(response.status).toBe(400)
  })

  test('should return 400 when To email array is missing', async () => {
    const response = await makeRequest(
      'POST',
      '/',
      { name: 'Marketing Team' },
      createToken('admin')
    )

    expect(response.status).toBe(400)
    expect(response.body.error).toBe(
      'At least one To email address is required.'
    )
  })

  test('should return 400 when To email array is empty', async () => {
    const response = await makeRequest(
      'POST',
      '/',
      {
        name: 'Marketing Team',
        emails: [],
      },
      createToken('admin')
    )

    expect(response.status).toBe(400)
  })

  test.each(['emails', 'cc', 'bcc'])(
    'should return 400 when an invalid email is provided in %s',
    async (field) => {
      const body = {
        ...validList,
        [field]: ['invalid-email'],
      }

      const response = await makeRequest(
        'POST',
        '/',
        body,
        createToken('admin')
      )

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Invalid email address')
    }
  )

  test('should return 400 when an email field is not an array', async () => {
    const response = await makeRequest(
      'POST',
      '/',
      {
        ...validList,
        emails: 'test@example.com',
      },
      createToken('admin')
    )

    expect(response.status).toBe(400)
    expect(response.body.error).toContain('must be an array')
  })

  test('should return 409 when recipient list name already exists', async () => {
    const duplicateError = new Error('Duplicate key')
    duplicateError.code = 11000

    jest.spyOn(RecipientList, 'create').mockRejectedValue(duplicateError)

    const response = await makeRequest(
      'POST',
      '/',
      validList,
      createToken('admin')
    )

    expect(response.status).toBe(409)
    expect(response.body.error).toContain('already exists')
  })
})

// --------------------------------------------------
// PUT TESTS
// --------------------------------------------------

describe('PUT /api/recipient-lists/:id', () => {
  test('should update a recipient list successfully', async () => {
    const existingList = {
      _id: validId,
      name: 'Old Name',
      emails: ['old@example.com'],
      cc: [],
      bcc: [],
      save: jest.fn().mockResolvedValue(true),
    }

    jest.spyOn(RecipientList, 'findById')
      .mockResolvedValue(existingList)

    const response = await makeRequest(
      'PUT',
      `/${validId}`,
      { name: 'Updated Name' },
      createToken('admin')
    )

    expect(response.status).toBe(200)
    expect(existingList.name).toBe('Updated Name')
    expect(existingList.save).toHaveBeenCalled()
  })

  test('should return 401 when no token is provided', async () => {
    const response = await makeRequest(
      'PUT',
      `/${validId}`,
      { name: 'Updated Name' }
    )

    expect(response.status).toBe(401)
  })

  test('should return 403 when a normal user tries to update a list', async () => {
    const response = await makeRequest(
      'PUT',
      `/${validId}`,
      { name: 'Updated Name' },
      createToken('user')
    )

    expect(response.status).toBe(403)
  })

  test('should return 400 for an invalid recipient list ID', async () => {
    const response = await makeRequest(
      'PUT',
      '/invalid-id',
      { name: 'Updated Name' },
      createToken('admin')
    )

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Invalid recipient list ID.')
  })

  test('should return 404 when recipient list does not exist', async () => {
    jest.spyOn(RecipientList, 'findById').mockResolvedValue(null)

    const response = await makeRequest(
      'PUT',
      `/${validId}`,
      { name: 'Updated Name' },
      createToken('admin')
    )

    expect(response.status).toBe(404)
    expect(response.body.error).toBe('Recipient list not found.')
  })

  test('should return 400 when update body is empty', async () => {
    const response = await makeRequest(
      'PUT',
      `/${validId}`,
      {},
      createToken('admin')
    )

    expect(response.status).toBe(400)
    expect(response.body.error).toContain('Provide a list name')
  })

  test('should return 400 when To email array is updated to empty', async () => {
    const response = await makeRequest(
      'PUT',
      `/${validId}`,
      { emails: [] },
      createToken('admin')
    )

    expect(response.status).toBe(400)
    expect(response.body.error).toBe(
      'At least one To email address is required.'
    )
  })

  test('should return 400 when an invalid email is provided during update', async () => {
    const response = await makeRequest(
      'PUT',
      `/${validId}`,
      { emails: ['invalid-email'] },
      createToken('admin')
    )

    expect(response.status).toBe(400)
  })
})

// --------------------------------------------------
// DELETE TESTS
// --------------------------------------------------

describe('DELETE /api/recipient-lists/:id', () => {
  test('should delete a recipient list successfully', async () => {
    jest.spyOn(RecipientList, 'findByIdAndDelete')
      .mockResolvedValue({ _id: validId, name: 'Marketing Team' })

    const response = await makeRequest(
      'DELETE',
      `/${validId}`,
      undefined,
      createToken('admin')
    )

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Recipient list deleted.')
  })

  test('should return 401 when no token is provided', async () => {
    const response = await makeRequest(
      'DELETE',
      `/${validId}`
    )

    expect(response.status).toBe(401)
  })

  test('should return 403 when a normal user tries to delete a list', async () => {
    const response = await makeRequest(
      'DELETE',
      `/${validId}`,
      undefined,
      createToken('user')
    )

    expect(response.status).toBe(403)
  })

  test('should return 400 for an invalid recipient list ID', async () => {
    const response = await makeRequest(
      'DELETE',
      '/invalid-id',
      undefined,
      createToken('admin')
    )

    expect(response.status).toBe(400)
  })

  test('should return 404 when recipient list does not exist', async () => {
    jest.spyOn(RecipientList, 'findByIdAndDelete')
      .mockResolvedValue(null)

    const response = await makeRequest(
      'DELETE',
      `/${validId}`,
      undefined,
      createToken('admin')
    )

    expect(response.status).toBe(404)
    expect(response.body.error).toBe('Recipient list not found.')
  })
})
