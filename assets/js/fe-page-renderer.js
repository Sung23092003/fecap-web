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
        hoverTextColor: firstValue(headerTop.hover_text_color, headerTop.hoverTextColor, headerTop.text_hover_color, headerTop.textHoverColor, headerTop.text_color_hover, headerTop.textColorHover, headerTop.hover_color, headerTop.hoverColor, headerTop.hover_text, headerTop.hoverText, headerTop.text_color, headerTop.textColor, "#212529"),
        hoverBgColor: firstValue(headerTop.hover_bg_color, headerTop.hoverBgColor, headerTop.bg_hover_color, headerTop.bgHoverColor, headerTop.background_hover_color, headerTop.backgroundHoverColor, headerTop.hover_background_color, headerTop.hoverBackgroundColor, headerTop.background_color_hover, headerTop.backgroundColorHover, headerTop.hover_background, headerTop.hoverBackground, "transparent"),
        borderColor: firstValue(headerTop.border_color, headerTop.borderColor, "#0282a5"),
        borderWidth: numberValue(firstValue(headerTop.border_thickness, headerTop.borderThickness), 1),
        leftLinks: normalizeList(headerTop.left_links || headerTop.leftLinks),
        rightLinks: normalizeList(headerTop.right_links || headerTop.rightLinks)
      },
      main: {
        bgColor: firstValue(headerMain.bg_color, headerMain.bgColor, "#0282a5"),
        textColor: firstValue(headerMain.text_color, headerMain.textColor, "#ffffff"),
        hoverTextColor: firstValue(headerMain.hover_text_color, headerMain.hoverTextColor, headerMain.text_hover_color, headerMain.textHoverColor, headerMain.text_color_hover, headerMain.textColorHover, headerMain.hover_color, headerMain.hoverColor, headerMain.hover_text, headerMain.hoverText, headerMain.text_color, headerMain.textColor, "#ffffff"),
        hoverBgColor: firstValue(headerMain.hover_bg_color, headerMain.hoverBgColor, headerMain.bg_hover_color, headerMain.bgHoverColor, headerMain.background_hover_color, headerMain.backgroundHoverColor, headerMain.hover_background_color, headerMain.hoverBackgroundColor, headerMain.background_color_hover, headerMain.backgroundColorHover, headerMain.hover_background, headerMain.hoverBackground, "transparent"),
        borderColor: firstValue(headerMain.border_color, headerMain.borderColor, "transparent"),
        borderWidth: numberValue(firstValue(headerMain.border_thickness, headerMain.borderThickness), 0),
        logo: firstValue(headerMain.logo, logo.logo_main, logo.logoMain, FALLBACKS.logo),
        logoCol: normalizeBootstrapColClass(firstValue(headerMain.logo_col, headerMain.logoCol, headerMain.logo_column, headerMain.logoColumn), "col-7 col-md-3 col-lg-3 col-xl-2"),
        searchShow: isEnabled(firstValue(headerMain.search_show, headerMain.searchShow), true),
        searchCol: normalizeBootstrapColClass(firstValue(headerMain.search_col, headerMain.searchCol, headerMain.search_column, headerMain.searchColumn), "col-12 col-sm-4 col-md-5 col-lg-6 col-xl-4"),
        searchPlaceholder: firstValue(headerMain.search_placeholder, headerMain.searchPlaceholder, "Tim kiem San pham & Dich vu ?"),
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

  function unwrapListPayload(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (raw.data && Array.isArray(raw.data.data)) return raw.data.data;
    if (raw.data && raw.data.data && Array.isArray(raw.data.data.data)) return raw.data.data.data;
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
      bgColor: "",
      hoverBgColor: "",
      textColor: "",
      bold: false
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
      bgColor: firstValue(data.menu_bg_color, data.bg_color, data.bgColor),
      hoverBgColor: firstValue(data.menu_hover_bg_color, data.hover_bg_color, data.hoverBgColor),
      textColor: firstValue(data.menu_text_color, data.text_color, data.textColor),
      bold: data.menu_bold === true || data.menu_bold === "true" || data.bold === true || data.bold === "true"
    };
  }

  function setMenuAppearanceFromApi(raw) {
    var payload = raw && raw.data ? raw.data : raw;
    var themeSetting =
      (payload && payload.themeSetting) ||
      (payload && payload.theme_setting) ||
      (payload && payload.data && payload.data.themeSetting) ||
      (payload && payload.data && payload.data.theme_setting);

    if (themeSetting && typeof themeSetting === "object") {
      window.FE_MENU_APPEARANCE = themeSetting;
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
    var col = footer.col_1 || {};
    var items = normalizeList(col.social_list || col.socialList || col.socials);
    var title = firstValue(col.social_title, col.socialTitle, "Mạng xã hội");

    if (!items.length) return "";
    return (
      '<div class="fe-footer-social-block">' +
        '<h4 class="ttl-f fe-footer-title text-16"><span>' + escapeHtml(title) + "</span></h4>" +
        '<ul class="list-social fe-footer-social-list">' + items.map(renderFooterSocialItem).join("") + "</ul>" +
      "</div>"
    );
  }

  function renderFooterBct(footer) {
    var col = footer.col_1 || {};
    var bct = col.bct_notice || col.bctNotice || {};
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
        renderFooterSocial(footer) +
        renderFooterBct(footer) +
      "</div>"
    );
  }

  function renderFooterImageList(items) {
    return normalizeList(items).map(function (item) {
      var image = safeUrl(firstValue(item.file, item.image, item.url, item.src, item.content), "");
      var href = safeUrl(firstValue(item.link, item.href), "#");
      var title = firstValue(item.name, item.title, "payment");
      if (!image) return "";
      return '<a href="' + escapeHtml(href) + '"><img src="' + escapeHtml(image) + '" alt="' + escapeHtml(title) + '" loading="lazy" decoding="async"></a>';
    }).join("");
  }

  function renderFooterColumnFour(col4) {
    var payment = col4.payment_method || {};
    var map = col4.map || {};
    var fanpage = col4.fanpage || {};
    var html = "";

    html += renderFooterColumnLinks(col4, "", "fa-solid fa-arrow-up-right-from-square");
    if (isEnabled(payment.show, false) && normalizeList(payment.payment_list).length) {
      html += '<div class="fe-footer-payment-block"><h4 class="ttl-f fe-footer-title text-16"><span>Hình thức thanh toán</span></h4><div class="payment-accept fe-footer-payment">' + renderFooterImageList(payment.payment_list) + "</div></div>";
    }
    if (col4.bct_notice && col4.bct_notice.content) {
      html += '<div class="fe-footer-bct-content">' + col4.bct_notice.content + "</div>";
    }
    if (isEnabled(map.show, false) && map.iframe) {
      html += '<div class="map-wrapper fe-footer-map-block"><h4 class="ttl-f fe-footer-title text-16"><span>' + escapeHtml(firstValue(map.title, "Tìm Chúng Tôi Trên Bản Đồ")) + '</span></h4>' + renderFooterEmbed(map.iframe) + "</div>";
    }
    if (isEnabled(fanpage.show, false) && fanpage.iframe) {
      html += '<div class="fe-footer-fanpage-block">' + renderFooterEmbed(fanpage.iframe) + "</div>";
    }

    return html;
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
    } catch (e) {}
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

  function renderFooter(footer) {
    var col1 = footer.col_1 || {};
    var colors = normalizeFooterColors(footer || {});
    var bootstrap = footer.bootstrap_size || col1.bootstrap_size || {};
    var col4 = footer.col_4 || {};
    var bg = hexToRgba(colors.bg, colors.bgOpacity);
    var image = safeUrl(firstValue(footer.col_1 && footer.col_1.footer_image), "");
    var copyrightStyle = (colors.copyrightBg ? "background:" + escapeHtml(colors.copyrightBg) + ";" : "") + (colors.copyrightText ? "color:" + escapeHtml(colors.copyrightText) + ";" : "");
    var styleVars = "--fe-footer-bg:" + bg + ";--fe-footer-text:" + escapeHtml(colors.text) + ";--fe-footer-short-border:" + escapeHtml(colors.shortBorder) + ";--fe-footer-long-border:" + escapeHtml(colors.longBorder) + ";--fe-footer-social-bg:" + escapeHtml(colors.socialBg) + ";--fe-footer-social-icon:" + escapeHtml(colors.socialIcon) + ";--fe-footer-bg-opacity:" + (image ? "0.18" : "0") + ";--fe-footer-image:" + (image ? "url('" + escapeHtml(image) + "')" : "none") + ";";

    return (
      '<div class="fe-footer-shell footer-style-' + escapeHtml(firstValue(footer.style, 3)) + '" style="' + styleVars + '">' +
        '<div class="fe-footer-inner"><div class="container"><div class="row g-4">' +
          renderFooterColumnOne(footer) +
          '<div class="' + escapeHtml(firstValue(bootstrap.right_group_class, "col-12 col-lg-12 col-xl-8")) + '"><div class="row g-4">' +
            '<div class="' + escapeHtml(firstValue(bootstrap.col_2_class, "col-5 col-md-4 col-xl-3")) + '">' + renderFooterColumnLinks(footer.col_2 || {}, "", "fa-solid fa-arrow-up-right-from-square") + "</div>" +
            '<div class="' + escapeHtml(firstValue(bootstrap.col_3_class, "col-7 col-md-4 col-xl-4")) + '">' + renderFooterColumnLinks(footer.col_3 || {}, "", "fa-solid fa-shield-halved") + "</div>" +
            '<div class="' + escapeHtml(firstValue(bootstrap.col_4_class, "col-12 col-md-4 col-xl-5")) + '">' + renderFooterColumnFour(col4) + "</div>" +
          "</div></div>" +
        "</div></div></div>" +
        renderFooterAccess(footer.access_time || footer.accessTime) +
        '<div class="fe-footer-copyright" style="' + copyrightStyle + '"><div class="container">' + escapeHtml(firstValue(footer.copyright && footer.copyright.text, "")) + "</div></div>" +
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
    var left = top.leftLinks.length ? top.leftLinks.map(renderTopLink).join("") : '<a style="color:inherit" href="#">Chao mung quy khach</a>';
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
      '<div class="header-main header-main-shell px-3 d-flex align-items-center justify-content-between' + (extraClass || "") + '" id="header-main" style="background:' + escapeHtml(main.bgColor) + ';color:' + escapeHtml(main.textColor) + ';border-bottom:' + Number(main.borderWidth || 0) + 'px solid ' + escapeHtml(main.borderColor) + ';--header-main-hover-bg:' + escapeHtml(main.hoverBgColor) + ';--header-main-hover-text:' + escapeHtml(main.hoverTextColor) + '">' +
        '<div class="container"><div class="row align-items-center w-100 wrap-menu">' +
          '<div class="d-md-none col-2 px-0"><div class="toggle-menu d-flex gap-1 justify-content-between align-content-center"><div class="box-icon d-flex justify-content-center gap-2"><div class="icon icon-light-border"><button class="btn btn-toggle-menu" type="button" data-bs-toggle="offcanvas" data-bs-target="#offcanvasExample3" aria-controls="offcanvasExample3"><i class="fa-solid fa-bars text-light fs-5 mt-1"></i></button></div></div></div></div>' +
          '<div class="wrap-header-logo ' + escapeHtml(main.logoCol) + ' px-0 d-flex align-content-center justify-content-center justify-content-md-start">' +
            '<div class="d-none d-md-block d-lg-none col-2 px-0 mt-2"><div class="toggle-menu d-flex gap-1 justify-content-between align-content-center"><div class="d-flex justify-content-center gap-2"><div class="icon icon-light-border"><button class="btn btn-toggle-menu" type="button" data-bs-toggle="offcanvas" data-bs-target="#offcanvasExample3" aria-controls="offcanvasExample3"><i class="fa-solid fa-bars text-light fs-5 mt-1"></i></button></div></div></div></div>' +
            '<div class="logo d-flex align-items-center justify-content-center justify-content-md-start" id="logo"><a href="./"><img class="w-100" src="' + escapeHtml(logo) + '" alt="logo" loading="eager" decoding="async"></a></div>' +
          "</div>" +
          (main.searchShow ? '<div class="d-none d-md-flex align-content-center wrap-header-search px-0 ' + escapeHtml(main.searchCol) + '" id="header-search"><div class="header-search d-block w-100"><form class="form-inline" action="tat-ca-san-pham" method="GET"><div class="input-group flex-nowrap"><input class="form-control" type="text" name="search" placeholder="' + escapeHtml(main.searchPlaceholder) + '"><div class="input-group-append bg-light"><button class="btn" type="submit" aria-label="Tim kiem"><i class="fa fa-search" aria-hidden="true"></i></button></div></div></form></div></div>' : "") +
          '<div class="header-actions-list col d-flex align-items-center justify-content-end px-1">' +
            items.map(renderMainItem).join("") +
          "</div>" +
        "</div></div>" +
      "</div>"
    );
  }

  function renderMenu(fallbackMenuHtml) {
    return (
      '<div id="header-sticky" style="' + menuAppearanceStyle() + '">' +
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

  function renderPageBanners(banners) {
    var root = document.querySelector(".banner_slide");
    var html;

    if (!root) return;

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
    root.style.cssText += ";" + menuAppearanceStyle();
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

    try {
      renderPageBanners(await loadBanners());
    } catch (bannerErr) {
      var bannerRoot = document.querySelector(".banner_slide");
      if (bannerRoot) bannerRoot.dataset.renderState = "fallback";
      window.dispatchEvent(new CustomEvent("fe:banner-rendered", { detail: { region: "banner", fallback: true } }));
      if (window.console) console.warn("Use static banner fallback:", bannerErr.message || bannerErr);
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
