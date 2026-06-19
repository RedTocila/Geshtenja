import { supabase, isSupabaseConfigured, MEDIA_BUCKET } from "./lib/supabase.js";
import { slugify } from "./lib/format.js";
import { initLang, t, categoryLabel } from "./i18n.js";
import { loadOrderMetrics, initOrdersTab, refreshOrdersUi } from "./admin-orders.js";
import { initInventoryTab, renderInventory, renderInventoryTagFilters } from "./admin-inventory.js";
import { showToast, showLoading, showEmpty, updateCount, openModal, closeModal, initModal, resetFormFileLabels } from "./admin-ui.js";
import {
  fetchTags,
  getTags,
  initTagsTab,
  syncProductTags,
  renderProductTagPicker,
  getSelectedTagIdsFromForm,
  productMatchesFilters,
  renderProductTagChips,
  setTagsChangedHandler,
} from "./admin-tags.js";
import { initAdminImagePreview } from "./lib/admin-image-preview.js";
import { setAdminTitle, fillCategorySelect, refreshAdminFileLabels } from "./lib/admin-i18n.js";
import { initProductImport, refreshProductImportUi } from "./admin-product-import.js";
import {
  initProductBulk,
  refreshProductBulkUi,
  productBulkCheckboxHtml,
  bindProductListBulk,
  isProductSelected,
} from "./admin-product-bulk.js";

const loginPanel = document.getElementById("loginPanel");
const dashboardPanel = document.getElementById("dashboardPanel");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginStatus = document.getElementById("loginStatus");
const loginPassword = document.getElementById("loginPassword");
const togglePassword = document.getElementById("togglePassword");
const adminEmail = document.getElementById("adminEmail");
const logoutBtn = document.getElementById("logoutBtn");

const productForm = document.getElementById("productForm");
const productList = document.getElementById("productList");
const productFormTitle = document.getElementById("productFormTitle");
const productCancel = document.getElementById("productCancel");
const productError = document.getElementById("productError");
const productPreview = document.getElementById("productPreview");
const addProductBtn = document.getElementById("addProductBtn");

const workForm = document.getElementById("workForm");
const workList = document.getElementById("workList");
const workFormTitle = document.getElementById("workFormTitle");
const workCancel = document.getElementById("workCancel");
const workError = document.getElementById("workError");
const workPreview = document.getElementById("workPreview");
const addWorkBtn = document.getElementById("addWorkBtn");
const productSearch = document.getElementById("productSearch");
const productTagFilters = document.getElementById("productTagFilters");
const productTagOptions = document.getElementById("productTagOptions");

let editingProduct = null;
let editingWork = null;
let productsCache = [];
let worksCache = [];
let productFilterTag = "";

function setFormRecordId(form, id) {
  const field = form.querySelector('[name="record_id"]');
  if (field) field.value = id ?? "";
}

function showError(el, message) {
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function setLoginStatus(message, type = "") {
  if (!loginStatus) return;
  loginStatus.textContent = message;
  loginStatus.classList.remove("is-ok", "is-bad");
  if (type) loginStatus.classList.add(type);
}

async function verifyConnection() {
  if (!requireSupabase()) {
    setLoginStatus(t("admin.login.notConnected"), "is-bad");
    return false;
  }

  setLoginStatus(t("admin.login.checking"));

  const { error } = await supabase.from("products").select("id", { count: "exact", head: true });
  if (error) {
    if (error.code === "PGRST205") {
      setLoginStatus(t("admin.login.dbNotSetup"), "is-bad");
    } else {
      setLoginStatus(`${error.message}`, "is-bad");
    }
    return false;
  }

  setLoginStatus(t("admin.login.connected"), "is-ok");
  return true;
}

togglePassword?.addEventListener("click", () => {
  const show = loginPassword.type === "password";
  loginPassword.type = show ? "text" : "password";
  const labelKey = show ? "admin.login.hidePassword" : "admin.login.showPassword";
  togglePassword.setAttribute("aria-label", t(labelKey));
  togglePassword.setAttribute("aria-pressed", show ? "true" : "false");
  togglePassword.querySelector(".admin-password-toggle__icon--show")?.toggleAttribute("hidden", show);
  togglePassword.querySelector(".admin-password-toggle__icon--hide")?.toggleAttribute("hidden", !show);
});

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    showError(loginError, t("admin.login.notConfigured"));
    return false;
  }
  return true;
}

async function uploadFile(file, folder) {
  const ext = file.name.split(".").pop();
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function showPanel(loggedIn) {
  loginPanel.hidden = loggedIn;
  dashboardPanel.hidden = !loggedIn;
}

async function checkSession() {
  if (!requireSupabase()) return;
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    adminEmail.textContent = data.session.user.email;
    showPanel(true);
    await loadAll();
  } else {
    showPanel(false);
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!requireSupabase()) return;
  showError(loginError, "");
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = t("admin.login.signingIn");
  const fd = new FormData(loginForm);
  const { error } = await supabase.auth.signInWithPassword({
    email: fd.get("email"),
    password: fd.get("password"),
  });
  submitBtn.disabled = false;
  submitBtn.textContent = t("admin.login.signIn");
  if (error) {
    showError(loginError, error.message === "Invalid login credentials" ? t("admin.login.wrongCredentials") : error.message);
    return;
  }
  await checkSession();
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  showPanel(false);
  loginForm.reset();
});

function setSidebarOpen(open) {
  const shell = document.querySelector(".admin-shell");
  const toggle = document.getElementById("sidebarToggle");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (!shell || !toggle || !backdrop) return;
  shell.classList.toggle("is-sidebar-open", open);
  backdrop.hidden = !open;
  backdrop.classList.toggle("is-visible", open);
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  toggle.setAttribute("aria-label", open ? t("admin.sidebar.closeMenu") : t("admin.sidebar.openMenu"));
}

function initSidebar() {
  const toggle = document.getElementById("sidebarToggle");
  const backdrop = document.getElementById("sidebarBackdrop");
  toggle?.addEventListener("click", () => {
    const open = !document.querySelector(".admin-shell")?.classList.contains("is-sidebar-open");
    setSidebarOpen(open);
  });
  backdrop?.addEventListener("click", () => setSidebarOpen(false));
}

document.querySelectorAll(".admin-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((t) => {
      t.classList.remove("is-active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("is-active");
    tab.setAttribute("aria-selected", "true");
    document.querySelectorAll(".admin-tab-panel").forEach((p) => {
      const active = p.id === `tab-${tab.dataset.tab}`;
      p.hidden = !active;
      p.classList.toggle("is-active", active);
    });
    const titleEl = document.getElementById("mainTopbarTitle");
    if (titleEl) {
      titleEl.textContent = t(`admin.tabs.${tab.dataset.tab}`);
      titleEl.dataset.i18n = `admin.tabs.${tab.dataset.tab}`;
    }
    setSidebarOpen(false);
    if (tab.dataset.tab === "orders") loadOrderMetrics();
    if (tab.dataset.tab === "tags") loadTagsList?.();
    if (tab.dataset.tab === "inventory") renderInventory(productsCache);
  });
});

function resetProductForm() {
  editingProduct = null;
  productForm.reset();
  productForm.stock_quantity.value = 10;
  productForm.in_stock.checked = true;
  setFormRecordId(productForm, "");
  setAdminTitle(productFormTitle, "admin.products.addTitle");
  productPreview.hidden = true;
  showError(productError, "");
  resetFormFileLabels(productForm);
  renderProductTagPicker(productTagOptions, []);
}

function resetWorkForm() {
  editingWork = null;
  workForm.reset();
  setFormRecordId(workForm, "");
  setAdminTitle(workFormTitle, "admin.works.addTitle");
  workPreview.hidden = true;
  showError(workError, "");
  resetFormFileLabels(workForm);
}

function closeProductModal() {
  resetProductForm();
  closeModal("productModal");
}

function closeWorkModal() {
  resetWorkForm();
  closeModal("workModal");
}

function openProductModal(item = null) {
  resetProductForm();
  fillCategorySelect(productForm.category, item?.category);
  if (item) {
    editingProduct = item;
    productForm.name.value = item.name;
    productForm.slug.value = item.slug || "";
    productForm.short_description.value = item.short_description || "";
    productForm.description.value = item.description || "";
    productForm.category.value = item.category;
    productForm.price.value = item.price ?? "";
    productForm.sale_price.value = item.sale_price ?? "";
    productForm.sku.value = item.sku || "";
    productForm.stock_quantity.value = item.stock_quantity ?? 0;
    productForm.in_stock.checked = item.in_stock !== false;
    productForm.is_featured.checked = !!item.is_featured;
    setFormRecordId(productForm, item.id);
    setAdminTitle(productFormTitle, "admin.products.editTitle");
    productPreview.hidden = false;
    productPreview.querySelector("img").src = item.image_url;
    const tagIds = (item.product_tags || []).map((row) => row.tag?.id).filter(Boolean);
    renderProductTagPicker(productTagOptions, tagIds);
  } else {
    renderProductTagPicker(productTagOptions, []);
  }
  openModal("productModal");
}

function openWorkModal(item = null) {
  resetWorkForm();
  if (item) {
    editingWork = item;
    workForm.title.value = item.title;
    workForm.type.value = item.type;
    workForm.location.value = item.location;
    setFormRecordId(workForm, item.id);
    setAdminTitle(workFormTitle, "admin.works.editTitle");
    if (item.image_url) {
      workPreview.hidden = false;
      workPreview.querySelector("img").src = item.image_url;
    }
  }
  openModal("workModal");
}

addProductBtn?.addEventListener("click", () => openProductModal());
addWorkBtn?.addEventListener("click", () => openWorkModal());
productCancel.addEventListener("click", closeProductModal);
workCancel.addEventListener("click", closeWorkModal);

productForm.querySelector('input[name="image"]').addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  productPreview.hidden = false;
  productPreview.querySelector("img").src = URL.createObjectURL(file);
});

workForm.querySelector('input[name="image"]').addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  workPreview.hidden = false;
  workPreview.querySelector("img").src = URL.createObjectURL(file);
});

async function loadProducts() {
  showLoading(productList, t("admin.products.loading"));
  let query = supabase
    .from("products")
    .select("*, product_images(id, image_url, sort_order), product_tags(tag:tags(id, name, slug))")
    .order("sort_order");

  let { data, error } = await query;

  if (error?.code === "PGRST200" || error?.message?.includes("product_tags")) {
    ({ data, error } = await supabase
      .from("products")
      .select("*, product_images(id, image_url, sort_order)")
      .order("sort_order"));
  }

  if (error) throw error;

  productsCache = data || [];
  renderProductTagFilters();
  renderInventoryTagFilters();
  renderProductList();
  renderInventory(productsCache);
}

function renderProductTagFilters() {
  if (!productTagFilters) return;

  const tags = getTags();
  const categorySlugs = new Set(["pendant", "sconce", "chandelier", "floor", "office"]);
  productTagFilters.innerHTML = `
    <button type="button" class="admin-pill-btn${productFilterTag === "" ? " is-active" : ""}" data-product-tag="">${t("admin.common.all")}</button>
    ${tags
      .map((tag) => {
        const label = categorySlugs.has(tag.slug) ? categoryLabel(tag.slug) : tag.name;
        return `<button type="button" class="admin-pill-btn${productFilterTag === tag.id ? " is-active" : ""}" data-product-tag="${tag.id}">${label}</button>`;
      })
      .join("")}
  `;

  productTagFilters.querySelectorAll("[data-product-tag]").forEach((btn) => {
    btn.addEventListener("click", () => {
      productFilterTag = btn.dataset.productTag || "";
      productTagFilters.querySelectorAll("[data-product-tag]").forEach((b) => {
        b.classList.toggle("is-active", b.dataset.productTag === productFilterTag);
      });
      renderProductList();
    });
  });
}

function renderProductList() {
  const search = productSearch?.value || "";
  const filtered = productsCache.filter((p) => productMatchesFilters(p, { search, tagId: productFilterTag }));

  updateCount(document.getElementById("productCount"), filtered.length, "item", productsCache.length);

  if (!productsCache.length) {
    showEmpty(productList, {
      icon: "◈",
      title: t("admin.products.emptyTitle"),
      hint: t("admin.products.emptyHint"),
    });
    bindProductListBulk(productList, []);
    return;
  }

  if (!filtered.length) {
    showEmpty(productList, {
      icon: "⌕",
      title: t("admin.products.noMatchTitle"),
      hint: t("admin.products.noMatchHint"),
    });
    bindProductListBulk(productList, []);
    return;
  }

  productList.innerHTML = filtered
    .map((p) => {
      const tags = (p.product_tags || []).map((row) => row.tag).filter(Boolean);
      return `
      <li class="admin-list__item${isProductSelected(p.id) ? " admin-list__item--selected" : ""}" data-id="${p.id}">
        ${productBulkCheckboxHtml(p.id)}
        <img class="admin-list__thumb" src="${p.image_url}" alt="" />
        <div class="admin-list__info">
          <p class="admin-list__title">${p.name}</p>
          <p class="admin-list__meta">${p.category} · €${p.price}${p.sale_price ? ` → €${p.sale_price}` : ""} · stock ${p.stock_quantity}</p>
          ${renderProductTagChips(tags)}
        </div>
        <div class="admin-list__actions">
          <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-edit-product="${p.id}">${t("admin.common.edit")}</button>
          <button type="button" class="admin-btn admin-btn--danger admin-btn--small" data-delete-product="${p.id}">${t("admin.common.delete")}</button>
        </div>
      </li>`;
    })
    .join("");

  productList.querySelectorAll("[data-edit-product]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = productsCache.find((p) => p.id === btn.dataset.editProduct);
      if (item) openProductModal(item);
    });
  });

  productList.querySelectorAll("[data-delete-product]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm(t("admin.products.deleteConfirm"))) return;
      const { error: delError } = await supabase.from("products").delete().eq("id", btn.dataset.deleteProduct);
      if (delError) showToast(delError.message, "error");
      else {
        showToast(t("admin.products.deleted"), "success");
        await loadProducts();
      }
    });
  });

  bindProductListBulk(
    productList,
    filtered.map((p) => p.id)
  );
}

async function loadWorks() {
  showLoading(workList, t("admin.works.loading"));
  const { data, error } = await supabase.from("works").select("*").order("sort_order");
  if (error) throw error;

  worksCache = data || [];
  updateCount(document.getElementById("workCount"), worksCache.length, "work");

  if (!worksCache.length) {
    showEmpty(workList, {
      icon: "◇",
      title: t("admin.works.emptyTitle"),
      hint: t("admin.works.emptyHint"),
    });
    return;
  }

  workList.innerHTML = worksCache
    .map((w, index) => {
          const thumb = w.image_url
            ? `<img class="admin-list__thumb" src="${w.image_url}" alt="" />`
            : `<div class="admin-list__thumb admin-list__thumb--empty">${t("admin.works.noPhoto")}</div>`;
          const videoTag = w.video_url ? ` · ${t("admin.works.video")}` : "";
          const isFirst = index === 0;
          const isLast = index === worksCache.length - 1;
          return `
      <li class="admin-list__item" data-id="${w.id}">
        <div class="admin-list__reorder">
          <button type="button" class="admin-btn admin-btn--ghost admin-btn--icon" data-move-work-up="${w.id}" ${isFirst ? "disabled" : ""} aria-label="${t("admin.works.moveUp")}">↑</button>
          <span class="admin-list__order" aria-hidden="true">${index + 1}</span>
          <button type="button" class="admin-btn admin-btn--ghost admin-btn--icon" data-move-work-down="${w.id}" ${isLast ? "disabled" : ""} aria-label="${t("admin.works.moveDown")}">↓</button>
        </div>
        ${thumb}
        <div class="admin-list__info">
          <p class="admin-list__title">${w.title}</p>
          <p class="admin-list__meta">${w.type} · ${w.location}${videoTag}</p>
        </div>
        <div class="admin-list__actions">
          <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-edit-work="${w.id}">${t("admin.common.edit")}</button>
          <button type="button" class="admin-btn admin-btn--danger admin-btn--small" data-delete-work="${w.id}">${t("admin.common.delete")}</button>
        </div>
      </li>`;
    })
    .join("");

  workList.querySelectorAll("[data-edit-work]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = worksCache.find((w) => w.id === btn.dataset.editWork);
      if (item) openWorkModal(item);
    });
  });

  workList.querySelectorAll("[data-move-work-up]").forEach((btn) => {
    btn.addEventListener("click", () => moveWork(btn.dataset.moveWorkUp, -1));
  });

  workList.querySelectorAll("[data-move-work-down]").forEach((btn) => {
    btn.addEventListener("click", () => moveWork(btn.dataset.moveWorkDown, 1));
  });

  workList.querySelectorAll("[data-delete-work]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm(t("admin.works.deleteConfirm"))) return;
      const { error: delError } = await supabase.from("works").delete().eq("id", btn.dataset.deleteWork);
      if (delError) showToast(delError.message, "error");
      else {
        showToast(t("admin.works.deleted"), "success");
        await loadWorks();
      }
    });
  });
}

/** @param {string} workId @param {-1 | 1} direction */
async function moveWork(workId, direction) {
  const index = worksCache.findIndex((w) => w.id === workId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= worksCache.length) return;

  const reordered = [...worksCache];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

  try {
    const results = await Promise.all(
      reordered.map((work, i) =>
        supabase.from("works").update({ sort_order: i + 1 }).eq("id", work.id)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
    await loadWorks();
    showToast(t("admin.works.orderUpdated"), "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function loadAll() {
  try {
    await fetchTags();
    await Promise.all([loadProducts(), loadWorks(), loadOrderMetrics()]);
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function saveProductImages(productId, galleryFiles, startOrder = 0) {
  const files = [...galleryFiles].filter((f) => f?.size);
  for (let i = 0; i < files.length; i++) {
    const url = await uploadFile(files[i], "products");
    await supabase.from("product_images").insert({
      product_id: productId,
      image_url: url,
      sort_order: startOrder + i + 1,
    });
  }
}

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError(productError, "");
  const submitBtn = productForm.querySelector('button[type="submit"]');
  const fd = new FormData(productForm);
  const imageFile = fd.get("image");
  const galleryFiles = productForm.querySelector('input[name="gallery"]').files;
  const editingId = editingProduct?.id || fd.get("record_id") || null;
  const wasEditing = !!editingId;
  let imageUrl = editingProduct?.image_url;

  submitBtn.disabled = true;
  submitBtn.textContent = wasEditing ? t("admin.products.saving") : t("admin.products.adding");

  try {
    if (imageFile?.size) {
      imageUrl = await uploadFile(imageFile, "products");
    }
    if (!imageUrl) {
      showError(productError, t("admin.products.photoRequired"));
      return;
    }

    const name = fd.get("name");
    const slug = (fd.get("slug") || slugify(name)).trim() || slugify(name);
    const saleRaw = fd.get("sale_price");
    const payload = {
      name,
      slug,
      short_description: fd.get("short_description") || null,
      description: fd.get("description") || null,
      category: fd.get("category"),
      image_url: imageUrl,
      price: Number(fd.get("price")) || 0,
      sale_price: saleRaw ? Number(saleRaw) : null,
      sku: fd.get("sku") || null,
      stock_quantity: Number(fd.get("stock_quantity")) || 0,
      in_stock: fd.get("in_stock") === "on",
      is_featured: fd.get("is_featured") === "on",
      updated_at: new Date().toISOString(),
    };

    let productId;

    if (wasEditing) {
      const { error } = await supabase.from("products").update(payload).eq("id", editingId);
      if (error) throw error;
      productId = editingId;
    } else {
      const { count } = await supabase.from("products").select("*", { count: "exact", head: true });
      const { data: inserted, error } = await supabase
        .from("products")
        .insert({ ...payload, sort_order: (count || 0) + 1 })
        .select("id")
        .single();
      if (error) throw error;
      if (!inserted?.id) {
        throw new Error("Product could not be saved. Check your connection and try again.");
      }
      productId = inserted.id;
    }

    if (galleryFiles?.length) {
      const { count: imgCount } = await supabase
        .from("product_images")
        .select("*", { count: "exact", head: true })
        .eq("product_id", productId);
      await saveProductImages(productId, galleryFiles, imgCount || 0);
    }

    await syncProductTags(productId, getSelectedTagIdsFromForm(productForm));

    closeProductModal();
    await loadProducts();
    showToast(wasEditing ? t("admin.products.updated") : t("admin.products.added"), "success");
  } catch (err) {
    showError(productError, err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = t("admin.products.save");
  }
});

workForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError(workError, "");
  const submitBtn = workForm.querySelector('button[type="submit"]');
  const fd = new FormData(workForm);
  const imageFile = fd.get("image");
  const videoFile = fd.get("video");
  const editingId = editingWork?.id || fd.get("record_id") || null;
  const wasEditing = !!editingId;
  let imageUrl = editingWork?.image_url ?? null;
  let videoUrl = editingWork?.video_url ?? null;

  submitBtn.disabled = true;
  submitBtn.textContent = wasEditing ? t("admin.works.saving") : t("admin.works.adding");

  try {
    if (imageFile?.size) {
      imageUrl = await uploadFile(imageFile, "works");
    }
    if (videoFile?.size) {
      videoUrl = await uploadFile(videoFile, "works");
    }

    const payload = {
      title: fd.get("title"),
      type: fd.get("type"),
      location: fd.get("location"),
      image_url: imageUrl,
      video_url: videoUrl,
    };

    if (wasEditing) {
      const { error } = await supabase.from("works").update(payload).eq("id", editingId);
      if (error) throw error;
    } else {
      const { count } = await supabase.from("works").select("*", { count: "exact", head: true });
      const { data: inserted, error } = await supabase
        .from("works")
        .insert({ ...payload, sort_order: (count || 0) + 1 })
        .select("id")
        .single();
      if (error) throw error;
      if (!inserted?.id) {
        throw new Error("Portfolio work could not be saved. Check your connection and try again.");
      }
    }

    closeWorkModal();
    await loadWorks();
    showToast(wasEditing ? t("admin.works.updated") : t("admin.works.added"), "success");
  } catch (err) {
    showError(workError, err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = t("admin.works.save");
  }
});

initLang();

function refreshAdminDynamicUi() {
  if (dashboardPanel.hidden) return;
  const activeTab = document.querySelector(".admin-tab.is-active")?.dataset.tab;
  const titleEl = document.getElementById("mainTopbarTitle");
  if (titleEl && activeTab) {
    setAdminTitle(titleEl, `admin.tabs.${activeTab}`);
  }

  setAdminTitle(
    productFormTitle,
    editingProduct ? "admin.products.editTitle" : "admin.products.addTitle"
  );
  setAdminTitle(workFormTitle, editingWork ? "admin.works.editTitle" : "admin.works.addTitle");

  fillCategorySelect(productForm?.category, productForm?.category?.value);
  renderProductTagPicker(productTagOptions, getSelectedTagIdsFromForm(productForm));
  refreshTagsUi?.();

  renderProductTagFilters();
  renderInventoryTagFilters();
  renderProductList();
  renderInventory(productsCache);
  loadWorks().catch(() => {});
  loadTagsList?.();
  refreshOrdersUi?.();
  refreshProductImportUi?.();
  refreshProductBulkUi?.();
  refreshAdminFileLabels();
}

window.addEventListener("languagechange", refreshAdminDynamicUi);

checkSession();
verifyConnection();
initSidebar();
initModal("productModal", { onClose: resetProductForm });
initModal("workModal", { onClose: resetWorkForm });
initProductImport(async () => {
  await loadProducts();
});
initProductBulk({
  onUpdated: loadProducts,
});
const { load: loadTagsList, refreshTagsUi } = initTagsTab();
setTagsChangedHandler(async () => {
  renderProductTagFilters();
  renderInventoryTagFilters();
  renderProductTagPicker(productTagOptions, getSelectedTagIdsFromForm(productForm));
  try {
    await loadProducts();
  } catch (err) {
    showToast(err.message, "error");
  }
});
initOrdersTab();
initInventoryTab();
initAdminImagePreview();
initFileFields();

productSearch?.addEventListener("input", () => renderProductList());

function initFileFields() {
  document.querySelectorAll(".admin-file__input").forEach((input) => {
    const wrap = input.closest(".admin-file");
    const nameEl = wrap?.querySelector("[data-file-name]");
    if (!nameEl) return;

    const updateName = () => {
      if (!input.files?.length) {
        nameEl.textContent = input.multiple ? t("admin.common.noFiles") : t("admin.common.noFile");
        return;
      }
      nameEl.textContent = [...input.files].map((f) => f.name).join(", ");
    };

    updateName();
    input.addEventListener("change", updateName);
  });
}
