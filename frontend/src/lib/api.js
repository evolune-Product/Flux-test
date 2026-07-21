export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

/**
 * Authenticated fetch wrapper. Automatically injects the Bearer token
 * from localStorage. All other fetch options pass through unchanged.
 *
 * @param {string} path - Path or full URL. If it starts with '/' or is
 *   a relative path, API_BASE_URL is prepended.
 * @param {RequestInit} options - Standard fetch options.
 * @returns {Promise<Response>}
 */
export async function apiFetch(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const token = localStorage.getItem("token");

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  return fetch(url, { ...options, headers });
}
