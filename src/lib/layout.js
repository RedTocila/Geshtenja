import { cartCount } from "./cart.js";
import { initLang, t, applyLanguage } from "../i18n.js";
import { initMobileNav } from "./mobile-nav.js";

const WHATSAPP_NUMBER = "35569696688";

/**
 * @param {HTMLElement} mount
 * @param {{ active?: string, showCart?: boolean }} [opts]
 */
export function mountShopHeader(mount, opts = {}) {
  const { active = "", showCart = true } = opts;
  const count = cartCount();

  mount.innerHTML = `
    <header class="site-header shop-header">
      <a href="/" class="brand" aria-label="Geshtenja Light home">
        <span class="brand__mark" aria-hidden="true">
          <img src="/logo.png" alt="" class="brand__logo brand__logo--off" width="40" height="40" />
          <img src="/logo-dark.png" alt="" class="brand__logo brand__logo--on" width="40" height="40" />
        </span>
        <span class="brand__name">Geshtenja Light</span>
      </a>
      <nav class="nav nav--desktop shop-nav" data-i18n-aria="nav.aria">
        <a href="/" class="${active === "home" ? "is-active" : ""}" data-i18n="nav.home">Home</a>
        <span class="nav-sep">/</span>
        <a href="/shop" class="${active === "shop" ? "is-active" : ""}" data-i18n="nav.shop">Shop</a>
        <span class="nav-sep">/</span>
        <a href="/#works" data-i18n="nav.works">Works</a>
        <span class="nav-sep">/</span>
        <a href="/#contact" data-i18n="nav.contact">Contact</a>
      </nav>
      <div class="header-actions">
        <div class="lang-switch header-actions__lang" role="group" aria-label="Choose language">
          <button type="button" class="lang-switch__btn is-active" data-lang="al" aria-pressed="true">AL</button>
          <button type="button" class="lang-switch__btn" data-lang="en" aria-pressed="false">EN</button>
        </div>
        ${
          showCart
            ? `<a href="/cart" class="cart-link header-actions__cart" aria-label="Shopping cart">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6h15l-1.5 9h-12L6 6z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
              <circle cx="9" cy="20" r="1.5" fill="currentColor"/>
              <circle cx="18" cy="20" r="1.5" fill="currentColor"/>
            </svg>
            <span class="cart-link__count" data-cart-count ${count ? "" : "hidden"}>${count}</span>
          </a>`
            : ""
        }
        <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="shopMobileMenu" data-i18n-aria="nav.menuAria">
          <span class="nav-toggle__line" aria-hidden="true"></span>
          <span class="nav-toggle__line" aria-hidden="true"></span>
          <span class="nav-toggle__line" aria-hidden="true"></span>
        </button>
      </div>
      <div class="mobile-menu" id="shopMobileMenu" hidden>
        <button type="button" class="mobile-menu__backdrop" data-nav-close tabindex="-1" aria-hidden="true"></button>
        <div class="mobile-menu__panel">
          <nav class="nav nav--mobile shop-nav" data-i18n-aria="nav.aria">
            <a href="/" class="${active === "home" ? "is-active" : ""}" data-i18n="nav.home">Home</a>
            <a href="/shop" class="${active === "shop" ? "is-active" : ""}" data-i18n="nav.shop">Shop</a>
            <a href="/#works" data-i18n="nav.works">Works</a>
            <a href="/#contact" data-i18n="nav.contact">Contact</a>
          </nav>
          <div class="mobile-menu__actions">
            ${
              showCart
                ? `<a href="/cart" class="cart-link" aria-label="Shopping cart">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6h15l-1.5 9h-12L6 6z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                  <circle cx="9" cy="20" r="1.5" fill="currentColor"/>
                  <circle cx="18" cy="20" r="1.5" fill="currentColor"/>
                </svg>
                <span class="cart-link__count" data-cart-count ${count ? "" : "hidden"}>${count}</span>
              </a>`
                : ""
            }
            <div class="lang-switch" role="group" aria-label="Choose language">
              <button type="button" class="lang-switch__btn is-active" data-lang="al" aria-pressed="true">AL</button>
              <button type="button" class="lang-switch__btn" data-lang="en" aria-pressed="false">EN</button>
            </div>
          </div>
        </div>
      </div>
    </header>
  `;

  initMobileNav(mount);
  applyLanguage();

  if (!mount.dataset.cartListener) {
    mount.dataset.cartListener = "true";
    window.addEventListener("cartchange", (e) => {
      const n = e.detail?.count ?? 0;
      mount.querySelectorAll("[data-cart-count]").forEach((el) => {
        el.textContent = String(n);
        el.hidden = n === 0;
      });
    });
  }
}

/** @param {HTMLElement} mount */
export function mountShopFooter(mount) {
  mount.innerHTML = `
    <footer class="site-footer shop-footer">
      <div class="site-footer__row">
        <p data-i18n="footer.rights">&copy; ${new Date().getFullYear()} Geshtenja Light. All rights reserved.</p>
        <nav data-i18n-aria="footer.aria">
          <a href="/shop" data-i18n="nav.shop">Shop</a>
          <a href="/#works" data-i18n="footer.works">Works</a>
          <a href="/#contact" data-i18n="footer.contact">Contact</a>
        </nav>
      </div>
      <p class="site-footer__credit">
        <span data-i18n="footer.builtBy">Built by</span>
        <a href="https://octosite.co" target="_blank" rel="noopener noreferrer">octosite.co</a>
      </p>
    </footer>
  `;
  applyLanguage();
}

export function mountWhatsAppFab() {
  if (document.getElementById("whatsappFab")) return;

  const link = document.createElement("a");
  link.id = "whatsappFab";
  link.className = "whatsapp-fab";
  link.href = `https://wa.me/${WHATSAPP_NUMBER}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.innerHTML = `
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.881 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  `;

  const syncLabel = () => {
    link.setAttribute("aria-label", t("contact.whatsappAria"));
  };

  syncLabel();
  document.body.appendChild(link);
  window.addEventListener("languagechange", syncLabel);
}

export function initShopPage() {
  initLang();
  document.body.classList.add("is-lit", "shop-page");
  mountWhatsAppFab();
}
