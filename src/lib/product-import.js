import * as XLSX from "xlsx";
import { slugify } from "./format.js";

export const PRODUCT_CATEGORIES = ["pendant", "sconce", "chandelier", "floor", "office"];

/** Category assigned on import; use bulk edit to change after import. */
export const IMPORT_DEFAULT_CATEGORY = "pendant";

export const DEFAULT_IMPORT_IMAGE =
  "https://images.unsplash.com/photo-1565818652107-397974f6bb0e?w=600&q=80";

const COLUMN_ALIASES = {
  sku: ["sku", "code", "kodi", "cod", "kod", "product code", "product_code", "productcode"],
  name: ["name", "emri", "emër", "emer", "product", "product name", "product_name", "productname"],
  price: ["price", "cmimi", "çmimi", "cmim", "price eur", "price (€)", "price €"],
  sale_price: ["sale price", "sale_price", "saleprice", "sale", "cmimi i zbritur", "zbritje"],
  stock_quantity: [
    "stock",
    "stok",
    "stoku",
    "stock quantity",
    "stock_quantity",
    "quantity",
    "sasia",
    "inventar",
    "inventari",
    "gjendje",
    "qty",
    "nr",
    "copa",
  ],
  image_url: ["image", "image url", "image_url", "imageurl", "photo", "foto", "foto url"],
  description: ["description", "pershkrim", "përshkrim", "desc"],
  short_description: ["short description", "short_description", "tagline", "pershkrim i shkurter"],
};

/** @param {string} header */
function normalizeHeader(header) {
  return String(header ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/** @param {string} header */
function mapColumn(header) {
  const norm = normalizeHeader(header);
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.includes(norm)) return field;
  }
  if (/\b(stok|stock|inventar|sasia|qty|quantity|gjendje)\b/.test(norm)) return "stock_quantity";
  return null;
}

/** @param {unknown} value */
function parseNumber(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const str = String(value).trim().replace(/€/g, "").replace(/\s/g, "");
  if (!str) return null;
  const normalized = str.includes(",") && !str.includes(".") ? str.replace(",", ".") : str.replace(/,/g, "");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

/**
 * @param {unknown[][]} matrix
 * @returns {Record<string, unknown>[]}
 */
export function matrixToObjects(matrix) {
  if (!matrix?.length) return [];

  const headerRow = matrix.find((row) => row.some((cell) => String(cell ?? "").trim()));
  if (!headerRow) return [];

  const headerIndex = matrix.indexOf(headerRow);
  const columnMap = headerRow.map((h) => mapColumn(String(h ?? "")));

  return matrix.slice(headerIndex + 1).flatMap((row) => {
    if (!row?.some((cell) => String(cell ?? "").trim())) return [];

    /** @type {Record<string, unknown>} */
    const obj = {};
    columnMap.forEach((field, i) => {
      if (field) obj[field] = row[i];
    });
    return [obj];
  });
}

/**
 * @param {ArrayBuffer} buffer
 * @returns {Record<string, unknown>[]}
 */
export function parseSpreadsheetBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  return matrixToObjects(matrix);
}

/**
 * @param {Record<string, unknown>} raw
 * @param {number} rowIndex
 * @param {{ defaultImageUrl: string }} options
 */
export function mapImportRow(raw, rowIndex, options) {
  const name = String(raw.name ?? "").trim();
  const sku = String(raw.sku ?? "").trim() || null;
  const price = parseNumber(raw.price);
  const salePrice = parseNumber(raw.sale_price);
  const category = IMPORT_DEFAULT_CATEGORY;
  const stockRaw = parseNumber(raw.stock_quantity);
  const stock_quantity = stockRaw != null ? Math.max(0, Math.floor(stockRaw)) : 0;
  const image_url = String(raw.image_url ?? "").trim() || options.defaultImageUrl;
  const description = String(raw.description ?? "").trim() || null;
  const short_description = String(raw.short_description ?? "").trim() || null;

  /** @type {string[]} */
  const errors = [];

  if (!name) errors.push("missing_name");
  if (price == null || price < 0) errors.push("invalid_price");

  return {
    rowIndex,
    name,
    sku,
    price: price ?? 0,
    sale_price: salePrice != null && salePrice >= 0 ? salePrice : null,
    category,
    stock_quantity,
    in_stock: stock_quantity > 0,
    image_url,
    description,
    short_description,
    errors,
  };
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {{ defaultImageUrl: string }} options
 */
export function validateImportRows(rows, options) {
  return rows.map((row, i) => mapImportRow(row, i + 1, options));
}

/**
 * @param {string} baseSlug
 * @param {Set<string>} usedSlugs
 */
export function uniqueSlug(baseSlug, usedSlugs) {
  let slug = baseSlug || "product";
  if (!usedSlugs.has(slug)) {
    usedSlugs.add(slug);
    return slug;
  }
  let n = 2;
  while (usedSlugs.has(`${slug}-${n}`)) n += 1;
  const unique = `${slug}-${n}`;
  usedSlugs.add(unique);
  return unique;
}

/**
 * @param {ReturnType<typeof mapImportRow>[]} rows
 * @param {Set<string>} existingSlugs
 */
export function toProductPayloads(rows, existingSlugs) {
  const usedSlugs = new Set(existingSlugs);
  const now = new Date().toISOString();

  return rows
    .filter((row) => !row.errors.length)
    .map((row) => {
      const baseSlug = slugify(row.name) || slugify(row.sku || "") || "product";
      const slug = uniqueSlug(baseSlug, usedSlugs);
      return {
        name: row.name,
        slug,
        sku: row.sku,
        price: row.price,
        sale_price: row.sale_price,
        category: row.category,
        stock_quantity: row.stock_quantity,
        in_stock: row.in_stock,
        image_url: row.image_url,
        description: row.description,
        short_description: row.short_description,
        is_featured: false,
        updated_at: now,
        _rowIndex: row.rowIndex,
        _skuKey: row.sku?.toLowerCase() || null,
      };
    });
}
