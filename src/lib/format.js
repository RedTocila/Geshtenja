/** @param {number} amount */
export function formatPrice(amount, currency = "EUR") {
  return new Intl.NumberFormat("sq-AL", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount ?? 0);
}

/** @param {{ price: number, sale_price?: number | null }} product */
export function effectivePrice(product) {
  if (product.sale_price != null && product.sale_price < product.price) {
    return product.sale_price;
  }
  return product.price ?? 0;
}

/** @param {string} name */
export function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
