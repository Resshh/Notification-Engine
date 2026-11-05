const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// Load environment variables from server/.env
require("dotenv").config({
  path: path.join(__dirname, "..", ".env")
});

const mongoose = require("mongoose");

const Connection = require("../models/Connection");

// Updated import for shared repository.
const {
  encryptPassword,
  decryptPassword
} = require("../utils/crypto");

// Integration tests must be explicitly enabled.
const runIntegrationTest =
  process.env.RUN_MONGO_INTEGRATION_TEST === "true";

test(
  "Story 1.1 - Save and retrieve an encrypted connection from MongoDB",
  {
    timeout: 30000,

    skip: runIntegrationTest
      ? false
      : "Set RUN_MONGO_INTEGRATION_TEST=true to enable database testing"
  },

  async () => {
    // Verify MongoDB configuration.
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not configured");
    }

    // Validate encryption key.
    if (
      !/^[0-9a-fA-F]{64}$/.test(
        process.env.ENCRYPTION_KEY || ""
      )
    ) {
      throw new Error(
        "ENCRYPTION_KEY must be 64 hexadecimal characters"
      );
    }

    // Never run this integration test in production mode.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Integration test must not run in production"
      );
    }

    let createdId;

    try {
      // Connect to the development/test MongoDB database.
      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000
      });

      console.log("Connected to development MongoDB");

      const plainPassword = "dummy-test-password";

      // Create a temporary test connection.
      const connection = await Connection.create({
        name: `TEST-ONLY-${Date.now()}`,
        type: "SQLServer",
        host: "localhost",
        port: 1433,
        database: "TestDB",
        username: "dummy_user",

        passwordEncrypted: encryptPassword(
          plainPassword
        ),

        createdBy: new mongoose.Types.ObjectId()
      });

      createdId = connection._id;

      console.log("Temporary connection saved");

      // Retrieve the encrypted password explicitly.
      const storedConnection = await Connection
        .findById(createdId)
        .select("+passwordEncrypted")
        .lean();

      assert.ok(storedConnection);

      // Password must not be stored as plaintext.
      assert.notEqual(
        storedConnection.passwordEncrypted,
        plainPassword
      );

      // Decryption must restore the original password.
      assert.equal(
        decryptPassword(
          storedConnection.passwordEncrypted
        ),
        plainPassword
      );

      // Ordinary queries must exclude the password.
      const safeConnection = await Connection
        .findById(createdId)
        .lean();

      assert.ok(safeConnection);

      assert.equal(
        safeConnection.passwordEncrypted,
        undefined
      );

      console.log(
        "Encryption and retrieval verified successfully"
      );

    } finally {
      try {
        // Remove only the record created by this test.
        if (
          createdId &&
          mongoose.connection.readyState === 1
        ) {
          await Connection.deleteOne({
            _id: createdId
          });

          console.log(
            "Temporary test connection removed"
          );
        }
      } finally {
        // Always close the MongoDB connection.
        await mongoose.disconnect();
      }
    }
  }
);