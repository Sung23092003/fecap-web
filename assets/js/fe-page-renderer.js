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

  var AUTO_LOGIN = (typeof ENV !== "undefined" && ENV.AUTO_LOGIN) ||
    (window.ENV && window.ENV.AUTO_LOGIN) ||
  {
    username: "admin",
    password: "123987"
  };
  var authPromise = null;
  var bodyCatalogCache = { categories: [], products: [] };

  function getStoredAuth() {
    try {
      var raw = localStorage.getItem("cms_auth");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      localStorage.removeItem("cms_auth");
      return null;
    }
  }

  function setStoredAuth(token, user) {
    localStorage.setItem("cms_auth", JSON.stringify({
      token: token,
      user: user || { name: AUTO_LOGIN.username },
      saved_at: Date.now()
    }));
  }

  function getStoredToken() {
    var auth = getStoredAuth();
    return auth && auth.token ? auth.token : "";
  }

  function extractToken(result) {
    if (!result) return "";
    if (result.token) return result.token;
    if (result.access_token) return result.access_token;
    if (result.data && result.data.token) return result.data.token;
    if (result.data && result.data.access_token) return result.data.access_token;
    return "";
  }

  async function autoLogin(force) {
    var existingToken = getStoredToken();
    if (!force && existingToken) return existingToken;
    if (authPromise && !force) return authPromise;

    authPromise = fetch(getBaseUrl() + "/cms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: AUTO_LOGIN.username,
        password: AUTO_LOGIN.password
      })
    })
      .then(function (response) {
        if (!response.ok && response.status !== 400) {
          throw new Error("Login API " + response.status);
        }
        return response.json();
      })
      .then(function (result) {
        var token = extractToken(result);
        if (!result || result.success === false || !token) {
          throw new Error(result && result.message ? result.message : "Login API error");
        }
        setStoredAuth(token, result.data && result.data.user);
        return token;
      })
      .finally(function () {
        authPromise = null;
      });

    return authPromise;
  }

  function getAuthHeaders() {
    var headers = { "Content-Type": "application/json" };
    var token = getStoredToken();
    if (token) headers.Authorization = "Bearer " + token;
    return headers;
  }

  async function fetchWithAuth(url, options, didRetry) {
    options = options || {};
    await autoLogin(false);
    options.headers = Object.assign({}, options.headers || {}, getAuthHeaders());

    var response = await fetch(url, options);
    if (response.status === 401 && !didRetry) {
      localStorage.removeItem("cms_auth");
      await autoLogin(true);
      options.headers = Object.assign({}, options.headers || {}, getAuthHeaders());
      response = await fetchWithAuth(url, options, true);
    }

    return response;
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

  function safeImageUrl(value, fallback) {
    var url = String(value || "").trim();
    if (!url) return fallback || "";
    if (/^data:image\//i.test(url)) return url;
    return safeUrl(url, fallback || "");
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

  function unwrapConfigPayload(raw) {
    var payload = raw;

    if (payload && payload.success === true && payload.data != null) {
      payload = payload.data;
    }

    if (payload && payload.data != null && typeof payload.data === "object") {
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

  function hexToRgba(hex, opacity) {
    var value = String(hex || "").replace("#", "").trim();
    var alpha = Math.max(0, Math.min(100, numberValue(opacity, 100))) / 100;
    var r;
    var g;
    var b;

    if (value.length === 3) {
      value = value.split("").map(function (char) { return char + char; }).join("");
    }

    if (!/^[0-9a-f]{6}$/i.test(value)) return hex || "transparent";

    r = parseInt(value.slice(0, 2), 16);
    g = parseInt(value.slice(2, 4), 16);
    b = parseInt(value.slice(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function isEnabled(value, fallback) {
    if (value === null || value === undefined || value === "") return fallback;
    return value !== 0 && value !== "0" && value !== false && value !== "false";
  }

  function normalizeBootstrapColClass(value, fallback) {
    var allowed = String(value || "")
      .trim()
      .split(/\s+/)
      .filter(function (part) {
        return /^col(?:-(?:sm|md|lg|xl|xxl))?(?:-(?:[1-9]|1[0-2]|auto))?$/.test(part);
      });

    return allowed.length ? allowed.join(" ") : fallback;
  }

  function complementBootstrapColClass(value, fallback) {
    var source = normalizeBootstrapColClass(value, "");
    var parts;
    var result;

    if (!source) return fallback;

    parts = source.split(/\s+/);
    result = parts.map(function (part) {
      var match;
      var prefix;
      var number;

      if (part === "col") return "col";
      if (/^col-(sm|md|lg|xl|xxl)$/.test(part)) return part;
      match = part.match(/^col(?:-(sm|md|lg|xl|xxl))?-(auto|[1-9]|1[0-2])$/);
      if (!match) return "";

      if (match[2] === "auto") return match[1] ? "col-" + match[1] : "col";

      number = 12 - Number(match[2]);
      prefix = match[1] ? "col-" + match[1] + "-" : "col-";
      return number > 0 ? prefix + number : prefix + "12";
    }).filter(Boolean);

    return result.length ? result.join(" ") : fallback;
  }

  function normalizeCssLength(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";
    if (/^\d+(\.\d+)?$/.test(raw)) return raw + "px";
    if (/^-?\d+(\.\d+)?(px|rem|em|%|vh|vw|vmin|vmax)$/i.test(raw)) return raw;
    return "";
  }

  function normalizeHeader(raw) {
    var d = unwrapHeaderPayload(raw);
    var headerTop = d.header_top || d.headerTop || {};
    var headerMain = d.header_main || d.headerMain || {};
    var categoryThemeSetting =
      headerTop.themeSettingCategory ||
      headerTop.theme_setting_category ||
      headerTop.themeSettingcategory ||
      headerTop.theme_settingCategory ||
      d.themeSettingCategory ||
      d.theme_setting_category ||
      d.themeSettingcategory ||
      d.theme_settingCategory;
    var headerNewsRaw =
      headerTop.news_list ||
      headerTop.newsList ||
      headerTop.news_items ||
      headerTop.newsItems ||
      headerTop.news ||
      d.header_news ||
      d.headerNews ||
      d.news_tab ||
      d.newsTab ||
      d.news ||
      {};
    var headerNews = Array.isArray(headerNewsRaw) ? {} : headerNewsRaw;
    var newsItems = Array.isArray(headerNewsRaw)
      ? normalizeList(headerNewsRaw)
      : normalizeList(
        headerNews.items ||
        headerNews.item_list ||
        headerNews.itemList ||
        headerNews.news_list ||
        headerNews.newsList ||
        headerNews.list ||
        headerTop.news_list ||
        headerTop.newsList ||
        headerTop.news_items ||
        headerTop.newsItems ||
        d.header_news_items ||
        d.headerNewsItems ||
        d.news_items ||
        d.newsItems
      );
    var logo = d.logo || {};

    if (!newsItems.length && firstValue(headerNews.text, headerNews.title, headerNews.name, headerNews.content)) {
      newsItems = [{
        text: firstValue(headerNews.text, headerNews.title, headerNews.name, headerNews.content),
        link: firstValue(headerNews.link, headerNews.url, headerNews.href)
      }];
    }

    if (categoryThemeSetting && typeof categoryThemeSetting === "object") {
      window.FE_MENU_APPEARANCE = categoryThemeSetting;
      window.FE_MENU_APPEARANCE_SOURCE = "header";
      try {
        localStorage.setItem("menu_appearance", JSON.stringify(categoryThemeSetting));
      } catch (e) { }
    }

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
        hoverTextColor: firstValue(headerTop.hover_text_color, headerTop.hoverTextColor, headerTop.text_hover_color, headerTop.textHoverColor, headerTop.text_color_hover, headerTop.textColorHover, headerTop.hover_color, headerTop.hoverColor, headerTop.hover_text, headerTop.hoverText, headerTop.text_color, headerTop.textColor, "#212529"),
        hoverBgColor: firstValue(headerTop.hover_bg_color, headerTop.hoverBgColor, headerTop.bg_hover_color, headerTop.bgHoverColor, headerTop.background_hover_color, headerTop.backgroundHoverColor, headerTop.hover_background_color, headerTop.hoverBackgroundColor, headerTop.background_color_hover, headerTop.backgroundColorHover, headerTop.hover_background, headerTop.hoverBackground, "transparent"),
        borderColor: firstValue(headerTop.border_color, headerTop.borderColor, "#0282a5"),
        borderWidth: numberValue(firstValue(headerTop.border_thickness, headerTop.borderThickness), 1),
        leftLinks: normalizeList(headerTop.left_links || headerTop.leftLinks),
        rightLinks: normalizeList(headerTop.right_links || headerTop.rightLinks)
      },
      main: {
        bgColor: firstValue(headerMain.bg_color, headerMain.bgColor, "#ffffff"),
        textColor: firstValue(headerMain.text_color, headerMain.textColor, "#202124"),
        hoverTextColor: firstValue(headerMain.hover_text_color, headerMain.hoverTextColor, headerMain.text_hover_color, headerMain.textHoverColor, headerMain.text_color_hover, headerMain.textColorHover, headerMain.hover_color, headerMain.hoverColor, headerMain.hover_text, headerMain.hoverText, headerMain.text_color, headerMain.textColor, "#ffffff"),
        hoverBgColor: firstValue(headerMain.hover_bg_color, headerMain.hoverBgColor, headerMain.bg_hover_color, headerMain.bgHoverColor, headerMain.background_hover_color, headerMain.backgroundHoverColor, headerMain.hover_background_color, headerMain.hoverBackgroundColor, headerMain.background_color_hover, headerMain.backgroundColorHover, headerMain.hover_background, headerMain.hoverBackground, "transparent"),
        borderColor: firstValue(headerMain.border_color, headerMain.borderColor, "transparent"),
        borderWidth: numberValue(firstValue(headerMain.border_thickness, headerMain.borderThickness), 0),
        logo: firstValue(headerMain.logo, logo.logo_main, logo.logoMain, FALLBACKS.logo),
        logoCol: normalizeBootstrapColClass(firstValue(headerMain.logo_col, headerMain.logoCol, headerMain.logo_column, headerMain.logoColumn), "col-7 col-md-3 col-lg-3 col-xl-3"),
        searchShow: isEnabled(firstValue(headerMain.search_show, headerMain.searchShow), true),
        searchCol: normalizeBootstrapColClass(firstValue(headerMain.search_col, headerMain.searchCol, headerMain.search_column, headerMain.searchColumn), "col-12 col-sm-5 col-md-5 col-lg-4 col-xl-3"),
        searchPlaceholder: firstValue(headerMain.search_placeholder, headerMain.searchPlaceholder, "Tìm kiếm Sản phẩm & Dịch vụ ?"),
        loginShow: isEnabled(firstValue(headerMain.login_show, headerMain.loginShow, headerMain.show_login, headerMain.showLogin), true),
        registerShow: isEnabled(firstValue(headerMain.register_show, headerMain.registerShow, headerMain.show_register, headerMain.showRegister), true),
        items: normalizeList(headerMain.item_list || headerMain.itemList)
      },
      news: {
        text: firstValue(headerNews.text, headerNews.title, headerNews.name, headerNews.content),
        link: firstValue(headerNews.link, headerNews.url, headerNews.href),
        items: newsItems,
        bgColor: firstValue(headerTop.news_bg_color, headerTop.newsBgColor, headerNews.bg_color, headerNews.bgColor, headerNews.background_color, headerNews.backgroundColor),
        textColor: firstValue(headerTop.news_text_color, headerTop.newsTextColor, headerNews.text_color, headerNews.textColor),
        hoverTextColor: firstValue(headerTop.news_hover_text_color, headerTop.newsHoverTextColor, headerNews.hover_text_color, headerNews.hoverTextColor, headerNews.text_hover_color, headerNews.textHoverColor)
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

  function unwrapListPayload(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (raw.sections && Array.isArray(raw.sections)) return raw.sections;
    if (raw.items && Array.isArray(raw.items)) return raw.items;
    if (raw.result && Array.isArray(raw.result)) return raw.result;
    if (raw.data && Array.isArray(raw.data.data)) return raw.data.data;
    if (raw.data && raw.data.data && Array.isArray(raw.data.data.data)) return raw.data.data.data;
    if (raw.data && raw.data.sections && Array.isArray(raw.data.sections)) return raw.data.sections;
    if (raw.data && raw.data.items && Array.isArray(raw.data.items)) return raw.data.items;
    if (raw.data && raw.data.result && Array.isArray(raw.data.result)) return raw.data.result;
    if (raw.data && Array.isArray(raw.data)) return raw.data;
    return [];
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
      .filter(isCategoryVisible);
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

  function getMenuAppearance() {
    var defaults = {
      bgColor: "#020878",
      hoverBgColor: "#0712b8",
      textColor: "#ffffff",
      bold: true
    };
    var data = null;

    try {
      if (window.FE_MENU_APPEARANCE && typeof window.FE_MENU_APPEARANCE === "object") {
        data = window.FE_MENU_APPEARANCE;
      } else {
        data = JSON.parse(localStorage.getItem("menu_appearance") || "null");
      }
    } catch (e) {
      data = null;
    }

    if (!data || typeof data !== "object") return defaults;

    return {
      bgColor: firstValue(data.menu_bg_color, data.bg_color, data.bgColor, defaults.bgColor),
      hoverBgColor: firstValue(data.menu_hover_bg_color, data.hover_bg_color, data.hoverBgColor, defaults.hoverBgColor),
      textColor: firstValue(data.menu_text_color, data.text_color, data.textColor, defaults.textColor),
      bold: (data.menu_bold === undefined && data.bold === undefined)
        ? defaults.bold
        : (data.menu_bold === true || data.menu_bold === "true" || data.bold === true || data.bold === "true")
    };
  }

  function setMenuAppearanceFromApi(raw) {
    if (window.FE_MENU_APPEARANCE_SOURCE === "header") return;

    var payload = raw && raw.data ? raw.data : raw;
    var categoryPayload = unwrapCategoryPayload(raw);
    var normalized;
    var flattened;
    var firstItem;
    var themeSetting =
      (payload && payload.themeSetting) ||
      (payload && payload.theme_setting) ||
      (payload && payload.data && payload.data.themeSetting) ||
      (payload && payload.data && payload.data.theme_setting);

    if (!themeSetting && categoryPayload) {
      normalized = normalizeCategoryItems(categoryPayload);
      flattened = flattenCategories(normalized);
      firstItem = flattened && flattened.length ? flattened[0] : null;
      themeSetting = firstValue(
        firstItem && firstItem.themeSetting,
        firstItem && firstItem.theme_setting
      );
    }

    if (themeSetting && typeof themeSetting === "object") {
      window.FE_MENU_APPEARANCE = themeSetting;
      try {
        localStorage.setItem("menu_appearance", JSON.stringify(themeSetting));
      } catch (e) { }
    }
  }

  function menuAppearanceStyle() {
    var appearance = getMenuAppearance();
    var parts = [];

    if (appearance.bgColor) parts.push("--fe-menu-bg:" + escapeHtml(appearance.bgColor));
    if (appearance.hoverBgColor) parts.push("--fe-menu-hover-bg:" + escapeHtml(appearance.hoverBgColor));
    if (appearance.textColor) parts.push("--fe-menu-text:" + escapeHtml(appearance.textColor));
    parts.push("--fe-menu-font-weight:" + (appearance.bold ? "700" : "500"));

    return parts.join(";") + ";";
  }

  function isBannerVisible(item) {
    var value = firstValue(item.banner_status, item.status, 1);
    return value === 1 || value === "1" || value === true || value === "show";
  }

  function bannerOrder(item) {
    return numberValue(firstValue(item.banner_order_no, item.order_no, item.position, item.order), 0);
  }

  function bannerTitle(item) {
    return firstValue(item.banner_title, item.title, "Banner");
  }

  function bannerDesktopImage(item) {
    return firstValue(item.banner_image_desktop, item.image_desktop, item.desktop_image, item.image, item.banner_image);
  }

  function bannerMobileImage(item) {
    return firstValue(item.banner_image_mobile, item.image_mobile, item.mobile_image, bannerDesktopImage(item));
  }

  function renderBannerSlide(item, index) {
    var title = bannerTitle(item);
    var desktop = safeUrl(bannerDesktopImage(item), "");
    var mobile = safeUrl(bannerMobileImage(item), desktop);
    var href = safeUrl(firstValue(item.banner_url, item.url, item.link), "#");
    var loading = index === 0 ? "eager" : "lazy";

    if (!desktop && !mobile) return "";

    return (
      '<div>' +
      '<a class="d-block w-100 rounded-10" href="' + escapeHtml(href) + '" title="' + escapeHtml(title) + '">' +
      '<picture class="block">' +
      (desktop ? '<source class="img-cover block" media="(min-width:768px)" srcset="' + escapeHtml(desktop) + '">' : "") +
      '<img class="img-cover block banner-auto-width" src="' + escapeHtml(mobile || desktop) + '" alt="' + escapeHtml(title) + '" loading="' + loading + '" decoding="async">' +
      "</picture>" +
      "</a>" +
      "</div>"
    );
  }

  function renderBanners(items) {
    return normalizeList(items)
      .filter(isBannerVisible)
      .sort(function (a, b) { return bannerOrder(a) - bannerOrder(b); })
      .map(renderBannerSlide)
      .filter(Boolean)
      .join("");
  }

  function parseSectionData(value) {
    if (!value) return {};
    if (typeof value === "object") return value;
    try {
      var parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function sectionData(section) {
    return parseSectionData(firstValue(section.section_data, section.sectionData, section.data, section.config, section.content));
  }

  function sectionOrder(item) {
    return numberValue(firstValue(item.section_order_no, item.order_no, item.position, item.order), 0);
  }

  function isSectionVisible(item) {
    var value = firstValue(item.section_status, item.status, 1);
    return value === 1 || value === "1" || value === true || value === "show";
  }

  function sectionType(item) {
    return String(firstValue(item.section_type, item.sectionType, item.type)).trim();
  }

  function slugValue(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\u0111/g, "d")
      .replace(/\u0110/g, "D")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function currentSectionTarget() {
    var params = new URLSearchParams(window.location.search || "");
    return slugValue(params.get("section") || params.get("section_url") || params.get("slug") || "");
  }

  function sectionUrl(section, data) {
    return slugValue(firstValue(data.url, data.section_url, section.section_url, section.url, section.section_alias, section.alias, section.section_name, section.name));
  }

  function sectionMoreHref(section, data) {
    var url = sectionUrl(section, data);
    if (!url) return "";
    return window.location.pathname + "?section=" + encodeURIComponent(url);
  }

  function sectionTitle(section, data) {
    return firstValue(data.display_name, data.title, data.heading);
  }

  function clampColumns(value) {
    var columns = numberValue(value, 3);
    if (columns <= 0) return 3;
    return Math.max(1, columns);
  }

  function normalizeSectionItems(items) {
    var list = normalizeList(items).filter(function (item) {
      return firstValue(item.image, item.title, item.description, item.url, item.link);
    });
    return list;
  }

  function chunkList(items, size) {
    var chunks = [];
    var chunkSize = Math.max(1, size);
    var i;

    for (i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }

    return chunks;
  }

  function bodyItemUrl(value) {
    var url = String(value || "").trim();
    if (!url) return "#";
    if (/^(https?:|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(url)) return url;
    return "/" + url.replace(/^\/+/, "");
  }

  function renderSectionTitle(title) {
    if (!title) return "";
    if (/<[a-z][\s\S]*>/i.test(String(title))) {
      return '<div class="fe-section-title-rich">' + title + "</div>";
    }
    return '<h2>' + escapeHtml(title) + "</h2>";
  }

  function renderRealImageCard(item, index) {
    var image = safeImageUrl(firstValue(item.image, item.img, item.thumbnail, item.thumb, item.image_url, item.imageUrl), "");
    var title = firstValue(item.title, item.name, "Dự án thực tế");
    var desc = firstValue(item.description, item.desc, item.summary);
    var href = bodyItemUrl(firstValue(item.url, item.link, item.href));
    var bgColor = firstValue(item.bg_color, item.bgColor, item.background_color, item.backgroundColor, "#ffffff");
    var titleColor = firstValue(item.title_color, item.titleColor, item.text_color, item.textColor, item.color, "#333333");
    var descColor = firstValue(item.description_color, item.descriptionColor, item.desc_color, item.descColor, item.text_color, item.textColor, item.color, "#333333");
    var tag = href === "#" ? "div" : "a";
    var itemStyle = '--fe-real-item-bg:' + escapeHtml(bgColor) + ';--fe-real-item-title:' + escapeHtml(titleColor) + ';--fe-real-item-desc:' + escapeHtml(descColor) + ';';
    var open = tag === "a" ? '<a class="fe-real-card" href="' + escapeHtml(href) + '" style="' + itemStyle + '">' : '<div class="fe-real-card" style="' + itemStyle + '">';
    var close = tag === "a" ? "</a>" : "</div>";

    return (
      open +
      '<div class="fe-real-media">' +
      (image
        ? '<img class="fe-real-modal-trigger" src="' + escapeHtml(image) + '" alt="' + escapeHtml(title) + '" loading="' + (index === 0 ? "eager" : "lazy") + '" decoding="async" data-fe-full-image="' + escapeHtml(image) + '" data-fe-image-title="' + escapeHtml(title) + '" data-fe-image-desc="' + escapeHtml(desc) + '">'
        : '<div class="fe-real-media-placeholder">No image</div>') +
      "</div>" +
      '<div class="fe-real-content">' +
      '<h3 class="fe-real-title">' + escapeHtml(title) + "</h3>" +
      (desc ? '<p class="fe-real-desc">' + escapeHtml(desc) + "</p>" : "") +
      "</div>" +
      close
    );
  }

  function renderRealImagesSection(section) {
    var data = sectionData(section);
    var title = sectionTitle(section, data);
    var desc = firstValue(data.description, data.desc);
    var columns = clampColumns(data.items_per_row);
    var rows = 2;
    var perPage = columns * rows;
    var items = normalizeSectionItems(data.items);
    var pages = chunkList(items, perPage);
    var bg = firstValue(data.bg_color, data.bgColor, "#ffffff");
    var titleColor = firstValue(data.title_color, data.titleColor, "#101828");
    var descColor = firstValue(data.description_color, data.descriptionColor, data.desc_color, data.descColor, "#344054");
    var moreHref = sectionMoreHref(section, data);
    var isDetail = currentSectionTarget() === sectionUrl(section, data);
    var itemsHtml;

    if (!items.length && !title && !desc) return "";

    if (pages.length > 1) {
      itemsHtml = '<div class="fe-real-images-slider fe-paged-grid-slider" data-slider-columns="' + columns + '" data-slider-rows="' + rows + '">' +
        pages.map(function (page) {
          return '<div class="fe-real-images-page"><div class="fe-real-images-page-grid">' + page.map(renderRealImageCard).join("") + "</div></div>";
        }).join("") +
        "</div>";
    } else if (items.length) {
      itemsHtml = '<div class="fe-real-images-grid">' + items.map(renderRealImageCard).join("") + "</div>";
    } else {
      itemsHtml = "";
    }

    return (
      '<section class="fe-body-section fe-real-images-section" style="--fe-body-bg:' + escapeHtml(bg) + ';--fe-real-columns:' + columns + ';--fe-real-title-color:' + escapeHtml(titleColor) + ';--fe-real-desc-color:' + escapeHtml(descColor) + '">' +
      '<div class="container">' +
      ((title || desc)
        ? '<div class="fe-section-heading">' +
        renderSectionTitle(title) +
        (desc ? '<div class="fe-section-desc">' + desc + "</div>" : "") +
        "</div>"
        : "") +
      itemsHtml +
      (!isDetail && moreHref ? '<div class="fe-section-more-wrap"><a class="fe-section-more" href="' + escapeHtml(moreHref) + '">Xem thêm</a></div>' : "") +
      "</div>" +
      "</section>"
    );
  }

  function renderArticleSection(section) {
    var data = sectionData(section);
    var title = sectionTitle(section, data);
    var desc = firstValue(data.description, data.desc, data.summary);
    var content = firstValue(data.content, data.body, data.html);
    var columnClass = normalizeBootstrapColClass(firstValue(data.bootstrap_class, data.bootstrapClass, data.column_class, data.columnClass), "col-12");
    var bg = firstValue(data.bg_color, data.bgColor, "#ffffff");
    var titleColor = firstValue(data.title_color, data.titleColor, "#101828");
    var descColor = firstValue(data.description_color, data.descriptionColor, data.desc_color, data.descColor, "#344054");
    var button = data.button || {};
    var rawButtonUrl = firstValue(button.url, button.link, button.href, data.button_url, data.buttonUrl);
    var buttonText = firstValue(button.text, button.name, button.label, data.button_text, data.buttonText, rawButtonUrl ? "Xem thêm" : "");
    var buttonUrl = bodyItemUrl(rawButtonUrl);
    var buttonBg = firstValue(button.bg_color, button.bgColor, data.button_bg_color, data.buttonBgColor, "#4154f1");
    var buttonColor = firstValue(button.text_color, button.textColor, data.button_text_color, data.buttonTextColor, "#ffffff");
    var hasButton = Boolean(buttonText || rawButtonUrl);
    var buttonHtml = "";

    if (!title && !desc && !content && !hasButton) return "";

    if (hasButton) {
      buttonHtml = buttonUrl !== "#"
        ? '<a class="fe-article-button" href="' + escapeHtml(buttonUrl) + '">' + escapeHtml(buttonText) + "</a>"
        : '<span class="fe-article-button" role="button" aria-disabled="true">' + escapeHtml(buttonText) + "</span>";
    }

    return (
      '<section class="fe-body-section fe-article-section" style="--fe-body-bg:' + escapeHtml(bg) + ';--fe-article-title-color:' + escapeHtml(titleColor) + ';--fe-article-desc-color:' + escapeHtml(descColor) + ';--fe-article-button-bg:' + escapeHtml(buttonBg) + ';--fe-article-button-color:' + escapeHtml(buttonColor) + '">' +
      '<div class="container">' +
      '<div class="row justify-content-center">' +
      '<div class="' + escapeHtml(columnClass) + '">' +
      ((title || desc)
        ? '<div class="fe-section-heading">' +
        renderSectionTitle(title) +
        (desc ? '<div class="fe-section-desc">' + desc + "</div>" : "") +
        "</div>"
        : "") +
      (content ? '<div class="fe-article-content">' + content + "</div>" : "") +
      (hasButton ? '<div class="fe-article-actions">' + buttonHtml + "</div>" : "") +
      "</div>" +
      "</div>" +
      "</div>" +
      "</section>"
    );
  }

  function youtubeVideoId(value) {
    var raw = String(value || "").trim();
    var url;
    var videoId = "";

    if (!raw) return "";
    if (/youtube\.com\/embed\//i.test(raw)) {
      videoId = raw.split("/embed/")[1] || "";
      videoId = String(videoId).split(/[?#]/)[0];
      return videoId.replace(/[^a-zA-Z0-9_-]/g, "");
    }

    try {
      url = new URL(raw, window.location.origin);
      if (/youtu\.be$/i.test(url.hostname)) {
        videoId = url.pathname.replace(/^\/+/, "").split("/")[0];
      } else if (/youtube\.com$/i.test(url.hostname) || /youtube-nocookie\.com$/i.test(url.hostname)) {
        if (url.pathname.indexOf("/watch") === 0) videoId = url.searchParams.get("v") || "";
        if (!videoId && url.pathname.indexOf("/shorts/") === 0) videoId = url.pathname.split("/")[2] || "";
        if (!videoId && url.pathname.indexOf("/live/") === 0) videoId = url.pathname.split("/")[2] || "";
      }
    } catch (e) {
      return "";
    }

    return String(videoId || "").replace(/[^a-zA-Z0-9_-]/g, "");
  }

  function youtubeEmbedUrl(value) {
    var raw = String(value || "").trim();
    var url;
    var videoId = "";

    if (!raw) return "";
    if (/youtube\.com\/embed\//i.test(raw)) return safeUrl(raw, "");

    try {
      url = new URL(raw, window.location.origin);
      if (/youtu\.be$/i.test(url.hostname)) {
        videoId = url.pathname.replace(/^\/+/, "").split("/")[0];
      } else if (/youtube\.com$/i.test(url.hostname) || /youtube-nocookie\.com$/i.test(url.hostname)) {
        if (url.pathname.indexOf("/watch") === 0) videoId = url.searchParams.get("v") || "";
        if (!videoId && url.pathname.indexOf("/shorts/") === 0) videoId = url.pathname.split("/")[2] || "";
        if (!videoId && url.pathname.indexOf("/live/") === 0) videoId = url.pathname.split("/")[2] || "";
      }
    } catch (e) {
      return safeUrl(raw, "");
    }

    videoId = String(videoId || "").replace(/[^a-zA-Z0-9_-]/g, "");
    return videoId ? "https://www.youtube.com/embed/" + videoId : safeUrl(raw, "");
  }

  function renderResponsiveVideo(url, title) {
    var embedUrl = youtubeEmbedUrl(url);
    if (!embedUrl) return "";
    return (
      '<div class="fe-news-video-frame">' +
      '<iframe src="' + escapeHtml(embedUrl) + '" title="' + escapeHtml(title || "Video") + '" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>' +
      "</div>"
    );
  }

  function renderNewsButton(button, className, fallbackText) {
    var rawUrl;
    var text;
    var url;
    var bg;
    var color;

    if (!button || button.visible === false || button.visible === "false" || button.visible === "hide" || button.show === false) return "";

    rawUrl = firstValue(button.url, button.link, button.href);
    text = firstValue(button.text, button.name, button.label, fallbackText);
    if (!text && !rawUrl) return "";

    url = bodyItemUrl(rawUrl);
    bg = firstValue(button.bg_color, button.bgColor, "#4154f1");
    color = firstValue(button.text_color, button.textColor, "#ffffff");

    if (url === "#") {
      return '<span class="' + className + '" style="--fe-news-button-bg:' + escapeHtml(bg) + ';--fe-news-button-color:' + escapeHtml(color) + '">' + escapeHtml(text || fallbackText || "Xem tiếp") + "</span>";
    }

    return '<a class="' + className + '" href="' + escapeHtml(url) + '" style="--fe-news-button-bg:' + escapeHtml(bg) + ';--fe-news-button-color:' + escapeHtml(color) + '">' + escapeHtml(text || fallbackText || "Xem tiếp") + "</a>";
  }

  function renderImageNewsSection(section) {
    var data = sectionData(section);
    var title = sectionTitle(section, data);
    var content = firstValue(data.content, data.body, data.html, data.description, data.desc);
    var image = safeImageUrl(firstValue(data.image, data.image_url, data.imageUrl, data.img, data.thumbnail), "");
    var videoUrl = firstValue(data.video_url, data.videoUrl, data.video, data.youtube_url, data.youtubeUrl);
    var mediaTitle = firstValue(data.media_title, data.mediaTitle, title, section.section_name, section.name, "Tin ảnh");
    var mediaClass = normalizeBootstrapColClass(firstValue(data.bootstrap_class, data.bootstrapClass, data.image_class, data.imageClass), "col-12 col-lg-6");
    var contentClass = complementBootstrapColClass(mediaClass, "col-12 col-lg-6");
    var position = firstValue(data.image_position, data.imagePosition, data.media_position, data.mediaPosition, "left");
    var effect = firstValue(data.image_effect, data.imageEffect, "none");
    var imageRadius = normalizeCssLength(firstValue(data.image_radius, data.imageRadius, data.border_radius, data.borderRadius));
    var bg = firstValue(data.bg_color, data.bgColor, "#ffffff");
    var leftButton = data.left_button || data.leftButton || {};
    var rightButton = data.right_button || data.rightButton || {};
    var mediaHtml = "";
    var buttonsHtml = [
      renderNewsButton(leftButton, "fe-image-news-button", firstValue(leftButton.text, "Xem Tiếp")),
      renderNewsButton(rightButton, "fe-image-news-button fe-image-news-button-secondary", firstValue(rightButton.text, "Đăng ký"))
    ].filter(Boolean).join("");

    if (videoUrl) {
      mediaHtml = renderResponsiveVideo(videoUrl, mediaTitle);
    } else if (image) {
      mediaHtml = '<img class="fe-image-news-img img-fluid' + (effect && effect !== "none" ? " effect-" + escapeHtml(effect) : "") + '" src="' + escapeHtml(image) + '" alt="' + escapeHtml(mediaTitle) + '" loading="lazy" decoding="async">';
    }

    if (!title && !content && !mediaHtml && !buttonsHtml) return "";

    return (
      '<section class="fe-body-section fe-image-news-section" style="--fe-body-bg:' + escapeHtml(bg) + ';--fe-image-news-radius:' + escapeHtml(imageRadius || "8px") + '">' +
      '<div class="container">' +
      '<div class="row align-items-center g-4 g-lg-5' + (position === "right" ? " flex-lg-row-reverse" : "") + '">' +
      '<div class="' + escapeHtml(mediaClass) + '">' +
      (mediaHtml ? '<div class="fe-image-news-media">' + mediaHtml + "</div>" : "") +
      "</div>" +
      '<div class="' + escapeHtml(contentClass) + '">' +
      '<div class="fe-image-news-content">' +
      (title ? '<div class="fe-image-news-title">' + renderSectionTitle(title) + "</div>" : "") +
      (content ? '<div class="fe-image-news-text">' + content + "</div>" : "") +
      (buttonsHtml ? '<div class="fe-image-news-actions">' + buttonsHtml + "</div>" : "") +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>" +
      "</section>"
    );
  }

  function renderConsultationMedia(data, title) {
    var mode = firstValue(data.display_mode, data.displayMode, "image");
    var imageData = data.image || {};
    var image = safeImageUrl(firstValue(imageData.url, imageData.data, imageData.src, data.image_url, data.imageUrl, data.image), "");
    var video = data.video || {};
    var videoUrl = firstValue(video.url, video.file, data.video_url, data.videoUrl);
    var mapIframe = firstValue(data.map_iframe, data.mapIframe, data.iframe);
    var article = firstValue(data.article, data.article_content, data.content, data.html);

    if (mode === "map" && mapIframe) {
      return '<div class="fe-consult-media fe-consult-map">' + mapIframe + '</div>';
    }

    if (mode === "video" && videoUrl) {
      if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(String(videoUrl))) {
        return '<div class="fe-consult-media fe-consult-video"><video controls src="' + escapeHtml(safeUrl(videoUrl, "")) + '"></video></div>';
      }
      return '<div class="fe-consult-media fe-consult-video">' + renderResponsiveVideo(videoUrl, title || "Video") + '</div>';
    }

    if (mode === "article" && article) {
      return '<div class="fe-consult-media fe-consult-article">' + article + '</div>';
    }

    if (image) {
      return '<div class="fe-consult-media fe-consult-image"><img src="' + escapeHtml(image) + '" alt="' + escapeHtml(title || "Đặt lịch tư vấn") + '" loading="lazy" decoding="async"></div>';
    }

    return "";
  }

  function renderConsultationSection(section) {
    var data = sectionData(section);
    var title = firstValue(data.display_name, data.title, section.section_name, section.name);
    var desc = firstValue(data.description, data.desc, data.summary);
    var bg = firstValue(data.bg_color, data.bgColor, "#fff3b0");
    var button = data.button || {};
    var buttonText = firstValue(button.text, button.name, button.label, data.button_text, data.buttonText, "Nhận báo giá ngay");
    var buttonBg = firstValue(button.bg_color, button.bgColor, data.button_bg_color, data.buttonBgColor, "#008eb8");
    var buttonColor = firstValue(button.text_color, button.textColor, data.button_text_color, data.buttonTextColor, "#ffffff");
    var icon = normalizeIconClass(firstValue(data.icon));
    var position = firstValue(data.image && data.image.position, data.image_position, data.imagePosition, "right");
    var hideImageMobile = isEnabled(firstValue(data.image && data.image.hide_on_mobile, data.hide_image_mobile, data.hideImageMobile), false);
    var mediaHtml = renderConsultationMedia(data, title);
    var reverseClass = position === "left" ? " flex-lg-row-reverse" : "";
    var hideMobileClass = hideImageMobile ? " fe-consult-hide-mobile" : "";

    if (!title && !desc && !buttonText && !mediaHtml) return "";

    return (
      '<section class="fe-body-section fe-consult-section" style="--fe-body-bg:' + escapeHtml(bg) + ';--fe-consult-button-bg:' + escapeHtml(buttonBg) + ';--fe-consult-button-color:' + escapeHtml(buttonColor) + '">' +
      '<div class="container">' +
      '<div class="fe-consult-box">' +
      '<div class="row g-0 align-items-stretch' + reverseClass + '">' +
      '<div class="col-12 col-lg-6">' +
      '<form class="fe-consult-form" data-fe-consult-form="true" onsubmit="return false;">' +
      '<div class="fe-consult-heading">' +
      (title ? '<div class="fe-consult-title">' + title + '</div>' : "") +
      (desc ? '<div class="fe-consult-desc">' + desc + '</div>' : "") +
      '</div>' +
      '<div class="fe-consult-fields">' +
      '<input type="text" name="name" autocomplete="name" placeholder="Họ tên (Bắt buộc)" required>' +
      '<input type="tel" name="phone" autocomplete="tel" placeholder="Điện thoại (Bắt buộc)" required>' +
      '<textarea name="content" rows="4" placeholder="Nội dung"></textarea>' +
      '</div>' +
      '<button type="submit" class="fe-consult-button">' + (icon ? '<i class="' + escapeHtml(icon) + '"></i>' : "") + '<span>' + escapeHtml(buttonText) + '</span></button>' +
      '</form>' +
      '</div>' +
      (mediaHtml ? '<div class="col-12 col-lg-6' + hideMobileClass + '">' + mediaHtml + '</div>' : "") +
      '</div>' +
      '</div>' +
      '</div>' +
      '</section>'
    );
  }
  function normalizeVideoNewsItems(data) {
    return normalizeList(firstValue(data.videos, data.items, data.video_list, data.videoList)).filter(function (item) {
      return firstValue(item.url, item.link, item.video_url, item.videoUrl, item.youtube_url, item.youtubeUrl, item.thumbnail, item.image, item.thumb);
    });
  }

  function videoNewsThumbnail(item, videoUrl) {
    var customThumb = safeImageUrl(firstValue(item.thumbnail, item.image, item.thumb, item.poster, item.cover), "");
    var videoId;

    if (customThumb) return customThumb;
    videoId = youtubeVideoId(videoUrl);
    return videoId ? "https://img.youtube.com/vi/" + videoId + "/hqdefault.jpg" : "";
  }

  function renderVideoNewsCard(item, index, isMain) {
    var title = firstValue(item.title, item.name, "Video");
    var desc = firstValue(item.description, item.desc, item.summary);
    var url = firstValue(item.url, item.link, item.video_url, item.videoUrl, item.youtube_url, item.youtubeUrl);
    var embedUrl = youtubeEmbedUrl(url);
    var thumb = videoNewsThumbnail(item, url);
    var mediaHtml = "";

    if (thumb) {
      mediaHtml =
        '<button type="button" class="fe-video-news-thumb' + (embedUrl ? " fe-video-news-trigger" : "") + '"' +
        (embedUrl ? ' data-fe-video-url="' + escapeHtml(embedUrl) + '"' : "") +
        ' data-fe-video-title="' + escapeHtml(title) + '" aria-label="' + escapeHtml(title) + '">' +
        '<img src="' + escapeHtml(thumb) + '" alt="' + escapeHtml(title) + '" loading="' + (index === 0 ? "eager" : "lazy") + '" decoding="async">' +
        (embedUrl ? '<span class="fe-video-news-play" aria-hidden="true"><i class="fa-solid fa-play"></i></span>' : "") +
        "</button>";
    } else if (embedUrl) {
      mediaHtml = renderResponsiveVideo(url, title);
    }

    if (!mediaHtml && !title && !desc) return "";

    return (
      '<article class="fe-video-news-card' + (isMain ? " fe-video-news-card-main" : "") + '">' +
      mediaHtml +
      ((title || desc)
        ? '<div class="fe-video-news-content">' +
        (title ? '<h3>' + escapeHtml(title) + "</h3>" : "") +
        (desc ? '<p>' + escapeHtml(desc) + "</p>" : "") +
        "</div>"
        : "") +
      "</article>"
    );
  }

  function ensureVideoNewsModal() {
    var modal = document.querySelector(".fe-video-news-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.className = "fe-video-news-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML =
      '<button class="fe-video-news-modal-close" type="button" aria-label="Đóng video"><i class="fa-solid fa-xmark"></i></button>' +
      '<div class="fe-video-news-modal-dialog">' +
      '<div class="fe-video-news-modal-frame"></div>' +
      "</div>";
    document.body.appendChild(modal);
    return modal;
  }

  function closeVideoNewsModal() {
    var modal = document.querySelector(".fe-video-news-modal");
    var frame;
    if (!modal) return;
    frame = modal.querySelector(".fe-video-news-modal-frame");
    if (frame) frame.innerHTML = "";
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("fe-modal-open");
  }

  function openVideoNewsModal(embedUrl, title) {
    var modal = ensureVideoNewsModal();
    var frame = modal.querySelector(".fe-video-news-modal-frame");
    if (!frame || !embedUrl) return;
    frame.innerHTML =
      '<iframe src="' + escapeHtml(embedUrl) + '?autoplay=1" title="' + escapeHtml(title || "Video") + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("fe-modal-open");
  }

  function bindVideoNewsModal() {
    if (document.body.dataset.feVideoModalBound === "true") return;
    document.body.dataset.feVideoModalBound = "true";

    document.addEventListener("click", function (event) {
      var trigger = event.target.closest(".fe-video-news-trigger");
      var modal;
      if (trigger) {
        event.preventDefault();
        openVideoNewsModal(trigger.getAttribute("data-fe-video-url"), trigger.getAttribute("data-fe-video-title"));
        return;
      }
      modal = document.querySelector(".fe-video-news-modal.is-open");
      if (!modal) return;
      if (event.target.closest(".fe-video-news-modal-close") || event.target === modal) {
        closeVideoNewsModal();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeVideoNewsModal();
    });
  }

  function renderVideoNewsSection(section) {
    var data = sectionData(section);
    var title = firstValue(data.title, data.video_title, data.videoTitle, sectionTitle(section, data));
    var desc = firstValue(data.description, data.video_description, data.videoDescription, data.desc);
    var itemsPerRow = clampColumns(firstValue(data.items_per_row, data.itemsPerRow, 3));
    var rows = Math.max(1, numberValue(firstValue(data.row_count, data.rowCount), 1));
    var layout = firstValue(data.layout_type, data.layoutType, "equal");
    var bg = firstValue(data.bg_color, data.bgColor, "#ffffff");
    var items = normalizeVideoNewsItems(data).slice(0, rows * itemsPerRow);
    var itemsHtml = "";

    if (!items.length && !title && !desc) return "";

    if (layout === "main_2" && items.length > 1) {
      itemsHtml = '<div class="row g-4 align-items-stretch"><div class="col-12 col-lg-8">' + renderVideoNewsCard(items[0], 0, true) + '</div><div class="col-12 col-lg-4"><div class="fe-video-news-stack">' + items.slice(1, 3).map(function (item, index) { return renderVideoNewsCard(item, index + 1, false); }).join("") + "</div></div></div>";
    } else if (layout === "main_4" && items.length > 1) {
      itemsHtml = '<div class="row g-4 align-items-stretch"><div class="col-12 col-lg-6">' + renderVideoNewsCard(items[0], 0, true) + '</div><div class="col-12 col-lg-6"><div class="row g-4">' + items.slice(1, 5).map(function (item, index) { return '<div class="col-12 col-sm-6">' + renderVideoNewsCard(item, index + 1, false) + "</div>"; }).join("") + "</div></div></div>";
    } else {
      itemsHtml = '<div class="fe-video-news-grid" style="--fe-video-columns:' + itemsPerRow + '">' + items.map(function (item, index) { return renderVideoNewsCard(item, index, false); }).join("") + "</div>";
    }

    return (
      '<section class="fe-body-section fe-video-news-section" style="--fe-body-bg:' + escapeHtml(bg) + '">' +
      '<div class="container">' +
      ((title || desc)
        ? '<div class="fe-section-heading fe-video-news-heading">' +
        (title ? '<div class="fe-video-news-heading-title">' + renderSectionTitle(title) + "</div>" : "") +
        (desc ? '<div class="fe-section-desc">' + desc + "</div>" : "") +
        "</div>"
        : "") +
      itemsHtml +
      "</div>" +
      "</section>"
    );
  }

  function categoryItemId(item) {
    return String(firstValue(item && item.category_id, item && item.id, item && item.categoryId));
  }

  function categoryItemTitle(item) {
    return firstValue(item && item.category_title, item && item.title, item && item.name, "Danh mục");
  }

  function productItemTitle(item) {
    return firstValue(item && item.product_name, item && item.name, item && item.title, "Sản phẩm");
  }

  function productItemImage(item) {
    return safeImageUrl(firstValue(item && item.product_image, item && item.image, item && item.thumbnail, item && item.thumb, item && item.avatar), "assets/img/not-found.svg");
  }

  function productItemCategoryId(item) {
    return String(firstValue(item && item.category_id, item && item.product_category_id, item && item.categoryId, item && item.menu_id));
  }

  function moneyText(value) {
    var number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return "";
    try { return number.toLocaleString("vi-VN") + "đ"; } catch (e) { return String(number) + "đ"; }
  }

  function renderMenuCategoryProductCard(item, index) {
    var title = productItemTitle(item);
    var image = productItemImage(item);
    var price = moneyText(firstValue(item.product_price_sale, item.sale_price, item.salePrice, item.product_price, item.price));
    var oldPrice = moneyText(firstValue(item.product_price, item.price));
    var phone = firstValue(item.phone, item.hotline, item.contact_phone, "0847 865 568");
    var href = bodyItemUrl(firstValue(item.product_alias, item.alias, item.slug, item.url, item.link));

    return '<article class="fe-menu-cat-card">' +
      '<a class="fe-menu-cat-thumb" href="' + escapeHtml(href) + '"><img src="' + escapeHtml(image) + '" alt="' + escapeHtml(title) + '" loading="' + (index < 4 ? "eager" : "lazy") + '" decoding="async"></a>' +
      '<div class="fe-menu-cat-card-body">' +
      '<a class="fe-menu-cat-card-title" href="' + escapeHtml(href) + '">' + escapeHtml(title) + '</a>' +
      '<div class="fe-menu-cat-stars" aria-hidden="true">★★★★★</div>' +
      '<div class="fe-menu-cat-price-row">' + (price ? '<span class="fe-menu-cat-price">' + escapeHtml(price) + '</span>' : "") + (oldPrice && oldPrice !== price ? '<span class="fe-menu-cat-old-price">' + escapeHtml(oldPrice) + '</span>' : "") + '</div>' +
      (phone ? '<a class="fe-menu-cat-phone" href="tel:' + escapeHtml(String(phone).replace(/\s+/g, "")) + '"><i class="bi bi-telephone-fill"></i>' + escapeHtml(phone) + '</a>' : "") +
      '<button type="button" class="fe-menu-cat-consult"><i class="bi bi-headset"></i>Yêu cầu tư vấn</button>' +
      '</div>' +
      '</article>';
  }

  function renderMenuCategorySection(section) {
    var data = sectionData(section);
    var selectedId = String(firstValue(data.menu_id, data.selected_category && data.selected_category.id));
    var selectedTitle = firstValue(data.menu_title, data.selected_category && data.selected_category.title, section.section_name, section.name, "Danh mục");
    var bg = firstValue(data.bg_color, data.bgColor, "#ffffff");
    var textColor = firstValue(data.text_color, data.textColor, "#333333");
    var columns = clampColumns(firstValue(data.items_per_row, data.itemsPerRow, 4));
    var rows = Math.max(1, numberValue(firstValue(data.num_rows, data.rows), 1));
    var limit = columns * rows;
    var categoryPool = bodyCatalogCache.categories.filter(function (item) {
      var parentId = String(firstValue(item.category_parent_id, item.parent_id, item.parentId));
      return selectedId ? (categoryItemId(item) === selectedId || parentId === selectedId) : true;
    });
    var activeTabs = categoryPool.length ? categoryPool : (selectedId ? [{ category_id: selectedId, category_title: selectedTitle }] : bodyCatalogCache.categories.slice(0, 8));
    var activeIds = activeTabs.map(categoryItemId).filter(Boolean);
    var products = bodyCatalogCache.products.filter(function (item) {
      var cid = productItemCategoryId(item);
      return !activeIds.length || activeIds.indexOf(cid) !== -1 || (!cid && !selectedId);
    }).slice(0, limit);
    var tabHtml = activeTabs.slice(0, 10).map(function (item, index) {
      return '<button type="button" class="fe-menu-cat-tab' + (index === 0 ? ' is-active' : '') + '">' + escapeHtml(categoryItemTitle(item)) + '</button>';
    }).join("");

    if (!activeTabs.length && !products.length) return "";

    return '<section class="fe-body-section fe-menu-cat-section" style="--fe-body-bg:' + escapeHtml(bg) + ';--fe-menu-cat-text:' + escapeHtml(textColor) + ';--fe-menu-cat-columns:' + columns + '">' +
      '<div class="container"><div class="fe-menu-cat-head"><h2>' + escapeHtml(selectedTitle) + '</h2>' +
      (tabHtml ? '<div class="fe-menu-cat-tabs">' + tabHtml + '</div>' : "") + '</div>' +
      (products.length ? '<div class="fe-menu-cat-grid">' + products.map(renderMenuCategoryProductCard).join("") + '</div>' : '<div class="fe-menu-cat-empty">Chưa có dữ liệu sản phẩm.</div>') +
      '</div></section>';
  }

  function cssDeclarationValue(value, property, fallback) {
    var raw = String(value || "").trim();
    var match;

    if (!raw) return fallback || "";
    match = raw.match(new RegExp(property + "\\s*:\\s*([^;]+)", "i"));
    return (match ? match[1] : raw).trim() || fallback || "";
  }

  function renderServiceCard(item, index, data) {
    var title = firstValue(item.title, item.name, "Tin dá»‹ch vá»¥");
    var desc = firstValue(item.description, item.desc, item.summary);
    var image = safeImageUrl(firstValue(item.image, item.img, item.thumbnail, item.thumb, item.image_url, item.imageUrl), "");
    var href = bodyItemUrl(firstValue(item.link, item.url, item.href));
    var textColor = firstValue(item.text_color, item.textColor, item.color, "#012970");
    var bgColor = firstValue(item.bg_color, item.bgColor, item.background_color, item.backgroundColor, "#ffffff");
    var tag = href === "#" ? "article" : "a";
    var imageShape = firstValue(data.image_shape, data.imageShape, "square");
    var displayType = firstValue(data.display_type, data.displayType, "original");
    var itemStyle = [
      "--fe-service-text:" + escapeHtml(textColor),
      "--fe-service-item-bg:" + escapeHtml(bgColor)
    ].join(";") + ";";
    var open = tag === "a"
      ? '<a class="fe-service-card" href="' + escapeHtml(href) + '" style="' + itemStyle + '">'
      : '<article class="fe-service-card" style="' + itemStyle + '">';
    var close = tag === "a" ? "</a>" : "</article>";
    var mediaClass = "fe-service-media" + (imageShape === "round" ? " is-round" : "") + (imageShape === "original" ? " is-original" : "");

    return (
      open +
      (image ? '<div class="' + mediaClass + '"><img src="' + escapeHtml(image) + '" alt="' + escapeHtml(title) + '" loading="' + (index < 4 ? "eager" : "lazy") + '" decoding="async"></div>' : "") +
      (displayType === "original" && !title && !desc ? "" :
        '<div class="fe-service-content">' +
        (title ? '<h3>' + escapeHtml(title) + "</h3>" : "") +
        (desc ? '<div class="fe-service-desc">' + desc + "</div>" : "") +
        "</div>") +
      close
    );
  }

  function renderServiceSection(section) {
    var data = sectionData(section);
    var title = sectionTitle(section, data);
    var desc = firstValue(data.description, data.desc, data.summary);
    var bg = firstValue(data.bg_color, data.bgColor, "#ffffff");
    var columns = clampColumns(firstValue(data.items_per_row, data.itemsPerRow, 3));
    var displayType = firstValue(data.display_type, data.displayType, "original");
    var layoutType = firstValue(data.layout_type, data.layoutType, "type_1");
    var centerContent = isEnabled(firstValue(data.center_content, data.centerContent), true);
    var radius = cssDeclarationValue(firstValue(data.border_radius, data.borderRadius), "border-radius", "8px");
    var padding = cssDeclarationValue(firstValue(data.item_padding, data.itemPadding), "padding", "0");
    var items = normalizeSectionItems(firstValue(data.services, data.items));
    var itemsHtml = items.map(function (item, index) {
      return renderServiceCard(item, index, data);
    }).join("");

    if (!items.length && !title && !desc) return "";

    return (
      '<section class="fe-body-section fe-service-section" style="--fe-body-bg:' + escapeHtml(bg) + ';--fe-service-columns:' + columns + ';--fe-service-radius:' + escapeHtml(radius) + ';--fe-service-padding:' + escapeHtml(padding) + '">' +
      '<div class="container">' +
      ((title || desc)
        ? '<div class="fe-section-heading">' +
        renderSectionTitle(title) +
        (desc ? '<div class="fe-section-desc">' + desc + "</div>" : "") +
        "</div>"
        : "") +
      (itemsHtml ? '<div class="fe-service-grid fe-service-' + escapeHtml(displayType) + ' fe-service-' + escapeHtml(layoutType) + (centerContent ? ' is-centered' : '') + '">' + itemsHtml + "</div>" : "") +
      "</div>" +
      "</section>"
    );
  }

  function renderFaqVisual(visual, title) {
    var type;
    var text;
    var videoUrl;
    var image;

    if (!visual || visual.visible === false) return "";

    type = firstValue(visual.type, "image");

    if (type === "text") {
      text = firstValue(visual.text, "");
      if (!text) return "";
      return '<div class="fe-faq-visual fe-faq-text">' + text + "</div>";
    }

    if (type === "video") {
      videoUrl = firstValue(visual.video_url, visual.videoUrl, visual.video_file, visual.videoFile);
      if (!videoUrl) return "";
      if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(String(videoUrl))) {
        return '<div class="fe-faq-visual fe-faq-video"><video controls src="' + escapeHtml(safeUrl(videoUrl, "")) + '"></video></div>';
      }
      return '<div class="fe-faq-visual fe-faq-video">' + renderResponsiveVideo(videoUrl, title || "Video") + "</div>";
    }

    image = safeImageUrl(firstValue(visual.image, visual.image_url, visual.imageUrl), "");
    if (!image) return "";
    return '<div class="fe-faq-visual fe-faq-image"><img src="' + escapeHtml(image) + '" alt="' + escapeHtml(title || "FAQ") + '" loading="lazy" decoding="async"></div>';
  }

  function normalizeFaqQuestions(data) {
    return normalizeList(firstValue(data.questions, data.items, data.faq_list)).map(function (item) {
      return {
        question: firstValue(item.question, item.title, item.name, ""),
        answer: firstValue(item.answer, item.content, item.description, item.desc, "")
      };
    }).filter(function (item) {
      return item.question || item.answer;
    });
  }

  function renderFaqSection(section) {
    var data = sectionData(section);
    var title = firstValue(data.title, sectionTitle(section, data));
    var desc = firstValue(data.description, data.desc);
    var bg = firstValue(data.bg_color, data.bgColor, "#ffffff");
    var visual = data.visual || {};
    var visualHtml = renderFaqVisual(visual, title);
    var questionWidth = normalizeBootstrapColClass(firstValue(data.question_width, data.questionWidth), "col-lg-7");
    var visualCol = complementBootstrapColClass(questionWidth, "col-lg-5");
    var questions = normalizeFaqQuestions(data);
    var sectionUid = "fe-faq-" + String(firstValue(section.id, section.section_id, Math.random().toString(36).slice(2, 8))).replace(/[^a-zA-Z0-9_-]/g, "");
    var questionsHtml;
    var rowHtml;

    questionsHtml = questions.map(function (item, index) {
      var itemId = sectionUid + "-q" + index;
      return (
        '<div class="accordion-item">' +
        '<h2 class="accordion-header">' +
        '<button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#' + itemId + '">' +
        escapeHtml(item.question) +
        "</button>" +
        "</h2>" +
        '<div id="' + itemId + '" class="accordion-collapse collapse" data-bs-parent="#' + sectionUid + '">' +
        '<div class="accordion-body">' +
        (/<[a-z][\s\S]*>/i.test(String(item.answer)) ? item.answer : escapeHtml(item.answer)) +
        "</div>" +
        "</div>" +
        "</div>"
      );
    }).join("");

    if (!title && !desc && !questionsHtml && !visualHtml) return "";

    if (visualHtml) {
      rowHtml =
        '<div class="row g-4 align-items-start">' +
        '<div class="col-12 ' + escapeHtml(visualCol) + '">' + visualHtml + "</div>" +
        '<div class="col-12 ' + escapeHtml(questionWidth) + '">' +
        (questionsHtml ? '<div class="accordion accordion-flush fe-faq-accordion" id="' + sectionUid + '">' + questionsHtml + "</div>" : "") +
        "</div>" +
        "</div>";
    } else {
      rowHtml =
        '<div class="row g-4 justify-content-center">' +
        '<div class="col-12 ' + escapeHtml(questionWidth) + '">' +
        (questionsHtml ? '<div class="accordion accordion-flush fe-faq-accordion" id="' + sectionUid + '">' + questionsHtml + "</div>" : "") +
        "</div>" +
        "</div>";
    }

    return (
      '<section class="fe-body-section fe-faq-section" style="--fe-body-bg:' + escapeHtml(bg) + '">' +
      '<div class="container">' +
      ((title || desc)
        ? '<div class="fe-section-heading">' +
        renderSectionTitle(title) +
        (desc ? '<div class="fe-section-desc">' + desc + "</div>" : "") +
        "</div>"
        : "") +
      rowHtml +
      "</div>" +
      "</section>"
    );
  }

  function normalizeBodyBanners(data) {
    return normalizeList(firstValue(data.banners, data.items, data.images)).map(function (item, index) {
      if (typeof item === "string") {
        return { image: item, url: "", title: "Banner " + (index + 1) };
      }
      return {
        image: firstValue(item.image, item.file, item.src, item.banner),
        url: firstValue(item.url, item.link, item.href, ""),
        title: firstValue(item.title, item.name, "Banner " + (index + 1))
      };
    }).filter(function (item) {
      return item.image;
    });
  }

  function renderBodyBannerCard(banner, index) {
    var image = safeImageUrl(banner.image, "");
    var href = safeUrl(banner.url, "");
    var title = firstValue(banner.title, "Banner " + (index + 1));
    var media = '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(title) + '" loading="' + (index === 0 ? "eager" : "lazy") + '" decoding="async">';

    if (!image) return "";
    if (href && href !== "#") {
      return '<div class="fe-body-banner-card"><a href="' + escapeHtml(href) + '">' + media + "</a></div>";
    }
    return '<div class="fe-body-banner-card">' + media + "</div>";
  }

  function renderBodyBannerSection(section) {
    var data = sectionData(section);
    var title = firstValue(data.title, sectionTitle(section, data));
    var desc = firstValue(data.description, data.desc);
    var perRow = Math.max(1, numberValue(firstValue(data.banners_per_row, data.bannersPerRow), 1));
    var banners = normalizeBodyBanners(data);
    var button = data.button || {};
    var buttonText = firstValue(button.text, button.name, data.button_text, data.buttonText, "");
    var buttonUrl = bodyItemUrl(firstValue(button.url, button.link, data.button_url, data.buttonUrl, ""));
    var isSlider = banners.length > perRow;
    var itemsHtml;
    var buttonHtml = "";

    if (!banners.length && !title && !desc && !buttonText) return "";

    if (isSlider) {
      itemsHtml =
        '<div class="fe-body-banner-slider" data-banner-columns="' + perRow + '">' +
        banners.map(function (banner, index) {
          return '<div class="fe-body-banner-slide">' + renderBodyBannerCard(banner, index) + "</div>";
        }).join("") +
        "</div>";
    } else {
      itemsHtml =
        '<div class="fe-body-banner-grid" style="--fe-body-banner-columns:' + perRow + '">' +
        banners.map(function (banner, index) { return renderBodyBannerCard(banner, index); }).join("") +
        "</div>";
    }

    if (buttonText) {
      buttonHtml = buttonUrl !== "#"
        ? '<div class="container"><div class="fe-body-banner-actions"><a class="fe-body-banner-button" href="' + escapeHtml(buttonUrl) + '">' + escapeHtml(buttonText) + "</a></div></div>"
        : '<div class="container"><div class="fe-body-banner-actions"><span class="fe-body-banner-button" role="button" aria-disabled="true">' + escapeHtml(buttonText) + "</span></div></div>";
    }

    var bgColor = firstValue(data.bg_color, data.bgColor, "#ffffff");

    return (
      '<section class="fe-body-section fe-body-banner-section p-0" style="background-color: ' + escapeHtml(bgColor) + ';">' +
      ((title || desc)
        ? '<div class="container"><div class="fe-section-heading mt-4">' +
        renderSectionTitle(title) +
        (desc ? '<div class="fe-section-desc">' + desc + "</div>" : "") +
        "</div></div>"
        : "") +
      '<div class="container-fluid p-0 overflow-hidden">' +
      itemsHtml +
      '</div>' +
      buttonHtml +
      "</section>"
    );
  }

  function renderBodySection(section) {
    var type = sectionType(section);

    if (type === "real_image" || type === "real_images") {
      return renderRealImagesSection(section);
    }

    if (type === "article" || type === "articles") {
      return renderArticleSection(section);
    }

    if (type === "menu_category" || type === "menu-category") {
      return renderMenuCategorySection(section);
    }

    if (type === "service" || type === "services") {
      return renderServiceSection(section);
    }

    if (type === "image_news" || type === "image-news") {
      return renderImageNewsSection(section);
    }

    if (type === "consultation" || type === "consultation_booking" || type === "consultation-booking") {
      return renderConsultationSection(section);
    }

    if (type === "faq") {
      return renderFaqSection(section);
    }

    if (type === "video_news" || type === "video-news") {
      return renderVideoNewsSection(section);
    }

    if (type === "body_banner" || type === "banner") {
      return renderBodyBannerSection(section);
    }

    return "";
  }

  function footerLinkTitle(item) {
    return firstValue(item.name, item.title, item.label, item.content);
  }

  function renderFooterLink(item, iconClass) {
    var title = footerLinkTitle(item);
    var href = safeUrl(firstValue(item.link, item.url, item.href), "#");
    var rawIcon = firstValue(item.icon);
    var icon = normalizeIconClass(firstValue(rawIcon, iconClass));
    var iconFile = safeImageUrl(firstValue(item.icon_file, item.iconFile, item.favicon, item.favicon_url, item.faviconUrl), "");
    if (!iconFile && rawIcon && /^(https?:|\/|\.\/|\.\.\/|data:image\/)/i.test(String(rawIcon).trim())) {
      iconFile = safeImageUrl(rawIcon, "");
      icon = "";
    }
    if (!title) return "";
    return '<li><a href="' + escapeHtml(href) + '">' + (iconFile ? '<img class="fe-footer-link-icon" src="' + escapeHtml(iconFile) + '" alt="" loading="lazy" decoding="async">' : (icon ? '<i class="' + escapeHtml(icon) + '"></i>' : "")) + '<span>' + escapeHtml(title) + "</span></a></li>";
  }

  function renderFooterColumnLinks(column, fallbackTitle, iconClass) {
    var links = normalizeList(column && column.link_list);
    var title = firstValue(column && column.title, fallbackTitle);
    if (!title && !links.length) return "";
    return (
      '<div class="fe-footer-block">' +
      (title ? '<h4 class="ttl-f fe-footer-title text-16"><span>' + escapeHtml(title) + "</span></h4>" : "") +
      '<ul class="menu-f fe-footer-links">' + links.map(function (item) { return renderFooterLink(item, iconClass); }).join("") + "</ul>" +
      "</div>"
    );
  }

  function renderFooterContact(footer) {
    var col = footer.col_1 || {};
    var phones = normalizeList(col.phone_list);
    var emails = normalizeList(col.email_list);
    var taxCode = firstValue(col.tax_code, col.taxCode, col.mst, col.tax);
    var address = firstValue(col.address, col.company_address, col.companyAddress);
    var rows = [];

    phones.forEach(function (item) {
      var phone = firstValue(item.phone, item.content);
      var name = firstValue(item.name, "Hotline");
      if (!phone) return;
      rows.push('<li><i class="fa-solid fa-phone"></i><p><strong>' + escapeHtml(name) + ': </strong><a href="tel:' + escapeHtml(phone) + '">' + escapeHtml(phone) + "</a></p></li>");
    });

    emails.forEach(function (item) {
      var email = firstValue(item.email, item.content);
      if (!email) return;
      rows.push('<li><i class="fa-solid fa-envelope"></i><p><strong>Email: </strong><a href="mailto:' + escapeHtml(email) + '">' + escapeHtml(email) + "</a></p></li>");
    });


    if (taxCode) {
      rows.push('<li><i class="fa-solid fa-file-invoice"></i><p><strong>MST: </strong>' + escapeHtml(taxCode) + "</p></li>");
    }

    if (address) {
      rows.push('<li><i class="fa-solid fa-location-dot"></i><p><strong>Địa chỉ: </strong>' + escapeHtml(address) + "</p></li>");
    }


    return rows.length ? '<ul class="list-contact fe-footer-contact fe-footer-contact-v2">' + rows.join("") + "</ul>" : "";
  }

  function renderFooterSocialItem(item) {
    var image = safeImageUrl(firstValue(item.image, item.file, item.icon_file, item.iconFile, item.src), "");
    var icon = normalizeIconClass(firstValue(item.icon));
    var text = firstValue(item.text, item.name, item.title, item.label);
    var href = safeUrl(firstValue(item.link, item.url, item.href), "#");
    var media = "";

    if (image) {
      media = '<img class="w-full" src="' + escapeHtml(image) + '" alt="' + escapeHtml(text || "social") + '" loading="lazy" decoding="async">';
    } else if (icon) {
      media = '<i class="' + escapeHtml(icon) + '"></i>';
    } else if (text) {
      media = '<span>' + escapeHtml(text.slice(0, 1).toUpperCase()) + "</span>";
    }

    if (!media) return "";
    return '<li><a class="icon-social" href="' + escapeHtml(href) + '" aria-label="' + escapeHtml(text || "social") + '">' + media + "</a></li>";
  }

  function renderFooterSocial(footer) {
    var col = footer.col_4 || {};
    var fallbackCol = footer.col_1 || {};
    var items = normalizeList(col.social_list || col.socialList || col.socials);
    if (!items.length) {
      items = normalizeList(fallbackCol.social_list || fallbackCol.socialList || fallbackCol.socials);
    }
    var title = firstValue(col.social_title, col.socialTitle, "Mạng xã hội");

    if (!items.length) {
      items = [{ text: "Tin tức đang cập nhật", link: "" }];
    }
    return (
      '<div class="fe-footer-social-block">' +
      '<h4 class="ttl-f fe-footer-title text-16"><span>' + escapeHtml(title) + "</span></h4>" +
      '<ul class="list-social fe-footer-social-list">' + items.map(renderFooterSocialItem).join("") + "</ul>" +
      "</div>"
    );
  }

  function renderFooterBct(footer) {
    var col = footer.col_4 || {};
    var fallbackCol = footer.col_1 || {};
    var bct = col.bct_notice || col.bctNotice || fallbackCol.bct_notice || fallbackCol.bctNotice || {};
    var image = safeImageUrl(firstValue(bct.image, bct.file, bct.icon_file, bct.iconFile), "https://we1.io.vn/public/assets/images/bct.png");
    var title = firstValue(bct.title, "Bộ công thương");
    var href = safeUrl(firstValue(bct.link, bct.url), "#");

    if (!isEnabled(firstValue(bct.show, bct.visible, bct.enabled), false)) return "";
    return (
      '<div class="fe-footer-bct-block">' +
      '<h4 class="ttl-f fe-footer-title text-16"><span>' + escapeHtml(title) + "</span></h4>" +
      '<a class="images-bct" href="' + escapeHtml(href) + '"><img class="w-full" src="' + escapeHtml(image) + '" alt="' + escapeHtml(title) + '" loading="lazy" decoding="async"></a>' +
      "</div>"
    );
  }

  function renderFooterColumnOne(footer) {
    var col = footer.col_1 || {};
    var bootstrap = footer.bootstrap_size || col.bootstrap_size || {};
    var logo = safeUrl(firstValue(col.logo), "");
    var company = firstValue(col.company_name);
    var desc = firstValue(col.short_description);

    return (
      '<div class="' + escapeHtml(firstValue(bootstrap.col_1_class, "col-12 col-xl-4")) + ' fe-footer-col-one">' +
      (company ? '<h4 class="ttl-f fe-footer-title text-16">' + escapeHtml(company) + "</h4>" : "") +
      (logo ? '<div class="logo-f fe-footer-logo-wrap"><img class="fe-footer-logo" src="' + escapeHtml(logo) + '" alt="' + escapeHtml(company || "Logo") + '" loading="lazy" decoding="async"></div>' : "") +
      (desc ? '<div class="fe-footer-desc">' + escapeHtml(desc) + "</div>" : "") +
      renderFooterContact(footer) +
      "</div>"
    );
  }

  function renderFooterImageList(items) {
    return normalizeList(items).map(function (item) {
      var image = safeImageUrl(firstValue(item.file, item.image, item.url, item.src, item.content), "");
      var href = safeUrl(firstValue(item.link, item.href), "#");
      var title = firstValue(item.name, item.title, "payment");
      if (!image) return "";
      return '<a href="' + escapeHtml(href) + '"><img src="' + escapeHtml(image) + '" alt="' + escapeHtml(title) + '" loading="lazy" decoding="async"></a>';
    }).join("");
  }

  function renderFooterColumnFour(footer) {
    var col4 = footer.col_4 || {};
    var payment = col4.payment_method || {};
    var map = col4.map || {};
    var fanpage = col4.fanpage || {};
    var blocks = [];
    var linksBlock = renderFooterColumnLinks(col4, "", "fa-solid fa-arrow-up-right-from-square");
    var mapAddressTitle = firstValue(map.address_title, map.addressTitle, map.company_name, map.companyName);
    var mapAddressText = firstValue(map.address, map.map_address, map.mapAddress);

    blocks.push('<div class="col-12">' + renderFooterSocial(footer) + "</div>");
    if (isEnabled(payment.show, false) && normalizeList(payment.payment_list).length) {
      blocks.push('<div class="col-12 col-md-12 max-sm:order-9 fe-footer-payment-block"><h4 class="ttl-f fe-footer-title text-16"><span>Hình thức thanh toán</span></h4><div class="payment-accept gap-2 mt-8px fe-footer-payment">' + renderFooterImageList(payment.payment_list) + "</div></div>");
    }
    var bctBlock = renderFooterBct(footer);
    if (bctBlock) {
      blocks.push('<div class="col-12">' + bctBlock + "</div>");
    }
    if (linksBlock) {
      blocks.push('<div class="col-12">' + linksBlock + "</div>");
    }
    if (col4.bct_notice && col4.bct_notice.content) {
      blocks.push('<div class="col-7 col-md-12 fe-footer-bct-content"><div class="max-sm:pl-24">' + col4.bct_notice.content + "</div></div>");
    }
    if (isEnabled(map.show, false) && map.iframe) {
      blocks.push(
        '<div class="col-12 fe-footer-map-block"><div class="map-wrapper">' +
        '<h4 class="ttl-f fe-footer-title text-16"><span>' + escapeHtml(firstValue(map.title, "Tìm Chúng Tôi Trên Bản Đồ")) + "</span></h4>" +
        renderFooterEmbed(map.iframe) +
        ((mapAddressTitle || mapAddressText) ? '<div class="map-address">' + (mapAddressTitle ? '<h5>' + escapeHtml(mapAddressTitle) + "</h5>" : "") + (mapAddressText ? '<p>' + escapeHtml(mapAddressText) + "</p>" : "") + "</div>" : "") +
        "</div></div>"
      );
    }
    if (isEnabled(fanpage.show, false) && fanpage.iframe) {
      blocks.push('<div class="col-12 fe-footer-fanpage-block">' + renderFooterEmbed(fanpage.iframe) + "</div>");
    }

    return blocks.length ? '<div class="row gap-y-24 fe-footer-col-four-inner">' + blocks.join("") + "</div>" : "";
  }

  function renderFooterEmbed(raw) {
    var iframe = firstValue(raw);
    if (!iframe) return "";
    return '<div class="fe-footer-embed">' + iframe + "</div>";
  }

  function visitorCount() {
    var key = "fe_footer_visit_count";
    var count = numberValue(localStorage.getItem(key), 0) + 1;
    try {
      localStorage.setItem(key, String(count));
    } catch (e) { }
    return count;
  }

  function renderFooterAccess(access) {
    var parts = [];
    var now = new Date();

    if (!access || (!isEnabled(access.show_time, false) && !isEnabled(access.show_visitor_count, false) && !firstValue(access.text))) return "";
    if (firstValue(access.text)) parts.push(escapeHtml(firstValue(access.text)));
    if (isEnabled(access.show_time, false)) parts.push('<span><i class="fa-regular fa-clock"></i> ' + escapeHtml(now.toLocaleString("vi-VN")) + "</span>");
    if (isEnabled(access.show_visitor_count, false)) parts.push('<span><i class="fa-solid fa-eye"></i> ' + visitorCount() + " lượt truy cập</span>");

    return '<div class="fe-footer-access" style="background:' + escapeHtml(firstValue(access.bg_color, access.bgColor, "#111827")) + ';color:' + escapeHtml(firstValue(access.text_color, access.textColor, "#ffffff")) + '"><div class="container d-flex flex-wrap justify-content-center gap-3">' + parts.join("") + "</div></div>";
  }

  function normalizeFooterColors(footer) {
    var col1 = footer.col_1 || footer.col1 || {};
    var rootColors = footer.colors || footer.color || {};
    var colColors = col1.colors || col1.color || {};
    var theme = footer.themeSetting || footer.theme_setting || {};
    var copyright = footer.copyright || {};

    return {
      bg: firstValue(colColors.bg_color, colColors.bgColor, rootColors.bg_color, rootColors.bgColor, theme.footer_bg_color, theme.bg_color, footer.bg_color, footer.bgColor, "#0f2742"),
      text: firstValue(colColors.text_color, colColors.textColor, rootColors.text_color, rootColors.textColor, theme.footer_text_color, theme.text_color, footer.text_color, footer.textColor, "#ffffff"),
      longBorder: firstValue(colColors.long_border_color, colColors.longBorderColor, rootColors.long_border_color, rootColors.longBorderColor, theme.footer_line_long_color, theme.long_border_color, "rgba(255,255,255,.16)"),
      shortBorder: firstValue(colColors.short_border_color, colColors.shortBorderColor, rootColors.short_border_color, rootColors.shortBorderColor, theme.footer_line_short_color, theme.short_border_color, "#9ee7e8"),
      bgOpacity: firstValue(colColors.bg_opacity, colColors.bgOpacity, rootColors.bg_opacity, rootColors.bgOpacity, theme.footer_bg_opacity, theme.bg_opacity, 100),
      copyrightBg: firstValue(copyright.bg_color, copyright.bgColor, theme.copyright_bg_color, ""),
      copyrightText: firstValue(copyright.text_color, copyright.textColor, theme.copyright_text_color, ""),
      socialBg: firstValue(colColors.social_icon_bg_color, colColors.socialIconBgColor, rootColors.social_icon_bg_color, rootColors.socialIconBgColor, "#ffffff"),
      socialIcon: firstValue(colColors.social_icon_color, colColors.socialIconColor, rootColors.social_icon_color, rootColors.socialIconColor, "#0d6efd")
    };
  }

  function footerVisibleColumns(style) {
    var layouts = {
      1: [1, 2],
      2: [1, 2, 3],
      3: [1, 2, 3, 4],
      4: [1, 2],
      5: [1, 2, 3]
    };

    return layouts[numberValue(style, 3)] || layouts[3];
  }

  function renderFooter(footer) {
    var col1 = footer.col_1 || {};
    var colors = normalizeFooterColors(footer || {});
    var bootstrap = footer.bootstrap_size || col1.bootstrap_size || {};
    var col4 = footer.col_4 || {};
    var style = numberValue(firstValue(footer.style, footer.footer_layout, footer.footerLayout), 3);
    var visibleColumns = footerVisibleColumns(style);
    var rightColumns = [];
    var bg = hexToRgba(colors.bg, colors.bgOpacity);
    var image = safeUrl(firstValue(footer.col_1 && footer.col_1.footer_image), "");
    var copyrightStyle = (colors.copyrightBg ? "background:" + escapeHtml(colors.copyrightBg) + ";" : "") + (colors.copyrightText ? "color:" + escapeHtml(colors.copyrightText) + ";" : "");
    var copyrightOwner = firstValue(footer.copyright && footer.copyright.text, col1.company_name, "");
    var copyrightHtml = copyrightOwner ? 'Bản quyền thuộc về "' + escapeHtml(copyrightOwner) + '" | Cung cấp bởi <a href="https://Thietkeweb365.vn" target="_blank" rel="noopener">Thietkeweb365.vn</a>' : "";
    var styleVars = "--fe-footer-bg:" + bg + ";--fe-footer-text:" + escapeHtml(colors.text) + ";--fe-footer-short-border:" + escapeHtml(colors.shortBorder) + ";--fe-footer-long-border:" + escapeHtml(colors.longBorder) + ";--fe-footer-social-bg:" + escapeHtml(colors.socialBg) + ";--fe-footer-social-icon:" + escapeHtml(colors.socialIcon) + ";--fe-footer-image:" + (image ? "url('" + escapeHtml(image) + "')" : "none") + ";";

    if (visibleColumns.indexOf(2) !== -1) {
      rightColumns.push('<div class="' + escapeHtml(firstValue(bootstrap.col_2_class, "col-5 col-md-4 col-xl-3")) + '">' + renderFooterColumnLinks(footer.col_2 || {}, "", "fa-solid fa-arrow-up-right-from-square") + "</div>");
    }
    if (visibleColumns.indexOf(3) !== -1) {
      rightColumns.push('<div class="' + escapeHtml(firstValue(bootstrap.col_3_class, "col-7 col-md-4 col-xl-4")) + '">' + renderFooterColumnLinks(footer.col_3 || {}, "", "fa-solid fa-shield-halved") + "</div>");
    }
    if (visibleColumns.indexOf(4) !== -1) {
      rightColumns.push('<div class="' + escapeHtml(firstValue(bootstrap.col_4_class, "col-12 col-md-4 col-xl-5")) + '">' + renderFooterColumnFour(footer) + "</div>");
    }

    return (
      '<div class="fe-footer-shell footer-style-' + escapeHtml(style) + '" style="' + styleVars + '">' +
      '<div class="fe-footer-inner"><div class="container"><div class="row g-4">' +
      renderFooterColumnOne(footer) +
      rightColumns.join("") +
      "</div></div></div>" +
      renderFooterAccess(footer.access_time || footer.accessTime) +
      '<div class="fe-footer-copyright" style="' + copyrightStyle + '"><div class="container">' + copyrightHtml + "</div></div>" +
      "</div>"
    );
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
    var left = top.leftLinks.length ? top.leftLinks.map(renderTopLink).join("") : '<a style="color:inherit" href="#">Chào mừng quý khách</a>';
    var right = top.rightLinks.length ? top.rightLinks.map(renderTopLink).join("") : "";
    var leftGapClass = topLinksGapClass(top.leftLinks);
    var rightGapClass = topLinksGapClass(top.rightLinks);
    return (
      '<div class="header-top d-none d-md-block" style="background:' + escapeHtml(top.bgColor) + ';color:' + escapeHtml(top.textColor) + ';border-bottom:' + Number(top.borderWidth || 0) + 'px solid ' + escapeHtml(top.borderColor) + ';--header-top-hover-bg:' + escapeHtml(top.hoverBgColor) + ';--header-top-hover-text:' + escapeHtml(top.hoverTextColor) + '">' +
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
      '<div class="header-action-inner d-flex justify-content-center align-items-center gap-1">' +
      renderMainItemMedia(item) +
      '<div class="text text-left d-none d-xl-block"><small>' + escapeHtml(title) + (content ? '<b class="d-block text-left">' + escapeHtml(content) + "</b>" : "") + "</small></div>" +
      "</div>" +
      "</a>"
    );
  }

  function defaultHeaderMainItems() {
    return [
      { name: "Hotline", content: "0847 865 568", icon: "fa-solid fa-phone", link: "tel:0847865568", columns: 1, position: 1, show_desktop: true, show_mobile: true },
      { name: "Email", content: "mrquan.thietkeweb365.vn@gmail.com", icon: "fa-solid fa-envelope", link: "mailto:mrquan.thietkeweb365.vn@gmail.com", columns: 2, position: 2, show_desktop: true, show_mobile: true }
    ];
  }

  function renderAccountAction(main) {
    var links = [];
    if (main.loginShow) links.push('<a href="./login.html">Đăng nhập</a>');
    if (main.registerShow) links.push('<a class="account-register" href="./register.html">Đăng ký</a>');
    if (!links.length) return "";

    return (
      '<div class="header-account-action d-none d-lg-flex align-items-center" style="color:inherit">' +
      '<i class="fa-solid fa-user"></i>' +
      '<div class="text text-left">' +
      '<small>Tài Khoản</small>' +
      '<div class="header-account-links">' + links.join("") + "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function renderHeaderMain(main, extraClass) {
    var items = (main.items.length ? main.items : defaultHeaderMainItems())
      .filter(function (item) {
        return isEnabled(firstValue(item.show_desktop, item.showDesktop), true) || isEnabled(firstValue(item.show_mobile, item.showMobile), true);
      })
      .sort(function (a, b) { return Number(a.position || 0) - Number(b.position || 0); });
    var logo = safeUrl(main.logo, FALLBACKS.logo);
    return (
      '<div class="header-main header-main-shell px-3 d-flex align-items-center justify-content-between' + (extraClass || "") + '" id="header-main" style="background:' + escapeHtml(main.bgColor) + ';color:' + escapeHtml(main.textColor) + ';border-bottom:' + Number(main.borderWidth || 0) + 'px solid ' + escapeHtml(main.borderColor) + ';--header-main-hover-bg:' + escapeHtml(main.hoverBgColor) + ';--header-main-hover-text:' + escapeHtml(main.hoverTextColor) + '">' +
      '<div class="container"><div class="row align-items-center justify-content-between w-100 wrap-menu">' +
      '<div class="d-lg-none col-2 px-0"><div class="toggle-menu d-flex gap-1 justify-content-between align-content-center"><div class="box-icon d-flex justify-content-center gap-2"><div class="icon icon-light-border"><button class="btn btn-toggle-menu" type="button" data-bs-toggle="offcanvas" data-bs-target="#offcanvasExample3" aria-controls="offcanvasExample3"><i class="fa-solid fa-bars fs-5 mt-1"></i></button></div></div></div></div>' +
      '<div class="wrap-header-logo ' + escapeHtml(main.logoCol) + ' px-0 d-flex align-content-center justify-content-center justify-content-lg-start">' +
      '<div class="logo d-flex align-items-center justify-content-center justify-content-md-start" id="logo"><a href="./"><img class="w-100" src="' + escapeHtml(logo) + '" alt="logo" loading="eager" decoding="async"></a></div>' +
      "</div>" +
      (main.searchShow ? '<div class="d-none d-md-flex align-content-center wrap-header-search px-0 ' + escapeHtml(main.searchCol) + '" id="header-search"><div class="header-search d-block w-100"><form class="form-inline" action="tat-ca-san-pham" method="GET"><div class="input-group flex-nowrap"><input class="form-control" type="text" name="search" placeholder="' + escapeHtml(main.searchPlaceholder) + '"><div class="input-group-append bg-light"><button class="btn" type="submit" aria-label="Search"><i class="fa fa-search" aria-hidden="true"></i></button></div></div></form></div></div>' : "") +
      '<div class="header-actions-list col d-none d-lg-flex align-items-center justify-content-end px-1">' +
      items.map(renderMainItem).join("") +
      renderAccountAction(main) +
      "</div>" +
      "</div></div>" +
      "</div>"
    );
  }

  function renderStickyMenuLogo(logo) {
    return (
      '<div class="fe-sticky-menu-logo">' +
      '<a href="./"><img src="' + escapeHtml(safeUrl(logo, FALLBACKS.logo)) + '" alt="logo" loading="lazy" decoding="async"></a>' +
      "</div>"
    );
  }

  function renderMenu(fallbackMenuHtml, logo) {
    return (
      '<div id="header-sticky" style="' + menuAppearanceStyle() + '">' +
      '<div class="header-bottom-item header-bottom d-none d-lg-block container-fluid px-5 header-bottom-surface">' +
      '<div class="header-bottom-inner">' +
      '<div class="fe-sticky-menu-list">' + fallbackMenuHtml + "</div>" +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function renderLanguageFlags() {
    return (
      '<div class="fe-header-language-flags" aria-label="Language">' +
      '<a href="#" aria-label="Tieng Viet"><img src="assets/img/header/vi.jpg" alt="VI"></a>' +
      '<a href="#" aria-label="English"><img src="assets/img/header/en.jpg" alt="EN"></a>' +
      '<a href="#" aria-label="Japanese"><img src="assets/img/header/ja.jpg" alt="JA"></a>' +
      "</div>"
    );
  }

  function renderHeaderNewsMarquee(news) {
    var items = normalizeList(news && news.items)
      .map(function (item) {
        return {
          text: firstValue(item.text, item.title, item.name, item.content),
          link: firstValue(item.link, item.url, item.href)
        };
      })
      .filter(function (item) { return item.text; });
    var content;

    if (!items.length && news && news.text) {
      items = [{ text: news.text, link: news.link }];
    }

    if (!items.length) return "";

    content = items.map(function (item) {
      var href = item.link ? safeUrl(item.link, "#") : "#";
      var itemHtml = '<span class="fe-header-news-text">' + escapeHtml(item.text) + "</span>";
      if (href && href !== "#") {
        itemHtml = '<a class="fe-header-news-link" href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + itemHtml + "</a>";
      }
      return itemHtml;
    }).join('<span class="fe-header-news-separator">|</span>');

    return (
      '<div class="fe-header-news-marquee" style="' +
      (news && news.bgColor ? '--fe-news-bg:' + escapeHtml(news.bgColor) + ';' : '') +
      (news && news.textColor ? '--fe-news-text:' + escapeHtml(news.textColor) + ';' : '') +
      (news && news.hoverTextColor ? '--fe-news-hover-text:' + escapeHtml(news.hoverTextColor) + ';' : '') +
      '">' +
      '<div class="container px-3 px-sm-5">' +
      '<div class="fe-header-news-track" aria-label="Tin tá»©c">' +
      '<span class="fe-header-news-badge"><i class="fa-solid fa-bullhorn"></i> Tin tá»©c</span>' +
      '<div class="fe-header-news-run"><div class="fe-header-news-content">' +
      '<span class="fe-header-news-group">' + content + "</span>" +
      "</div></div>" +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function renderMenuStyle5(menuHtml, logo) {
    return (
      '<div id="header-sticky" class="header-sticky-style-5" style="' + menuAppearanceStyle() + '">' +
      '<div class="header-bottom-item header-bottom header-bottom-style-5 d-none d-lg-block container-fluid px-5 header-bottom-surface">' +
      '<button class="fe-header-vertical-toggle" type="button" data-fe-vertical-toggle aria-expanded="false" aria-controls="fe-header-vertical-menu">' +
      '<i class="fa-solid fa-bars"></i><span>Menu</span>' +
      "</button>" +
      '<div class="header-bottom-layout">' +
      renderStickyMenuLogo(logo) +
      '<div class="header-bottom-inner fe-style5-main-menu"><div class="fe-sticky-menu-list">' + menuHtml + "</div></div>" +
      '<aside class="fe-header-vertical-panel" id="fe-header-vertical-menu" aria-hidden="true">' +
      '<div class="fe-header-vertical-head">' +
      '<strong>Danh mục</strong>' +
      '<button class="fe-header-vertical-close" type="button" data-fe-vertical-close aria-label="Đóng menu"><i class="fa-solid fa-xmark"></i></button>' +
      "</div>" +
      '<nav class="fe-header-vertical-nav">' + menuHtml + "</nav>" +
      "</aside>" +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function bindHeaderStyle5(root) {
    var toggle = root.querySelector("[data-fe-vertical-toggle]");
    var close = root.querySelector("[data-fe-vertical-close]");
    var panel = root.querySelector("#fe-header-vertical-menu");
    var nav = root.querySelector(".fe-header-vertical-nav");

    if (!toggle || !panel) return;

    function setOpen(open) {
      root.classList.toggle("fe-style5-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      panel.setAttribute("aria-hidden", open ? "false" : "true");
    }

    setOpen(false);
    toggle.addEventListener("click", function () {
      setOpen(!root.classList.contains("fe-style5-open"));
    });
    if (close) {
      close.addEventListener("click", function () {
        setOpen(false);
      });
    }

    if (nav) {
      nav.querySelectorAll(".menu-item.has-sub-menu").forEach(function (item) {
        item.classList.remove("is-open");
      });

      nav.addEventListener("click", function (event) {
        var parent = event.target.closest(".menu-item.has-sub-menu");

        if (!parent || !nav.contains(parent)) return;
        if (event.target.closest(".sub-menu")) return;

        event.preventDefault();
        parent.classList.toggle("is-open");
      });
    }
  }

  function bindHeaderScrollState(root) {
    var isStyle4 = root.dataset.headerStyle === "4";
    var enterThreshold = isStyle4 ? 220 : 140;
    var exitThreshold = 4;
    var ticking = false;
    var isScrolled = root.classList.contains("fe-header-scrolled");
    var lastScrollY = window.scrollY || window.pageYOffset || 0;

    if (root._feHeaderScrollCleanup) {
      root._feHeaderScrollCleanup();
    }

    function update() {
      var scrollY = window.scrollY || window.pageYOffset || 0;
      var isScrollingUp = scrollY < lastScrollY;

      if (!isScrolled && scrollY > enterThreshold) {
        isScrolled = true;
        root.classList.add("fe-header-scrolled");
      } else if (isScrolled && isScrollingUp && scrollY <= exitThreshold) {
        isScrolled = false;
        root.classList.remove("fe-header-scrolled");
      }

      lastScrollY = scrollY;
      ticking = false;
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    root._feHeaderScrollCleanup = function () {
      window.removeEventListener("scroll", requestUpdate);
    };
  }

  function bindMobileCategoryMenu(root) {
    var sourceMenu = root.querySelector(".header-bottom .menu");
    var mobileMenu = root.querySelector("#mobile-category-menu");

    if (!sourceMenu || !mobileMenu) return;

    mobileMenu.innerHTML = sourceMenu.innerHTML;
    mobileMenu.querySelectorAll(".menu-item").forEach(function (item) {
      item.classList.remove("py-1", "px-2");
      item.classList.add("mobile-category-item");
      if (item.querySelector(":scope > .sub-menu")) item.classList.add("mobile-has-submenu");
    });
    mobileMenu.querySelectorAll(".mega").forEach(function (item) { item.classList.remove("mega"); });
    mobileMenu.querySelectorAll(".sub-menu").forEach(function (item) { item.classList.add("mobile-sub-menu"); });
    mobileMenu.querySelectorAll(".menu-link").forEach(function (item) {
      item.classList.remove("py-1", "px-2");
      item.classList.add("mobile-category-link");
    });
    mobileMenu.querySelectorAll(".fa-caret-down").forEach(function (item) {
      item.classList.add("mobile-category-caret");
    });

    if (mobileMenu.dataset.bound === "true") return;
    mobileMenu.dataset.bound = "true";
    mobileMenu.addEventListener("click", function (event) {
      var trigger = event.target.closest(".mobile-has-submenu > .mobile-category-link, .mobile-has-submenu > .mobile-category-caret");
      var item;

      if (!trigger || !mobileMenu.contains(trigger)) return;
      event.preventDefault();
      item = trigger.closest(".mobile-has-submenu");
      if (item) item.classList.toggle("active");
    });
  }

  function renderMobileSidebarInfo(header) {
    var loginLinks = "";

    if (header.main.loginShow || header.main.registerShow) {
      loginLinks =
        '<div class="border-top d-flex py-2 gap-2">' +
        (header.main.loginShow ? '<a class="btn-login d-flex gap-2 align-items-center" href="./login.html"><img src="assets/img/header/icon-login.png" alt="" width="20" height="20"><span>Đăng nhập</span></a>' : "") +
        (header.main.registerShow ? '<a class="btn-login d-flex gap-2 align-items-center" href="./register.html"><img src="assets/img/header/icon-register.png" alt="" width="20" height="20"><span>Đăng ký</span></a>' : "") +
        "</div>";
    }

    return (
      '<div class="foo_mid border-top text-dark">' +
      '<a class="btn-hotline d-flex gap-2 align-items-center" href="tel:0847865568">' +
      '<img src="assets/img/header/icon-hotline.png" alt="" width="36">' +
      '<div class="d-flex flex-column fw-bold"><span class="text-sub">Hotline & Zalo</span><span class="fs-5">0847 865 568</span></div>' +
      "</a>" +
      loginLinks +
      '<div class="py-2 border-top">' +
      '<p class="mb-2 position-relative fw-bold">Kết nối mạng xã hội</p>' +
      '<div class="d-flex position-relative social mb-1 mx-0 gap-1">' +
      '<a href="#" target="_blank" class="position-relative iso sitdown modal-open d-inline-block mr-1" title="Facebook"><i class="fa-brands fa-facebook-f"></i></a>' +
      '<a href="#" target="_blank" class="position-relative iso sitdown modal-open d-inline-block mr-1" title="Shopee"><img src="https://we1.io.vn/admin/public/images/footer/1773280802172%20Shopee.png" alt="Shopee" width="32" height="32"></a>' +
      '<a href="#" target="_blank" class="position-relative iso sitdown modal-open d-inline-block mr-1" title="Twitter"><i class="fa-brands fa-twitter"></i></a>' +
      '<a href="#" target="_blank" class="position-relative iso sitdown modal-open d-inline-block mr-1" title="Youtube"><i class="fa-brands fa-youtube"></i></a>' +
      "</div>" +
      "</div>" +
      '<div class="mb-2 border-top">' +
      '<address class="my-2">' +
      '<h5 class="mb-2"><strong>THIẾT KẾ WEB 365 .VN</strong></h5>' +
      '<p class="mb-1"><b>SDT: </b><a class="text-dark" href="tel:0847865568" title="0847 865 568">0847 865 568</a></p>' +
      '<p class="mb-1"><b>SDT: </b><a class="text-dark" href="tel:0847865568" title="0847 865 568">0847 865 568</a></p>' +
      '<p class="m-0"><b>Email: </b><a class="text-dark" href="mailto:mrquan.thietkeweb365.vn@gmail.com" title="mrquan.thietkeweb365.vn@gmail.com">mrquan.thietkeweb365.vn@gmail.com</a></p>' +
      '<p class="m-0"><b>Email: </b><a class="text-dark" href="mailto:youmail@gmail.com" title="youmail@gmail.com">youmail@gmail.com</a></p>' +
      '<p class="mb-1"><b>Hà Nội: </b>Trần Khát Chân, Hai Bà Trưng, Hà Nội</p>' +
      '<p class="mb-1"><b>TP. HCM: </b>Bùi Đình Túy, Bình Thạnh, TP. HCM</p>' +
      "</address>" +
      "</div>" +
      '<div class="border-top text-dark">' +
      '<p class="mt-2 position-relative fw-bold">Phương thức thanh toán</p>' +
      '<div class="d-flex py-2 gap-4"><div class="footer-column-1"><div class="payment-accept gap-1 mx-0">' +
      '<img class="first lazy loaded" width="47" src="https://we1.io.vn/admin/public/images/footer/174807414842AC.webp" alt="American Express">' +
      '<img class="lazy loaded" width="47" src="https://we1.io.vn/admin/public/images/footer/174807414848MC.webp" alt="MasterCard">' +
      "</div></div></div>" +
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
      '<div class="px-3 py-2"><div class="header-search d-block w-100"><form class="form-inline" action="#" method="GET"><div class="input-group flex-nowrap"><input class="form-control" type="text" name="search" placeholder="Tìm kiếm Sản phẩm & Dịch vụ ?"><div class="input-group-append bg-light"><button class="btn" type="submit" aria-label="Tìm kiếm"><i class="fa fa-search" aria-hidden="true"></i></button></div></div></form></div></div>' +
      '<div class="offcanvas-body pt-1 px-3 d-flex justify-content-between flex-column"><ul class="mobile-category-menu border-top" id="mobile-category-menu"></ul>' + renderMobileSidebarInfo(header) + '</div>' +
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
    var response = await fetchWithAuth(getBaseUrl() + "/admin/config/header", {
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

    response = await fetchWithAuth(getBaseUrl() + "/admin/category?" + params.toString(), {
      method: "GET",
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error("Category API " + response.status);

    json = await response.json();
    if (!json || json.success === false) throw new Error(json && json.message ? json.message : "Category API error");
    setMenuAppearanceFromApi(json);

    pageCategories = normalizeCategoryItems(unwrapCategoryPayload(json));
    allCategories = allCategories.concat(flattenCategories(pageCategories));
    totalPage = Math.min(categoryTotalPage(json), 20);

    for (page = 2; page <= totalPage; page += 1) {
      params.set("page", String(page));
      response = await fetchWithAuth(getBaseUrl() + "/admin/category?" + params.toString(), {
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

  async function loadBanners() {
    var params = new URLSearchParams();
    var response;
    var json;

    params.set("limit", "20");
    params.set("page", "1");
    params.set("banner_status", "1");
    params.set("banner_type", "-1");
    params.set("sort_order", "asc");

    response = await fetchWithAuth(getBaseUrl() + "/admin/banner?" + params.toString(), {
      method: "GET",
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error("Banner API " + response.status);
    json = await response.json();
    if (!json || json.success === false) throw new Error(json && json.message ? json.message : "Banner API error");

    return unwrapListPayload(json);
  }

  async function loadFooter() {
    var response = await fetchWithAuth(getBaseUrl() + "/admin/config/footer", {
      method: "GET",
      headers: getAuthHeaders()
    });
    var json;

    if (!response.ok) throw new Error("Footer API " + response.status);
    json = await response.json();
    if (!json || json.success === false) throw new Error(json && json.message ? json.message : "Footer API error");

    return unwrapConfigPayload(json);
  }

  function normalizeApiList(json) {
    if (Array.isArray(json && json.data && json.data.data)) return json.data.data;
    if (Array.isArray(json && json.data && json.data.items)) return json.data.items;
    if (Array.isArray(json && json.data)) return json.data;
    if (Array.isArray(json && json.items)) return json.items;
    return [];
  }

  async function loadBodyCatalogData() {
    var categoryParams = new URLSearchParams();
    var productParams = new URLSearchParams();
    var categoryResponse;
    var productResponse;
    var categoryJson;
    var productJson;

    categoryParams.set("page", "1");
    categoryParams.set("limit", "200");
    categoryParams.set("category_status", "1");
    categoryParams.set("sort_order", "asc");
    productParams.set("page", "1");
    productParams.set("limit", "120");
    productParams.set("product_status", "1");

    try {
      categoryResponse = await fetchWithAuth(getBaseUrl().replace(/\/$/, "") + "/admin/category?" + categoryParams.toString(), { method: "GET", headers: getAuthHeaders() });
      if (categoryResponse.ok) {
        categoryJson = await categoryResponse.json();
        bodyCatalogCache.categories = flattenCategories(normalizeCategoryItems(unwrapCategoryPayload(categoryJson)));
      }
    } catch (e) { bodyCatalogCache.categories = []; }

    try {
      productResponse = await fetchWithAuth(getBaseUrl().replace(/\/$/, "") + "/admin/product?" + productParams.toString(), { method: "GET", headers: getAuthHeaders() });
      if (productResponse.ok) {
        productJson = await productResponse.json();
        bodyCatalogCache.products = normalizeApiList(productJson);
      }
    } catch (e) { bodyCatalogCache.products = []; }
  }
  async function loadBodySections() {
    var params = new URLSearchParams();
    var response;
    var json;
    var endpoints;
    var i;
    var list;
    var lastError;

    params.set("page", "1");
    params.set("limit", "100");
    params.set("section_status", "1");
    params.set("sort_order", "asc");

    endpoints = [
      getBaseUrl().replace(/\/$/, "") + "/admin/page-section?" + params.toString()
    ];

    for (i = 0; i < endpoints.length; i += 1) {
      try {
        response = await fetchWithAuth(endpoints[i], {
          method: "GET",
          headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error("Body section API " + response.status);
        json = await response.json();
        if (!json || json.success === false) throw new Error(json && json.message ? json.message : "Body section API error");

        list = unwrapListPayload(json);
        if (list.length || i === endpoints.length - 1) return list;
      } catch (e) {
        lastError = e;
      }
    }

    throw lastError || new Error("Body section API error");
  }

  function renderPageBanners(banners) {
    var root = document.querySelector(".banner_slide");
    var html;

    if (!root) return;
    if (currentSectionTarget()) {
      root.innerHTML = "";
      root.style.display = "none";
      root.dataset.renderState = "ready";
      return;
    }

    html = renderBanners(banners);
    if (!html) {
      root.dataset.renderState = "fallback";
      window.dispatchEvent(new CustomEvent("fe:banner-rendered", { detail: { region: "banner", fallback: true } }));
      return;
    }

    if (window.jQuery && window.jQuery.fn && window.jQuery.fn.slick && window.jQuery(root).hasClass("slick-initialized")) {
      window.jQuery(root).slick("unslick");
    }

    root.innerHTML = html;
    root.dataset.renderState = "ready";
    window.dispatchEvent(new CustomEvent("fe:banner-rendered", { detail: { region: "banner", data: banners } }));
  }

  function renderPageFooter(footer) {
    var root = document.querySelector('[data-page-region="footer"]');
    if (!root) return;
    root.innerHTML = renderFooter(footer);
    root.dataset.renderState = "ready";
    window.dispatchEvent(new CustomEvent("fe:footer-rendered", { detail: { region: "footer", data: footer } }));
  }

  function renderPageBody(sections) {
    var root = document.querySelector('[data-page-region="body"]');
    var html;
    var target = currentSectionTarget();
    var visibleSections;

    if (!root) return;

    visibleSections = normalizeList(sections)
      .filter(isSectionVisible)
      .filter(function (section) {
        if (!target) return true;
        return sectionUrl(section, sectionData(section)) === target;
      });

    html = visibleSections
      .sort(function (a, b) { return sectionOrder(a) - sectionOrder(b); })
      .map(renderBodySection)
      .filter(Boolean)
      .join("");

    if (!html) {
      root.innerHTML = "";
      root.dataset.renderState = "fallback";
      window.dispatchEvent(new CustomEvent("fe:body-rendered", { detail: { region: "body", fallback: true } }));
      if (window.console && visibleSections.length) {
        console.warn("No supported body sections rendered. Section types:", visibleSections.map(sectionType));
      }
      return;
    }

    root.innerHTML = html;
    root.dataset.renderState = "ready";
    bindVideoNewsModal();
    window.dispatchEvent(new CustomEvent("fe:body-rendered", { detail: { region: "body", data: sections } }));
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
    if (sections.menu) html += header.style === 5 ? renderMenuStyle5(menuHtml, header.main.logo || header.logo.main) : renderMenu(menuHtml, header.main.logo || header.logo.main);
    if (header.style === 4) html += renderHeaderNewsMarquee(header.news);
    html += renderOffcanvas(header);
    root.innerHTML = html;
    root.style.cssText += ";" + menuAppearanceStyle();
    root.dataset.headerStyle = String(header.style);
    root.dataset.renderState = "ready";
    bindHeaderStyle5(root);
    bindMobileCategoryMenu(root);
    bindHeaderScrollState(root);
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

    try {
      renderPageBanners(await loadBanners());
    } catch (bannerErr) {
      var bannerRoot = document.querySelector(".banner_slide");
      if (bannerRoot) bannerRoot.dataset.renderState = "fallback";
      window.dispatchEvent(new CustomEvent("fe:banner-rendered", { detail: { region: "banner", fallback: true } }));
      if (window.console) console.warn("Use static banner fallback:", bannerErr.message || bannerErr);
    }

    try {
      await loadBodyCatalogData();
      renderPageBody(await loadBodySections());
    } catch (bodyErr) {
      var bodyRoot = document.querySelector('[data-page-region="body"]');
      if (bodyRoot) bodyRoot.dataset.renderState = "fallback";
      window.dispatchEvent(new CustomEvent("fe:body-rendered", { detail: { region: "body", fallback: true } }));
      if (window.console) console.warn("Use empty body fallback:", bodyErr.message || bodyErr);
    }

    try {
      renderPageFooter(await loadFooter());
    } catch (footerErr) {
      var footerRoot = document.querySelector('[data-page-region="footer"]');
      if (footerRoot) footerRoot.dataset.renderState = "fallback";
      window.dispatchEvent(new CustomEvent("fe:footer-rendered", { detail: { region: "footer", fallback: true } }));
      if (window.console) console.warn("Use empty footer fallback:", footerErr.message || footerErr);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();


