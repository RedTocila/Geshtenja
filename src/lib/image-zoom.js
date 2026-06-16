const DEFAULTS = {
  zoom: 2.8,
  lensSize: 180,
};

function canHoverZoom() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/**
 * Enable pointer-following magnify lens on images within root.
 * @param {ParentNode} root
 * @param {string} selector
 * @param {{ zoom?: number, lensSize?: number }} [options]
 */
export function applyImageZoom(root, selector, options = {}) {
  if (!canHoverZoom() || !root) return;

  const { zoom, lensSize } = { ...DEFAULTS, ...options };

  root.querySelectorAll(selector).forEach((img) => {
    if (!(img instanceof HTMLImageElement) || img.dataset.zoomReady) return;
    img.dataset.zoomReady = "1";

    const parent = img.parentElement;
    if (!parent) return;

    parent.classList.add("img-zoom");
    if (getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }

    const lens = document.createElement("div");
    lens.className = "img-zoom__lens";
    lens.setAttribute("aria-hidden", "true");
    lens.hidden = true;
    parent.appendChild(lens);

    const show = () => {
      if (!img.src) return;
      lens.hidden = false;
      parent.classList.add("img-zoom--active");
      lens.style.backgroundImage = `url("${img.currentSrc || img.src}")`;
    };

    const hide = () => {
      lens.hidden = true;
      parent.classList.remove("img-zoom--active");
    };

    const move = (e) => {
      const rect = img.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        hide();
        return;
      }

      lens.style.backgroundImage = `url("${img.currentSrc || img.src}")`;

      const pctX = x / rect.width;
      const pctY = y / rect.height;
      const bgW = rect.width * zoom;
      const bgH = rect.height * zoom;

      lens.style.width = `${lensSize}px`;
      lens.style.height = `${lensSize}px`;
      lens.style.left = `${x}px`;
      lens.style.top = `${y}px`;
      lens.style.backgroundSize = `${bgW}px ${bgH}px`;
      lens.style.backgroundPosition = `${-(pctX * bgW - lensSize / 2)}px ${-(pctY * bgH - lensSize / 2)}px`;
    };

    parent.addEventListener("mouseenter", show);
    parent.addEventListener("mouseleave", hide);
    parent.addEventListener("mousemove", move);
  });
}
