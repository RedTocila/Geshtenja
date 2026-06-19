import { mountShopHeader, mountShopFooter, initShopPage } from "../lib/layout.js";
import { setPageMeta } from "../lib/seo.js";
import { fetchProducts, filterAndSortProducts, productUrl } from "../lib/products.js";
import { fetchStoreTags, mountTagFilters, renderProductTagsHtml } from "../lib/tags.js";
import { formatPrice } from "../lib/format.js";
import { t } from "../i18n.js";
import { applyImageZoom } from "../lib/image-zoom.js";

let allProducts = [];
let storeTags = [];
let activeTag = "all";
let tagFiltersExpanded = false;

const SHOP_TAG_VISIBLE_LIMIT = 7;

const shopFilters = document.getElementById("shopFilters");
const shopSearch = document.getElementById("shopSearch");
const shopSort = document.getElementById("shopSort");

function renderProductCard(p) {
  const onSale = p.sale_price != null && p.sale_price < p.price;
  const priceHtml = onSale
    ? `<span class="shop-price shop-price--sale">${formatPrice(p.sale_price)}</span><span class="shop-price shop-price--old">${formatPrice(p.price)}</span>`
    : `<span class="shop-price">${formatPrice(p.effective_price)}</span>`;
  const tagsHtml = renderProductTagsHtml(p, "shop-card__category");

  return `
    <a href="${productUrl(p.slug)}" class="shop-card">
      <div class="shop-card__media">
        <img src="${p.image_url}" alt="${p.name}" loading="lazy" width="600" height="750" />
        ${p.is_featured ? `<span class="shop-card__badge">${t("shopPage.featured")}</span>` : ""}
        ${onSale ? `<span class="shop-card__badge shop-card__badge--sale">${t("shopPage.sale")}</span>` : ""}
      </div>
      <div class="shop-card__body">
        ${tagsHtml ? `<div class="shop-card__tags">${tagsHtml}</div>` : ""}
        <h2 class="shop-card__name">${p.name}</h2>
        <div class="shop-card__price">${priceHtml}</div>
        <span class="shop-stock${p.in_stock ? "" : " is-out"}">${p.in_stock ? t("shopPage.inStock") : t("shopPage.outStock")}</span>
      </div>
    </a>
  `;
}

function renderGrid() {
  const search = shopSearch?.value ?? "";
  const sort = shopSort?.value ?? "newest";
  const list = filterAndSortProducts(allProducts, { search, tagId: activeTag, sort });
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

function setupTagFilters() {
  mountTagFilters(
    shopFilters,
    storeTags,
    activeTag,
    (tagId) => {
      activeTag = tagId;
      renderGrid();
    },
    {
      visibleLimit: SHOP_TAG_VISIBLE_LIMIT,
      expanded: tagFiltersExpanded,
      onExpandedChange: (expanded) => {
        tagFiltersExpanded = expanded;
      },
    }
  );
}

function refreshShopMeta() {
  setPageMeta({
    title: t("shopPage.metaTitle"),
    description: t("shopPage.metaDesc"),
    url: `${location.origin}/shop`,
  });
}

async function refreshShopUi() {
  storeTags = await fetchStoreTags(allProducts, { all: true });
  setupTagFilters();
  renderGrid();
  refreshShopMeta();
}

async function init() {
  initShopPage();
  mountShopHeader(document.getElementById("siteHeader"), { active: "shop" });
  mountShopFooter(document.getElementById("siteFooter"));

  refreshShopMeta();

  allProducts = await fetchProducts();
  storeTags = await fetchStoreTags(allProducts, { all: true });
  setupTagFilters();
  renderGrid();

  shopSearch?.addEventListener("input", renderGrid);
  shopSort?.addEventListener("change", renderGrid);

  window.addEventListener("languagechange", refreshShopUi);
}

init();
