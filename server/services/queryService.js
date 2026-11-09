const Query = require("../models/Query");
const { validateQuerySafety } = require("../security/validator");
const { executeQuery } = require("../core/executeQuery");

// Business logic service for saved queries.
// Ref: Story 5.1 (CRUD), Story 5.2 (Test Queries & Previews), and safety rule BR-03.

/**
 * Creates and persists a new query definition after running security validation.
 * @param {object} queryData - Query fields from client request.
 * @param {string} [username] - Creating user identifier.
 * @returns {Promise<object>} The newly saved query document.
 */
async function createQuery(queryData, username = "admin") {
  const { name, connectionId, kind, queryText, entity, filter, select, params, columnMapping, rowLimit, execApproved } = queryData;

  // Basic required fields check
  if (!name || !name.trim()) {
    const error = new Error("Query name is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!connectionId) {
    const error = new Error("Connection ID is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!kind || !["sql", "odata"].includes(kind)) {
    const error = new Error("Query kind must be either 'sql' or 'odata'.");
    error.statusCode = 400;
    throw error;
  }

  // Kind-specific content check
  if (kind === "sql" && (!queryText || !queryText.trim())) {
    const error = new Error("SQL query text is required when kind is 'sql'.");
    error.statusCode = 400;
    throw error;
  }

  if (kind === "odata" && (!entity || !entity.trim())) {
    const error = new Error("Service Layer entity is required when kind is 'odata'.");
    error.statusCode = 400;
    throw error;
  }

  // Run the dialect-aware safety validation (Story 5.3)
  const validationResult = validateQuerySafety({
    kind,
    queryText,
    entity,
    filter,
    select,
    params,
    execApproved
  });

  if (!validationResult.valid) {
    const error = new Error(validationResult.error);
    error.statusCode = 400;
    throw error;
  }

  // Persist query into MongoDB (source system is never contacted per BR-03)
  const newQuery = new Query({
    name: name.trim(),
    connectionId,
    kind,
    queryText: queryText ? queryText.trim() : "",
    entity: entity ? entity.trim() : "",
    filter: filter ? filter.trim() : "",
    select: select ? select.trim() : "",
    params: params || [],
    columnMapping: columnMapping || [],
    rowLimit: rowLimit ? Number(rowLimit) : 1000,
    execApproved: Boolean(execApproved),
    createdBy: username
  });

  return await newQuery.save();
}

/**
 * Retrieves all saved queries.
 * @returns {Promise<Array>} List of saved query documents.
 */
async function getAllQueries() {
  // Exclude passwordEncrypted if connection reference is populated (Ref: FR-02)
  return await Query.find()
    .populate({
      path: "connectionId",
      select: "-passwordEncrypted"
    })
    .sort({ createdAt: -1 });
}

/**
 * Retrieves a single query by its database ID.
 * @param {string} queryId - MongoDB ObjectId string.
 * @returns {Promise<object>} Query document.
 */
async function getQueryById(queryId) {
  const query = await Query.findById(queryId).populate({
    path: "connectionId",
    select: "-passwordEncrypted"
  });

  if (!query) {
    const error = new Error(`Query with ID '${queryId}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  return query;
}

/**
 * Updates an existing saved query after re-running safety validation.
 * @param {string} queryId - MongoDB ObjectId string.
 * @param {object} updateData - Updated query fields.
 * @returns {Promise<object>} The updated query document.
 */
async function updateQuery(queryId, updateData) {
  const existing = await Query.findById(queryId);
  if (!existing) {
    const error = new Error(`Query with ID '${queryId}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  // Merge existing fields with incoming updates for validation check
  const mergedKind = updateData.kind || existing.kind;
  const mergedQueryText = updateData.queryText !== undefined ? updateData.queryText : existing.queryText;
  const mergedEntity = updateData.entity !== undefined ? updateData.entity : existing.entity;
  const mergedFilter = updateData.filter !== undefined ? updateData.filter : existing.filter;
  const mergedSelect = updateData.select !== undefined ? updateData.select : existing.select;
  const mergedParams = updateData.params !== undefined ? updateData.params : existing.params;
  const mergedExecApproved = updateData.execApproved !== undefined ? updateData.execApproved : existing.execApproved;

  // Re-run safety validation on updated content (Story 5.3)
  const validationResult = validateQuerySafety({
    kind: mergedKind,
    queryText: mergedQueryText,
    entity: mergedEntity,
    filter: mergedFilter,
    select: mergedSelect,
    params: mergedParams,
    execApproved: mergedExecApproved
  });

  if (!validationResult.valid) {
    const error = new Error(validationResult.error);
    error.statusCode = 400;
    throw error;
  }

  // Apply updates
  if (updateData.name !== undefined) existing.name = updateData.name.trim();
  if (updateData.connectionId !== undefined) existing.connectionId = updateData.connectionId;
  if (updateData.kind !== undefined) existing.kind = updateData.kind;
  if (updateData.queryText !== undefined) existing.queryText = updateData.queryText.trim();
  if (updateData.entity !== undefined) existing.entity = updateData.entity.trim();
  if (updateData.filter !== undefined) existing.filter = updateData.filter.trim();
  if (updateData.select !== undefined) existing.select = updateData.select.trim();
  if (updateData.params !== undefined) existing.params = updateData.params;
  if (updateData.columnMapping !== undefined) existing.columnMapping = updateData.columnMapping;
  if (updateData.rowLimit !== undefined) existing.rowLimit = Number(updateData.rowLimit);
  if (updateData.execApproved !== undefined) existing.execApproved = Boolean(updateData.execApproved);

  return await existing.save();
}

/**
 * Deletes a saved query by ID.
 * @param {string} queryId - MongoDB ObjectId string.
 * @returns {Promise<object>} Deletion confirmation.
 */
async function deleteQuery(queryId) {
  const query = await Query.findByIdAndDelete(queryId);
  if (!query) {
    const error = new Error(`Query with ID '${queryId}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  return { ok: true, message: `Query '${query.name}' successfully deleted.` };
}

/**
 * Executes a saved query in preview/test mode, returning at most 10 rows.
 * Ref: Story 5.2, sub-tasks 142, 143, FR-11.
 *
 * @param {string} queryId - MongoDB ObjectId of the saved query.
 * @param {object} [runtimeParams={}] - Key-value parameter overrides from test runner or UI.
 * @returns {Promise<{ columns: string[], rows: any[][], meta: object }>}
 */
async function testQuery(queryId, runtimeParams = {}) {
  if (!queryId) {
    const error = new Error("Query ID is required for test execution.");
    error.statusCode = 400;
    throw error;
  }

  const queryDoc = await Query.findById(queryId).lean();
  if (!queryDoc) {
    const error = new Error(`Query with ID '${queryId}' not found.`);
    error.statusCode = 404;
    throw error;
  }

  // Call shared executeQuery() limited to 10 rows (Ref: FR-11, Sub-task 142)
  return await executeQuery(queryDoc, runtimeParams, { limit: 10 });
}

/**
 * Executes a transient/unsaved query definition in preview/test mode, returning at most 10 rows.
 *
 * @param {object} queryData - Transient query definition from client.
 * @param {object} [runtimeParams={}] - Key-value parameter overrides.
 * @returns {Promise<{ columns: string[], rows: any[][], meta: object }>}
 */
async function testQueryTransient(queryData, runtimeParams = {}) {
  if (!queryData || !queryData.connectionId) {
    const error = new Error("Target connection ID is required for query test.");
    error.statusCode = 400;
    throw error;
  }

  // Validate query safety before execution
  const validationResult = validateQuerySafety(queryData);
  if (!validationResult.valid) {
    const error = new Error(validationResult.error);
    error.statusCode = 400;
    throw error;
  }

  return await executeQuery(queryData, runtimeParams, { limit: 10 });
}

module.exports = {
  createQuery,
  getAllQueries,
  getQueryById,
  updateQuery,
  deleteQuery,
  testQuery,
  testQueryTransient
};

