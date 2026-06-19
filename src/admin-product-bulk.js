import { supabase } from "./lib/supabase.js";
import { t } from "./i18n.js";
import { showToast, openModal, closeModal, initModal } from "./admin-ui.js";
import { fillCategorySelectWithUnchanged } from "./lib/admin-i18n.js";
import {
  fetchTags,
  renderProductTagPicker,
  getSelectedTagIdsFromContainer,
  syncProductTags,
  addProductTags,
  clearProductTags,
} from "./admin-tags.js";

const bulkBar = document.getElementById("productBulkBar");
const bulkCount = document.getElementById("productBulkCount");
const selectAll = document.getElementById("productSelectAll");
const editBtn = document.getElementById("productBulkEdit");
const deleteBtn = document.getElementById("productBulkDelete");
const clearBtn = document.getElementById("productBulkClear");

const bulkForm = document.getElementById("productBulkForm");
const bulkFormTitle = document.getElementById("productBulkFormTitle");
const bulkFormError = document.getElementById("productBulkFormError");
const bulkCategory = document.getElementById("productBulkCategory");
const bulkPrice = document.getElementById("productBulkPrice");
const bulkSalePrice = document.getElementById("productBulkSalePrice");
const bulkClearSalePrice = document.getElementById("productBulkClearSalePrice");
const bulkSku = document.getElementById("productBulkSku");
const bulkTagOptions = document.getElementById("productBulkTagOptions");
const bulkTagMode = document.getElementById("productBulkTagMode");
const bulkInStock = document.getElementById("productBulkInStock");
const bulkFeatured = document.getElementById("productBulkFeatured");
const bulkCancel = document.getElementById("productBulkCancel");

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

function showBulkError(message) {
  if (!bulkFormError) return;
  if (!message) {
    bulkFormError.hidden = true;
    bulkFormError.textContent = "";
    return;
  }
  bulkFormError.hidden = false;
  bulkFormError.textContent = message;
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
  for (const btn of [editBtn, deleteBtn]) {
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

function fillCategorySelect() {
  fillCategorySelectWithUnchanged(bulkCategory);
}

function resetBulkForm() {
  bulkForm?.reset();
  showBulkError("");
  if (bulkCategory) bulkCategory.value = "";
  if (bulkInStock) bulkInStock.value = "";
  if (bulkFeatured) bulkFeatured.value = "";
  if (bulkTagMode) bulkTagMode.value = "unchanged";
  if (bulkClearSalePrice) bulkClearSalePrice.checked = false;
  renderProductTagPicker(bulkTagOptions, [], "bulk_tag_ids");
}

async function openBulkEditModal() {
  const count = selectedIds.size;
  if (!count) return;

  await fetchTags();
  resetBulkForm();

  if (bulkFormTitle) {
    bulkFormTitle.textContent = tf("admin.products.bulk.editTitle", { count });
  }

  openModal("productBulkModal");
}

async function applyBulkEdit() {
  const ids = [...selectedIds];
  if (!ids.length) return;

  /** @type {Record<string, unknown>} */
  const payload = {};
  let hasProductChange = false;
  let hasTagChange = false;

  const category = bulkCategory?.value;
  if (category) {
    payload.category = category;
    hasProductChange = true;
  }

  const priceRaw = bulkPrice?.value.trim();
  if (priceRaw !== "") {
    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0) {
      showBulkError(t("admin.products.bulk.invalidPrice"));
      return;
    }
    payload.price = price;
    hasProductChange = true;
  }

  const saleRaw = bulkSalePrice?.value.trim();
  if (bulkClearSalePrice?.checked) {
    payload.sale_price = null;
    hasProductChange = true;
  } else if (saleRaw !== "") {
    const sale = Number(saleRaw);
    if (!Number.isFinite(sale) || sale < 0) {
      showBulkError(t("admin.products.bulk.invalidPrice"));
      return;
    }
    payload.sale_price = sale;
    hasProductChange = true;
  }

  const skuRaw = bulkSku?.value.trim();
  if (skuRaw !== "") {
    payload.sku = skuRaw;
    hasProductChange = true;
  }

  const inStock = bulkInStock?.value;
  if (inStock === "true" || inStock === "false") {
    payload.in_stock = inStock === "true";
    hasProductChange = true;
  }

  const featured = bulkFeatured?.value;
  if (featured === "true" || featured === "false") {
    payload.is_featured = featured === "true";
    hasProductChange = true;
  }

  const tagMode = bulkTagMode?.value || "unchanged";
  const tagIds = getSelectedTagIdsFromContainer(bulkTagOptions);
  if (tagMode !== "unchanged") hasTagChange = true;

  if (!hasProductChange && !hasTagChange) {
    showBulkError(t("admin.products.bulk.nothingToApply"));
    return;
  }

  const submitBtn = bulkForm?.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = t("admin.products.bulk.applying");
  }

  try {
    if (hasProductChange) {
      await bulkUpdate(ids, payload);
    }

    if (hasTagChange) {
      for (const productId of ids) {
        if (tagMode === "clear") {
          await clearProductTags(productId);
        } else if (tagMode === "add") {
          await addProductTags(productId, tagIds);
        } else if (tagMode === "replace") {
          await syncProductTags(productId, tagIds);
        }
      }
    }

    closeModal("productBulkModal");
    clearProductSelection();
    document.querySelectorAll(".product-bulk-check").forEach((input) => {
      input.checked = false;
    });
    await onUpdated?.();
    showToast(tf("admin.products.bulk.updated", { count: ids.length }), "success");
  } catch (err) {
    showBulkError(err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = t("admin.products.bulk.apply");
    }
  }
}

async function runDelete() {
  const ids = [...selectedIds];
  if (!ids.length) return;
  if (!confirm(tf("admin.products.bulk.deleteConfirm", { count: ids.length }))) return;

  try {
    await bulkDelete(ids);
    clearProductSelection();
    document.querySelectorAll(".product-bulk-check").forEach((input) => {
      input.checked = false;
    });
    await onUpdated?.();
    showToast(tf("admin.products.bulk.deleted", { count: ids.length }), "success");
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

/** @param {{ onUpdated: () => Promise<void> }} options */
export function initProductBulk(options) {
  onUpdated = options.onUpdated;
  fillCategorySelect();
  initModal("productBulkModal", { onClose: resetBulkForm });

  selectAll?.addEventListener("change", () => toggleVisible(selectAll.checked));
  editBtn?.addEventListener("click", () => openBulkEditModal());
  deleteBtn?.addEventListener("click", () => runDelete());
  clearBtn?.addEventListener("click", () => {
    clearProductSelection();
    document.querySelectorAll(".product-bulk-check").forEach((input) => {
      input.checked = false;
    });
    document.querySelectorAll(".admin-list__item--selected").forEach((item) => {
      item.classList.remove("admin-list__item--selected");
    });
  });

  bulkCancel?.addEventListener("click", () => closeModal("productBulkModal"));

  bulkForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    showBulkError("");
    applyBulkEdit();
  });
}

export function refreshProductBulkUi() {
  fillCategorySelect();
  updateBulkBar();
  renderProductTagPicker(
    bulkTagOptions,
    getSelectedTagIdsFromContainer(bulkTagOptions),
    "bulk_tag_ids"
  );
  if (bulkFormTitle && selectedIds.size) {
    bulkFormTitle.textContent = tf("admin.products.bulk.editTitle", { count: selectedIds.size });
  }
}
