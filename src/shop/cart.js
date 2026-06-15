import { mountShopHeader, mountShopFooter, initShopPage } from "../lib/layout.js";
import {
  getCart,
  removeFromCart,
  updateCartQuantity,
  cartSubtotal,
  clearCart,
} from "../lib/cart.js";
import { formatPrice } from "../lib/format.js";
import { productUrl } from "../lib/products.js";

function render() {
  const app = document.getElementById("cartApp");
  const cart = getCart();

  if (!cart.length) {
    app.innerHTML = `
      <div class="shop-empty">
        <p>Your cart is empty.</p>
        <a href="/shop" class="btn btn--primary">Continue Shopping</a>
      </div>`;
    return;
  }

  const subtotal = cartSubtotal(cart);

  app.innerHTML = `
    <div class="cart-layout">
      <div class="cart-items">
        <table class="cart-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Price</th>
              <th>Qty</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${cart
              .map((item) => {
                const unit = item.sale_price != null && item.sale_price < item.price ? item.sale_price : item.price;
                return `
              <tr data-id="${item.productId}">
                <td>
                  <div class="cart-item">
                    <img class="cart-item__img" src="${item.image_url}" alt="" />
                    <a href="${productUrl(item.slug)}" class="cart-item__name">${item.name}</a>
                  </div>
                </td>
                <td>${formatPrice(unit)}</td>
                <td>
                  <div class="product-qty" style="margin:0">
                    <button type="button" data-qty-minus="${item.productId}">−</button>
                    <input type="number" value="${item.quantity}" min="1" data-qty-input="${item.productId}" aria-label="Quantity" />
                    <button type="button" data-qty-plus="${item.productId}">+</button>
                  </div>
                </td>
                <td>${formatPrice(unit * item.quantity)}</td>
                <td><button type="button" class="btn--danger-ghost" data-remove="${item.productId}">Remove</button></td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
        <button type="button" class="btn--danger-ghost" id="clearCartBtn" style="margin-top:1rem">Empty cart</button>
      </div>
      <aside class="cart-summary">
        <h2>Order Summary</h2>
        <div class="summary-row"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div>
        <div class="summary-row"><span>Delivery</span><span>Cash on delivery</span></div>
        <div class="summary-row summary-row--total"><span>Total</span><span>${formatPrice(subtotal)}</span></div>
        <a href="/checkout" class="btn btn--primary btn--block">Proceed to Checkout</a>
        <a href="/shop" class="btn btn--outline btn--block" style="margin-top:0.5rem">Continue Shopping</a>
      </aside>
    </div>
  `;

  app.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      removeFromCart(btn.dataset.remove);
      render();
    });
  });

  app.querySelectorAll("[data-qty-minus]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = cart.find((c) => c.productId === btn.dataset.qtyMinus);
      if (!item) return;
      updateCartQuantity(item.productId, item.quantity - 1);
      render();
    });
  });

  app.querySelectorAll("[data-qty-plus]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = cart.find((c) => c.productId === btn.dataset.qtyPlus);
      if (!item) return;
      updateCartQuantity(item.productId, item.quantity + 1);
      render();
    });
  });

  app.querySelectorAll("[data-qty-input]").forEach((input) => {
    input.addEventListener("change", () => {
      updateCartQuantity(input.dataset.qtyInput, Number(input.value) || 1);
      render();
    });
  });

  document.getElementById("clearCartBtn").addEventListener("click", () => {
    if (confirm("Empty your cart?")) {
      clearCart();
      render();
    }
  });
}

function init() {
  initShopPage();
  mountShopHeader(document.getElementById("siteHeader"));
  mountShopFooter(document.getElementById("siteFooter"));
  render();
  window.addEventListener("cartchange", render);
}

init();
