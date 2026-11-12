/**
 * Connection Management API Client
 * Epic 1: Stories 1.1, 1.2, 1.3
 */

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

/**
 * Lists all saved connections.
 * Story 1.2, Sub-task 22.
 */
export async function getConnections() {
  const response = await api.get('/connections');
  return response.data?.connections || response.data?.data || [];
}

/**
 * Gets a connection by its ID.
 * Story 1.2, Sub-task 22.
 */
export async function getConnectionById(id) {
  const response = await api.get(`/connections/${encodeURIComponent(id)}`);
  return response.data?.connection || response.data?.data || response.data;
}

/**
 * Creates a new connection.
 * Story 1.1, Sub-task 11.
 */
export async function createConnection(connectionData) {
  const response = await api.post('/connections', connectionData);
  return response.data?.connection || response.data?.data || response.data;
}

/**
 * Updates an existing connection.
 * Story 1.2, Sub-task 23.
 */
export async function updateConnection(id, connectionData) {
  const response = await api.put(`/connections/${encodeURIComponent(id)}`, connectionData);
  return response.data?.connection || response.data?.data || response.data;
}

/**
 * Deletes a connection.
 * Story 1.2, Sub-task 24, 25.
 */
export async function deleteConnection(id) {
  const response = await api.delete(`/connections/${encodeURIComponent(id)}`);
  return response.data;
}

/**
 * Tests an unsaved connection form or a saved connection ID.
 * Story 1.3, Sub-task 33.
 */
export async function testConnection(payload) {
  if (payload.id) {
    const response = await api.post(`/connections/${encodeURIComponent(payload.id)}/test`, payload);
    return response.data;
  }
  const response = await api.post('/connections/test', payload);
  return response.data;
}

export default api;
