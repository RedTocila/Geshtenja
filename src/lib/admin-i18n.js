import { t, categoryLabel } from "../i18n.js";
import { PRODUCT_CATEGORIES } from "./product-import.js";

/** @param {HTMLElement | null} el @param {string} key */
export function setAdminTitle(el, key) {
  if (!el) return;
  el.dataset.i18n = key;
  el.textContent = t(key);
}

/** @param {HTMLSelectElement | null} select @param {string} [value] */
export function fillCategorySelect(select, value) {
  if (!select) return;
  const current = value ?? select.value;
  select.innerHTML = PRODUCT_CATEGORIES.map(
    (category) => `<option value="${category}">${categoryLabel(category)}</option>`
  ).join("");
  if (current) select.value = current;
}

/** @param {HTMLSelectElement | null} select */
export function fillCategorySelectWithUnchanged(select) {
  if (!select) return;
  const current = select.value;
  const unchanged = `<option value="">${t("admin.products.bulk.keepUnchanged")}</option>`;
  const options = PRODUCT_CATEGORIES.map(
    (category) => `<option value="${category}">${categoryLabel(category)}</option>`
  ).join("");
  select.innerHTML = unchanged + options;
  select.value = current;
}

export function refreshAdminFileLabels() {
  document.querySelectorAll(".admin-file__input").forEach((input) => {
    const wrap = input.closest(".admin-file");
    const nameEl = wrap?.querySelector("[data-file-name]");
    if (!nameEl) return;
    if (!input.files?.length) {
      nameEl.textContent = input.multiple ? t("admin.common.noFiles") : t("admin.common.noFile");
    }
  });

  document.querySelectorAll(".admin-file__btn").forEach((btn) => {
    const input = document.getElementById(btn.getAttribute("for") || "");
    if (!input) return;
    btn.textContent = input.multiple ? t("admin.common.chooseFiles") : t("admin.common.chooseFile");
  });
}
