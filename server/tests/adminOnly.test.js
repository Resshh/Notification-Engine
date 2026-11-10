// Support Jest and Node.js built-in test runner.
const test =
  typeof globalThis.test === "function"
    ? globalThis.test
    : require("node:test");

const assert = require("node:assert/strict");

const adminOnly = require("../middleware/adminOnly");

// ======================================
// Mock Express Response
// ======================================

const mockResponse = () => ({
  statusCode: null,
  body: null,

  status(code) {
    this.statusCode = code;
    return this;
  },

  json(data) {
    this.body = data;
    return this;
  }
});

// ======================================
// Story 1.4 - Admin-Only Access Tests
// ======================================

// Test 1: Reject unauthenticated users.
test("Story 1.4 - Reject unauthenticated users", () => {
  const req = {};
  const res = mockResponse();

  let nextCalled = false;

  adminOnly(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.message, "Authentication required");
  assert.equal(nextCalled, false);
});

// Test 2: Reject authenticated non-admin users.
test("Story 1.4 - Reject non-admin users", () => {
  const req = {
    user: {
      _id: "507f1f77bcf86cd799439011",
      role: "user"
    }
  };

  const res = mockResponse();

  let nextCalled = false;

  adminOnly(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  assert.equal(res.body.message, "Admin access required");
  assert.equal(nextCalled, false);
});

// Test 3: Allow authenticated administrators.
test("Story 1.4 - Allow authenticated administrators", () => {
  const req = {
    user: {
      _id: "507f1f77bcf86cd799439011",
      role: "admin"
    }
  };

  const res = mockResponse();

  let nextCalled = false;

  adminOnly(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
  assert.equal(res.body, null);
});

// Test 4: Reject admin role without authenticated user ID.
test("Story 1.4 - Reject users without an ID", () => {
  const req = {
    user: {
      role: "admin"
    }
  };

  const res = mockResponse();

  let nextCalled = false;

  adminOnly(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, "Authentication required");
  assert.equal(nextCalled, false);
});

// Test 5: Prevent authorization bypass.
test("Story 1.4 - Reject attempts to bypass authorization", () => {
  const req = {
    body: {
      role: "admin"
    },
    headers: {
      role: "admin",
      "x-role": "admin"
    }
  };

  const res = mockResponse();

  let nextCalled = false;

  adminOnly(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.equal(nextCalled, false);
});