import { mountShopHeader, mountShopFooter, initShopPage } from "../lib/layout.js";
import { getCart, cartSubtotal, clearCart } from "../lib/cart.js";
import { createOrder, notifyAdminOrder } from "../lib/orders.js";
import { formatPrice } from "../lib/format.js";

function render() {
  const app = document.getElementById("checkoutApp");
  const cart = getCart();

  if (!cart.length) {
    app.innerHTML = `
      <div class="shop-empty">
        <p>Your cart is empty.</p>
        <a href="/shop" class="btn btn--primary">Go to Shop</a>
      </div>`;
    return;
  }

  const subtotal = cartSubtotal(cart);

  app.innerHTML = `
    <div class="checkout-layout">
      <form class="checkout-form" id="checkoutForm">
        <label class="form-field">
          <span>Full Name *</span>
          <input class="form-control" type="text" name="customer_name" required autocomplete="name" />
        </label>
        <label class="form-field">
          <span>Phone Number *</span>
          <input class="form-control" type="tel" name="customer_phone" required autocomplete="tel" />
        </label>
        <label class="form-field">
          <span>Email *</span>
          <input class="form-control" type="email" name="customer_email" required autocomplete="email" />
        </label>
        <label class="form-field">
          <span>City *</span>
          <input class="form-control" type="text" name="customer_city" required />
        </label>
        <label class="form-field">
          <span>Address *</span>
          <input class="form-control" type="text" name="customer_address" required autocomplete="street-address" />
        </label>
        <label class="form-field">
          <span>Additional Notes</span>
          <textarea class="form-control" name="notes" rows="3" placeholder="Delivery instructions, preferred time…"></textarea>
        </label>
        <p class="shop-error" id="checkoutError" hidden></p>
        <button type="submit" class="btn btn--primary">Place Order</button>
      </form>
      <aside class="checkout-summary">
        <h2>Order Summary</h2>
        ${cart
          .map((item) => {
            const unit = item.sale_price != null && item.sale_price < item.price ? item.sale_price : item.price;
            return `<div class="summary-row"><span>${item.name} × ${item.quantity}</span><span>${formatPrice(unit * item.quantity)}</span></div>`;
          })
          .join("")}
        <div class="summary-row summary-row--total"><span>Total</span><span>${formatPrice(subtotal)}</span></div>
        <div class="payment-badge">💵 Cash on Delivery</div>
      </aside>
    </div>
  `;

  document.getElementById("checkoutForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("checkoutError");
    const btn = e.target.querySelector('button[type="submit"]');
    errEl.hidden = true;
    btn.disabled = true;
    btn.textContent = "Placing order…";

    const fd = new FormData(e.target);

    try {
      const result = await createOrder({
        customer_name: fd.get("customer_name"),
        customer_phone: fd.get("customer_phone"),
        customer_email: fd.get("customer_email"),
        customer_city: fd.get("customer_city"),
        customer_address: fd.get("customer_address"),
        notes: fd.get("notes"),
        items: cart.map((c) => ({ product_id: c.productId, quantity: c.quantity })),
      });

      await notifyAdminOrder({
        order_number: result.order_number,
        total: result.total,
        customer_name: fd.get("customer_name"),
        customer_email: fd.get("customer_email"),
        customer_phone: fd.get("customer_phone"),
        customer_city: fd.get("customer_city"),
        customer_address: fd.get("customer_address"),
        notes: fd.get("notes"),
        items: cart,
      });

      sessionStorage.setItem(
        "geshtenja-last-order-summary",
        JSON.stringify({
          items: cart.map((c) => ({
            name: c.name,
            image_url: c.image_url,
            quantity: c.quantity,
            price: c.price,
            sale_price: c.sale_price,
          })),
          total: result.total,
        }),
      );
      clearCart();
      location.href = "/order-success";
    } catch (err) {
      errEl.hidden = false;
      errEl.textContent = err.message || "Could not place order. Please try again.";
      btn.disabled = false;
      btn.textContent = "Place Order";
    }
  });
}

function init() {
  initShopPage();
  mountShopHeader(document.getElementById("siteHeader"));
  mountShopFooter(document.getElementById("siteFooter"));
  render();
}

init();
