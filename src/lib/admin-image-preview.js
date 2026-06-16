const PREVIEW_SIZE = 240;
const OFFSET = 16;

/** @type {HTMLDivElement | null} */
let previewEl = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let hideTimer = null;

function ensurePreview() {
  if (previewEl) return previewEl;

  previewEl = document.createElement("div");
  previewEl.className = "admin-img-preview";
  previewEl.hidden = true;
  previewEl.innerHTML = '<img alt="" />';
  document.body.appendChild(previewEl);
  return previewEl;
}

function positionPreview(clientX, clientY) {
  if (!previewEl) return;

  let left = clientX + OFFSET;
  let top = clientY + OFFSET;

  if (left + PREVIEW_SIZE > window.innerWidth - OFFSET) {
    left = clientX - PREVIEW_SIZE - OFFSET;
  }
  if (top + PREVIEW_SIZE > window.innerHeight - OFFSET) {
    top = clientY - PREVIEW_SIZE - OFFSET;
  }

  previewEl.style.left = `${Math.max(OFFSET, left)}px`;
  previewEl.style.top = `${Math.max(OFFSET, top)}px`;
}

function showPreview(thumb, clientX, clientY) {
  const preview = ensurePreview();
  const img = preview.querySelector("img");
  if (!(img instanceof HTMLImageElement) || !thumb.src) return;

  clearTimeout(hideTimer);
  hideTimer = null;
  img.src = thumb.src;
  img.alt = thumb.alt || "";
  preview.hidden = false;
  positionPreview(clientX, clientY);
}

function hidePreview() {
  hideTimer = setTimeout(() => {
    if (previewEl) previewEl.hidden = true;
  }, 80);
}

/**
 * Show an enlarged image when hovering admin thumbnails (delegated).
 * @param {string} [selector]
 */
export function initAdminImagePreview(selector = "img.admin-list__thumb") {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  document.addEventListener("mouseover", (e) => {
    const thumb = e.target.closest(selector);
    if (!(thumb instanceof HTMLImageElement) || !thumb.src) return;
    showPreview(thumb, e.clientX, e.clientY);
  });

  document.addEventListener("mousemove", (e) => {
    if (!previewEl || previewEl.hidden) return;
    const thumb = e.target.closest(selector);
    if (!(thumb instanceof HTMLImageElement)) return;
    positionPreview(e.clientX, e.clientY);
  });

  document.addEventListener("mouseout", (e) => {
    const thumb = e.target.closest(selector);
    if (!(thumb instanceof HTMLImageElement)) return;

    const related = e.relatedTarget;
    if (related instanceof Node && previewEl?.contains(related)) return;

    hidePreview();
  });
}
