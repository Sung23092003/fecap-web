/**
 * Xử lý trang đăng nhập - Gọi API và quản lý trạng thái xác thực
 */

(function () {
  "use strict";

  // Sử dụng cấu hình từ file config.js
  const API_BASE_URL = ENV.BASE_URL;

  // DOM Elements
  const loginForm = document.getElementById("login-form");
  const loginAlert = document.getElementById("login-alert");
  const btnLogin = document.getElementById("btn-login");
  const loginSpinner = document.getElementById("login-spinner");
  const btnText = document.getElementById("btn-text");
  const usernameInput = document.getElementById("yourUsername");
  const passwordInput = document.getElementById("yourPassword");
  const rememberMeInput = document.getElementById("rememberMe");
  const togglePasswordBtn = document.getElementById("togglePassword");
  const eyeIcon = document.getElementById("eyeIcon");
  const REMEMBER_LOGIN_KEY = "cms_remember_login";

  /**
   * Xử lý ẩn/hiện mật khẩu khi nhấn vào icon con mắt
   */
  togglePasswordBtn.addEventListener("click", function () {
    const isPassword = passwordInput.type === "password";
    // Chuyển đổi type của input giữa password và text
    passwordInput.type = isPassword ? "text" : "password";
    // Thay đổi icon tương ứng
    eyeIcon.classList.toggle("bi-eye");
    eyeIcon.classList.toggle("bi-eye-slash");
  });

  /**
   * Hiển thị thông báo lỗi cho người dùng
   * @param {string} message - Nội dung thông báo lỗi
   */
  function showError(message) {
    loginAlert.textContent = message;
    loginAlert.classList.remove("d-none");
    loginAlert.classList.add("show");
  }

  /**
   * Ẩn thông báo lỗi
   */
  function hideError() {
    loginAlert.classList.add("d-none");
    loginAlert.classList.remove("show");
  }

  /**
   * Bật trạng thái đang tải (loading) trên nút đăng nhập
   */
  function setLoading(isLoading) {
    if (isLoading) {
      btnLogin.disabled = true;
      loginSpinner.classList.remove("d-none");
      btnText.textContent = "Đang xử lý...";
    } else {
      btnLogin.disabled = false;
      loginSpinner.classList.add("d-none");
      btnText.textContent = "Đăng Nhập";
    }
  }

  /**
   * Chuyển đổi thông báo lỗi từ API sang tiếng Việt
   * @param {string} apiMessage - Thông báo gốc từ API
   * @returns {string} Thông báo tiếng Việt tương ứng
   */
  function translateErrorMessage(apiMessage) {
    const errorMap = {
      "Please provide your login credentials.": "Vui lòng nhập đầy đủ thông tin đăng nhập.",
      "Account does not exist.": "Tài khoản không tồn tại.",
      "Incorrect password.": "Mật khẩu không chính xác.",
      "Account is locked.": "Tài khoản đã bị khóa.",
      "Lỗi kết nối máy chủ": "Không thể kết nối đến máy chủ. Vui lòng thử lại sau.",
    };

    return errorMap[apiMessage] || apiMessage;
  }

  function loadRememberedLogin() {
    try {
      const raw = localStorage.getItem(REMEMBER_LOGIN_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && data.username && data.password) {
        usernameInput.value = data.username;
        passwordInput.value = data.password;
        rememberMeInput.checked = true;
      }
    } catch (error) {
      localStorage.removeItem(REMEMBER_LOGIN_KEY);
    }
  }

  function saveRememberedLogin(username, password) {
    if (!rememberMeInput.checked) {
      localStorage.removeItem(REMEMBER_LOGIN_KEY);
      return;
    }

    localStorage.setItem(REMEMBER_LOGIN_KEY, JSON.stringify({
      username: username,
      password: password
    }));
  }

  /**
   * Xử lý sự kiện submit form đăng nhập
   */
  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    // Ẩn thông báo lỗi cũ
    hideError();

    // Kiểm tra tính hợp lệ của form
    if (!loginForm.checkValidity()) {
      event.stopPropagation();
      loginForm.classList.add("was-validated");
      return;
    }

    // Lấy dữ liệu từ form
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // Bật trạng thái loading
    setLoading(true);

    try {
      // Gọi API đăng nhập thông qua module Auth
      const result = await Auth.login(API_BASE_URL, username, password);

      if (result.success) {
        saveRememberedLogin(username, password);
        // Đăng nhập thành công, chuyển hướng về trang chủ
        window.location.href = "index.html";
      } else {
        // Hiển thị thông báo lỗi từ API (đã dịch sang tiếng Việt)
        showError(translateErrorMessage(result.message));
      }
    } catch (error) {
      // Xử lý lỗi kết nối hoặc lỗi bất ngờ
      showError(translateErrorMessage(error.message));
    } finally {
      // Tắt trạng thái loading
      setLoading(false);
    }
  });

  /**
   * Kiểm tra nếu đã đăng nhập thì chuyển hướng về trang chủ
   * (Tránh việc user đã login lại vào trang login)
   */
  if (Auth.isLoggedIn()) {
    window.location.href = "index.html";
  }

  loadRememberedLogin();
})();
