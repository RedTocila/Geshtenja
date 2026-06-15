/** @param {object} opts */
export function setPageMeta({ title, description, url, image, type = "website" }) {
  document.title = title;
  setMeta("description", description);
  setMeta("og:title", title, "property");
  setMeta("og:description", description, "property");
  setMeta("og:type", type, "property");
  if (url) setMeta("og:url", url, "property");
  if (image) setMeta("og:image", image, "property");
  setMeta("twitter:card", "summary_large_image");
  setMeta("twitter:title", title);
  setMeta("twitter:description", description);
  if (image) setMeta("twitter:image", image);
}

function setMeta(name, content, attr = "name") {
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

/** @param {object} product */
export function injectProductJsonLd(product, price) {
  const existing = document.getElementById("product-jsonld");
  if (existing) existing.remove();

  const script = document.createElement("script");
  script.id = "product-jsonld";
  script.type = "application/ld+json";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.short_description || product.description,
    image: product.image_url,
    sku: product.sku || undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: price,
      availability: product.in_stock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${location.origin}/shop/${product.slug}`,
    },
  });
  document.head.appendChild(script);
}
