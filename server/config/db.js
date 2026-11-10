const mongoose = require("mongoose");

// ======================================
// MongoDB Database Connection
// ======================================

const connectDB = async () => {
  try {
    // Read MongoDB connection URI from environment variables
    const mongoURI = process.env.MONGO_URI;

    // Validate MongoDB URI
    if (!mongoURI) {
      throw new Error("MONGO_URI is not configured");
    }

    // Connect to MongoDB
    await mongoose.connect(mongoURI);

    console.log("MongoDB connected successfully");

  } catch (error) {
    console.error(
      "MongoDB connection failed:",
      error.message
    );

    // Pass the error to the server startup handler
    throw error;
  }
};

module.exports = connectDB;