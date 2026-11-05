const mongoose = require("mongoose");

// ======================================
// MongoDB Connection
// ======================================

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error("MONGO_URI is not configured");
    }

    await mongoose.connect(mongoURI);

    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error(
      "MongoDB connection failed:",
      error.message
    );

    throw error;
  }
};

module.exports = connectDB;