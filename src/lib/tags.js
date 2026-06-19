import { supabase, isSupabaseConfigured } from "./supabase.js";
import { categoryLabel, t } from "../i18n.js";
import { PRODUCT_CATEGORIES } from "./product-categories.js";

const CATEGORY_TAG_SLUGS = new Set(PRODUCT_CATEGORIES);

/** @typedef {{ id: string, name: string, slug: string }} StoreTag */

/** @param {{ name: string, slug: string }} tag */
export function tagDisplayName(tag) {
  if (CATEGORY_TAG_SLUGS.has(tag.slug)) return categoryLabel(tag.slug);
  return tag.name;
}

/** @param {{ product_tags?: { tag?: StoreTag | null }[] }} product */
export function extractProductTags(product) {
  return (product.product_tags || []).map((row) => row.tag).filter(Boolean);
}

/** @param {{ product_tags?: { tag?: StoreTag | null }[], category?: string }} product @param {string} tagId */
export function productHasTag(product, tagId) {
  if (!tagId || tagId === "all") return true;

  const tags = extractProductTags(product);
  if (tags.some((tag) => tag.id === tagId || tag.slug === tagId)) return true;
  if (!tags.length && product.category === tagId) return true;

  return false;
}

/** @param {StoreTag[]} tags @param {import("../data/fallback.js").StoreProduct[]} products */
function tagsUsedByProducts(tags, products) {
  return tags.filter((tag) => products.some((product) => productHasTag(product, tag.id)));
}

/** @param {import("../data/fallback.js").StoreProduct[]} products */
function fallbackStoreTags(products) {
  const slugs = new Set(products.map((product) => product.category).filter(Boolean));
  for (const slug of PRODUCT_CATEGORIES) {
    if (products.some((product) => product.category === slug)) slugs.add(slug);
  }
  return [...slugs].map((slug) => ({ id: slug, name: categoryLabel(slug), slug }));
}

/** @param {import("../data/fallback.js").StoreProduct[]} [products] @param {{ all?: boolean }} [opts] @returns {Promise<StoreTag[]>} */
export async function fetchStoreTags(products = [], { all = false } = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return fallbackStoreTags(products);
  }

  const { data: tags, error } = await supabase.from("tags").select("id, name, slug").order("name");
  if (error?.code === "PGRST205" || error || !tags?.length) {
    return fallbackStoreTags(products);
  }

  return all ? tags : tagsUsedByProducts(tags, products);
}

/** @param {{ product_tags?: { tag?: StoreTag | null }[], category?: string }} product */
export function renderProductTagsHtml(product, className = "product-card__category") {
  const tags = extractProductTags(product);
  if (tags.length) {
    return tags.map((tag) => `<span class="${className}">${tagDisplayName(tag)}</span>`).join("");
  }
  if (product.category) {
    return `<span class="${className}">${categoryLabel(product.category)}</span>`;
  }
  return "";
}

/**
 * @param {HTMLElement | null} container
 * @param {StoreTag[]} tags
 * @param {string} activeId
 * @param {(tagId: string) => void} onFilter
 * @param {{ visibleLimit?: number, expanded?: boolean, onExpandedChange?: (expanded: boolean) => void }} [opts]
 */
export function mountTagFilters(container, tags, activeId, onFilter, opts = {}) {
  if (!container) return;

  const { visibleLimit = 0, expanded = false, onExpandedChange } = opts;
  const activeIndex = tags.findIndex((tag) => activeId === tag.slug || activeId === tag.id);
  const shouldExpand = expanded || (visibleLimit > 0 && activeIndex >= visibleLimit);
  const visibleTags =
    visibleLimit > 0 && !shouldExpand ? tags.slice(0, visibleLimit) : tags;
  const hasHiddenTags = visibleLimit > 0 && tags.length > visibleLimit;

  const tagButtons = visibleTags
    .map((tag) => {
      const isActive = activeId === tag.slug || activeId === tag.id;
      return `<button type="button" class="filter-btn${isActive ? " is-active" : ""}" data-filter="${tag.slug}" role="tab" aria-selected="${isActive ? "true" : "false"}">${tagDisplayName(tag)}</button>`;
    })
    .join("");

  const toggleButton =
    hasHiddenTags && !shouldExpand
      ? `<button type="button" class="filter-btn filter-btn--more" data-action="expand">${t("shopPage.showMoreTags")}</button>`
      : hasHiddenTags && shouldExpand
        ? `<button type="button" class="filter-btn filter-btn--more" data-action="collapse">${t("shopPage.showLessTags")}</button>`
        : "";

  container.innerHTML = [
    `<button type="button" class="filter-btn${activeId === "all" ? " is-active" : ""}" data-filter="all" role="tab" aria-selected="${activeId === "all" ? "true" : "false"}">${t("categories.all")}</button>`,
    tagButtons,
    toggleButton,
  ].join("");

  container.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tagId = btn.dataset.filter || "all";
      container.querySelectorAll("[data-filter]").forEach((item) => {
        const isActive = item.dataset.filter === tagId;
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      onFilter(tagId);
    });
  });

  container.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextExpanded = btn.dataset.action === "expand";
      onExpandedChange?.(nextExpanded);
      mountTagFilters(container, tags, activeId, onFilter, {
        ...opts,
        expanded: nextExpanded,
      });
    });
  });
}

export const PRODUCT_TAG_SELECT = "product_tags(tag:tags(id, name, slug))";
