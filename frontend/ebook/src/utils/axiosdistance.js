import axios from "axios";
import { BASE_URL, API_PATHS } from "./Apipath";

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Request Interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem("token");

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    //handle common globally
    if (error.response) {
      const requestUrl = error.config?.url || "";
      const isAuthRequest =
        requestUrl.includes(API_PATHS.AUTH.LOGIN) ||
        requestUrl.includes(API_PATHS.AUTH.REGISTER);

      // Token expired or invalid: clear the session and send the user to login.
      // Login/register 401s (wrong password) are left for the page to show.
      if (error.response.status === 401 && !isAuthRequest) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      } else if (error.response.status === 500) {
        console.error("Server error. Please try again later.");
      }
    } else if (error.code === "ECONNABORTED") {
      console.error("Request timeout. Please check your network connection and try again.");

    }

    return Promise.reject(error);
  }
);

export default axiosInstance;