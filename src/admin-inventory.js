import { supabase } from "./lib/supabase.js";
import { t, categoryLabel } from "./i18n.js";
import { showToast, showEmpty } from "./admin-ui.js";

/** @type {import("./lib/products.js").StoreProduct[]} */
let inventoryProducts = [];

function filterInventory(products, query) {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products.filter(
    (p) =>
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      categoryLabel(p.category).toLowerCase().includes(q)
  );
}

function stockStatus(product) {
  const qty = Number(product.stock_quantity) || 0;
  if (!product.in_stock || qty <= 0) return "out";
  if (qty <= 5) return "low";
  return "in";
}

function statusBadge(product) {
  const status = stockStatus(product);
  const label =
    status === "out"
      ? t("admin.inventory.statusOut")
      : status === "low"
        ? t("admin.inventory.statusLow")
        : t("admin.inventory.statusIn");
  return `<span class="admin-badge admin-badge--stock-${status}">${label}</span>`;
}

function renderSummary(products) {
  const el = document.getElementById("inventorySummary");
  if (!el) return;

  const total = products.length;
  const outOfStock = products.filter((p) => stockStatus(p) === "out").length;
  const lowStock = products.filter((p) => stockStatus(p) === "low").length;

  el.innerHTML = `
    <div class="admin-inventory-metric">
      <strong>${total}</strong>
      <span>${t("admin.inventory.totalProducts")}</span>
    </div>
    <div class="admin-inventory-metric admin-inventory-metric--warn">
      <strong>${lowStock}</strong>
      <span>${t("admin.inventory.lowStock")}</span>
    </div>
    <div class="admin-inventory-metric admin-inventory-metric--bad">
      <strong>${outOfStock}</strong>
      <span>${t("admin.inventory.outOfStock")}</span>
    </div>
  `;
}

function getRowQuantity(row) {
  const input = row.querySelector("[data-stock-input]");
  return Math.max(0, Number(input?.value) || 0);
}

async function persistStock(productId, quantity, row) {
  const saveBtn = row?.querySelector("[data-stock-save]");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = t("admin.inventory.saving");
  }

  try {
    const qty = Math.max(0, Number(quantity) || 0);
    const { error } = await supabase
      .from("products")
      .update({ stock_quantity: qty, in_stock: qty > 0 })
      .eq("id", productId);

    if (error) throw error;

    const item = inventoryProducts.find((p) => p.id === productId);
    if (item) {
      item.stock_quantity = qty;
      item.in_stock = qty > 0;
    }

    if (row) {
      const statusCell = row.querySelector("[data-stock-status]");
      if (statusCell && item) statusCell.innerHTML = statusBadge(item);
    }

    renderSummary(inventoryProducts);
    showToast(t("admin.inventory.updated"), "success");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = t("admin.inventory.save");
    }
  }
}

/** @param {import("./lib/products.js").StoreProduct[]} [products] */
export function renderInventory(products) {
  if (products) inventoryProducts = products;

  const tableWrap = document.getElementById("inventoryTableWrap");
  const tbody = document.getElementById("inventoryList");
  const emptyEl = document.getElementById("inventoryEmpty");
  if (!tableWrap || !tbody || !emptyEl) return;

  renderSummary(inventoryProducts);

  if (!inventoryProducts.length) {
    tableWrap.hidden = true;
    emptyEl.hidden = false;
    showEmpty(emptyEl, {
      icon: "▤",
      title: t("admin.inventory.emptyTitle"),
      hint: t("admin.inventory.emptyHint"),
    });
    return;
  }

  const query = document.getElementById("inventorySearch")?.value || "";
  const filtered = filterInventory(inventoryProducts, query);

  if (!filtered.length) {
    tableWrap.hidden = true;
    emptyEl.hidden = false;
    showEmpty(emptyEl, {
      icon: "⌕",
      title: t("admin.inventory.noMatchTitle"),
      hint: t("admin.inventory.noMatchHint"),
    });
    return;
  }

  tableWrap.hidden = false;
  emptyEl.hidden = true;

  tbody.innerHTML = filtered
    .map((p) => {
      const qty = Number(p.stock_quantity) || 0;
      const code = p.sku?.trim() || "";
      return `
      <tr data-inventory-id="${p.id}">
        <td>
          <div class="admin-inventory-product">
            <img class="admin-list__thumb" src="${p.image_url}" alt="" />
            <span class="admin-inventory-product__name">${p.name}</span>
          </div>
        </td>
        <td><code class="admin-inventory-code">${code || t("admin.inventory.noCode")}</code></td>
        <td>${categoryLabel(p.category)}</td>
        <td data-stock-status>${statusBadge(p)}</td>
        <td>
          <input
            class="admin-inventory-qty"
            type="number"
            min="0"
            step="1"
            value="${qty}"
            data-stock-input
            aria-label="${t("admin.inventory.stockAria")} ${p.name}"
          />
        </td>
        <td>
          <div class="admin-stock-control">
            <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-stock-delta="-1" aria-label="${t("admin.inventory.removeOne")}">−</button>
            <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-stock-delta="-5" aria-label="${t("admin.inventory.removeFive")}">−5</button>
            <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-stock-delta="5" aria-label="${t("admin.inventory.addFive")}">+5</button>
            <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-stock-delta="1" aria-label="${t("admin.inventory.addOne")}">+</button>
            <button type="button" class="admin-btn admin-btn--primary admin-btn--small" data-stock-save>${t("admin.inventory.save")}</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

export function initInventoryTab() {
  document.getElementById("inventorySearch")?.addEventListener("input", () => renderInventory());

  document.getElementById("inventoryList")?.addEventListener("click", async (e) => {
    const row = e.target.closest("tr[data-inventory-id]");
    if (!row) return;
    const productId = row.dataset.inventoryId;

    const deltaBtn = e.target.closest("[data-stock-delta]");
    if (deltaBtn) {
      const input = row.querySelector("[data-stock-input]");
      const delta = Number(deltaBtn.dataset.stockDelta) || 0;
      const next = Math.max(0, getRowQuantity(row) + delta);
      if (input) input.value = String(next);
      await persistStock(productId, next, row);
      return;
    }

    if (e.target.closest("[data-stock-save]")) {
      await persistStock(productId, getRowQuantity(row), row);
    }
  });

  document.getElementById("inventoryList")?.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter" || !e.target.matches("[data-stock-input]")) return;
    const row = e.target.closest("tr[data-inventory-id]");
    if (!row) return;
    e.preventDefault();
    await persistStock(row.dataset.inventoryId, getRowQuantity(row), row);
  });
}
