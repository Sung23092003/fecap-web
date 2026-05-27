(function () {
  "use strict";

  function isAuthPage() {
    const path = window.location.pathname || "";
    const file = path.split("/").pop();

    return (
      file === "pages-login.html" ||
      file === "pages-register.html" ||
      file === "pages-error-404.html"
    );
  }

  function redirectToLogin() {
    window.location.href = "pages-login.html";
  }

  function hasToken() {
    try {
      if (window.Auth && typeof window.Auth.getToken === "function") {
        return !!window.Auth.getToken();
      }

      // Fallback nếu Auth chưa load (nhưng vẫn muốn chạy được)
      const raw = localStorage.getItem("cms_auth");
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return !!parsed && !!parsed.token;
    } catch (e) {
      return false;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Không guard các trang public
    if (isAuthPage()) return;

    if (!hasToken()) {
      redirectToLogin();
    }
  });

  // Intercept toàn cầu cho hàm fetch để bắt lỗi 401
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    try {
      const response = await originalFetch.apply(this, args);
      if (response.status === 401 && !isAuthPage()) {
        if (window.Auth && typeof window.Auth.clearAuth === 'function') {
          window.Auth.clearAuth();
        } else {
          localStorage.removeItem("cms_auth");
        }
        redirectToLogin();
      }
      return response;
    } catch (error) {
      throw error;
    }
  };
})();

