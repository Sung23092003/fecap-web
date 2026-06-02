(function () {
  "use strict";

  var FALLBACKS = {
    logo: "assets/img/header/logo.png",
    menuIcon: "assets/img/header/cam-nang.png"
  };

  var layoutSections = {
    1: { top: false, main: false, menu: true },
    2: { top: false, main: true, menu: true },
    3: { top: true, main: true, menu: true },
    4: { top: true, main: true, menu: true },
    5: { top: true, main: true, menu: true }
  };

  function getBaseUrl() {
    if (typeof ENV !== "undefined" && ENV.BASE_URL) return ENV.BASE_URL;
    return (window.ENV && window.ENV.BASE_URL) || "https://capi.id.vn";
  }

  function getAuthHeaders() {
    var headers = { "Content-Type": "application/json" };
    try {
      var raw = localStorage.getItem("cms_auth");
      var auth = raw ? JSON.parse(raw) : null;
      if (auth && auth.token) headers.Authorization = "Bearer " + auth.token;
    } catch (e) {}
    return headers;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeUrl(value, fallback) {
    var url = String(value || "").trim();
    if (!url) return fallback || "#";
    if (/^(https?:|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(url)) return url;
    return fallback || "#";
  }

  function normalizeList(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        var parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  function unwrapHeaderPayload(raw) {
    var payload = raw;

    if (payload && payload.success === true && payload.data != null) {
      payload = payload.data;
    }

    if (payload && payload.data != null && (payload.data.header_main || payload.data.header_top || payload.data.style != null)) {
      payload = payload.data;
    }

    return payload || {};
  }

  function firstValue() {
    for (var i = 0; i < arguments.length; i += 1) {
      if (arguments[i] !== null && arguments[i] !== undefined && arguments[i] !== "") {
        return arguments[i];
      }
    }
    return "";
  }

  function numberValue(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function isEnabled(value, fallback) {
    if (value === null || value === undefined || value === "") return fallback;
    return value !== 0 && value !== "0" && value !== false && value !== "false";
  }

  function normalizeHeader(raw) {
    var d = unwrapHeaderPayload(raw);
    var headerTop = d.header_top || d.headerTop || {};
    var headerMain = d.header_main || d.headerMain || {};
    var logo = d.logo || {};

    return {
      style: numberValue(firstValue(d.style, d.header_layout, d.headerLayout), 3),
      logo: {
        favicon: firstValue(logo.favicon),
        main: firstValue(headerMain.logo, logo.logo_main, logo.logoMain, FALLBACKS.logo),
        social: firstValue(logo.social_image, logo.socialImage)
      },
      top: {
        bgColor: firstValue(headerTop.bg_color, headerTop.bgColor, "#ffffff"),
        textColor: firstValue(headerTop.text_color, headerTop.textColor, "#212529"),
        borderColor: firstValue(headerTop.border_color, headerTop.borderColor, "#0282a5"),
        borderWidth: numberValue(firstValue(headerTop.border_thickness, headerTop.borderThickness), 1),
        leftLinks: normalizeList(headerTop.left_links || headerTop.leftLinks),
        rightLinks: normalizeList(headerTop.right_links || headerTop.rightLinks)
      },
      main: {
        bgColor: firstValue(headerMain.bg_color, headerMain.bgColor, "#0282a5"),
        textColor: firstValue(headerMain.text_color, headerMain.textColor, "#ffffff"),
        borderColor: firstValue(headerMain.border_color, headerMain.borderColor, "transparent"),
        borderWidth: numberValue(firstValue(headerMain.border_thickness, headerMain.borderThickness), 0),
        logo: firstValue(headerMain.logo, logo.logo_main, logo.logoMain, FALLBACKS.logo),
        searchShow: isEnabled(firstValue(headerMain.search_show, headerMain.searchShow), true),
        items: normalizeList(headerMain.item_list || headerMain.itemList)
      }
    };
  }

  function iconHtml(item) {
    var image = item.image || item.img || "";
    var icon = item.icon || "";
    if (image) {
      return '<img src="' + escapeHtml(safeUrl(image, "")) + '" alt="">';
    }
    if (/^fa[srb]?\s|^fa-|^bi\s|^bi-|^ri-|^bx\s|^bx-/i.test(icon)) {
      return '<i class="' + escapeHtml(icon) + '"></i>';
    }
    return '<i class="fa-solid fa-circle-info"></i>';
  }

  function renderTopLink(item) {
    var name = firstValue(item.name, item.label);
    var icon = firstValue(item.icon);
    var iconPart = icon ? '<i class="' + escapeHtml(icon) + '"></i>' : "";
    return '<a style="color:inherit;display:inline-flex;align-items:center;gap:6px" href="' + escapeHtml(safeUrl(firstValue(item.link, item.url), "#")) + '">' + iconPart + '<span>' + escapeHtml(name) + "</span></a>";
  }

  function topLinksGapClass(items) {
    var hasIconAndText = normalizeList(items).some(function (item) {
      return firstValue(item.icon) && firstValue(item.name, item.label);
    });
    return hasIconAndText ? "gap-3" : "gap-1";
  }

  function renderHeaderTop(top) {
    var left = top.leftLinks.length ? top.leftLinks.map(renderTopLink).join("") : '<a style="color:inherit" href="#">Chao mung quy khach</a>';
    var right = top.rightLinks.length ? top.rightLinks.map(renderTopLink).join("") : "";
    var leftGapClass = topLinksGapClass(top.leftLinks);
    var rightGapClass = topLinksGapClass(top.rightLinks);
    return (
      '<div class="header-top d-none d-md-block" style="background:' + escapeHtml(top.bgColor) + ';color:' + escapeHtml(top.textColor) + ';border-bottom:' + Number(top.borderWidth || 0) + 'px solid ' + escapeHtml(top.borderColor) + '">' +
        '<div class="container-fluid px-3 px-sm-5 py-2">' +
          '<div class="infomation d-flex flex-nowrap justify-content-between gap-2">' +
            '<div class="d-flex flex-wrap ' + leftGapClass + ' infomation-left">' + left + "</div>" +
            '<div class="social-icons d-flex align-items-center ' + rightGapClass + '">' + right + "</div>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function renderMainItem(item) {
    var columns = Math.max(1, Math.min(12, numberValue(item.columns, 1)));
    var showDesktop = isEnabled(firstValue(item.show_desktop, item.showDesktop), true);
    var showMobile = isEnabled(firstValue(item.show_mobile, item.showMobile), true);
    var visibleClass = (showDesktop ? " d-xl-block" : " d-xl-none") + (showMobile ? "" : " d-none");
    var href = safeUrl(firstValue(item.link, item.url), "#");
    var title = firstValue(item.name, item.label);
    var content = firstValue(item.content, item.description);
    return (
      '<a class="header-action col-' + columns + visibleClass + '" style="color:inherit" href="' + escapeHtml(href) + '">' +
        '<div class="d-flex justify-content-center align-items-center gap-1">' +
          '<div class="box-icon d-flex justify-content-center"><div class="icon icon-light-border">' + iconHtml(item) + "</div></div>" +
          '<div class="text text-left d-none d-xl-block"><small>' + escapeHtml(title) + (content ? '<b class="d-block text-left">' + escapeHtml(content) + "</b>" : "") + "</small></div>" +
        "</div>" +
      "</a>"
    );
  }

  function defaultMainItems() {
    return [
      { name: "He thong cua hang", content: "(45 chi nhanh)", icon: "fa-solid fa-location-dot" },
      { name: "San pham", content: "Yeu thich", icon: "fa-regular fa-heart" },
      { name: "Dang nhap", content: "Dang ky", icon: "fa-regular fa-user", link: "./register.html" },
      { name: "Gio hang", content: "0 vnd", icon: "fa-solid fa-cart-shopping" }
    ];
  }

  function renderHeaderMain(main, extraClass) {
    var items = (main.items.length ? main.items : defaultMainItems())
      .filter(function (item) {
        return isEnabled(firstValue(item.show_desktop, item.showDesktop), true) || isEnabled(firstValue(item.show_mobile, item.showMobile), true);
      })
      .sort(function (a, b) { return Number(a.position || 0) - Number(b.position || 0); });
    var logo = safeUrl(main.logo, FALLBACKS.logo);
    return (
      '<div class="header-main header-main-shell px-3 d-flex align-items-center justify-content-between' + (extraClass || "") + '" id="header-main" style="background:' + escapeHtml(main.bgColor) + ';color:' + escapeHtml(main.textColor) + ';border-bottom:' + Number(main.borderWidth || 0) + 'px solid ' + escapeHtml(main.borderColor) + '">' +
        '<div class="container"><div class="row align-items-center justify-content-between w-100 wrap-menu">' +
          '<div class="d-md-none col-2 px-0"><div class="toggle-menu d-flex gap-1 justify-content-between align-content-center"><div class="box-icon d-flex justify-content-center gap-2"><div class="icon icon-light-border"><button class="btn btn-toggle-menu" type="button" data-bs-toggle="offcanvas" data-bs-target="#offcanvasExample3" aria-controls="offcanvasExample3"><i class="fa-solid fa-bars text-light fs-5 mt-1"></i></button></div></div></div></div>' +
          '<div class="wrap-header-logo col-7 col-md-3 col-lg-3 col-xl-2 px-0 d-flex gap-2 align-content-center justify-content-center justify-content-md-start">' +
            '<div class="d-none d-md-block d-lg-none col-2 px-0 mt-2"><div class="toggle-menu d-flex gap-1 justify-content-between align-content-center"><div class="d-flex justify-content-center gap-2"><div class="icon icon-light-border"><button class="btn btn-toggle-menu" type="button" data-bs-toggle="offcanvas" data-bs-target="#offcanvasExample3" aria-controls="offcanvasExample3"><i class="fa-solid fa-bars text-light fs-5 mt-1"></i></button></div></div></div></div>' +
            '<div class="logo d-flex align-items-center justify-content-center justify-content-md-start" id="logo"><a href="./"><img class="w-100" src="' + escapeHtml(logo) + '" alt="logo"></a></div>' +
          "</div>" +
          (main.searchShow ? '<div class="d-none d-md-flex align-content-center gap-2 wrap-header-search px-0 col-12 col-sm-4 col-md-5 col-lg-6 col-xl-4" id="header-search"><div class="header-search d-block w-100"><form class="form-inline" action="tat-ca-san-pham" method="GET"><div class="input-group flex-nowrap"><input class="form-control" type="text" name="search" placeholder="Tim kiem San pham & Dich vu ?"><div class="input-group-append bg-light"><button class="btn" type="submit" aria-label="Tim kiem"><i class="fa fa-search" aria-hidden="true"></i></button></div></div></form></div></div>' : "") +
          items.map(renderMainItem).join("") +
          '<div class="col-2 d-flex justify-content-end gap-2 d-xl-none px-0"><a class="d-block" href="#"><div class="d-flex justify-content-center align-items-center gap-1"><div class="box-icon d-flex justify-content-center gap-1 align-items-center"><div class="icon icon-light-border"><i class="fa-solid fa-cart-shopping text-light"></i></div></div></div></a></div>' +
        "</div></div>" +
      "</div>"
    );
  }

  function renderMenu(fallbackMenuHtml) {
    return (
      '<div id="header-sticky">' +
        '<div class="header-bottom-item header-bottom d-none d-lg-block container-fluid px-5 header-bottom-surface">' +
          '<div class="header-bottom-inner">' + fallbackMenuHtml + "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function renderOffcanvas(header) {
    var logo = safeUrl(header.main.logo || header.logo.main, FALLBACKS.logo);
    return (
      '<div class="offcanvas offcanvas-start offcanvasExample3" id="offcanvasExample3" data-bs-scroll="false" data-bs-backdrop="true" tabindex="-1" aria-labelledby="offcanvasExampleLabel">' +
        '<div class="offcanvas-header pb-1 position-relative px-1 pt-2 mx-3">' +
          '<h5 class="offcanvas-title mx-auto" id="offcanvasExampleLabel"><img class="w-100" width="250" src="' + escapeHtml(logo) + '" alt="logo"></h5>' +
          '<button class="btn-close position-absolute z-1 end-0" id="btn-close-sidebar" type="button" data-bs-dismiss="offcanvas" aria-label="Close"></button>' +
        "</div>" +
        '<div class="px-3 py-2"><div class="header-search d-block w-100"><form class="form-inline" action="#" method="GET"><div class="input-group flex-nowrap"><input class="form-control" type="text" name="search" placeholder="Tim kiem San pham & Dich vu ?"><div class="input-group-append bg-light"><button class="btn" type="submit" aria-label="Tim kiem"><i class="fa fa-search" aria-hidden="true"></i></button></div></div></form></div></div>' +
        '<div class="offcanvas-body pt-1 px-3 d-flex justify-content-between flex-column"><ul class="mobile-category-menu border-top" id="mobile-category-menu"></ul></div>' +
      "</div>"
    );
  }

  function applyMeta(header) {
    if (header.logo.favicon) {
      var icon = document.querySelector('link[rel="icon"]') || document.createElement("link");
      icon.rel = "icon";
      icon.href = safeUrl(header.logo.favicon, "");
      if (!icon.parentNode) document.head.appendChild(icon);
    }
    if (header.logo.social) {
      var og = document.querySelector('meta[property="og:image"]') || document.createElement("meta");
      og.setAttribute("property", "og:image");
      og.setAttribute("content", safeUrl(header.logo.social, ""));
      if (!og.parentNode) document.head.appendChild(og);
    }
  }

  async function loadHeader() {
    var response = await fetch(getBaseUrl() + "/admin/config/header", {
      method: "GET",
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error("Header API " + response.status);
    var json = await response.json();
    if (!json || json.success === false) throw new Error(json && json.message ? json.message : "Header API error");
    return normalizeHeader(json);
  }

  function renderPageHeader(header) {
    var root = document.querySelector('[data-page-region="header"]');
    if (!root) return;
    var menu = root.querySelector(".header-bottom .menu");
    var fallbackMenuHtml = menu ? '<ul class="menu mb-0 d-flex row-gap-2 align-items-center justify-content-center">' + menu.innerHTML + "</ul>" : '<ul class="menu mb-0 d-flex row-gap-2 align-items-center justify-content-center"></ul>';
    var sections = layoutSections[header.style] || layoutSections[3];
    var html = "";
    if (sections.top) html += renderHeaderTop(header.top);
    if (sections.main) html += renderHeaderMain(header.main);
    if (!sections.main && sections.menu) html += renderHeaderMain(header.main, " d-lg-none");
    if (sections.menu) html += renderMenu(fallbackMenuHtml);
    html += renderOffcanvas(header);
    root.innerHTML = html;
    root.dataset.headerStyle = String(header.style);
    root.dataset.renderState = "ready";
    applyMeta(header);
    window.dispatchEvent(new CustomEvent("fe:page-rendered", { detail: { region: "header", data: header } }));
  }

  async function init() {
    try {
      renderPageHeader(await loadHeader());
    } catch (err) {
      var root = document.querySelector('[data-page-region="header"]');
      if (root) root.dataset.renderState = "ready";
      window.dispatchEvent(new CustomEvent("fe:page-rendered", { detail: { region: "header", fallback: true } }));
      if (window.console) console.warn("Use static header fallback:", err.message || err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
