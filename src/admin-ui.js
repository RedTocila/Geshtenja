let toastTimer = null;

export function showToast(message, type = "") {
  const el = document.getElementById("adminToast");
  if (!el || !message) return;
  el.textContent = message;
  el.className = "admin-toast";
  if (type) el.classList.add(`admin-toast--${type}`);
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("is-visible"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove("is-visible");
    setTimeout(() => {
      el.hidden = true;
    }, 250);
  }, 3200);
}

export function showLoading(listEl, label = "Loading…") {
  listEl.innerHTML = `
    <li class="admin-loading">
      <span class="admin-spinner" aria-hidden="true"></span>
      <span>${label}</span>
    </li>`;
}

export function showEmpty(listEl, { icon = "○", title, hint }) {
  listEl.innerHTML = `
    <li class="admin-empty">
      <span class="admin-empty__icon" aria-hidden="true">${icon}</span>
      <p class="admin-empty__title">${title}</p>
      ${hint ? `<p class="admin-empty__hint">${hint}</p>` : ""}
    </li>`;
}

export function updateCount(el, count, label, total = null) {
  if (!el) return;
  const showTotal = total != null && total !== count;
  if (count > 0 || showTotal) {
    el.hidden = false;
    el.textContent = showTotal
      ? `${count} of ${total} ${label}${total === 1 ? "" : "s"}`
      : `${count} ${label}${count === 1 ? "" : "s"}`;
  } else {
    el.hidden = true;
    el.textContent = "";
  }
}

export function resetFormFileLabels(form) {
  form?.querySelectorAll("[data-file-name]").forEach((el) => {
    const input = el.closest(".admin-file")?.querySelector(".admin-file__input");
    el.textContent = input?.multiple ? "No files chosen" : "No file chosen";
  });
}

const modalEscHandlers = new Map();

export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const handler = (e) => {
    if (e.key === "Escape") closeModal(modalId);
  };
  modalEscHandlers.set(modalId, handler);
  document.addEventListener("keydown", handler);

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  modal.querySelector(".admin-modal__close")?.focus();
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const handler = modalEscHandlers.get(modalId);
  if (handler) {
    document.removeEventListener("keydown", handler);
    modalEscHandlers.delete(modalId);
  }

  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

export function initModal(modalId, { onClose } = {}) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.querySelector(".admin-modal__backdrop")?.addEventListener("click", () => {
    onClose?.();
    closeModal(modalId);
  });

  modal.querySelector(".admin-modal__close")?.addEventListener("click", () => {
    onClose?.();
    closeModal(modalId);
  });
}
