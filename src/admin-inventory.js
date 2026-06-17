import { supabase } from "./lib/supabase.js";
import { t, categoryLabel } from "./i18n.js";
import { showToast, showEmpty } from "./admin-ui.js";
import { getTags, productMatchesFilters } from "./admin-tags.js";

/** @type {import("./lib/products.js").StoreProduct[]} */
let inventoryProducts = [];
let inventoryFilterTag = "";
/** @type {"all" | "low" | "out"} */
let inventoryStockFilter = "all";

const CATEGORY_TAG_SLUGS = new Set(["pendant", "sconce", "chandelier", "floor", "office"]);

function tagLabel(tag) {
  return CATEGORY_TAG_SLUGS.has(tag.slug) ? categoryLabel(tag.slug) : tag.name;
}

function stockStatus(product) {
  const qty = Number(product.stock_quantity) || 0;
  if (!product.in_stock || qty <= 0) return "out";
  if (qty <= 5) return "low";
  return "in";
}

function stockCounts(products) {
  let low = 0;
  let out = 0;
  for (const p of products) {
    const status = stockStatus(p);
    if (status === "low") low++;
    else if (status === "out") out++;
  }
  return { all: products.length, low, out };
}

function renderClickableCategoryTag(tagId, label) {
  const active = inventoryFilterTag === tagId ? " is-active" : "";
  return `<button type="button" class="admin-tag admin-tag--clickable${active}" data-inventory-tag="${tagId}">${label}</button>`;
}

function renderClickableStockTag(filter, label, count) {
  const active = inventoryStockFilter === filter ? " is-active" : "";
  const tone =
    filter === "low" ? " admin-tag--stock-low" : filter === "out" ? " admin-tag--stock-out" : " admin-tag--stock-all";
  return `<button type="button" class="admin-tag admin-tag--clickable admin-tag--stock${tone}${active}" data-inventory-stock="${filter}">${label} <span class="admin-tag__count">${count}</span></button>`;
}

function renderRowTags(tags) {
  if (!tags?.length) return `<span class="admin-muted">${t("admin.inventory.noTags")}</span>`;
  return `<div class="admin-tags admin-tags--inline">${tags.map((tag) => renderClickableCategoryTag(tag.id, tagLabel(tag))).join("")}</div>`;
}

function setInventoryTagFilter(tagId) {
  inventoryFilterTag = tagId;
  renderInventoryTagFilters();
  renderInventory();
}

function setInventoryStockFilter(filter) {
  inventoryStockFilter = filter;
  renderInventoryTagFilters();
  renderInventory();
}

function matchesInventoryFilters(product, { search, tagId }) {
  if (!productMatchesFilters(product, { search, tagId })) return false;
  if (inventoryStockFilter === "all") return true;
  return stockStatus(product) === inventoryStockFilter;
}

export function renderInventoryTagFilters() {
  const el = document.getElementById("inventoryTagFilters");
  if (!el) return;

  const tags = getTags();
  const counts = stockCounts(inventoryProducts);

  if (!inventoryProducts.length && !tags.length) {
    el.innerHTML = "";
    el.hidden = true;
    return;
  }

  el.hidden = false;
  const categoryTags = tags
    .map((tag) => renderClickableCategoryTag(tag.id, tagLabel(tag)))
    .join("");
  const categorySection =
    categoryTags.length > 0
      ? `<span class="admin-inventory-tag-divider" aria-hidden="true"></span>${categoryTags}`
      : "";

  el.innerHTML = `
    ${renderClickableStockTag("all", t("admin.inventory.totalProducts"), counts.all)}
    ${renderClickableStockTag("low", t("admin.inventory.lowStock"), counts.low)}
    ${renderClickableStockTag("out", t("admin.inventory.outOfStock"), counts.out)}
    ${categorySection}
  `;
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

    renderInventoryTagFilters();
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

  renderInventoryTagFilters();

  const tableWrap = document.getElementById("inventoryTableWrap");
  const tbody = document.getElementById("inventoryList");
  const emptyEl = document.getElementById("inventoryEmpty");
  if (!tableWrap || !tbody || !emptyEl) return;

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

  const search = document.getElementById("inventorySearch")?.value || "";
  const filtered = inventoryProducts.filter((p) =>
    matchesInventoryFilters(p, { search, tagId: inventoryFilterTag })
  );

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
      const tags = (p.product_tags || []).map((row) => row.tag).filter(Boolean);
      return `
      <tr data-inventory-id="${p.id}">
        <td>
          <div class="admin-inventory-product">
            <img class="admin-list__thumb" src="${p.image_url}" alt="" />
            <span class="admin-inventory-product__name">${p.name}</span>
          </div>
        </td>
        <td><code class="admin-inventory-code">${code || t("admin.inventory.noCode")}</code></td>
        <td class="admin-inventory-tags">${renderRowTags(tags)}</td>
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

  document.getElementById("inventoryTagFilters")?.addEventListener("click", (e) => {
    const stockBtn = e.target.closest("[data-inventory-stock]");
    if (stockBtn) {
      setInventoryStockFilter(stockBtn.dataset.inventoryStock);
      return;
    }
    const tagBtn = e.target.closest("[data-inventory-tag]");
    if (!tagBtn) return;
    const tagId = tagBtn.dataset.inventoryTag || "";
    setInventoryTagFilter(inventoryFilterTag === tagId ? "" : tagId);
  });

  document.getElementById("inventoryList")?.addEventListener("click", async (e) => {
    const tagBtn = e.target.closest("[data-inventory-tag]");
    if (tagBtn) {
      const tagId = tagBtn.dataset.inventoryTag || "";
      setInventoryTagFilter(inventoryFilterTag === tagId ? "" : tagId);
      return;
    }

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
