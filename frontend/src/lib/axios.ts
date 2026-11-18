import axios from "axios";

export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL ?? "" }); // "" = same origin

api.interceptors.request.use((cfg) => {
  const t = sessionStorage.getItem("token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes("/auth/login")) {
      sessionStorage.clear();
      window.location.assign("/login");
    }
    return Promise.reject(err);
  }
);
