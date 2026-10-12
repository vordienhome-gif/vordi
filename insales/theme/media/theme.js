/*!
 * Elitmosteks B2B — скрипты темы (без зависимостей; использует common-js v2 InSales, если он подключён)
 *  - оптовая таблица: количество, суммы, массовое добавление в корзину
 *  - минимальная сумма заказа (по группе клиента) — прогресс и блокировка «Оформить»
 *  - повтор заказа, выгрузка корзины в CSV, форма заявки, меню, галерея, менеджер, cookie
 */


(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.VOTheme = api;
  if (typeof document !== "undefined" && !(typeof module === "object" && module.exports)) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { api.init(root); });
    else api.init(root);
  }
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  // ---------- чистые функции (покрыты тестами) ----------
  function toNum(v) {
    if (v === null || v === undefined || v === "") return 0;
    var n = Number(String(v).replace(/\s/g, "").replace(",", "."));
    return isFinite(n) ? n : 0;
  }
  function formatRub(n) {
    var r = Math.round(toNum(n));
    var s = String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return (r < 0 ? "−" : "") + s + " ₽";
  }
  /** Сумма корзины из JSON InSales (поля зависят от версии API) */
  function cartTotal(order) {
    var t = cartTotalOrNull(order);
    return t === null ? 0 : t;
  }
  /** То же, но null, если в ответе нет данных о сумме */
  function cartTotalOrNull(order) {
    if (!order || typeof order !== "object") return null;
    var keys = ["items_price", "total_price", "items_total_price"];
    for (var i = 0; i < keys.length; i++) {
      if (order[keys[i]] !== undefined && order[keys[i]] !== null && !isNaN(Number(order[keys[i]]))) return Number(order[keys[i]]);
    }
    var lines = order.order_lines || order.items;
    if (!lines || typeof lines.length !== "number") return null;
    var s = 0;
    for (var j = 0; j < lines.length; j++) s += toNum(lines[j].total_price || toNum(lines[j].sale_price) * toNum(lines[j].quantity));
    return s;
  }
  /** Состояние минимального заказа */
  function minState(total, min) {
    total = Math.max(0, toNum(total)); min = toNum(min);
    if (min <= 0) return { active: false, reached: true, left: 0, pct: 100 };
    var left = Math.max(0, min - total);
    return { active: true, reached: left === 0, left: left, pct: Math.min(100, Math.floor(total / min * 100)) };
  }
  /** Собирает выбор {variantId: qty} и сумму из списка {id, qty, price} */
  function collect(rows) {
    var items = {}, count = 0, sum = 0;
    for (var i = 0; i < rows.length; i++) {
      var q = Math.floor(toNum(rows[i].qty));
      if (q > 0) { items[rows[i].id] = (items[rows[i].id] || 0) + q; count++; sum += q * toNum(rows[i].price); }
    }
    return { items: items, count: count, sum: sum };
  }
  /** Позиции заказа → {variantId: qty} */
  function orderToItems(order) {
    var o = order && (order.order || order);
    var lines = (o && (o.order_lines || o.items)) || [], items = {}, n = 0;
    for (var i = 0; i < lines.length; i++) {
      var id = lines[i].variant_id, q = Math.round(toNum(lines[i].quantity));
      if (id && q > 0) { items[id] = (items[id] || 0) + q; n++; }
    }
    return n ? items : null;
  }
  /** Текст письма из полей анкеты */
  function composeContent(pairs) {
    var out = [];
    for (var i = 0; i < pairs.length; i++) {
      var v = String(pairs[i][1] || "").trim();
      if (v) out.push(pairs[i][0] + ": " + v);
    }
    return out.join("\n");
  }
  /** CSV (разделитель «;», UTF-8 BOM для Excel) */
  function toCSV(rows) {
    function cell(v) { v = String(v === undefined || v === null ? "" : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    return "﻿" + rows.map(function (r) { return r.map(cell).join(";"); }).join("\r\n");
  }

  // ---------- браузер ----------
  function init(win) {
    var doc = win.document;
    var VO = win.VO || {};
    var state = VO.state || (doc.body && doc.body.getAttribute("data-vo-state")) || "guest";
    var minOrder = toNum(VO.minOrder);
    var cartSum = toNum(VO.cartTotal);
    var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); };

    var live = doc.createElement("div");
    live.className = "toast";
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    live.hidden = true;
    doc.body.appendChild(live);
    var toastTimer = null;
    function toast(html, isError) {
      live.className = "toast" + (isError ? " toast--error" : "");
      live.innerHTML = html;
      live.hidden = false;
      if (toastTimer) win.clearTimeout(toastTimer);
      toastTimer = win.setTimeout(function () { live.hidden = true; }, 5000);
    }

    // --- меню ---
    var drawer = doc.getElementById("vo-drawer");
    $$("[data-vo-menu-open]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!drawer) return;
        drawer.hidden = false; b.setAttribute("aria-expanded", "true"); doc.body.style.overflow = "hidden";
        var c = drawer.querySelector("[data-vo-menu-close]"); if (c) c.focus();
      });
    });
    function closeDrawer() {
      if (!drawer || drawer.hidden) return;
      drawer.hidden = true; doc.body.style.overflow = "";
      $$("[data-vo-menu-open]").forEach(function (b) { b.setAttribute("aria-expanded", "false"); b.focus(); });
    }
    if (drawer) drawer.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var f = $$("a[href], button, summary", drawer).filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && doc.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && doc.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
    $$("[data-vo-menu-close]").forEach(function (b) { b.addEventListener("click", closeDrawer); });
    if (drawer) drawer.addEventListener("click", function (e) { if (e.target === drawer) closeDrawer(); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeDrawer(); closeMgr(); } });

    // --- менеджер ---
    var mgrBtn = doc.querySelector("[data-vo-manager-toggle]");
    var mgrPanel = doc.getElementById("vo-mgr-panel");
    function closeMgr() { if (mgrPanel && mgrBtn) { mgrPanel.hidden = true; mgrBtn.setAttribute("aria-expanded", "false"); } }
    if (mgrBtn && mgrPanel) {
      mgrBtn.addEventListener("click", function () { var open = mgrPanel.hidden; mgrPanel.hidden = !open; mgrBtn.setAttribute("aria-expanded", String(open)); });
      doc.addEventListener("click", function (e) { if (!e.target.closest("[data-vo-manager]")) closeMgr(); });
    }

    // --- cookie ---
    var cookie = doc.querySelector("[data-vo-cookie]");
    if (cookie) {
      var seen = false;
      try { seen = win.localStorage.getItem("vo-cookie") === "1"; } catch (e) {}
      if (!seen) cookie.hidden = false;
      var ok = cookie.querySelector("[data-vo-cookie-ok]");
      if (ok) ok.addEventListener("click", function () { cookie.hidden = true; try { win.localStorage.setItem("vo-cookie", "1"); } catch (e) {} });
    }

    // --- галерея ---
    var mainImg = doc.querySelector("[data-vo-gallery-main]");
    var mainLink = doc.querySelector("[data-vo-gallery-main-link]");
    $$("[data-vo-thumb]").forEach(function (t) {
      t.addEventListener("click", function () {
        if (mainImg) mainImg.src = t.getAttribute("data-vo-thumb");
        if (mainLink) mainLink.href = t.getAttribute("data-vo-orig");
        $$("[data-vo-thumb]").forEach(function (x) { x.classList.toggle("is-active", x === t); });
      });
    });

    // --- сортировка / фильтр наличия ---
    $$("[data-vo-sort]").forEach(function (sel) {
      sel.addEventListener("change", function () {
        var url = new win.URL(win.location.href);
        if (sel.value) url.searchParams.set("order", sel.value); else url.searchParams.delete("order");
        url.searchParams.delete("page");
        win.location.href = url.toString();
      });
    });
    $$("[data-vo-hide-na]").forEach(function (cb) {
      var key = "vo-hide-na";
      try { cb.checked = win.localStorage.getItem(key) === "1"; } catch (e) {}
      function apply() {
        $$(".ptable__row.is-unavailable, .pcard.is-unavailable").forEach(function (r) { r.hidden = cb.checked; });
        try { win.localStorage.setItem(key, cb.checked ? "1" : "0"); } catch (e) {}
      }
      cb.addEventListener("change", apply); apply();
    });

    // --- вид каталога: плитка / таблица ---
    (function () {
      var cur = "grid";
      try { cur = win.localStorage.getItem("vo-view") === "table" ? "table" : "grid"; } catch (e) {}
      $$("[data-vo-view]").forEach(function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-vo-view") === cur);
        b.setAttribute("aria-pressed", String(b.getAttribute("data-vo-view") === cur));
        b.addEventListener("click", function () {
          var v = b.getAttribute("data-vo-view");
          if (v === cur) return;
          try { win.localStorage.setItem("vo-view", v); } catch (e) {}
          win.location.reload();
        });
      });
    })();

    // --- раскрытие вариантов ---
    $$("[data-vo-expand]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-vo-expand");
        var open = b.getAttribute("aria-expanded") !== "true";
        b.setAttribute("aria-expanded", String(open));
        b.textContent = open ? "Скрыть" : "Выбрать";
        $$('[data-vo-sub="' + id + '"]').forEach(function (r) { r.hidden = !open; });
      });
    });

    // --- количество и суммы ---
    var inputs = function () { return $$("[data-vo-variant]"); };
    function rows() {
      return inputs().map(function (i) { return { id: i.getAttribute("data-vo-variant"), qty: i.value, price: i.getAttribute("data-vo-price"), el: i }; });
    }
    function refresh() {
      var rs = rows();
      rs.forEach(function (r) {
        var q = Math.max(0, Math.floor(toNum(r.qty)));
        r.el.classList.toggle("has-value", q > 0);
        var stock = toNum(r.el.getAttribute("data-vo-stock"));
        r.el.classList.toggle("is-over", stock > 0 && q > stock);
        r.el.title = stock > 0 && q > stock ? "На складе " + stock + " шт — менеджер уточнит срок поставки остатка" : "";
        $$('[data-vo-sum="' + r.id + '"]').forEach(function (c) { c.textContent = q > 0 ? formatRub(q * toNum(r.price)) : "—"; });
      });
      var sel = collect(rs);
      $$("[data-vo-sel-count]").forEach(function (e) { e.textContent = sel.count; });
      $$("[data-vo-sel-sum]").forEach(function (e) { e.textContent = formatRub(sel.sum); });
      $$("[data-vo-bulk-add]").forEach(function (b) {
        b.disabled = sel.count === 0;
        b.innerHTML = b.innerHTML.replace(/\s*\(\d+\)$/, "") + (sel.count ? " (" + sel.count + ")" : "");
      });
      renderMin(cartSum + sel.sum, sel.sum > 0);
      return sel;
    }
    function renderMin(total, withSelection) {
      var st = minState(total, minOrder);
      $$("[data-vo-minbar]").forEach(function (b) { b.hidden = !st.active; });
      $$("[data-vo-minfill]").forEach(function (f) { f.style.width = st.pct + "%"; f.classList.toggle("is-ok", st.reached); });
      $$("[data-vo-mintext]").forEach(function (t) {
        if (!st.active) return;
        t.innerHTML = st.reached
          ? "Минимальная сумма заказа достигнута"
          : "До минимального заказа " + (withSelection ? "(с выбранными) " : "") + "осталось <b>" + formatRub(st.left) + "</b>";
      });
      $$("[data-vo-checkout]").forEach(function (b) {
        b.classList.toggle("is-disabled", !st.reached);
        b.setAttribute("aria-disabled", st.reached ? "false" : "true");
      });
    }
    doc.addEventListener("click", function (e) {
      var step = e.target.closest && e.target.closest("[data-vo-step]");
      if (step) {
        var inp = step.parentNode.querySelector("[data-vo-variant]");
        if (inp) { inp.value = Math.max(0, Math.floor(toNum(inp.value)) + Number(step.getAttribute("data-vo-step"))); refresh(); }
      }
      var co = e.target.closest && e.target.closest("[data-vo-checkout]");
      if (co && co.getAttribute("aria-disabled") === "true") {
        e.preventDefault(); e.stopPropagation();
        toast("Минимальная сумма заказа — " + formatRub(minOrder) + ". Добавьте товары, чтобы оформить заказ.", true);
      }
    }, true);
    doc.addEventListener("input", function (e) { if (e.target.hasAttribute && e.target.hasAttribute("data-vo-variant")) refresh(); });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.hasAttribute && e.target.hasAttribute("data-vo-variant")) { e.preventDefault(); bulkAdd(); }
    });

    // --- добавление в корзину ---
    function setCartTotal(sum) {
      cartSum = toNum(sum);
      $$("[data-vo-cart-total]").forEach(function (e) { e.textContent = formatRub(cartSum); });
      refresh();
    }
    function addItems(items) {
      return new Promise(function (resolve, reject) {
        var body = Object.keys(items).map(function (id) { return "variant_ids[" + encodeURIComponent(id) + "]=" + encodeURIComponent(items[id]); }).join("&");
        var csrf = doc.querySelector('meta[name="csrf-token"]');
        win.fetch("/cart_items.json", {
          method: "POST", credentials: "same-origin",
          headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-CSRF-Token": csrf ? csrf.content : "" },
          body: body
        }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (data) {
          if (win.Cart && typeof win.Cart.forceUpdate === "function") { try { win.Cart.forceUpdate(); } catch (e) {} }
          resolve(data);
        }, reject);
      });
    }
    function fetchCart() {
      return win.fetch("/cart_items.json", { credentials: "same-origin", headers: { Accept: "application/json" } }).then(function (r) { return r.json(); });
    }
    var busy = false;
    function bulkAdd() {
      if (busy) return;
      var sel = collect(rows());
      if (!sel.count) return;
      busy = true;
      $$("[data-vo-bulk-add]").forEach(function (b) { b.disabled = true; });
      addItems(sel.items).then(function (data) {
        inputs().forEach(function (i) { i.value = 0; });
        var total = cartTotalOrNull(data);
        if (total !== null) setCartTotal(total); else fetchCart().then(function (c) { var t = cartTotalOrNull(c); if (t !== null) setCartTotal(t); }).catch(function () { refresh(); });
        toast("Добавлено позиций: " + sel.count + ". <a href=\"/cart_items\">Перейти в корзину</a>");
        if (win.ym && VO.metrika > 0) try { win.ym(VO.metrika, "reachGoal", "bulk_add"); } catch (e) {}
      }).catch(function () {
        toast("Не удалось добавить товары. Обновите страницу или свяжитесь с менеджером.", true);
      }).then(function () { busy = false; refresh(); });
    }
    $$("[data-vo-bulk-add]").forEach(function (b) { b.addEventListener("click", bulkAdd); });

    if (win.EventBus && win.EventBus.subscribe) {
      ["update_items:insales:cart", "delete_items:insales:cart", "add_items:insales:cart"].forEach(function (ev) {
        win.EventBus.subscribe(ev, function (data) { var t = cartTotalOrNull(data); if (t !== null && isFinite(t)) setCartTotal(t); });
      });
    }

    // --- повтор заказа ---
    $$("[data-vo-repeat]").forEach(function (b) {
      b.addEventListener("click", function () {
        b.disabled = true;
        var inline = b.getAttribute("data-vo-repeat-items");
        var p;
        if (inline) { try { p = Promise.resolve(JSON.parse(inline)); } catch (e) { p = Promise.resolve(null); } }
        else {
          p = win.fetch(b.getAttribute("data-vo-repeat") + ".json", { credentials: "same-origin", headers: { Accept: "application/json" } })
            .then(function (r) { return r.ok ? r.json() : null; }).then(orderToItems).catch(function () { return null; });
        }
        p.then(function (items) {
          if (!items || !Object.keys(items).length) { win.location.href = b.getAttribute("data-vo-repeat"); return; }
          return addItems(items).then(function () { win.location.href = "/cart_items"; });
        }).catch(function () {
          b.disabled = false;
          toast("Не удалось повторить заказ. Откройте заказ и добавьте товары вручную.", true);
        });
      });
    });

    // --- корзина в CSV ---
    $$("[data-vo-cart-csv]").forEach(function (b) {
      b.addEventListener("click", function () {
        var data = [["Артикул", "Наименование", "Цена", "Количество", "Сумма"]];
        $$("[data-vo-cart-line]").forEach(function (tr) {
          var q = tr.querySelector("input[name^='cart[quantity]']");
          var qty = q ? toNum(q.value) : 0, price = toNum(tr.getAttribute("data-price"));
          data.push([tr.getAttribute("data-sku") || "", tr.getAttribute("data-title") || "", price, qty, price * qty]);
        });
        var blob = new win.Blob([toCSV(data)], { type: "text/csv;charset=utf-8" });
        var a = doc.createElement("a");
        a.href = win.URL.createObjectURL(blob);
        a.download = "korzina-" + new Date().toISOString().slice(0, 10) + ".csv";
        doc.body.appendChild(a); a.click(); a.remove();
      });
    });

    // --- форма заявки: доп. поля → content ---
    $$("[data-vo-lead]").forEach(function (form) {
      var content = form.querySelector("[data-vo-content]");
      function sync() {
        var pairs = $$("[data-vo-extra]", form).map(function (f) { return [f.getAttribute("data-vo-extra"), f.value]; });
        pairs.unshift(["Тип обращения", form.getAttribute("data-vo-subject")]);
        if (content) content.value = composeContent(pairs);
      }
      form.addEventListener("input", sync);
      form.addEventListener("change", sync);
      form.addEventListener("submit", sync, true);
      sync();
    });

    refresh();
  }

  return { init: init, toNum: toNum, formatRub: formatRub, cartTotal: cartTotal, cartTotalOrNull: cartTotalOrNull, minState: minState, collect: collect, orderToItems: orderToItems, composeContent: composeContent, toCSV: toCSV };
});
