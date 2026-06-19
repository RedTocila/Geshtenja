import { supabase } from "./lib/supabase.js";
import { t } from "./i18n.js";
import { showToast, openModal, closeModal, initModal } from "./admin-ui.js";
import {
  DEFAULT_IMPORT_IMAGE,
  parseSpreadsheetBuffer,
  validateImportRows,
  toProductPayloads,
} from "./lib/product-import.js";

const importBtn = document.getElementById("importProductsBtn");
const importForm = document.getElementById("productImportForm");
const importFile = document.getElementById("productImportFile");
const importPreview = document.getElementById("productImportPreview");
const importSummary = document.getElementById("productImportSummary");
const importError = document.getElementById("productImportError");
const importCancel = document.getElementById("productImportCancel");
const updateExisting = document.getElementById("importUpdateExisting");

/** @type {ReturnType<typeof validateImportRows>} */
let parsedRows = [];

/** @param {string} key @param {Record<string, string | number>} [vars] */
function tf(key, vars = {}) {
  let str = t(key);
  for (const [k, v] of Object.entries(vars)) {
    str = str.replaceAll(`{${k}}`, String(v));
  }
  return str;
}

function showImportError(message) {
  if (!importError) return;
  if (!message) {
    importError.hidden = true;
    importError.textContent = "";
    return;
  }
  importError.hidden = false;
  importError.textContent = message;
}

function resetImportForm() {
  importForm?.reset();
  parsedRows = [];
  if (importPreview) {
    importPreview.hidden = true;
    importPreview.innerHTML = "";
  }
  if (importSummary) importSummary.textContent = "";
  showImportError("");
  const submitBtn = importForm?.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
}

function rowErrorLabel(code) {
  const key = `admin.products.import.errors.${code}`;
  const label = t(key);
  return label === key ? code : label;
}

function renderPreview() {
  if (!importPreview || !importSummary) return;

  const valid = parsedRows.filter((r) => !r.errors.length);
  const invalid = parsedRows.filter((r) => r.errors.length);

  importSummary.textContent = tf("admin.products.import.summary", {
    total: parsedRows.length,
    valid: valid.length,
    invalid: invalid.length,
  });

  const rows = parsedRows.slice(0, 50);
  const more = parsedRows.length > 50 ? parsedRows.length - 50 : 0;

  importPreview.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table admin-table--import">
        <thead>
          <tr>
            <th>#</th>
            <th>${t("admin.products.import.colCode")}</th>
            <th>${t("admin.products.import.colName")}</th>
            <th>${t("admin.products.import.colPrice")}</th>
            <th>${t("admin.products.import.colStock")}</th>
            <th>${t("admin.products.import.colStatus")}</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => {
              const ok = !row.errors.length;
              const status = ok
                ? `<span class="admin-import-status admin-import-status--ok">${t("admin.products.import.statusOk")}</span>`
                : `<span class="admin-import-status admin-import-status--bad">${row.errors.map(rowErrorLabel).join(", ")}</span>`;
              return `
            <tr class="${ok ? "" : "admin-import-row--bad"}">
              <td>${row.rowIndex}</td>
              <td>${row.sku || "—"}</td>
              <td>${row.name || "—"}</td>
              <td>€${row.price.toFixed(2)}</td>
              <td>${row.stock_quantity}</td>
              <td>${status}</td>
            </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
    ${more ? `<p class="admin-muted admin-import-more">${tf("admin.products.import.moreRows", { count: more })}</p>` : ""}
  `;
  importPreview.hidden = false;

  const submitBtn = importForm?.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = valid.length === 0;
}

async function parseSelectedFile(file) {
  const buffer = await file.arrayBuffer();
  const rawRows = parseSpreadsheetBuffer(buffer);
  if (!rawRows.length) {
    throw new Error(t("admin.products.import.emptyFile"));
  }

  const options = {
    defaultImageUrl: DEFAULT_IMPORT_IMAGE,
  };

  parsedRows = validateImportRows(rawRows, options);
  renderPreview();
}

/** @param {ReturnType<typeof toProductPayloads>} payloads @param {boolean} shouldUpdate */
async function runImport(payloads, shouldUpdate) {
  const { data: existing, error: fetchError } = await supabase.from("products").select("id, sku, slug");
  if (fetchError) throw fetchError;

  const existingBySku = new Map();
  for (const p of existing ?? []) {
    if (p.sku) existingBySku.set(p.sku.toLowerCase(), p);
  }

  const { count } = await supabase.from("products").select("*", { count: "exact", head: true });
  let sortOrder = count || 0;

  const toInsert = [];
  const toUpdate = [];

  for (const payload of payloads) {
    const { _rowIndex, _skuKey, ...row } = payload;
    void _rowIndex;

    if (shouldUpdate && _skuKey && existingBySku.has(_skuKey)) {
      const match = existingBySku.get(_skuKey);
      toUpdate.push({ id: match.id, ...row, slug: match.slug || row.slug });
    } else {
      sortOrder += 1;
      toInsert.push({ ...row, sort_order: sortOrder });
    }
  }

  const BATCH = 50;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error } = await supabase.from("products").insert(batch);
    if (error) throw error;
  }

  for (const row of toUpdate) {
    const { id, ...update } = row;
    const { error } = await supabase.from("products").update(update).eq("id", id);
    if (error) throw error;
  }

  return { inserted: toInsert.length, updated: toUpdate.length };
}

/** @param {() => Promise<void>} onImported */
export function initProductImport(onImported) {
  if (!importBtn || !importForm) return;

  initModal("productImportModal", { onClose: resetImportForm });

  importBtn.addEventListener("click", () => {
    resetImportForm();
    openModal("productImportModal");
  });

  importCancel?.addEventListener("click", () => closeModal("productImportModal"));

  importFile?.addEventListener("change", async () => {
    showImportError("");
    const file = importFile.files?.[0];
    if (!file) return;

    try {
      await parseSelectedFile(file);
    } catch (err) {
      parsedRows = [];
      if (importPreview) importPreview.hidden = true;
      if (importSummary) importSummary.textContent = "";
      showImportError(err.message);
      const submitBtn = importForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
    }
  });

  importForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showImportError("");

    const validRows = parsedRows.filter((r) => !r.errors.length);
    if (!validRows.length) return;

    const submitBtn = importForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = t("admin.products.import.importing");

    try {
      const { data: slugRows } = await supabase.from("products").select("slug");
      const existingSlugs = new Set((slugRows ?? []).map((r) => r.slug).filter(Boolean));

      const payloads = toProductPayloads(validRows, existingSlugs);
      const { inserted, updated } = await runImport(payloads, updateExisting?.checked);

      closeModal("productImportModal");
      await onImported();

      const parts = [];
      if (inserted) parts.push(tf("admin.products.import.addedCount", { count: inserted }));
      if (updated) parts.push(tf("admin.products.import.updatedCount", { count: updated }));
      showToast(parts.join(" · ") || t("admin.products.import.done"), "success");
    } catch (err) {
      showImportError(err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = t("admin.products.import.submit");
    }
  });
}

export function refreshProductImportUi() {
  if (parsedRows.length) renderPreview();
  const title = document.getElementById("productImportTitle");
  if (title) title.textContent = t("admin.products.import.title");
}
