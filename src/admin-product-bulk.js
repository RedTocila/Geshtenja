import { supabase } from "./lib/supabase.js";
import { t, categoryLabel } from "./i18n.js";
import { showToast } from "./admin-ui.js";
import { PRODUCT_CATEGORIES } from "./lib/product-import.js";

const bulkBar = document.getElementById("productBulkBar");
const bulkCount = document.getElementById("productBulkCount");
const selectAll = document.getElementById("productSelectAll");
const bulkCategory = document.getElementById("productBulkCategory");
const applyCategoryBtn = document.getElementById("productBulkApplyCategory");
const inStockBtn = document.getElementById("productBulkInStock");
const outStockBtn = document.getElementById("productBulkOutStock");
const featuredBtn = document.getElementById("productBulkFeatured");
const unfeaturedBtn = document.getElementById("productBulkUnfeatured");
const deleteBtn = document.getElementById("productBulkDelete");
const clearBtn = document.getElementById("productBulkClear");

/** @type {Set<string>} */
const selectedIds = new Set();

/** @type {string[]} */
let visibleIds = [];

/** @type {(() => Promise<void>) | null} */
let onUpdated = null;

/** @param {string} key @param {Record<string, string | number>} [vars] */
function tf(key, vars = {}) {
  let str = t(key);
  for (const [k, v] of Object.entries(vars)) {
    str = str.replaceAll(`{${k}}`, String(v));
  }
  return str;
}

export function isProductSelected(id) {
  return selectedIds.has(id);
}

export function productBulkCheckboxHtml(id) {
  const checked = selectedIds.has(id) ? "checked" : "";
  return `<label class="admin-list__check" data-bulk-check-wrap>
    <input type="checkbox" class="admin-check admin-list__check-input product-bulk-check" data-product-id="${id}" ${checked} aria-label="${t("admin.products.bulk.selectItem")}" />
  </label>`;
}

function updateBulkBar() {
  const count = selectedIds.size;
  if (bulkBar) bulkBar.hidden = visibleIds.length === 0;
  if (bulkCount) bulkCount.textContent = tf("admin.products.bulk.selected", { count });

  const disabled = count === 0;
  for (const btn of [applyCategoryBtn, inStockBtn, outStockBtn, featuredBtn, unfeaturedBtn, deleteBtn]) {
    if (btn) btn.disabled = disabled;
  }

  if (selectAll && visibleIds.length) {
    const allVisible = visibleIds.every((id) => selectedIds.has(id));
    const someVisible = visibleIds.some((id) => selectedIds.has(id));
    selectAll.checked = allVisible;
    selectAll.indeterminate = !allVisible && someVisible;
  } else if (selectAll) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
  }
}

export function clearProductSelection() {
  selectedIds.clear();
  updateBulkBar();
}

function toggleVisible(checked) {
  for (const id of visibleIds) {
    if (checked) selectedIds.add(id);
    else selectedIds.delete(id);
  }
  updateBulkBar();
  document.querySelectorAll(".product-bulk-check").forEach((input) => {
    const id = input.dataset.productId;
    if (visibleIds.includes(id)) input.checked = checked;
  });
}

/** @param {string[]} ids @param {Record<string, unknown>} payload */
async function bulkUpdate(ids, payload) {
  const { error } = await supabase
    .from("products")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
}

/** @param {string[]} ids */
async function bulkDelete(ids) {
  const { error } = await supabase.from("products").delete().in("id", ids);
  if (error) throw error;
}

async function runBulkAction(action) {
  const ids = [...selectedIds];
  if (!ids.length) return;

  try {
    switch (action) {
      case "category": {
        const category = bulkCategory?.value;
        if (!category) return;
        await bulkUpdate(ids, { category });
        showToast(tf("admin.products.bulk.updated", { count: ids.length }), "success");
        break;
      }
      case "in_stock":
        await bulkUpdate(ids, { in_stock: true });
        showToast(tf("admin.products.bulk.updated", { count: ids.length }), "success");
        break;
      case "out_stock":
        await bulkUpdate(ids, { in_stock: false });
        showToast(tf("admin.products.bulk.updated", { count: ids.length }), "success");
        break;
      case "featured":
        await bulkUpdate(ids, { is_featured: true });
        showToast(tf("admin.products.bulk.updated", { count: ids.length }), "success");
        break;
      case "unfeatured":
        await bulkUpdate(ids, { is_featured: false });
        showToast(tf("admin.products.bulk.updated", { count: ids.length }), "success");
        break;
      case "delete":
        if (!confirm(tf("admin.products.bulk.deleteConfirm", { count: ids.length }))) return;
        await bulkDelete(ids);
        showToast(tf("admin.products.bulk.deleted", { count: ids.length }), "success");
        break;
      default:
        return;
    }

    clearProductSelection();
    await onUpdated?.();
  } catch (err) {
    showToast(err.message, "error");
  }
}

/**
 * @param {HTMLElement} list
 * @param {string[]} ids
 */
export function bindProductListBulk(list, ids) {
  visibleIds = ids;
  updateBulkBar();

  list.querySelectorAll(".product-bulk-check").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.dataset.productId;
      if (!id) return;
      if (input.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      input.closest(".admin-list__item")?.classList.toggle("admin-list__item--selected", input.checked);
      updateBulkBar();
    });
  });

  list.querySelectorAll(".admin-list__item").forEach((item) => {
    item.classList.toggle("admin-list__item--selected", selectedIds.has(item.dataset.id));
  });
}

function fillCategorySelect() {
  if (!bulkCategory) return;
  bulkCategory.innerHTML = PRODUCT_CATEGORIES.map(
    (c) => `<option value="${c}">${categoryLabel(c)}</option>`
  ).join("");
}

/** @param {{ onUpdated: () => Promise<void> }} options */
export function initProductBulk(options) {
  onUpdated = options.onUpdated;
  fillCategorySelect();

  selectAll?.addEventListener("change", () => toggleVisible(selectAll.checked));
  applyCategoryBtn?.addEventListener("click", () => runBulkAction("category"));
  inStockBtn?.addEventListener("click", () => runBulkAction("in_stock"));
  outStockBtn?.addEventListener("click", () => runBulkAction("out_stock"));
  featuredBtn?.addEventListener("click", () => runBulkAction("featured"));
  unfeaturedBtn?.addEventListener("click", () => runBulkAction("unfeatured"));
  deleteBtn?.addEventListener("click", () => runBulkAction("delete"));
  clearBtn?.addEventListener("click", () => {
    clearProductSelection();
    document.querySelectorAll(".product-bulk-check").forEach((input) => {
      input.checked = false;
    });
  });
}

export function refreshProductBulkUi() {
  fillCategorySelect();
  updateBulkBar();
}
