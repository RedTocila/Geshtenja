import {
  fetchOrders,
  updateOrderStatus,
  deleteOrder,
  orderMetrics,
  filterOrdersBySearch,
  notifyOrderEmail,
} from "./lib/orders.js";
import { formatPrice } from "./lib/format.js";
import { t } from "./i18n.js";
import { showToast, showLoading, showEmpty } from "./admin-ui.js";

const STATUS_OPTIONS = ["pending", "confirmed", "processing", "delivered", "cancelled"];

const ORDER_TAB_STATUSES = {
  pending: ["pending", "confirmed", "processing"],
  completed: ["delivered"],
  cancelled: ["cancelled"],
};

let allOrders = [];
let revenuePeriod = "1d";
let activeOrderTab = "pending";

function statusLabel(status) {
  return t(`admin.orders.status.${status}`) || status;
}

function orderTabTitle(tab) {
  return t(`admin.orders.tabs.${tab}.title`);
}

function orderEmptyState(tab, hasQuery) {
  if (hasQuery) {
    return { icon: "⌕", title: t("admin.orders.noMatch.title"), hint: t("admin.orders.noMatch.hint") };
  }
  return {
    icon: tab === "completed" ? "✓" : tab === "cancelled" ? "×" : "◎",
    title: t(`admin.orders.empty.${tab}.title`),
    hint: t(`admin.orders.empty.${tab}.hint`),
  };
}

function statusBadge(status) {
  return `<span class="admin-badge admin-badge--${status}">${statusLabel(status)}</span>`;
}

function renderMetrics() {
  const el = document.getElementById("orderMetrics");
  if (!el) return;

  const m = orderMetrics(allOrders, revenuePeriod);
  el.innerHTML = `
    <div class="admin-metric admin-metric--revenue">
      <strong>${formatPrice(m.totalRevenue)}</strong>
      <span>${t("admin.orders.revenue")} · ${t(`admin.orders.periods.${revenuePeriod}`)}</span>
    </div>
    <div class="admin-metric">
      <strong>${m.totalOrders}</strong>
      <span>Orders in period</span>
    </div>
    <div class="admin-metric admin-metric--highlight">
      <strong>${m.pendingOrders}</strong>
      <span>Pending (active)</span>
    </div>
    <div class="admin-metric">
      <strong>${m.completedOrders}</strong>
      <span>Completed (all time)</span>
    </div>
    <div class="admin-metric">
      <strong>${m.cancelledOrders}</strong>
      <span>Cancelled (all time)</span>
    </div>
  `;
}

function updateOrderTabCounts() {
  const query = document.getElementById("orderSearch")?.value || "";
  const searched = filterOrdersBySearch(allOrders, query);

  const counts = {
    pending: searched.filter((o) => ORDER_TAB_STATUSES.pending.includes(o.status)).length,
    completed: searched.filter((o) => ORDER_TAB_STATUSES.completed.includes(o.status)).length,
    cancelled: searched.filter((o) => ORDER_TAB_STATUSES.cancelled.includes(o.status)).length,
  };

  document.getElementById("orderTabCountPending").textContent = String(counts.pending);
  document.getElementById("orderTabCountCompleted").textContent = String(counts.completed);
  document.getElementById("orderTabCountCancelled").textContent = String(counts.cancelled);
}

export async function loadOrderMetrics() {
  const el = document.getElementById("orderMetrics");
  const list = document.getElementById("orderList");
  if (!el) return;

  if (list) showLoading(list, t("admin.orders.loading"));

  try {
    allOrders = await fetchOrders();
    renderMetrics();
    updateOrderTabCounts();
    renderOrderList();
  } catch (err) {
    el.innerHTML = `<p class="admin-error">${err.message}</p>`;
    if (list) {
      showEmpty(list, {
        icon: "!",
        title: t("admin.orders.loadError"),
        hint: err.message,
      });
    }
  }
}

async function setOrderStatus(orderId, status) {
  const order = allOrders.find((o) => o.id === orderId);
  const previousStatus = order?.status;

  await updateOrderStatus(orderId, status);

  if (status === "cancelled" && previousStatus !== "cancelled" && order) {
    await notifyOrderEmail(order, "cancelled");
  }

  await loadOrderMetrics();
  showToast(t("admin.orders.statusUpdated"), "success");
}

function fulfillButton(order) {
  if (order.status === "pending" || order.status === "confirmed") {
    return `<button type="button" class="admin-btn admin-btn--primary admin-btn--small" data-fulfill-order="${order.id}">Complete &amp; send for delivery</button>`;
  }
  if (order.status === "processing") {
    return `<button type="button" class="admin-btn admin-btn--primary admin-btn--small" data-deliver-order="${order.id}">Mark as delivered</button>`;
  }
  return "";
}

function renderOrderRow(order) {
  const highlight = order.status === "pending" ? " admin-list__item--pending" : "";
  return `
    <li class="admin-list__item${highlight}" data-id="${order.id}">
      <div class="admin-list__info">
        <p class="admin-list__title">${order.order_number}</p>
        <p class="admin-list__meta">${order.customer_name} · ${formatPrice(order.total)} · ${new Date(order.created_at).toLocaleString()}</p>
      </div>
      ${statusBadge(order.status)}
      <div class="admin-list__actions">
        ${fulfillButton(order)}
        <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-view-order="${order.id}">${t("admin.common.view")}</button>
        <button type="button" class="admin-btn admin-btn--danger admin-btn--small" data-delete-order="${order.id}">${t("admin.common.delete")}</button>
      </div>
    </li>`;
}

function renderOrderList() {
  const list = document.getElementById("orderList");
  const title = document.getElementById("orderListTitle");
  if (!list || !title) return;

  const statuses = ORDER_TAB_STATUSES[activeOrderTab];
  const query = document.getElementById("orderSearch")?.value || "";
  const searched = filterOrdersBySearch(allOrders, query);
  const orders = searched.filter((o) => statuses.includes(o.status));

  title.textContent = orderTabTitle(activeOrderTab);
  title.dataset.i18n = `admin.orders.tabs.${activeOrderTab}.title`;
  updateOrderTabCounts();

  list.innerHTML = orders.length
    ? orders.map(renderOrderRow).join("")
    : "";

  if (!orders.length) {
    showEmpty(list, orderEmptyState(activeOrderTab, Boolean(query.trim())));
  }

  bindOrderListEvents(list);
}

function bindOrderListEvents(root) {
  root.querySelectorAll("[data-view-order]").forEach((btn) => {
    btn.addEventListener("click", () => openOrderModal(btn.dataset.viewOrder));
  });

  root.querySelectorAll("[data-fulfill-order]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Mark this order as complete and send it out for delivery?")) return;
      await setOrderStatus(btn.dataset.fulfillOrder, "processing");
    });
  });

  root.querySelectorAll("[data-deliver-order]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Mark this order as delivered to the customer?")) return;
      await setOrderStatus(btn.dataset.deliverOrder, "delivered");
    });
  });

  root.querySelectorAll("[data-delete-order]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this order permanently?")) return;
      await deleteOrder(btn.dataset.deleteOrder);
      await loadOrderMetrics();
      showToast(t("admin.orders.deleted"), "success");
    });
  });
}

function modalActions(order) {
  if (order.status === "pending" || order.status === "confirmed") {
    return `<button type="button" class="admin-btn admin-btn--primary" id="fulfillOrderBtn">Complete &amp; send for delivery</button>`;
  }
  if (order.status === "processing") {
    return `<button type="button" class="admin-btn admin-btn--primary" id="deliverOrderBtn">Mark as delivered</button>`;
  }
  return "";
}

function closeOrderModal(modal) {
  modal.classList.remove("is-open");
  document.removeEventListener("keydown", modal._escHandler);
}

function openOrderModal(id) {
  const order = allOrders.find((o) => o.id === id);
  if (!order) return;

  let modal = document.getElementById("orderModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "orderModal";
    modal.className = "admin-modal";
    modal.innerHTML = `<div class="admin-modal__backdrop"></div><div class="admin-modal__card" id="orderModalCard"></div>`;
    document.body.appendChild(modal);
    modal.querySelector(".admin-modal__backdrop").addEventListener("click", () => closeOrderModal(modal));
  }

  modal._escHandler = (e) => {
    if (e.key === "Escape") closeOrderModal(modal);
  };

  const items = (order.order_items || [])
    .map(
      (i) =>
        `<tr><td>${i.product_name}</td><td>${i.quantity}</td><td>${formatPrice(i.unit_price)}</td><td>${formatPrice(i.line_total)}</td></tr>`
    )
    .join("");

  document.getElementById("orderModalCard").innerHTML = `
    <div class="admin-order-modal__header">
      <div class="admin-order-modal__title">
        <h2>${order.order_number}</h2>
        <p class="admin-muted">${new Date(order.created_at).toLocaleString()}</p>
      </div>
      <div class="admin-order-modal__header-actions">
        ${statusBadge(order.status)}
        <button type="button" class="admin-modal__close" id="closeOrderModal" aria-label="Close order details">×</button>
      </div>
    </div>
    <div class="admin-order-modal__customer admin-muted">
      <strong>${order.customer_name}</strong><br/>
      ${order.customer_phone}<br/>
      ${order.customer_email}<br/>
      ${order.customer_city}, ${order.customer_address}
      ${order.notes ? `<br/><em>${order.notes}</em>` : ""}
    </div>
    <table class="admin-table">
      <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
      <tbody>${items}</tbody>
    </table>
    <p class="admin-order-modal__total">Total: ${formatPrice(order.total)} · Cash on Delivery</p>
    <div class="admin-order-modal__actions">
      ${modalActions(order)}
      <label class="admin-form admin-order-modal__status">
        <span>Change status</span>
        <select id="orderStatusSelect" class="admin-select">${STATUS_OPTIONS.map((s) => `<option value="${s}"${s === order.status ? " selected" : ""}>${statusLabel(s)}</option>`).join("")}</select>
      </label>
      <button type="button" class="admin-btn admin-btn--ghost" id="saveOrderStatus">Update status</button>
    </div>
  `;

  modal.classList.add("is-open");
  document.addEventListener("keydown", modal._escHandler);
  document.getElementById("closeOrderModal").onclick = () => closeOrderModal(modal);

  document.getElementById("fulfillOrderBtn")?.addEventListener("click", async () => {
    await setOrderStatus(order.id, "processing");
    closeOrderModal(modal);
  });

  document.getElementById("deliverOrderBtn")?.addEventListener("click", async () => {
    await setOrderStatus(order.id, "delivered");
    closeOrderModal(modal);
  });

  document.getElementById("saveOrderStatus").onclick = async () => {
    const status = document.getElementById("orderStatusSelect").value;
    await setOrderStatus(order.id, status);
    closeOrderModal(modal);
  };

  document.getElementById("closeOrderModal").focus();
}

export function refreshOrdersUi() {
  if (!allOrders.length && !document.getElementById("orderMetrics")?.querySelector(".admin-metric")) return;
  renderMetrics();
  updateOrderTabCounts();
  renderOrderList();
}

export function initOrdersTab() {
  document.getElementById("orderSearch")?.addEventListener("input", renderOrderList);

  document.getElementById("revenuePeriodTabs")?.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-period]");
    if (!tab) return;
    revenuePeriod = tab.dataset.period;
    document.querySelectorAll("#revenuePeriodTabs .admin-pill-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.period === revenuePeriod);
    });
    renderMetrics();
  });

  document.getElementById("orderStatusTabs")?.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-order-tab]");
    if (!tab) return;
    activeOrderTab = tab.dataset.orderTab;
    document.querySelectorAll("#orderStatusTabs .admin-pill-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.orderTab === activeOrderTab);
    });
    renderOrderList();
  });
}
