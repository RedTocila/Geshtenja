import { supabase } from "./lib/supabase.js";
import { slugify } from "./lib/format.js";
import { t, categoryLabel } from "./i18n.js";
import { showToast, showLoading, showEmpty, updateCount, openModal, closeModal, initModal } from "./admin-ui.js";
import { setAdminTitle } from "./lib/admin-i18n.js";

const CATEGORY_TAG_SLUGS = new Set(["pendant", "sconce", "chandelier", "floor", "office"]);

function tagDisplayName(tag) {
  if (CATEGORY_TAG_SLUGS.has(tag.slug)) return categoryLabel(tag.slug);
  return tag.name;
}

/** Match the five category filters on the public site. */
const DEFAULT_TAGS = [
  { name: "Pendant", slug: "pendant" },
  { name: "Sconce", slug: "sconce" },
  { name: "Chandelier", slug: "chandelier" },
  { name: "Floor lamp", slug: "floor" },
  { name: "Office", slug: "office" },
];

let tagsCache = [];
let tagUsageCounts = new Map();
let onTagsChanged = null;
let defaultTagsEnsured = false;

async function ensureDefaultTags() {
  if (defaultTagsEnsured) return;

  const { count, error: countError } = await supabase.from("tags").select("*", { count: "exact", head: true });
  if (countError) {
    if (countError.code === "PGRST205") return;
    throw countError;
  }

  if ((count || 0) === 0) {
    const { error: insertError } = await supabase.from("tags").insert(DEFAULT_TAGS);
    if (insertError) throw insertError;
  }

  await linkProductsToCategoryTags();
  defaultTagsEnsured = true;
}

async function linkProductsToCategoryTags() {
  const [{ data: tags, error: tagsError }, { data: products, error: productsError }] = await Promise.all([
    supabase.from("tags").select("id, slug").in("slug", DEFAULT_TAGS.map((t) => t.slug)),
    supabase.from("products").select("id, category"),
  ]);

  if (tagsError) throw tagsError;
  if (productsError) throw productsError;
  if (!tags?.length || !products?.length) return;

  const tagBySlug = new Map(tags.map((tag) => [tag.slug, tag.id]));
  const { data: existingLinks, error: linksError } = await supabase.from("product_tags").select("product_id, tag_id");
  if (linksError) throw linksError;

  const linked = new Set((existingLinks || []).map((row) => `${row.product_id}:${row.tag_id}`));
  const toInsert = [];

  for (const product of products) {
    const tagId = tagBySlug.get(product.category);
    if (!tagId) continue;
    const key = `${product.id}:${tagId}`;
    if (!linked.has(key)) toInsert.push({ product_id: product.id, tag_id: tagId });
  }

  if (toInsert.length) {
    const { error: insertError } = await supabase.from("product_tags").insert(toInsert);
    if (insertError) throw insertError;
  }
}

export function getTags() {
  return tagsCache;
}

export function getTagUsageCount(tagId) {
  return tagUsageCounts.get(tagId) || 0;
}

export function setTagsChangedHandler(fn) {
  onTagsChanged = fn;
}

async function notifyTagsChanged() {
  await fetchTags();
  onTagsChanged?.();
}

export async function fetchTags() {
  await ensureDefaultTags();

  const [{ data: tags, error: tagsError }, { data: links, error: linksError }] = await Promise.all([
    supabase.from("tags").select("id, name, slug, created_at").order("name"),
    supabase.from("product_tags").select("product_id, tag_id"),
  ]);

  if (tagsError?.code === "PGRST205" || linksError?.code === "PGRST205") {
    tagsCache = [];
    tagUsageCounts = new Map();
    return tagsCache;
  }

  if (tagsError) throw tagsError;
  if (linksError) throw linksError;

  tagUsageCounts = new Map();
  for (const link of links || []) {
    tagUsageCounts.set(link.tag_id, (tagUsageCounts.get(link.tag_id) || 0) + 1);
  }

  tagsCache = tags || [];
  return tagsCache;
}

export async function syncProductTags(productId, tagIds) {
  const { error: deleteError } = await supabase.from("product_tags").delete().eq("product_id", productId);
  if (deleteError) throw deleteError;

  const uniqueIds = [...new Set(tagIds.filter(Boolean))];
  if (!uniqueIds.length) return;

  const { error: insertError } = await supabase.from("product_tags").insert(
    uniqueIds.map((tag_id) => ({ product_id: productId, tag_id }))
  );
  if (insertError) throw insertError;
}

/** @param {string} productId @param {string[]} tagIds */
export async function addProductTags(productId, tagIds) {
  const uniqueIds = [...new Set(tagIds.filter(Boolean))];
  if (!uniqueIds.length) return;

  const { data: existing, error: fetchError } = await supabase
    .from("product_tags")
    .select("tag_id")
    .eq("product_id", productId);
  if (fetchError) throw fetchError;

  const have = new Set((existing ?? []).map((row) => row.tag_id));
  const toAdd = uniqueIds.filter((id) => !have.has(id));
  if (!toAdd.length) return;

  const { error: insertError } = await supabase.from("product_tags").insert(
    toAdd.map((tag_id) => ({ product_id: productId, tag_id }))
  );
  if (insertError) throw insertError;
}

/** @param {string} productId */
export async function clearProductTags(productId) {
  const { error } = await supabase.from("product_tags").delete().eq("product_id", productId);
  if (error) throw error;
}

/** @param {HTMLElement} container */
export function getSelectedTagIdsFromContainer(container) {
  if (!container) return [];
  return [...container.querySelectorAll('input[name="bulk_tag_ids"]:checked')].map((input) => input.value);
}

/** @param {HTMLElement} container @param {string[]} [selectedIds] @param {string} [inputName] */
export function renderProductTagPicker(container, selectedIds = [], inputName = "tag_ids") {
  if (!container) return;
  const selected = new Set(selectedIds);

  if (!tagsCache.length) {
    container.innerHTML = `<p class="admin-muted admin-tag-picker__empty">${t("admin.products.tagsEmpty")}</p>`;
    return;
  }

  container.innerHTML = tagsCache
    .map(
      (tag) => `
      <label class="admin-tag-option">
        <input type="checkbox" class="admin-check admin-tag-option__input" name="${inputName}" value="${tag.id}" ${selected.has(tag.id) ? "checked" : ""} />
        <span>${tagDisplayName(tag)}</span>
      </label>`
    )
    .join("");
}

export function getSelectedTagIdsFromForm(form) {
  return [...form.querySelectorAll('input[name="tag_ids"]:checked')].map((input) => input.value);
}

function extractProductTags(product) {
  return (product.product_tags || []).map((row) => row.tag).filter(Boolean);
}

export function productMatchesFilters(product, { search = "", tagId = "" } = {}) {
  const q = search.trim().toLowerCase();
  const tags = extractProductTags(product);

  if (tagId && !tags.some((tag) => tag.id === tagId)) {
    return false;
  }

  if (!q) return true;

  const haystack = [
    product.name,
    product.category,
    product.sku,
    product.short_description,
    ...tags.map((tag) => tag.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

export function renderProductTagChips(tags) {
  if (!tags?.length) return "";
  return `<div class="admin-tags">${tags.map((tag) => `<span class="admin-tag">${tagDisplayName(tag)}</span>`).join("")}</div>`;
}

async function uniqueTagSlug(name, excludeId = null) {
  let base = slugify(name) || "tag";
  let candidate = base;
  let n = 2;

  while (true) {
    let query = supabase.from("tags").select("id").eq("slug", candidate).limit(1);
    const { data, error } = await query;
    if (error) throw error;
    const taken = data?.[0];
    if (!taken || (excludeId && taken.id === excludeId)) return candidate;
    candidate = `${base}-${n++}`;
  }
}

export function initTagsTab() {
  const tagList = document.getElementById("tagList");
  const addTagBtn = document.getElementById("addTagBtn");
  const tagForm = document.getElementById("tagForm");
  const tagFormTitle = document.getElementById("tagFormTitle");
  const tagCancel = document.getElementById("tagCancel");
  const tagError = document.getElementById("tagError");

  if (!tagList || !tagForm) return;

  let editingTag = null;

  function resetTagForm() {
    editingTag = null;
    tagForm.reset();
    const recordField = tagForm.querySelector('[name="record_id"]');
    if (recordField) recordField.value = "";
    setAdminTitle(tagFormTitle, "admin.tags.addTitle");
    tagError.hidden = true;
    tagError.textContent = "";
  }

  function closeTagModal() {
    resetTagForm();
    closeModal("tagModal");
  }

  function openTagModal(tag = null) {
    resetTagForm();
    if (tag) {
      editingTag = tag;
      tagForm.name.value = tag.name;
      const recordField = tagForm.querySelector('[name="record_id"]');
      if (recordField) recordField.value = tag.id;
      setAdminTitle(tagFormTitle, "admin.tags.editTitle");
    }
    openModal("tagModal");
  }

  async function loadTagsList() {
    showLoading(tagList, t("admin.tags.loading"));
    try {
      await fetchTags();
    } catch (err) {
      showToast(err.message, "error");
      return;
    }

    updateCount(document.getElementById("tagCount"), tagsCache.length, "tag");

    if (!tagsCache.length) {
      showEmpty(tagList, {
        icon: "◆",
        title: t("admin.tags.emptyTitle"),
        hint: t("admin.tags.emptyHint"),
      });
      return;
    }

    tagList.innerHTML = tagsCache
      .map((tag) => {
        const count = getTagUsageCount(tag.id);
        const countLabel = count === 1 ? t("admin.tags.productsCount") : t("admin.tags.productsCountPlural");
        return `
        <li class="admin-list__item" data-id="${tag.id}">
          <div class="admin-list__icon" aria-hidden="true">◆</div>
          <div class="admin-list__info">
            <p class="admin-list__title">${tagDisplayName(tag)}</p>
            <p class="admin-list__meta">${count} ${countLabel} · ${tag.slug}</p>
          </div>
          <div class="admin-list__actions">
            <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-edit-tag="${tag.id}">${t("admin.common.edit")}</button>
            <button type="button" class="admin-btn admin-btn--danger admin-btn--small" data-delete-tag="${tag.id}">${t("admin.common.delete")}</button>
          </div>
        </li>`;
      })
      .join("");

    tagList.querySelectorAll("[data-edit-tag]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = tagsCache.find((t) => t.id === btn.dataset.editTag);
        if (tag) openTagModal(tag);
      });
    });

    tagList.querySelectorAll("[data-delete-tag]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const tag = tagsCache.find((t) => t.id === btn.dataset.deleteTag);
        if (!tag) return;
        const count = getTagUsageCount(tag.id);
        const msg =
          count > 0
            ? t("admin.tags.deleteConfirmWithProducts").replace("{name}", tag.name).replace("{count}", count)
            : t("admin.tags.deleteConfirm").replace("{name}", tag.name);
        if (!confirm(msg)) return;

        const { error } = await supabase.from("tags").delete().eq("id", tag.id);
        if (error) {
          showToast(error.message, "error");
          return;
        }

        showToast(t("admin.tags.deleted"), "success");
        await notifyTagsChanged();
        await loadTagsList();
      });
    });
  }

  addTagBtn?.addEventListener("click", () => openTagModal());
  tagCancel?.addEventListener("click", closeTagModal);

  tagForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    tagError.hidden = true;
    tagError.textContent = "";

    const submitBtn = tagForm.querySelector('button[type="submit"]');
    const name = tagForm.name.value.trim();
    if (!name) {
      tagError.hidden = false;
      tagError.textContent = t("admin.tags.nameRequired");
      return;
    }

    const editingId = editingTag?.id || tagForm.querySelector('[name="record_id"]')?.value || null;
    const wasEditing = !!editingId;

    submitBtn.disabled = true;
    submitBtn.textContent = wasEditing ? t("admin.products.saving") : t("admin.products.adding");

    try {
      const slug = await uniqueTagSlug(name, editingId);

      if (wasEditing) {
        const { error } = await supabase.from("tags").update({ name, slug }).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tags").insert({ name, slug });
        if (error) throw error;
      }

      closeTagModal();
      showToast(wasEditing ? t("admin.tags.updated") : t("admin.tags.added"), "success");
      await notifyTagsChanged();
      await loadTagsList();
    } catch (err) {
      tagError.hidden = false;
      tagError.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = t("admin.tags.save");
    }
  });

  initModal("tagModal", { onClose: resetTagForm });

  function refreshTagsUi() {
    setAdminTitle(
      tagFormTitle,
      editingTag ? "admin.tags.editTitle" : "admin.tags.addTitle"
    );
  }

  return { load: loadTagsList, refreshTagsUi };
}
