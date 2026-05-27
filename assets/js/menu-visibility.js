(function () {
  "use strict";

  var STORAGE_KEY = 'niceadmin_menu_visibility';

  function getSettings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  var menuItemMap = {
    'Dashboard': 'dashboard',
    'Quản lý Giao diện': 'layout',
    'Quản lý Đầu Trang': 'layout-header',
    'Quản lý Thân Trang': 'layout-body',
    'Quản lý Chân Trang': 'layout-footer',
    'Quản lý danh mục': 'category',
    'Quản lý bài viết': 'articles',
    'Quản lý tin tức': 'articles-news',
    'Quản lý dịch vụ': 'articles-services',
    'Quản lý Sản phẩm': 'articles-products',
    'Quản Lý Bài Sản phẩm': 'articles-products-post',
    'Quản Lý Sản phẩm bán chạy': 'articles-products-hot',
    'Quản Lý thông tin thanh toán': 'articles-products-payment',
    'Quản lý Đơn hàng': 'orders',
    'Quản lý Yêu cầu tư vấn': 'consult',
    'Quản lý user người dùng': 'users',
    'Quản lý user khách hàng': 'users-customer',
    'Quản lý cấp độ VIP': 'users-vip',
    'Quản lý Comment': 'users-comment',
    'Quản Lý Mã và Link Chat': 'chat-link',
    'Quản lý User': 'system-users',
    'Quy định': 'regulations',
    'QL Quy định chung': 'regulations-general',
    'QL Hướng dẫn': 'regulations-guide',
    'Quản lý SEO': 'seo',
    'Danh sách icons': 'icons',
    'Bootstrap': 'icons-bootstrap',
    'Remix': 'icons-remix',
    'Boxicons': 'icons-boxicons',
    'Fontawesome': 'icons-fontawesome',
    'Cài đặt Chung': 'settings',
    'Phân quyền': 'settings-permissions',
    'Quản lý quyền': 'settings-permissions-role',
    'Quản lý nhóm quyền': 'settings-permissions-group',
    'Cài đặt ẩn/hiện menu': 'settings-menu',
    'Quản lý ĐVHC': 'settings-dvhc',
    'Hướng dẫn BFE': 'settings-bfe',
    'Quản lý Đầu trang': 'layout-header'
  };

  var settings = getSettings();

  // Short delay to ensure DOM is ready
  setTimeout(function () {
    var sidebarItems = document.querySelectorAll('#sidebar-nav .nav-item, #sidebar-nav .nav-content li');
    sidebarItems.forEach(function (item) {
      var link = item.querySelector('a span:last-child, a');
      if (!link) return;
      var text = link.textContent.trim();
      var menuId = menuItemMap[text];
      if (menuId && settings[menuId] === false) {
        item.style.display = 'none';
      }
    });
  }, 100);
})();
