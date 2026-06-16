import { mountShopHeader, mountShopFooter, initShopPage } from "../lib/layout.js";
import { setPageMeta } from "../lib/seo.js";
import { fetchProducts, filterAndSortProducts, productUrl } from "../lib/products.js";
import { formatPrice } from "../lib/format.js";
import { categoryLabel } from "../i18n.js";
import { applyImageZoom } from "../lib/image-zoom.js";

const CATEGORIES = ["all", "pendant", "sconce", "chandelier", "floor", "office"];

let allProducts = [];
let activeCategory = "all";

function renderFilters() {
  const el = document.getElementById("shopFilters");
  el.innerHTML = CATEGORIES.map(
    (cat) =>
      `<button type="button" class="filter-btn${cat === activeCategory ? " is-active" : ""}" data-filter="${cat}" role="tab">${categoryLabel(cat)}</button>`
  ).join("");

  el.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.filter;
      renderFilters();
      renderGrid();
    });
  });
}

function renderProductCard(p) {
  const onSale = p.sale_price != null && p.sale_price < p.price;
  const priceHtml = onSale
    ? `<span class="shop-price shop-price--sale">${formatPrice(p.sale_price)}</span><span class="shop-price shop-price--old">${formatPrice(p.price)}</span>`
    : `<span class="shop-price">${formatPrice(p.effective_price)}</span>`;

  return `
    <a href="${productUrl(p.slug)}" class="shop-card">
      <div class="shop-card__media">
        <img src="${p.image_url}" alt="${p.name}" loading="lazy" width="600" height="750" />
        ${p.is_featured ? '<span class="shop-card__badge">Featured</span>' : ""}
        ${onSale ? '<span class="shop-card__badge" style="left:auto;right:0.75rem;background:#1a1816;color:#fff">Sale</span>' : ""}
      </div>
      <div class="shop-card__body">
        <span class="shop-card__category">${categoryLabel(p.category)}</span>
        <h2 class="shop-card__name">${p.name}</h2>
        <div class="shop-card__price">${priceHtml}</div>
        <span class="shop-stock${p.in_stock ? "" : " is-out"}">${p.in_stock ? "In stock" : "Out of stock"}</span>
      </div>
    </a>
  `;
}

function renderGrid() {
  const search = document.getElementById("shopSearch").value;
  const sort = document.getElementById("shopSort").value;
  const list = filterAndSortProducts(allProducts, { search, category: activeCategory, sort });
  const grid = document.getElementById("shopGrid");
  const empty = document.getElementById("shopEmpty");

  if (!list.length) {
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  grid.innerHTML = list.map(renderProductCard).join("");
  applyImageZoom(grid, ".shop-card__media img");
}

async function init() {
  initShopPage();
  mountShopHeader(document.getElementById("siteHeader"), { active: "shop" });
  mountShopFooter(document.getElementById("siteFooter"));

  setPageMeta({
    title: "Shop — Geshtenja Light",
    description: "Browse premium lighting — pendants, sconces, chandeliers and more. Cash on delivery.",
    url: `${location.origin}/shop`,
  });

  allProducts = await fetchProducts();
  renderFilters();
  renderGrid();

  document.getElementById("shopSearch").addEventListener("input", renderGrid);
  document.getElementById("shopSort").addEventListener("change", renderGrid);
}

init();
