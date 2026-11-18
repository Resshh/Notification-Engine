// Jest globalTeardown: stop the mock Service Layer started in startMockServiceLayer.js.
module.exports = async () => {
  const srv = globalThis.__MOCK_SERVICE_LAYER__;
  if (!srv) return;
  srv.closeAllConnections();
  await new Promise((resolve) => srv.close(resolve));
};
