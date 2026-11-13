
/**
 * Connection Management API Client
 * Stories 1.1, 1.2 and 1.3
 */

import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach the logged-in user's JWT token.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Get all saved connections
export async function getConnections() {
  const response = await api.get("/connections");

  return response.data?.connections || response.data?.data || [];
}

// Get one saved connection
export async function getConnectionById(id) {
  const response = await api.get(
    `/connections/${encodeURIComponent(id)}`
  );

  return response.data?.connection ||
         response.data?.data ||
         response.data;
}

// Create a connection
export async function createConnection(connectionData) {
  const response = await api.post(
    "/connections",
    connectionData
  );

  return response.data?.connection ||
         response.data?.data ||
         response.data;
}

// Update a connection
export async function updateConnection(id, connectionData) {
  const response = await api.put(
    `/connections/${encodeURIComponent(id)}`,
    connectionData
  );

  return response.data?.connection ||
         response.data?.data ||
         response.data;
}

// Delete a connection
export async function deleteConnection(id) {
  const response = await api.delete(
    `/connections/${encodeURIComponent(id)}`
  );

  return response.data;
}

// Test a new or saved connection
export async function testConnection(payload) {
  let response;

  if (payload.id) {
    response = await api.post(
      `/connections/${encodeURIComponent(payload.id)}/test`,
      payload
    );
  } else {
    response = await api.post(
      "/connections/test",
      payload
    );
  }

  return response.data;
}

export default api;
