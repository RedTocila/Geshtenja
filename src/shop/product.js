import { mountShopHeader, mountShopFooter, initShopPage } from "../lib/layout.js";
import { setPageMeta, injectProductJsonLd } from "../lib/seo.js";
import {
  fetchProducts,
  fetchProductBySlug,
  productGallery,
  relatedProducts,
  productUrl,
} from "../lib/products.js";
import { formatPrice, effectivePrice } from "../lib/format.js";
import { addToCart } from "../lib/cart.js";
import { categoryLabel } from "../i18n.js";
import { applyImageZoom } from "../lib/image-zoom.js";

function getSlugFromPath() {
  const params = new URLSearchParams(location.search);
  if (params.get("slug")) return params.get("slug");
  const match = location.pathname.match(/\/shop\/([^/]+)\/?$/);
  return match?.[1] ?? null;
}

function renderProduct(product, all) {
  const gallery = productGallery(product);
  const price = effectivePrice(product);
  const onSale = product.sale_price != null && product.sale_price < product.price;

  document.getElementById("productBreadcrumb").innerHTML = `
    <a href="/shop">Shop</a> / <span>${product.name}</span>
  `;

  document.getElementById("productContent").innerHTML = `
    <div class="product-layout">
      <div class="product-gallery">
        <div class="product-gallery__main">
          <img id="galleryMain" src="${gallery[0]}" alt="${product.name}" />
        </div>
        ${
          gallery.length > 1
            ? `<div class="product-gallery__thumbs">${gallery
                .map(
                  (url, i) =>
                    `<button type="button" class="product-gallery__thumb${i === 0 ? " is-active" : ""}" data-url="${url}">
                      <img src="${url}" alt="" />
                    </button>`
                )
                .join("")}</div>`
            : ""
        }
      </div>
      <div class="product-info">
        <p class="shop-card__category">${categoryLabel(product.category)}</p>
        <h1 class="product-info__title">${product.name}</h1>
        <p class="product-info__short">${product.short_description || ""}</p>
        <div class="product-info__price">
          ${
            onSale
              ? `<span class="shop-price shop-price--sale">${formatPrice(product.sale_price)}</span>
                 <span class="shop-price shop-price--old">${formatPrice(product.price)}</span>`
              : `<span class="shop-price">${formatPrice(price)}</span>`
          }
        </div>
        <p class="shop-stock${product.in_stock ? "" : " is-out"}">
          ${product.in_stock ? `${product.stock_quantity} in stock` : "Out of stock"}
        </p>
        ${product.sku ? `<p class="shop-stock">SKU: ${product.sku}</p>` : ""}
        <div class="product-qty" id="qtyControl" ${product.in_stock ? "" : "hidden"}>
          <button type="button" id="qtyMinus" aria-label="Decrease quantity">−</button>
          <input type="number" id="qtyInput" value="1" min="1" max="${product.stock_quantity}" aria-label="Quantity" />
          <button type="button" id="qtyPlus" aria-label="Increase quantity">+</button>
        </div>
        <div class="product-actions">
          <button type="button" class="btn btn--primary" id="addToCartBtn" ${product.in_stock ? "" : "disabled"}>
            ${product.in_stock ? "Add to Cart" : "Out of Stock"}
          </button>
          <a href="/cart" class="btn btn--outline">View Cart</a>
        </div>
        <div class="product-desc">
          <h2>Description</h2>
          <p>${product.description || product.short_description || ""}</p>
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll(".product-gallery__thumb").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("galleryMain").src = btn.dataset.url;
      document.querySelectorAll(".product-gallery__thumb").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
    });
  });

  const qtyInput = document.getElementById("qtyInput");
  document.getElementById("qtyMinus")?.addEventListener("click", () => {
    qtyInput.value = String(Math.max(1, Number(qtyInput.value) - 1));
  });
  document.getElementById("qtyPlus")?.addEventListener("click", () => {
    qtyInput.value = String(Math.min(product.stock_quantity, Number(qtyInput.value) + 1));
  });

  document.getElementById("addToCartBtn")?.addEventListener("click", () => {
    const qty = Number(qtyInput.value) || 1;
    addToCart(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image_url: product.image_url,
        price: product.price,
        sale_price: product.sale_price,
        quantity: qty,
      },
      product.stock_quantity
    );
    const btn = document.getElementById("addToCartBtn");
    btn.textContent = "Added ✓";
    setTimeout(() => {
      btn.textContent = "Add to Cart";
    }, 1500);
  });

  const related = relatedProducts(product, all);
  if (related.length) {
    document.getElementById("relatedProducts").hidden = false;
    document.getElementById("relatedGrid").innerHTML = related
      .map(
        (p) => `
      <a href="${productUrl(p.slug)}" class="shop-card">
        <div class="shop-card__media"><img src="${p.image_url}" alt="${p.name}" loading="lazy" /></div>
        <div class="shop-card__body">
          <span class="shop-card__category">${categoryLabel(p.category)}</span>
          <h2 class="shop-card__name">${p.name}</h2>
          <div class="shop-card__price"><span class="shop-price">${formatPrice(p.effective_price)}</span></div>
        </div>
      </a>`
      )
      .join("");
  }

  setPageMeta({
    title: `${product.name} — Geshtenja Light`,
    description: product.short_description || product.description,
    url: `${location.origin}/shop/${product.slug}`,
    image: product.image_url,
    type: "product",
  });
  injectProductJsonLd(product, price);

  applyImageZoom(document.getElementById("productContent"), ".product-gallery__main img", {
    zoom: 3.2,
    lensSize: 210,
  });
  applyImageZoom(document.getElementById("relatedProducts"), ".shop-card__media img");
}

async function init() {
  initShopPage();
  mountShopHeader(document.getElementById("siteHeader"), { active: "shop" });
  mountShopFooter(document.getElementById("siteFooter"));

  const slug = getSlugFromPath();
  if (!slug) {
    location.href = "/shop";
    return;
  }

  const [product, all] = await Promise.all([fetchProductBySlug(slug), fetchProducts()]);
  if (!product) {
    document.getElementById("productContent").innerHTML =
      '<div class="shop-empty"><p>Product not found.</p><a href="/shop" class="btn btn--primary">Back to Shop</a></div>';
    return;
  }

  renderProduct(product, all);
}

init();
