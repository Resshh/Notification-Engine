import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Previews an existing saved query by ID.
 * Returns at most 10 rows in the common format.
 * Ref: Story 5.2, Sub-tasks 142, 143, FR-11.
 */
export async function previewSavedQuery(queryId, params = {}) {
  if (!queryId) throw new Error('Please select or save a query before previewing it.');
  const response = await api.post(`/queries/${encodeURIComponent(queryId)}/test`, { params });
  return response.data?.data || response.data;
}

/**
 * Previews an unsaved/transient query directly from the editor form.
 * Ref: Story 5.2.
 */
export async function previewTransientQuery(queryData, params = {}) {
  const response = await api.post('/queries/test', { ...queryData, params });
  return response.data?.data || response.data;
}

export default api;
