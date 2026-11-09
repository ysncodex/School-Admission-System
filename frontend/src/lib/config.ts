const configuredBaseUrl =
  window.__APP_CONFIG__?.apiBaseUrl || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export const API_BASE_URL = configuredBaseUrl.replace(/\/$/, '');
