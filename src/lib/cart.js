const CART_KEY = "geshtenja-cart";

/** @typedef {{ productId: string, slug: string, name: string, image_url: string, price: number, sale_price?: number | null, quantity: number }} CartItem */

/** @returns {CartItem[]} */
export function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** @param {CartItem[]} items */
function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("cartchange", { detail: { count: cartCount(items) } }));
}

/** @param {CartItem[]} items */
export function cartCount(items = getCart()) {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

/** @param {CartItem[]} items */
export function cartSubtotal(items = getCart()) {
  return items.reduce((sum, i) => {
    const unit = i.sale_price != null && i.sale_price < i.price ? i.sale_price : i.price;
    return sum + unit * i.quantity;
  }, 0);
}

/**
 * @param {Omit<CartItem, 'quantity'> & { quantity?: number }} item
 * @param {number} [maxStock]
 */
export function addToCart(item, maxStock = 99) {
  const cart = getCart();
  const existing = cart.find((c) => c.productId === item.productId);
  const addQty = item.quantity ?? 1;

  if (existing) {
    existing.quantity = Math.min(existing.quantity + addQty, maxStock);
  } else {
    cart.push({ ...item, quantity: Math.min(addQty, maxStock) });
  }
  saveCart(cart);
  return cart;
}

/** @param {string} productId */
export function removeFromCart(productId) {
  const cart = getCart().filter((c) => c.productId !== productId);
  saveCart(cart);
  return cart;
}

/**
 * @param {string} productId
 * @param {number} quantity
 */
export function updateCartQuantity(productId, quantity) {
  const cart = getCart();
  const item = cart.find((c) => c.productId === productId);
  if (!item) return cart;
  if (quantity <= 0) return removeFromCart(productId);
  item.quantity = quantity;
  saveCart(cart);
  return cart;
}

export function clearCart() {
  saveCart([]);
}
