const API_BASE_URL = "http://localhost:8000/api/v1";
const AUTH_TOKEN_KEY = "wordinary_access_token";

function getAuthToken() {
  return appStorage.getItem(AUTH_TOKEN_KEY);
}

function setAuthToken(token) {
  appStorage.setItem(AUTH_TOKEN_KEY, token);
}

function clearAuthToken() {
  appStorage.removeItem(AUTH_TOKEN_KEY);
}

async function apiRequest(path, options = {}) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {})
  };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) {
      clearAuthToken();
      if (typeof showAuthScreen === "function") showAuthScreen();
    }
    throw new Error(data.detail || `HTTP ${response.status}`);
  }
  return data;
}

function toQueryString(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}
