/**
 * Cấu hình môi trường cho ứng dụng web (front-end)
 *
 * - Chạy LOCAL (localhost / 127.0.0.1 / IP nội bộ / file://):
 *     -> dùng BASE_URL_LOCAL khai báo tay bên dưới.
 * - Chạy trên SERVER (miền thật):
 *     -> tự động suy ra API theo miền hiện tại, ví dụ:
 *        https://dienlanhnguyengia.com  ->  https://api.dienlanhnguyengia.com
 *        http://www.abc.vn              ->  http://api.abc.vn
 */
(function () {
  "use strict";

  /* ====== CHỈNH TAY KHI CHẠY LOCAL ====== */
  var BASE_URL_LOCAL = "https://capi.id.vn";

  /* Giá trị dự phòng khi không xác định được môi trường */
  var DEFAULT_BASE_URL = "https://capi.id.vn";

  function isLocalHostname(hostname) {
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "" ||
      /\.(local|localtest|test|dev)$/.test(hostname) ||
      /^192\.168\.\d+\.\d+$/.test(hostname) ||
      /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname)
    );
  }

  function detectBaseUrl() {
    var loc = window.location;
    var hostname = String(loc.hostname || "").toLowerCase();

    /* Mở trực tiếp bằng file:// hoặc không có hostname -> coi như local */
    if (loc.protocol === "file:" || !hostname) {
      return BASE_URL_LOCAL || DEFAULT_BASE_URL;
    }

    if (isLocalHostname(hostname)) {
      return BASE_URL_LOCAL || DEFAULT_BASE_URL;
    }

    /* Trên server: giữ nguyên giao thức, thay sub-domain bằng api. */
    var host = hostname.replace(/^www\./, "");
    return loc.protocol + "//api." + host;
  }

  window.ENV = {
    BASE_URL: detectBaseUrl(),
    IS_LOCAL: isLocalHostname(String(window.location.hostname || "").toLowerCase()) ||
      window.location.protocol === "file:" ||
      !window.location.hostname
  };
})();
