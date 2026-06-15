import { supabase, isSupabaseConfigured, MEDIA_BUCKET } from "./lib/supabase.js";

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

const workForm = document.getElementById("workForm");
const workList = document.getElementById("workList");
const workFormTitle = document.getElementById("workFormTitle");
const workCancel = document.getElementById("workCancel");
const workError = document.getElementById("workError");
const workPreview = document.getElementById("workPreview");

let editingProduct = null;
let editingWork = null;

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
    setLoginStatus("Not connected — missing Supabase keys in .env. Restart npm run dev after adding them.", "is-bad");
    return false;
  }

  setLoginStatus("Checking connection…");

  const { error } = await supabase.from("products").select("id", { count: "exact", head: true });
  if (error) {
    if (error.code === "PGRST205") {
      setLoginStatus("Database not set up yet — run supabase/schema.sql in Supabase SQL Editor.", "is-bad");
    } else {
      setLoginStatus(`Connection error: ${error.message}`, "is-bad");
    }
    return false;
  }

  setLoginStatus("Connected to Geshtenja database", "is-ok");
  return true;
}

togglePassword?.addEventListener("click", () => {
  const show = loginPassword.type === "password";
  loginPassword.type = show ? "text" : "password";
  togglePassword.textContent = show ? "Hide password" : "Show password";
  togglePassword.setAttribute("aria-pressed", show ? "true" : "false");
});

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    showError(loginError, "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.");
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
  submitBtn.textContent = "Signing in…";
  const fd = new FormData(loginForm);
  const { error } = await supabase.auth.signInWithPassword({
    email: fd.get("email"),
    password: fd.get("password"),
  });
  submitBtn.disabled = false;
  submitBtn.textContent = "Sign in";
  if (error) {
    showError(loginError, error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
    return;
  }
  await checkSession();
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  showPanel(false);
  loginForm.reset();
});

document.querySelectorAll(".admin-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    document.querySelectorAll(".admin-tab-panel").forEach((p) => {
      p.hidden = p.id !== `tab-${tab.dataset.tab}`;
      p.classList.toggle("is-active", p.id === `tab-${tab.dataset.tab}`);
    });
  });
});

function resetProductForm() {
  editingProduct = null;
  productForm.reset();
  productFormTitle.textContent = "Add product";
  productCancel.hidden = true;
  productPreview.hidden = true;
  showError(productError, "");
}

function resetWorkForm() {
  editingWork = null;
  workForm.reset();
  workFormTitle.textContent = "Add portfolio work";
  workCancel.hidden = true;
  workPreview.hidden = true;
  showError(workError, "");
}

productCancel.addEventListener("click", resetProductForm);
workCancel.addEventListener("click", resetWorkForm);

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
  const { data, error } = await supabase.from("products").select("*").order("sort_order");
  if (error) throw error;
  productList.innerHTML = data.length
    ? data
        .map(
          (p) => `
      <li class="admin-list__item" data-id="${p.id}">
        <img class="admin-list__thumb" src="${p.image_url}" alt="" />
        <div class="admin-list__info">
          <p class="admin-list__title">${p.name}</p>
          <p class="admin-list__meta">${p.category}</p>
        </div>
        <div class="admin-list__actions">
          <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-edit-product="${p.id}">Edit</button>
          <button type="button" class="admin-btn admin-btn--danger admin-btn--small" data-delete-product="${p.id}">Delete</button>
        </div>
      </li>`
        )
        .join("")
    : '<li class="admin-muted">No products yet.</li>';

  productList.querySelectorAll("[data-edit-product]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = data.find((p) => p.id === btn.dataset.editProduct);
      if (!item) return;
      editingProduct = item;
      productForm.name.value = item.name;
      productForm.category.value = item.category;
      productForm.id.value = item.id;
      productFormTitle.textContent = "Edit product";
      productCancel.hidden = false;
      productPreview.hidden = false;
      productPreview.querySelector("img").src = item.image_url;
    });
  });

  productList.querySelectorAll("[data-delete-product]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this product?")) return;
      const { error: delError } = await supabase.from("products").delete().eq("id", btn.dataset.deleteProduct);
      if (delError) alert(delError.message);
      else await loadProducts();
    });
  });
}

async function loadWorks() {
  const { data, error } = await supabase.from("works").select("*").order("sort_order");
  if (error) throw error;
  workList.innerHTML = data.length
    ? data
        .map((w) => {
          const thumb = w.image_url
            ? `<img class="admin-list__thumb" src="${w.image_url}" alt="" />`
            : `<div class="admin-list__thumb admin-list__thumb--empty">No photo</div>`;
          const videoTag = w.video_url ? " · video" : "";
          return `
      <li class="admin-list__item" data-id="${w.id}">
        ${thumb}
        <div class="admin-list__info">
          <p class="admin-list__title">${w.title}</p>
          <p class="admin-list__meta">${w.type} · ${w.location}${videoTag}</p>
        </div>
        <div class="admin-list__actions">
          <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-edit-work="${w.id}">Edit</button>
          <button type="button" class="admin-btn admin-btn--danger admin-btn--small" data-delete-work="${w.id}">Delete</button>
        </div>
      </li>`;
        })
        .join("")
    : '<li class="admin-muted">No portfolio works yet.</li>';

  workList.querySelectorAll("[data-edit-work]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = data.find((w) => w.id === btn.dataset.editWork);
      if (!item) return;
      editingWork = item;
      workForm.title.value = item.title;
      workForm.type.value = item.type;
      workForm.location.value = item.location;
      workForm.id.value = item.id;
      workFormTitle.textContent = "Edit portfolio work";
      workCancel.hidden = false;
      if (item.image_url) {
        workPreview.hidden = false;
        workPreview.querySelector("img").src = item.image_url;
      }
    });
  });

  workList.querySelectorAll("[data-delete-work]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this work?")) return;
      const { error: delError } = await supabase.from("works").delete().eq("id", btn.dataset.deleteWork);
      if (delError) alert(delError.message);
      else await loadWorks();
    });
  });
}

async function loadAll() {
  try {
    await Promise.all([loadProducts(), loadWorks()]);
  } catch (err) {
    alert(err.message);
  }
}

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError(productError, "");
  const fd = new FormData(productForm);
  const imageFile = fd.get("image");
  let imageUrl = editingProduct?.image_url;

  try {
    if (imageFile?.size) {
      imageUrl = await uploadFile(imageFile, "products");
    }
    if (!imageUrl) {
      showError(productError, "Please add a photo.");
      return;
    }

    const payload = {
      name: fd.get("name"),
      category: fd.get("category"),
      image_url: imageUrl,
    };

    if (editingProduct) {
      const { error } = await supabase.from("products").update(payload).eq("id", editingProduct.id);
      if (error) throw error;
    } else {
      const { count } = await supabase.from("products").select("*", { count: "exact", head: true });
      const { error } = await supabase.from("products").insert({ ...payload, sort_order: (count || 0) + 1 });
      if (error) throw error;
    }

    resetProductForm();
    await loadProducts();
  } catch (err) {
    showError(productError, err.message);
  }
});

workForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError(workError, "");
  const fd = new FormData(workForm);
  const imageFile = fd.get("image");
  const videoFile = fd.get("video");
  let imageUrl = editingWork?.image_url ?? null;
  let videoUrl = editingWork?.video_url ?? null;

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

    if (editingWork) {
      const { error } = await supabase.from("works").update(payload).eq("id", editingWork.id);
      if (error) throw error;
    } else {
      const { count } = await supabase.from("works").select("*", { count: "exact", head: true });
      const { error } = await supabase.from("works").insert({ ...payload, sort_order: (count || 0) + 1 });
      if (error) throw error;
    }

    resetWorkForm();
    await loadWorks();
  } catch (err) {
    showError(workError, err.message);
  }
});

checkSession();
verifyConnection();
