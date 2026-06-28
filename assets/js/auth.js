/**
 * Auth module (DISABLED)
 *
 * Yêu cầu: xóa toàn bộ logic login / tài khoản / token.
 * File này giữ API tối thiểu để tránh lỗi runtime khi trang vẫn include.
 */

const Auth = (function () {
  "use strict";

  function setAuth() {}
  function getAuth() {
    return null;
  }
  function getToken() {
    return null;
  }
  function getUser() {
    return null;
  }
  function clearAuth() {}
  function isLoggedIn() {
    return false;
  }
  function getAuthHeader() {
    return { "Content-Type": "application/json" };
  }

  async function login() {
    return { success: false, message: "Login is disabled" };
  }

  function logout(loginPageUrl = "login.html") {
    try {
      clearAuth();
    } catch (e) {}
    window.location.href = loginPageUrl;
  }

  return {
    setAuth,
    getAuth,
    getToken,
    getUser,
    clearAuth,
    isLoggedIn,
    getAuthHeader,
    login,
    logout,
  };
})();

