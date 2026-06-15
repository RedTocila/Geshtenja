import { setLang, t } from "../i18n.js";

function getMenu(toggle) {
  const id = toggle.getAttribute("aria-controls");
  return id ? document.getElementById(id) : null;
}

function syncToggleLabel(toggle, open) {
  toggle.setAttribute("aria-label", t(open ? "nav.menuClose" : "nav.menuAria"));
}

function closeMenu(toggle) {
  const menu = getMenu(toggle);
  if (!toggle || !menu) return;
  menu.classList.remove("is-open");
  menu.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
  syncToggleLabel(toggle, false);
  document.body.classList.remove("mobile-nav-open");
}

function openMenu(toggle) {
  const menu = getMenu(toggle);
  if (!toggle || !menu) return;
  menu.hidden = false;
  requestAnimationFrame(() => {
    menu.classList.add("is-open");
  });
  toggle.setAttribute("aria-expanded", "true");
  syncToggleLabel(toggle, true);
  document.body.classList.add("mobile-nav-open");
}

function portalMenu(menu) {
  if (menu.dataset.portaled === "true") return;
  document.body.appendChild(menu);
  menu.dataset.portaled = "true";
}

/**
 * @param {ParentNode} [root]
 */
export function initMobileNav(root = document) {
  const headers =
    root instanceof Element && root.classList.contains("site-header")
      ? [root]
      : [...(root.querySelectorAll?.(".site-header") || [])];

  headers.forEach((header) => {
    if (header.dataset.navInit === "true") return;
    header.dataset.navInit = "true";

    const toggle = header.querySelector(".nav-toggle");
    if (!toggle) return;

    const menu = getMenu(toggle);
    if (!menu) return;

    portalMenu(menu);
    syncToggleLabel(toggle, false);

    toggle.addEventListener("click", () => {
      const isOpen = menu.classList.contains("is-open");
      if (isOpen) closeMenu(toggle);
      else openMenu(toggle);
    });

    menu.querySelector("[data-nav-close]")?.addEventListener("click", () => closeMenu(toggle));

    menu.querySelectorAll("a[href]").forEach((link) => {
      link.addEventListener("click", () => closeMenu(toggle));
    });

    header.querySelectorAll(".lang-switch__btn").forEach((btn) => {
      btn.addEventListener("click", () => setLang(btn.dataset.lang));
    });
  });

  if (!document.body.dataset.mobileNavKeyInit) {
    document.body.dataset.mobileNavKeyInit = "true";
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      document.querySelectorAll(".mobile-menu.is-open").forEach((menu) => {
        const id = menu.id;
        const toggle = document.querySelector(`.nav-toggle[aria-controls="${id}"]`);
        if (toggle) closeMenu(toggle);
      });
    });

    window.addEventListener("languagechange", () => {
      document.querySelectorAll(".nav-toggle").forEach((toggle) => {
        const open = toggle.getAttribute("aria-expanded") === "true";
        syncToggleLabel(toggle, open);
      });
    });
  }
}
