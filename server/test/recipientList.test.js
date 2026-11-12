
const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const jwt = require('jsonwebtoken')
const express = require('express')

process.env.JWT_SECRET = 'test-secret'

const { RecipientList } = require('../models')
const router = require('../routes/recipientList')

const app = express()

app.use(express.json())
app.use('/api/recipient-lists', router)

// Error-handling middleware (same behavior as the main application)
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    error: err.status
      ? err.message
      : 'Something went wrong',
  })
})

const validId = '507f1f77bcf86cd799439011'

function token(role = 'user') {
  return jwt.sign({ role }, process.env.JWT_SECRET)
}

// Reusable HTTP request helper
function request(method, path, body, role = 'user', authenticated = true) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      const payload = body === undefined ? undefined : JSON.stringify(body)

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: {
            ...(authenticated
              ? { Authorization: `Bearer ${token(role)}` }
              : {}),
            ...(payload !== undefined
              ? {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(payload),
                }
              : {}),
          },
        },
        (res) => {
          let data = ''

          res.on('data', (chunk) => {
            data += chunk
          })

          res.on('end', () => {
            server.close()

            let parsedBody

            try {
              parsedBody = data ? JSON.parse(data) : null
            } catch {
              parsedBody = data
            }

            resolve({
              status: res.statusCode,
              body: parsedBody,
            })
          })
        }
      )

      req.on('error', (error) => {
        server.close()
        reject(error)
      })

      if (payload !== undefined) {
        req.write(payload)
      }

      req.end()
    })

    server.on('error', reject)
  })
}

test('GET recipient lists requires authentication', async () => {
  const response = await request(
    'GET',
    '/api/recipient-lists',
    undefined,
    'user',
    false
  )

  assert.equal(response.status, 401)
  assert.equal(response.body.error, 'Please log in')
})

test('GET returns recipient lists sorted by name', async () => {
  const originalFind = RecipientList.find

  RecipientList.find = () => ({
    sort: (sortQuery) => {
      assert.deepEqual(sortQuery, { name: 1 })

      return {
        lean: async () => [
          { name: 'Accounting' },
          { name: 'Finance' },
        ],
      }
    },
  })

  try {
    const response = await request(
      'GET',
      '/api/recipient-lists',
      undefined,
      'user'
    )

    assert.equal(response.status, 200)
    assert.deepEqual(response.body.lists, [
      { name: 'Accounting' },
      { name: 'Finance' },
    ])
  } finally {
    RecipientList.find = originalFind
  }
})

test('POST creates a recipient list with trimmed values and default arrays', async () => {
  const originalCreate = RecipientList.create

  RecipientList.create = async (input) => {
    assert.deepEqual(input, {
      name: 'Finance Team',
      emails: ['one@example.com', 'two@example.com'],
      cc: [],
      bcc: [],
    })

    return {
      _id: validId,
      ...input,
    }
  }

  try {
    const response = await request(
      'POST',
      '/api/recipient-lists',
      {
        name: ' Finance Team ',
        emails: [' one@example.com ', 'two@example.com'],
      },
      'admin'
    )

    assert.equal(response.status, 201)
    assert.equal(response.body.list.name, 'Finance Team')
    assert.deepEqual(response.body.list.emails, [
      'one@example.com',
      'two@example.com',
    ])
    assert.deepEqual(response.body.list.cc, [])
    assert.deepEqual(response.body.list.bcc, [])
  } finally {
    RecipientList.create = originalCreate
  }
})

test('POST rejects non-admin users', async () => {
  const response = await request(
    'POST',
    '/api/recipient-lists',
    {
      name: 'Finance Team',
    },
    'user'
  )

  assert.equal(response.status, 403)
  assert.equal(response.body.error, 'Admins only')
})

test('POST rejects invalid email addresses', async () => {
  const response = await request(
    'POST',
    '/api/recipient-lists',
    {
      name: 'Finance Team',
      emails: ['valid@example.com', 'invalid-email'],
    },
    'admin'
  )

  assert.equal(response.status, 400)
  assert.match(
    response.body.error,
    /Invalid email address in emails at position 2/
  )
})

test('POST rejects a missing list name', async () => {
  const response = await request(
    'POST',
    '/api/recipient-lists',
    {
      emails: ['valid@example.com'],
    },
    'admin'
  )

  assert.equal(response.status, 400)
  assert.equal(response.body.error, 'List name is required.')
})

test('PUT updates only supplied fields', async () => {
  const originalFindById = RecipientList.findById

  const list = {
    _id: validId,
    name: 'Old Name',
    emails: ['old@example.com'],
    cc: [],
    bcc: [],
    async save() {
      return this
    },
  }

  RecipientList.findById = async (id) => {
    assert.equal(id, validId)
    return list
  }

  try {
    const response = await request(
      'PUT',
      `/api/recipient-lists/${validId}`,
      {
        name: ' New Name ',
        cc: [' copy@example.com '],
      },
      'admin'
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.list.name, 'New Name')
    assert.deepEqual(response.body.list.emails, ['old@example.com'])
    assert.deepEqual(response.body.list.cc, ['copy@example.com'])
    assert.deepEqual(response.body.list.bcc, [])
  } finally {
    RecipientList.findById = originalFindById
  }
})

test('PUT rejects an invalid recipient list ID', async () => {
  const response = await request(
    'PUT',
    '/api/recipient-lists/not-an-object-id',
    {
      name: 'Updated Name',
    },
    'admin'
  )

  assert.equal(response.status, 400)
  assert.equal(response.body.error, 'Invalid recipient list ID.')
})

test('PUT returns 404 when the recipient list does not exist', async () => {
  const originalFindById = RecipientList.findById
  RecipientList.findById = async () => null

  try {
    const response = await request(
      'PUT',
      `/api/recipient-lists/${validId}`,
      {
        name: 'Updated Name',
      },
      'admin'
    )

    assert.equal(response.status, 404)
    assert.equal(response.body.error, 'Recipient list not found.')
  } finally {
    RecipientList.findById = originalFindById
  }
})

test('DELETE removes an existing recipient list', async () => {
  const originalFindByIdAndDelete = RecipientList.findByIdAndDelete

  RecipientList.findByIdAndDelete = async (id) => {
    assert.equal(id, validId)
    return { _id: validId, name: 'Finance Team' }
  }

  try {
    const response = await request(
      'DELETE',
      `/api/recipient-lists/${validId}`,
      undefined,
      'admin'
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.message, 'Recipient list deleted.')
  } finally {
    RecipientList.findByIdAndDelete = originalFindByIdAndDelete
  }
})

test('DELETE returns 404 when the recipient list does not exist', async () => {
  const originalFindByIdAndDelete = RecipientList.findByIdAndDelete
  RecipientList.findByIdAndDelete = async () => null

  try {
    const response = await request(
      'DELETE',
      `/api/recipient-lists/${validId}`,
      undefined,
      'admin'
    )

    assert.equal(response.status, 404)
    assert.equal(response.body.error, 'Recipient list not found.')
  } finally {
    RecipientList.findByIdAndDelete = originalFindByIdAndDelete
  }
})
