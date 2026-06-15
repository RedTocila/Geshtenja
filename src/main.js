import pendantSvg from "./assets/pendant-lamp.svg?raw";
import { supabase, isSupabaseConfigured } from "./lib/supabase.js";
import { FALLBACK_PRODUCTS, FALLBACK_WORKS, workGradient } from "./data/fallback.js";
import { initLang, getHeroSlides, categoryLabel, t } from "./i18n.js";
import { formatPrice, effectivePrice, slugify } from "./lib/format.js";
import { productUrl } from "./lib/products.js";
import { cartCount } from "./lib/cart.js";
import { mountWhatsAppFab } from "./lib/layout.js";
import { initMobileNav } from "./lib/mobile-nav.js";

const LAMP_GRADIENT_IDS = ["matteBlack", "neckMetal", "shadeSideLight", "bulbGlass", "bulbGlow", "beamGrad", "beamRimGrad"];
const LAMP_CLIP_IDS = ["bulbGlowClip"];
const LAMP_FILTER_IDS = ["beamSoft"];

function injectPendantLamp(container, prefix) {
  let svg = pendantSvg;
  [...LAMP_GRADIENT_IDS, ...LAMP_FILTER_IDS].forEach((id) => {
    svg = svg.replaceAll(`id="${id}"`, `id="${prefix}-${id}"`);
    svg = svg.replaceAll(`url(#${id})`, `url(#${prefix}-${id})`);
  });
  LAMP_CLIP_IDS.forEach((id) => {
    svg = svg.replaceAll(`id="${id}"`, `id="${prefix}-${id}"`);
    svg = svg.replaceAll(`url(#${id})`, `url(#${prefix}-${id})`);
  });
  container.innerHTML = svg;
}

let products = [...FALLBACK_PRODUCTS];
let works = [...FALLBACK_WORKS];

let isLit = false;
let scrollAutoLightUsed = false;
let heroSlideIndex = 0;
let heroSlideTimer = null;
const HERO_AUTO_SLIDE_MS = 5000;
const HOME_PRODUCT_LIMIT = 12;
let activeFilter = "all";

async function loadContent() {
  if (!isSupabaseConfigured || !supabase) return;

  const [productsRes, worksRes] = await Promise.all([
    supabase.from("products").select("*").order("sort_order"),
    supabase.from("works").select("*").order("sort_order"),
  ]);

  if (!productsRes.error && productsRes.data?.length) {
    products = productsRes.data;
  }
  if (!worksRes.error && worksRes.data?.length) {
    works = worksRes.data.map((w, i) => ({
      ...w,
      gradient: w.image_url ? null : workGradient(i),
    }));
  }
}

function renderProducts(filter = "all") {
  const grid = document.getElementById("productGrid");
  const more = document.getElementById("productsMore");
  const items = filter === "all" ? products : products.filter((p) => p.category === filter);
  const visible = items.slice(0, HOME_PRODUCT_LIMIT);

  grid.innerHTML = visible
    .map((p) => {
      const image = p.image_url || p.image;
      const onSale = p.sale_price != null && Number(p.sale_price) < Number(p.price);
      const price = effectivePrice(p);
      const slug = p.slug || slugify(p.name);
      const href = p.slug ? productUrl(p.slug) : `/shop/${slug}`;
      const priceHtml = onSale
        ? `<span class="product-card__price product-card__price--sale">${formatPrice(p.sale_price)}</span>
           <span class="product-card__price product-card__price--old">${formatPrice(p.price)}</span>`
        : `<span class="product-card__price">${formatPrice(price)}</span>`;

      return `
    <article class="product-card" data-category="${p.category}">
      <a href="${href}" class="product-card__visual">
        <img class="product-card__img" src="${image}" alt="${p.name}" loading="lazy" width="600" height="750" />
        <div class="product-card__overlay">
          <span class="product-card__category">${categoryLabel(p.category)}</span>
          <h3 class="product-card__name">${p.name}</h3>
          <div class="product-card__price-row">${priceHtml}</div>
        </div>
      </a>
    </article>
  `;
    })
    .join("");

  if (more) {
    more.hidden = items.length <= HOME_PRODUCT_LIMIT;
  }

  observeCards(grid.querySelectorAll(".product-card"));
}

function workCardBg(w, index) {
  if (w.image_url) {
    return `background-image: url('${w.image_url}'); background-size: cover; background-position: center;`;
  }
  return `background: ${w.gradient || workGradient(index)};`;
}

function renderWorks() {
  const grid = document.getElementById("worksGrid");
  grid.innerHTML = works
    .map((w, i) => {
      const videoBtn = w.video_url
        ? `<button type="button" class="work-card__play" data-video="${w.video_url}" aria-label="${t("video.play")}">▶</button>`
        : "";
      return `
    <article class="work-card">
      <div class="work-card__bg" style="${workCardBg(w, i)}"></div>
      <div class="work-card__overlay">
        <span class="work-card__type">${w.type}</span>
        <h3 class="work-card__title">${w.title}</h3>
        <span class="work-card__location">${w.location}</span>
      </div>
      ${videoBtn}
    </article>
  `;
    })
    .join("");

  grid.querySelectorAll(".work-card__play").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openVideoModal(btn.dataset.video);
    });
  });

  observeCards(grid.querySelectorAll(".work-card"));
}

function openVideoModal(src) {
  let modal = document.getElementById("videoModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "videoModal";
    modal.className = "video-modal";
    modal.innerHTML = `
      <div class="video-modal__backdrop"></div>
      <div class="video-modal__content">
        <button type="button" class="video-modal__close" aria-label="${t("video.close")}">×</button>
        <video controls playsinline></video>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector(".video-modal__backdrop").addEventListener("click", closeVideoModal);
    modal.querySelector(".video-modal__close").addEventListener("click", closeVideoModal);
  }
  const video = modal.querySelector("video");
  video.src = src;
  modal.classList.add("is-open");
  video.play();
}

function closeVideoModal() {
  const modal = document.getElementById("videoModal");
  if (!modal) return;
  const video = modal.querySelector("video");
  video.pause();
  video.removeAttribute("src");
  modal.classList.remove("is-open");
}

const CLOUD_WHITE_MS = 5000;
const CLOUD_RED_MS = 3000;
let cloudNudgeTimer = null;
let cloudIsUrgent = false;

function syncCloudText() {
  const cloud = document.getElementById("lightCloud");
  if (!cloud || isLit) return;
  const key = cloudIsUrgent ? "light.cloudUrgent" : "light.cloud";
  cloud.dataset.i18n = key;
  cloud.textContent = t(key);
}

function setCloudUrgent(urgent) {
  if (cloudIsUrgent === urgent) return;
  cloudIsUrgent = urgent;
  const cloud = document.getElementById("lightCloud");
  if (!cloud) return;
  cloud.classList.toggle("is-urgent", urgent);
  syncCloudText();
}

function clearCloudNudgeTimer() {
  if (cloudNudgeTimer) {
    clearTimeout(cloudNudgeTimer);
    cloudNudgeTimer = null;
  }
}

function scheduleCloudLoop() {
  clearCloudNudgeTimer();
  if (isLit) return;
  const delay = cloudIsUrgent ? CLOUD_RED_MS : CLOUD_WHITE_MS;
  cloudNudgeTimer = setTimeout(() => {
    if (isLit) return;
    setCloudUrgent(!cloudIsUrgent);
    scheduleCloudLoop();
  }, delay);
}

function resetCloudNudge() {
  setCloudUrgent(false);
  scheduleCloudLoop();
}

function setLit(lit) {
  if (isLit === lit) return;
  isLit = lit;
  document.body.classList.toggle("is-lit", lit);
  const lightSwitch = document.getElementById("lightSwitch");
  if (lightSwitch) lightSwitch.checked = lit;
  if (lit) {
    clearCloudNudgeTimer();
    setCloudUrgent(false);
  } else {
    scheduleCloudLoop();
  }
}

function takeManualLightControl() {
  scrollAutoLightUsed = true;
}

function toggleLight() {
  takeManualLightControl();
  setLit(!isLit);
}

function applyHeroSlideContent(slide, totalSlides) {
  document.getElementById("heroTitle").textContent = slide.title;
  document.getElementById("heroTagline").textContent = slide.tagline;
  document.getElementById("heroSlideNum").textContent = String(heroSlideIndex + 1).padStart(2, "0");
  document.getElementById("heroSlideNumNext").textContent = String((heroSlideIndex + 1) % totalSlides + 1).padStart(2, "0");
}

const HERO_SLIDE_ANIM_MS = 450;
let heroSlideAnimating = false;

function getHeroSlideEls() {
  return [
    document.getElementById("heroTitle"),
    document.getElementById("heroTagline"),
    document.getElementById("heroSlideNum"),
    document.getElementById("heroSlideNumNext"),
  ];
}

function updateHeroSlide(index, { animate = true, direction = 1 } = {}) {
  const slides = getHeroSlides();
  const nextIndex = ((index % slides.length) + slides.length) % slides.length;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (nextIndex === heroSlideIndex) return;

  if (!animate || reducedMotion) {
    heroSlideIndex = nextIndex;
    applyHeroSlideContent(slides[heroSlideIndex], slides.length);
    return;
  }

  if (heroSlideAnimating) return;

  const els = getHeroSlideEls();
  heroSlideAnimating = true;
  const outClass = direction >= 0 ? "is-slide-out-next" : "is-slide-out-prev";

  els.forEach((el) => el.classList.add(outClass));

  setTimeout(() => {
    heroSlideIndex = nextIndex;
    applyHeroSlideContent(slides[heroSlideIndex], slides.length);

    const inClass = direction >= 0 ? "is-slide-in-next" : "is-slide-in-prev";
    els.forEach((el) => {
      el.classList.remove(outClass);
      el.classList.add(inClass);
    });

    requestAnimationFrame(() => {
      els.forEach((el) => el.classList.remove(inClass));
      heroSlideAnimating = false;
    });
  }, HERO_SLIDE_ANIM_MS);
}

function startHeroAutoSlide() {
  stopHeroAutoSlide();
  heroSlideTimer = setInterval(() => {
    updateHeroSlide(heroSlideIndex + 1, { direction: 1 });
  }, HERO_AUTO_SLIDE_MS);
}

function stopHeroAutoSlide() {
  if (heroSlideTimer) {
    clearInterval(heroSlideTimer);
    heroSlideTimer = null;
  }
}

function resetHeroAutoSlide() {
  stopHeroAutoSlide();
  startHeroAutoSlide();
}

function handleScroll() {
  const scrollY = window.scrollY;
  const threshold = window.innerHeight * 0.15;

  if (!scrollAutoLightUsed && scrollY > threshold) {
    setLit(true);
    scrollAutoLightUsed = true;
  }

  positionHeroLamp();
}

function initFilters() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => {
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      activeFilter = btn.dataset.filter;
      renderProducts(activeFilter);
    });
  });

  document.querySelectorAll("[data-filter]").forEach((el) => {
    if (el.classList.contains("filter-btn")) return;
    el.addEventListener("click", (e) => {
      const filter = el.dataset.filter;
      if (!filter) return;
      setTimeout(() => {
        document.querySelectorAll(".filter-btn").forEach((b) => {
          b.classList.toggle("is-active", b.dataset.filter === filter);
          b.setAttribute("aria-selected", b.dataset.filter === filter ? "true" : "false");
        });
        activeFilter = filter;
        renderProducts(filter);
      }, 400);
    });
  });
}

function positionHeroLamp() {
  const hero = document.getElementById("hero");
  const lamp = document.getElementById("lamp");
  const stage = document.querySelector(".hero__stage");
  const header = document.querySelector(".site-header");
  if (!hero || !lamp) return;

  const headerHeight = header ? header.offsetHeight : 72;
  let lampTop = headerHeight + 8;

  if (window.matchMedia("(max-width: 900px)").matches && stage) {
    const heroRect = hero.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const lampHeight = lamp.offsetHeight;
    const lowTop = stageRect.bottom - heroRect.top - lampHeight;
    lampTop = lampTop + (lowTop - lampTop) * 0.4;
  }

  hero.style.setProperty("--lamp-top", `${lampTop}px`);
  void lamp.offsetHeight;

  const lampRect = lamp.getBoundingClientRect();
  document.documentElement.style.setProperty("--lamp-cord-height", `${Math.max(lampRect.top, 0)}px`);
}

let cardObserver;

function observeCards(cards) {
  if (!cardObserver) {
    cardObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = "1";
            entry.target.style.transform = "translateY(0)";
          }
        });
      },
      { threshold: 0.1 }
    );
  }

  cards.forEach((el) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(24px)";
    el.style.transition = "opacity 0.6s ease, transform 0.6s ease";
    cardObserver.observe(el);
  });
}

async function init() {
  initLang();

  injectPendantLamp(document.getElementById("lampFixture"), "hero");
  injectPendantLamp(document.getElementById("aboutLamp"), "about");

  await loadContent();
  renderProducts();
  renderWorks();
  updateHeroSlide(0, { animate: false });
  positionHeroLamp();

  const lamp = document.getElementById("lamp");
  const lightSwitch = document.getElementById("lightSwitch");

  lamp.addEventListener("click", () => {
    takeManualLightControl();
    resetCloudNudge();
    toggleLight();
  });
  lightSwitch.addEventListener("change", () => {
    takeManualLightControl();
    resetCloudNudge();
    setLit(lightSwitch.checked);
  });

  document.getElementById("heroPrev").addEventListener("click", () => {
    updateHeroSlide(heroSlideIndex - 1, { direction: -1 });
    resetHeroAutoSlide();
  });
  document.getElementById("heroNext").addEventListener("click", () => {
    updateHeroSlide(heroSlideIndex + 1, { direction: 1 });
    resetHeroAutoSlide();
  });

  const hero = document.getElementById("hero");
  hero.addEventListener("mouseenter", stopHeroAutoSlide);
  hero.addEventListener("mouseleave", startHeroAutoSlide);
  hero.addEventListener("focusin", stopHeroAutoSlide);
  hero.addEventListener("focusout", startHeroAutoSlide);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopHeroAutoSlide();
    else startHeroAutoSlide();
  });
  startHeroAutoSlide();

  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", positionHeroLamp);
  requestAnimationFrame(positionHeroLamp);

  document.getElementById("contactForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.textContent = t("contact.sent");
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = t("contact.send");
      btn.disabled = false;
      e.target.reset();
    }, 3000);
  });

  window.addEventListener("languagechange", () => {
    updateHeroSlide(heroSlideIndex, { animate: false });
    renderProducts(activeFilter);
    renderWorks();
    syncCloudText();
  });

  initFilters();

  const updateHomeCart = () => {
    const n = cartCount();
    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      el.textContent = String(n);
      el.hidden = n === 0;
    });
  };
  updateHomeCart();
  window.addEventListener("cartchange", updateHomeCart);

  initMobileNav();
  mountWhatsAppFab();
  scheduleCloudLoop();

  document.querySelectorAll(".section__header").forEach((el) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(24px)";
    el.style.transition = "opacity 0.6s ease, transform 0.6s ease";
    observeCards([el]);
  });
}

init();
