import { mountShopHeader, mountShopFooter, initShopPage } from "../lib/layout.js";

/** @typedef {{ name: string, image_url: string }} OrderItem */
/** @typedef {{ items: OrderItem[] }} OrderSummary */

/** @returns {OrderSummary | null} */
function getLastOrderSummary() {
  try {
    const raw = sessionStorage.getItem("geshtenja-last-order-summary");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** @param {OrderItem} item */
function renderOrderItem(item) {
  return `
    <li class="order-success__item">
      <img
        class="order-success__item-img"
        src="${item.image_url}"
        alt="${item.name}"
        width="120"
        height="150"
        loading="lazy"
      />
      <p class="order-success__item-name">${item.name}</p>
    </li>
  `;
}

function init() {
  initShopPage();
  mountShopHeader(document.getElementById("siteHeader"), { showCart: false });
  mountShopFooter(document.getElementById("siteFooter"));

  const summary = getLastOrderSummary();
  const container = document.getElementById("orderSuccess");

  if (!summary?.items?.length) {
    container.innerHTML = `
      <div class="shop-empty">
        <p>No order found.</p>
        <a href="/shop" class="btn btn--primary">Go to Shop</a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="order-success__icon">✓</div>
    <h1 class="shop-hero__title">Thank You!</h1>
    <p class="order-success__lead">Your order has been placed successfully. We'll contact you shortly to confirm delivery.</p>

    <div class="order-success__items-wrap">
      <h2 class="order-success__items-title">Your Order</h2>
      <ul class="order-success__items">
        ${summary.items.map(renderOrderItem).join("")}
      </ul>
    </div>

    <div class="order-success__actions">
      <a href="/shop" class="btn btn--primary">Continue Shopping</a>
      <a href="/" class="btn btn--outline">Back to Home</a>
    </div>
  `;
}

init();
