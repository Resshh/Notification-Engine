// Jest globalSetup: tests that run Service Layer queries talk to the mock on port 50000.
// If something already listens there (the dev server's mock), use that one.
module.exports = async () => {
  try {
    globalThis.__MOCK_SERVICE_LAYER__ = await require("../../mock-service-layer/server").start(50000);
  } catch (err) {
    if (err.code !== "EADDRINUSE") throw err;
  }
};
