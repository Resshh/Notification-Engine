
require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Mock SAP Service Layer for offline work and the demo. Turn off when using the real SAP test system.
  if (process.env.START_MOCK_SERVICE_LAYER !== "false") {
    try {
      const srv = await require("./mock-service-layer/server").start();
      console.log(`Mock Service Layer on http://localhost:${srv.address().port}/b1s/v1`);
    } catch (err) {
      if (err.code !== "EADDRINUSE") throw err;
      console.log("Mock Service Layer port already in use; using the one that is running.");
    }
  }

  await connectDB();
  await require("./engine/scheduler").startScheduler();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
