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

  function categoryUrl(value) {
    var url = String(value || "").trim();
    if (!url) return "#";
    if (/^(https?:|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(url)) return url;
    return "/" + url.replace(/^\/+/, "");
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

  function unwrapCategoryPayload(raw) {
    if (!raw) return null;
    if (raw.data && raw.data.data != null) return raw.data.data;
    if (raw.data != null) return raw.data;
    return raw;
  }

  function normalizeCategoryItems(data) {
    var itemById = new Map();
    var items = [];

    function cloneItem(item, parentTitle) {
      var cloned = Object.assign({}, item || {});
      cloned._children = [];
      cloned._parentTitle = parentTitle || "";
      return cloned;
    }

    if (Array.isArray(data)) {
      items = data.map(function (item) { return cloneItem(item); });
    } else if (data && typeof data === "object") {
      Object.keys(data).forEach(function (key) {
        var entry = data[key];
        var parent = entry && (entry.parent || entry);
        var parentItem;
        if (!parent || parent.category_id == null) return;

        parentItem = cloneItem(parent);
        items.push(parentItem);

        normalizeList(entry.sub).forEach(function (sub) {
          items.push(cloneItem(sub, parentItem.category_title));
        });
      });
    }

    items = items.filter(function (item) {
      var id = firstValue(item.category_id, item.id);
      if (!id || itemById.has(String(id))) return false;
      itemById.set(String(id), item);
      return true;
    });

    itemById.clear();

    items.forEach(function (item) {
      itemById.set(String(firstValue(item.category_id, item.id)), item);
    });

    items.forEach(function (item) {
      var parentId = firstValue(item.category_parent_id, item.parent_id);
      var parent = parentId !== "" ? itemById.get(String(parentId)) : null;
      if (parent && parent !== item) {
        item._parentTitle = parent.category_title || parent.title || "";
        parent._children.push(item);
      }
    });

    return items.filter(function (item) {
      var parentId = firstValue(item.category_parent_id, item.parent_id);
      return parentId === "" || Number(parentId) === 0 || !itemById.has(String(parentId));
    });
  }

  function flattenCategories(items) {
    var flat = [];

    normalizeList(items).forEach(function walk(item) {
      var cloned = Object.assign({}, item);
      var children = normalizeList(cloned._children);
      delete cloned._children;
      flat.push(cloned);
      children.forEach(walk);
    });

    return flat;
  }

  function categoryTotalPage(raw) {
    return numberValue(
      firstValue(
        raw && raw.data && raw.data.pagination && raw.data.pagination.total_page,
        raw && raw.data && raw.data.total_page,
        raw && raw.total_page
      ),
      1
    );
  }

  function isCategoryVisible(item) {
    var value = firstValue(item.category_status, item.status, 1);
    return value === 1 || value === "1" || value === true || value === "true";
  }

  function categoryTitle(item) {
    return firstValue(item.category_title, item.title, item.name);
  }

  function categoryAlias(item) {
    return firstValue(item.category_alias, item.alias, item.slug, item.link, item.url);
  }

  function categoryOrder(item) {
    return numberValue(firstValue(item.category_order_no, item.order_no, item.position, item.order), 0);
  }

  function sortCategories(items) {
    return normalizeList(items)
      .filter(isCategoryVisible)
      .sort(function (a, b) {
        var orderDiff = categoryOrder(a) - categoryOrder(b);
        if (orderDiff) return orderDiff;
        return String(categoryTitle(a)).localeCompare(String(categoryTitle(b)), "vi");
      });
  }

  function renderCategoryIcon(item) {
    var image = firstValue(item.category_image, item.image, item.icon_image);
    var icon = normalizeIconClass(firstValue(item.category_icon, item.icon));
    if (image) return '<img src="' + escapeHtml(safeUrl(image, "")) + '" alt="" loading="lazy" decoding="async">';
    if (icon) return '<i class="' + escapeHtml(icon) + '"></i>';
    return "";
  }

  function renderCategoryLink(item, className) {
    var icon = renderCategoryIcon(item);
    var title = categoryTitle(item);
    return '<a class="' + className + '" href="' + escapeHtml(categoryUrl(categoryAlias(item))) + '">' + icon + '<span>' + escapeHtml(title) + "</span></a>";
  }

  function renderCategorySubMenu(children) {
    var visibleChildren = sortCategories(children);
    var hasGrandChildren = visibleChildren.some(function (item) {
      return sortCategories(item._children).length > 0;
    });

    if (!visibleChildren.length) return "";

    if (!hasGrandChildren && visibleChildren.length <= 8) {
      return '<ul class="sub-menu">' + visibleChildren.map(function (item) {
        return '<li>' + renderCategoryLink(item, "menu-link py-2 px-3 d-flex align-items-center gap-2") + "</li>";
      }).join("") + "</ul>";
    }

    return '<ul class="sub-menu sub-menu-list">' + visibleChildren.map(function (item) {
      var grandChildren = sortCategories(item._children);
      var rows = '<li>' + renderCategoryLink(item, "menu-link d-flex align-items-center gap-2") + "</li>";
      rows += grandChildren.map(function (child) {
        return '<li>' + renderCategoryLink(child, "menu-link d-flex align-items-center gap-2") + "</li>";
      }).join("");
      return '<li class="sub-menu-item"><ul class="menu-list">' + rows + "</ul></li>";
    }).join("") + "</ul>";
  }

  function renderCategoryMenu(categories) {
    var roots = sortCategories(categories);
    if (!roots.length) return "";

    return '<ul class="menu mb-0 d-flex row-gap-2 align-items-center justify-content-center">' + roots.map(function (item) {
      var children = sortCategories(item._children);
      return (
        '<li class="menu-item d-flex align-items-center py-1 px-2' + (children.length ? " has-sub-menu" : "") + '">' +
          renderCategoryLink(item, "menu-link py-1 px-2 d-flex align-items-center gap-1") +
          (children.length ? '<i class="fa-solid fa-caret-down"></i>' + renderCategorySubMenu(children) : "") +
        "</li>"
      );
    }).join("") + "</ul>";
  }

  function normalizeIconClass(icon) {
    var value = firstValue(icon).trim();
    var match;
    if (!value) return "";

    match = value.match(/class\s*=\s*["']([^"']+)["']/i);
    if (match && match[1]) value = match[1];

    return /^[a-z0-9_\-:\s]+$/i.test(value) ? value : "";
  }

  function renderMainItemMedia(item) {
    var image = firstValue(item.image, item.img);
    var iconClass = normalizeIconClass(item.icon);

    if (image) {
      return '<div class="box-image d-flex justify-content-center"><img class="header-action-image" src="' + escapeHtml(safeUrl(image, "")) + '" alt="" loading="lazy" decoding="async"></div>';
    }

    if (iconClass) {
      return '<div class="box-icon d-flex justify-content-center"><div class="icon icon-light-border"><i class="' + escapeHtml(iconClass) + '"></i></div></div>';
    }

    return "";
  }

  function renderTopLink(item) {
    var name = firstValue(item.name, item.label);
    var icon = normalizeIconClass(item.icon);
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
      '<a class="header-action' + visibleClass + '" style="color:inherit;--header-action-columns:' + columns + '" href="' + escapeHtml(href) + '">' +
        '<div class="d-flex justify-content-center align-items-center gap-1">' +
          renderMainItemMedia(item) +
          '<div class="text text-left d-none d-xl-block"><small>' + escapeHtml(title) + (content ? '<b class="d-block text-left">' + escapeHtml(content) + "</b>" : "") + "</small></div>" +
        "</div>" +
      "</a>"
    );
  }

  function renderHeaderMain(main, extraClass) {
    var items = main.items
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
            '<div class="logo d-flex align-items-center justify-content-center justify-content-md-start" id="logo"><a href="./"><img class="w-100" src="' + escapeHtml(logo) + '" alt="logo" loading="eager" decoding="async"></a></div>' +
          "</div>" +
          (main.searchShow ? '<div class="d-none d-md-flex align-content-center gap-2 wrap-header-search px-0 col-12 col-sm-4 col-md-5 col-lg-6 col-xl-4" id="header-search"><div class="header-search d-block w-100"><form class="form-inline" action="tat-ca-san-pham" method="GET"><div class="input-group flex-nowrap"><input class="form-control" type="text" name="search" placeholder="Tim kiem San pham & Dich vu ?"><div class="input-group-append bg-light"><button class="btn" type="submit" aria-label="Tim kiem"><i class="fa fa-search" aria-hidden="true"></i></button></div></div></form></div></div>' : "") +
          '<div class="header-actions-list d-flex align-items-center justify-content-end gap-2 ms-auto px-0">' +
            items.map(renderMainItem).join("") +
          "</div>" +
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
          '<h5 class="offcanvas-title mx-auto" id="offcanvasExampleLabel"><img class="w-100" width="250" src="' + escapeHtml(logo) + '" alt="logo" loading="lazy" decoding="async"></h5>' +
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

  async function loadCategoryMenu() {
    var params = new URLSearchParams();
    var response;
    var json;
    var pageCategories;
    var allCategories = [];
    var totalPage;
    var page;

    params.set("page", "1");
    params.set("category_status", "1");

    response = await fetch(getBaseUrl() + "/admin/category?" + params.toString(), {
      method: "GET",
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error("Category API " + response.status);

    json = await response.json();
    if (!json || json.success === false) throw new Error(json && json.message ? json.message : "Category API error");

    pageCategories = normalizeCategoryItems(unwrapCategoryPayload(json));
    allCategories = allCategories.concat(flattenCategories(pageCategories));
    totalPage = Math.min(categoryTotalPage(json), 20);

    for (page = 2; page <= totalPage; page += 1) {
      params.set("page", String(page));
      response = await fetch(getBaseUrl() + "/admin/category?" + params.toString(), {
        method: "GET",
        headers: getAuthHeaders()
      });
      if (!response.ok) break;
      json = await response.json();
      if (!json || json.success === false) break;
      allCategories = allCategories.concat(flattenCategories(normalizeCategoryItems(unwrapCategoryPayload(json))));
    }

    return renderCategoryMenu(normalizeCategoryItems(allCategories));
  }

  function renderPageHeader(header, apiMenuHtml) {
    var root = document.querySelector('[data-page-region="header"]');
    if (!root) return;
    var menu = root.querySelector(".header-bottom .menu");
    var fallbackMenuHtml = menu ? '<ul class="menu mb-0 d-flex row-gap-2 align-items-center justify-content-center">' + menu.innerHTML + "</ul>" : '<ul class="menu mb-0 d-flex row-gap-2 align-items-center justify-content-center"></ul>';
    var menuHtml = apiMenuHtml || fallbackMenuHtml;
    var sections = layoutSections[header.style] || layoutSections[3];
    var html = "";
    if (sections.top) html += renderHeaderTop(header.top);
    if (sections.main) html += renderHeaderMain(header.main);
    if (!sections.main && sections.menu) html += renderHeaderMain(header.main, " d-lg-none");
    if (sections.menu) html += renderMenu(menuHtml);
    html += renderOffcanvas(header);
    root.innerHTML = html;
    root.dataset.headerStyle = String(header.style);
    root.dataset.renderState = "ready";
    applyMeta(header);
    window.dispatchEvent(new CustomEvent("fe:page-rendered", { detail: { region: "header", data: header, menuFromApi: Boolean(apiMenuHtml) } }));
  }

  async function init() {
    var header;
    var menuHtml = "";

    try {
      header = await loadHeader();
      try {
        menuHtml = await loadCategoryMenu();
      } catch (menuErr) {
        if (window.console) console.warn("Use static menu fallback:", menuErr.message || menuErr);
      }
      renderPageHeader(header, menuHtml);
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
