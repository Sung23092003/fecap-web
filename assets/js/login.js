/**
 * login.js (DISABLED)
 *
 * Không còn xử lý login / tài khoản / token.
 */

(function () {
  "use strict";

  const loginForm = document.getElementById("login-form");
  const loginAlert = document.getElementById("login-alert");

  function showError(message) {
    if (!loginAlert) return;
    loginAlert.textContent = message;
    loginAlert.classList.remove("d-none");
    loginAlert.classList.add("show");
  }

  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      showError("Đăng nhập đang bị tắt (không còn API tài khoản)." );
    });
  }
})();

