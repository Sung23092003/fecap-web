/**
 * Module xác thực người dùng
 */

const Auth = (function () {
  "use strict";

  // Key lưu trữ trong localStorage
  const STORAGE_KEY = "cms_auth";


  function setAuth(authData) {
    const data = {
      token: authData.token,
      user: authData.user,
      saved_at: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getAuth() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch (e) {
      clearAuth();
      return null;
    }
  }

  /**
   * Lấy JWT Token từ localStorage
   * @returns {string|null} Token hoặc null
   */
  function getToken() {
    const auth = getAuth();
    return auth ? auth.token : null;
  }

  /**
   * Lấy thông tin người dùng từ localStorage
   * @returns {Object|null} Thông tin user hoặc null
   */
  function getUser() {
    const auth = getAuth();
    return auth ? auth.user : null;
  }

  /**
   * Xóa thông tin xác thực (Đăng xuất)
   */
  function clearAuth() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Kiểm tra trạng thái đăng nhập
   * @returns {boolean} True nếu đã đăng nhập (có token)
   */
  function isLoggedIn() {
    return !!getToken();
  }

  /**
   * Tạo header Authorization cho các API request
   * @returns {Object} Header chứa Bearer Token
   */
  function getAuthHeader() {
    const token = getToken();
    return token
      ? {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        }
      : {
          "Content-Type": "application/json",
        };
  }

  /**
   * Gọi API Đăng nhập
   * @param {string} baseUrl - URL gốc của API 
   * @param {string} username - Tên đăng nhập 
   * @param {string} password - Mật khẩu
   * @returns {Promise<Object>} Kết quả từ API
   */
  async function login(baseUrl, username, password) {
    const url = `${baseUrl}/cms`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: username,
        password: password,
      }),
    });

    if (!response.ok && response.status !== 400) {
      throw new Error("Lỗi kết nối máy chủ");
    }

    const result = await response.json();

    // Đăng nhập thành công
    if (result.success) {
      setAuth({
        token: result.data.token,
        user: result.data.user,
      });
    }

    return result;
  }

  /**
   * Đăng xuất: Xóa token và chuyển hướng về trang login
   * @param {string} loginPageUrl - Đường dẫn tới trang đăng nhập
   */
  function logout(loginPageUrl = "pages-login.html") {
    clearAuth();
    window.location.href = loginPageUrl;
  }

  // Public API
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
