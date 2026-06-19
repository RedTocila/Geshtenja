import { supabase, isSupabaseConfigured } from "./supabase.js";
import { effectivePrice } from "./format.js";
import { FALLBACK_PRODUCTS } from "../data/fallback.js";
import { extractProductTags, productHasTag, PRODUCT_TAG_SELECT } from "./tags.js";

/** @typedef {import('../data/fallback.js').StoreProduct} StoreProduct */

function enrichProduct(p) {
  return {
    ...p,
    product_images: p.product_images ?? [],
    effective_price: effectivePrice(p),
  };
}

/** @returns {Promise<StoreProduct[]>} */
export async function fetchProducts() {
  if (!isSupabaseConfigured || !supabase) {
    return FALLBACK_PRODUCTS.map(enrichProduct);
  }

  const { data, error } = await supabase
    .from("products")
    .select(`*, product_images(id, image_url, sort_order), ${PRODUCT_TAG_SELECT}`)
    .order("sort_order");

  if (error || !data?.length) {
    return FALLBACK_PRODUCTS.map(enrichProduct);
  }

  return data.map((p) =>
    enrichProduct({
      ...p,
      product_images: (p.product_images ?? []).sort((a, b) => a.sort_order - b.sort_order),
    })
  );
}

/** @param {string} slug */
export async function fetchProductBySlug(slug) {
  const products = await fetchProducts();
  return products.find((p) => p.slug === slug) ?? null;
}

/**
 * @param {StoreProduct[]} products
 * @param {{ search?: string, tagId?: string, category?: string, sort?: string }} opts
 */
export function filterAndSortProducts(products, { search = "", tagId = "all", category, sort = "newest" } = {}) {
  let list = [...products];
  const filterTag = tagId !== "all" ? tagId : category;

  if (filterTag && filterTag !== "all") {
    list = list.filter((product) => productHasTag(product, filterTag));
  }

  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter((product) => {
      const tagText = extractProductTags(product)
        .map((tag) => tag.name)
        .join(" ");
      return (
        product.name.toLowerCase().includes(q) ||
        product.short_description?.toLowerCase().includes(q) ||
        product.sku?.toLowerCase().includes(q) ||
        tagText.toLowerCase().includes(q)
      );
    });
  }

  switch (sort) {
    case "price-asc":
      list.sort((a, b) => a.effective_price - b.effective_price);
      break;
    case "price-desc":
      list.sort((a, b) => b.effective_price - a.effective_price);
      break;
    case "featured":
      list.sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || b.sort_order - a.sort_order);
      break;
    default:
      list.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "") || b.sort_order - a.sort_order);
  }

  return list;
}

/** @param {StoreProduct} product */
export function productGallery(product) {
  const extra = (product.product_images ?? []).map((i) => i.image_url);
  return [product.image_url, ...extra.filter((u) => u !== product.image_url)];
}

/** @param {StoreProduct} product @param {StoreProduct[]} all @param {number} [limit] */
export function relatedProducts(product, all, limit = 4) {
  return all
    .filter((p) => p.id !== product.id && p.category === product.category && p.in_stock)
    .slice(0, limit);
}

export function productUrl(slug) {
  return `/shop/${slug}`;
}
