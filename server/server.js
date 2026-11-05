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
    // Connect to MongoDB first.
    await connectDB();

    // Start Express after successful connection.
    app.listen(PORT, () => {
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

// Start the server when executed directly.
if (require.main === module) {
  startServer();
};

module.exports = startServer;