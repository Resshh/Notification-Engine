
import axios from "axios";

// Use the Vite proxy to communicate with Express.
const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add JWT token if one exists.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Preview a saved query.
export async function previewSavedQuery(queryId, params = {}) {
  if (!queryId) {
    throw new Error("Save the query before previewing it.");
  }

  const response = await api.post(
    `/query-preview/${encodeURIComponent(queryId)}/preview`,
    { params }
  );

  return response.data;
}

export default api;
