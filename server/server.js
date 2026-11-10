// ======================================
// Environment Configuration
// ======================================

require("dotenv").config();

// ======================================
// Imports
// ======================================

const app = require("./app");
const connectDB = require("./config/db");

// ======================================
// Server Configuration
// ======================================

const PORT = process.env.PORT || 5000;

// ======================================
// Start Server
// ======================================

const startServer = async () => {
  try {
    // Connect to MongoDB before starting Express.
    await connectDB();

    // Start the server after successful database connection.
    return app.listen(PORT, () => {
      console.log(
        `Server running on http://localhost:${PORT}`
      );
    });

  } catch (error) {
    console.error(
      "Server startup failed:",
      error.message
    );

    process.exitCode = 1;
  }
};

// ======================================
// Application Entry Point
// ======================================

// Start automatically only when server.js is run directly.
if (require.main === module) {
  startServer();
}

// Export for testing and integration.
module.exports = startServer;