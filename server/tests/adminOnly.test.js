const test = require("node:test");
const assert = require("node:assert/strict");

const adminOnly = require("../middleware/adminOnly");

// Helper function to simulate an Express response.
const createResponse = () => ({
  statusCode: 200,
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

// Test 1: User is not authenticated.
test("Story 1.4 - Reject unauthenticated users", () => {
  const req = {};
  const res = createResponse();

  let nextCalled = false;

  adminOnly(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.message, "Authentication required");
  assert.equal(nextCalled, false);
});

// Test 2: Authenticated user is not an admin.
test("Story 1.4 - Reject non-admin users", () => {
  const req = {
    user: {
      _id: "user123",
      role: "user"
    }
  };

  const res = createResponse();

  let nextCalled = false;

  adminOnly(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, "Admin access required");
  assert.equal(nextCalled, false);
});

// Test 3: Authenticated administrator.
test("Story 1.4 - Allow authenticated administrators", () => {
  const req = {
    user: {
      _id: "admin123",
      role: "admin"
    }
  };

  const res = createResponse();

  let nextCalled = false;

  adminOnly(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

// Test 4: User object exists but ID is missing.
test("Story 1.4 - Reject users without an ID", () => {
  const req = {
    user: {
      role: "admin"
    }
  };

  const res = createResponse();

  let nextCalled = false;

  adminOnly(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

// Test 5: Admin role supplied in request body is not trusted.
test("Story 1.4 - Reject attempts to bypass authorization", () => {
  const req = {
    body: {
      role: "admin"
    },
    headers: {
      role: "admin"
    }
  };

  const res = createResponse();

  let nextCalled = false;

  adminOnly(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});