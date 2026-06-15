import pendantSvg from "./assets/pendant-lamp.svg?raw";
import { supabase, isSupabaseConfigured } from "./lib/supabase.js";
import { FALLBACK_PRODUCTS, FALLBACK_WORKS, workGradient } from "./data/fallback.js";

const LAMP_GRADIENT_IDS = ["matteBlack", "neckMetal", "shadeSideLight", "beamGrad", "beamRimGrad"];
const LAMP_FILTER_IDS = ["beamSoft"];

function injectPendantLamp(container, prefix) {
  let svg = pendantSvg;
  [...LAMP_GRADIENT_IDS, ...LAMP_FILTER_IDS].forEach((id) => {
    svg = svg.replaceAll(`id="${id}"`, `id="${prefix}-${id}"`);
    svg = svg.replaceAll(`url(#${id})`, `url(#${prefix}-${id})`);
  });
  container.innerHTML = svg;
}

let products = [...FALLBACK_PRODUCTS];
let works = [...FALLBACK_WORKS];

const HERO_SLIDES = [
  { title: "Pendant", tagline: "Illuminate Your Space. Discover our curated lighting and decor. Find your perfect piece. From modern sconces to classic chandeliers, we offer a diverse range of styles to enhance any room. Let us help you find the perfect lighting." },
  { title: "Sconce", tagline: "Wall-mounted elegance for every corridor and reading nook. Our sconce collection blends sculptural form with warm, directed light." },
  { title: "Chandelier", tagline: "Make a statement overhead. From minimalist rings to cascading crystal forms, our chandeliers anchor the room." },
];

let isLit = false;
let scrollAutoLightUsed = false;
let heroSlideIndex = 0;
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
  const items = filter === "all" ? products : products.filter((p) => p.category === filter);

  grid.innerHTML = items
    .map((p) => {
      const image = p.image_url || p.image;
      return `
    <article class="product-card" data-category="${p.category}">
      <div class="product-card__visual">
        <img class="product-card__img" src="${image}" alt="${p.name}" loading="lazy" width="600" height="750" />
      </div>
      <div class="product-card__body">
        <span class="product-card__category">${p.category}</span>
        <h3 class="product-card__name">${p.name}</h3>
      </div>
    </article>
  `;
    })
    .join("");

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
        ? `<button type="button" class="work-card__play" data-video="${w.video_url}" aria-label="Play video">▶</button>`
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
        <button type="button" class="video-modal__close" aria-label="Close">×</button>
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

function setLit(lit) {
  if (isLit === lit) return;
  isLit = lit;
  document.body.classList.toggle("is-lit", lit);
  const lightSwitch = document.getElementById("lightSwitch");
  if (lightSwitch) lightSwitch.checked = lit;
}

function takeManualLightControl() {
  scrollAutoLightUsed = true;
}

function toggleLight() {
  takeManualLightControl();
  setLit(!isLit);
}

function updateHeroSlide(index) {
  heroSlideIndex = ((index % HERO_SLIDES.length) + HERO_SLIDES.length) % HERO_SLIDES.length;
  const slide = HERO_SLIDES[heroSlideIndex];
  document.getElementById("heroTitle").textContent = slide.title;
  document.getElementById("heroTagline").textContent = slide.tagline;
  document.getElementById("heroSlideNum").textContent = String(heroSlideIndex + 1).padStart(2, "0");
  document.getElementById("heroSlideNumNext").textContent = String((heroSlideIndex + 1) % HERO_SLIDES.length + 1).padStart(2, "0");
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
  const header = document.querySelector(".site-header");
  if (!hero || !lamp) return;

  const headerHeight = header ? header.offsetHeight : 72;

  hero.style.setProperty("--lamp-top", `${headerHeight + 8}px`);
  void lamp.offsetHeight;

  const lampRect = lamp.getBoundingClientRect();
  const cordHeight = Math.max(lampRect.top, 0);
  document.documentElement.style.setProperty("--lamp-cord-height", `${cordHeight}px`);
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
  injectPendantLamp(document.getElementById("lampFixture"), "hero");
  injectPendantLamp(document.getElementById("aboutLamp"), "about");

  await loadContent();
  renderProducts();
  renderWorks();
  updateHeroSlide(0);
  positionHeroLamp();

  const lamp = document.getElementById("lamp");
  const lightSwitch = document.getElementById("lightSwitch");

  lamp.addEventListener("click", toggleLight);
  lightSwitch.addEventListener("change", () => {
    takeManualLightControl();
    setLit(lightSwitch.checked);
  });

  document.getElementById("heroPrev").addEventListener("click", () => updateHeroSlide(heroSlideIndex - 1));
  document.getElementById("heroNext").addEventListener("click", () => updateHeroSlide(heroSlideIndex + 1));

  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", positionHeroLamp);
  requestAnimationFrame(positionHeroLamp);

  document.getElementById("contactForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.textContent = "Message Sent ✓";
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = "Send Message";
      btn.disabled = false;
      e.target.reset();
    }, 3000);
  });

  initFilters();

  document.querySelectorAll(".section__header").forEach((el) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(24px)";
    el.style.transition = "opacity 0.6s ease, transform 0.6s ease";
    observeCards([el]);
  });
}

init();
