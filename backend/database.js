// ==========================================================================
// LAVENDER — SQLITE DATABASE MODULE (backend/database.js)
// Dynamic SQLite Database Engine: Products, Categories, Brands, Orders, Users, Wishlist
// ==========================================================================

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'lavender.sqlite');
const JSON_MIGRATION_FILE = path.join(DB_DIR, 'database.json');
const CATALOG_SEED_FILE = path.join(DB_DIR, 'catalog-seed.json');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_FILE);

// Optimization pragmas
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT,
    salt TEXT,
    auth_provider TEXT DEFAULT 'email',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS wishlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, product_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    tagline TEXT,
    types_json TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    origin TEXT,
    tag TEXT,
    logo_text TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    brand TEXT NOT NULL,
    brand_slug TEXT,
    category TEXT NOT NULL,
    product_type TEXT,
    skin_type TEXT,
    concern TEXT,
    price REAL NOT NULL,
    original_price REAL,
    discount REAL DEFAULT 0,
    rating REAL DEFAULT 4.5,
    rating_count INTEGER DEFAULT 0,
    delivery TEXT,
    is_bestseller INTEGER DEFAULT 0,
    is_trending INTEGER DEFAULT 0,
    is_flash_deal INTEGER DEFAULT 0,
    offer_tag TEXT,
    image TEXT,
    thumbnails_json TEXT,
    sizes_json TEXT,
    description TEXT,
    benefits_json TEXT,
    how_to_use TEXT,
    ingredients TEXT,
    suitable_for TEXT,
    in_stock INTEGER DEFAULT 1,
    is_admin_product INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    city TEXT NOT NULL,
    pincode TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    items_json TEXT NOT NULL,
    subtotal REAL NOT NULL,
    coupon_code TEXT,
    discount_amount REAL DEFAULT 0,
    total_payable REAL NOT NULL,
    status TEXT DEFAULT 'Confirmed',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    created_at TEXT NOT NULL
  );
`);

console.log('📦 Dynamic SQLite database connected at:', DB_FILE);

// Sanitizer helpers for safe SQLite binding
function toStr(val, fallback = '') {
  if (val === undefined || val === null) return fallback;
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function toJsonStr(val, fallback = '[]') {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'string') return val;
  try { return JSON.stringify(val); } catch { return fallback; }
}

function toNum(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function mapProductRow(row) {
  if (!row) return null;
  let thumbnails = [row.image];
  try { if (row.thumbnails_json) thumbnails = JSON.parse(row.thumbnails_json); } catch {}
  let sizes = [];
  try { if (row.sizes_json) sizes = JSON.parse(row.sizes_json); } catch {}
  let benefits = [];
  try { if (row.benefits_json) benefits = JSON.parse(row.benefits_json); } catch {}

  return {
    id: row.id,
    title: row.title,
    brand: row.brand,
    brandSlug: row.brand_slug,
    category: row.category,
    productType: row.product_type,
    skinType: row.skin_type,
    concern: row.concern,
    price: Number(row.price),
    originalPrice: row.original_price ? Number(row.original_price) : Number(row.price),
    discount: Number(row.discount || 0),
    rating: Number(row.rating || 4.5),
    ratingCount: Number(row.rating_count || 0),
    delivery: row.delivery || 'Free Express Delivery',
    isBestseller: Boolean(row.is_bestseller),
    isTrending: Boolean(row.is_trending),
    isFlashDeal: Boolean(row.is_flash_deal),
    offerTag: row.offer_tag || '',
    image: row.image,
    thumbnails,
    sizes,
    description: row.description || '',
    benefits,
    howToUse: row.how_to_use || '',
    ingredients: row.ingredients || '',
    suitableFor: row.suitable_for || 'All skin types',
    inStock: Boolean(row.in_stock),
    isAdminProduct: Boolean(row.is_admin_product),
    addedAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCategoryRow(row) {
  if (!row) return null;
  let types = [];
  try { if (row.types_json) types = JSON.parse(row.types_json); } catch {}
  return {
    id: row.id,
    label: row.label,
    slug: row.slug,
    tagline: row.tagline || '',
    types
  };
}

function mapOrderRow(row) {
  if (!row) return null;
  let items = [];
  try { if (row.items_json) items = JSON.parse(row.items_json); } catch {}
  return {
    id: row.id,
    userId: row.user_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    deliveryAddress: row.delivery_address,
    city: row.city,
    pincode: row.pincode,
    paymentMethod: row.payment_method,
    items,
    subtotal: Number(row.subtotal),
    couponCode: row.coupon_code,
    discountAmount: Number(row.discount_amount),
    totalPayable: Number(row.total_payable),
    status: row.status,
    createdAt: row.created_at
  };
}

// Prepared statements
const queries = {
  getUserByEmail: db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)'),
  getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser: db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, salt, auth_provider, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertSession: db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)'),
  getSessionWithUser: db.prepare(`
    SELECT s.token, s.created_at AS session_created_at, u.*
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),

  // Admin Sessions
  insertAdminSession: db.prepare('INSERT INTO admin_sessions (token, created_at) VALUES (?, ?)'),
  getAdminSession: db.prepare('SELECT * FROM admin_sessions WHERE token = ?'),
  deleteAdminSession: db.prepare('DELETE FROM admin_sessions WHERE token = ?'),

  // Wishlist
  getUserWishlist: db.prepare('SELECT product_json FROM wishlists WHERE user_id = ? ORDER BY id DESC'),
  getWishlistItem: db.prepare('SELECT * FROM wishlists WHERE user_id = ? AND product_id = ?'),
  insertWishlistItem: db.prepare(`
    INSERT OR REPLACE INTO wishlists (user_id, product_id, product_json, created_at)
    VALUES (?, ?, ?, ?)
  `),
  deleteWishlistItem: db.prepare('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?'),

  // Categories
  getAllCategories: db.prepare('SELECT * FROM categories ORDER BY id ASC'),
  getCategoryById: db.prepare('SELECT * FROM categories WHERE id = ? OR slug = ?'),
  insertCategory: db.prepare(`
    INSERT OR REPLACE INTO categories (id, label, slug, tagline, types_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  updateCategory: db.prepare(`
    UPDATE categories SET label = ?, slug = ?, tagline = ?, types_json = ? WHERE id = ?
  `),
  deleteCategory: db.prepare('DELETE FROM categories WHERE id = ? OR slug = ?'),
  countCategories: db.prepare('SELECT COUNT(*) AS count FROM categories'),

  // Brands with Dynamic Product Counts
  getAllBrandsWithCounts: db.prepare(`
    SELECT b.id, b.name, b.slug, b.origin, b.tag, b.logo_text,
           (SELECT COUNT(*) FROM products p WHERE p.brand_slug = b.slug OR LOWER(p.brand) = LOWER(b.name)) AS count
    FROM brands b
    ORDER BY b.name ASC
  `),
  getBrandById: db.prepare('SELECT * FROM brands WHERE id = ? OR slug = ?'),
  insertBrand: db.prepare(`
    INSERT OR REPLACE INTO brands (id, name, slug, origin, tag, logo_text, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  updateBrand: db.prepare(`
    UPDATE brands SET name = ?, slug = ?, origin = ?, tag = ?, logo_text = ? WHERE id = ?
  `),
  deleteBrand: db.prepare('DELETE FROM brands WHERE id = ? OR slug = ?'),
  countBrands: db.prepare('SELECT COUNT(*) AS count FROM brands'),

  // Products
  getAllProducts: db.prepare('SELECT * FROM products ORDER BY is_admin_product DESC, created_at DESC'),
  getProductById: db.prepare('SELECT * FROM products WHERE id = ?'),
  insertProduct: db.prepare(`
    INSERT OR REPLACE INTO products (
      id, title, brand, brand_slug, category, product_type, skin_type, concern,
      price, original_price, discount, rating, rating_count, delivery,
      is_bestseller, is_trending, is_flash_deal, offer_tag, image,
      thumbnails_json, sizes_json, description, benefits_json, how_to_use,
      ingredients, suitable_for, in_stock, is_admin_product, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `),
  updateProduct: db.prepare(`
    UPDATE products SET
      title = ?, brand = ?, brand_slug = ?, category = ?, product_type = ?,
      skin_type = ?, concern = ?, price = ?, original_price = ?, discount = ?,
      rating = ?, rating_count = ?, delivery = ?, is_bestseller = ?,
      is_trending = ?, is_flash_deal = ?, offer_tag = ?, image = ?,
      thumbnails_json = ?, sizes_json = ?, description = ?, benefits_json = ?,
      how_to_use = ?, ingredients = ?, suitable_for = ?, in_stock = ?,
      updated_at = ?
    WHERE id = ?
  `),
  deleteProduct: db.prepare('DELETE FROM products WHERE id = ?'),
  countProducts: db.prepare('SELECT COUNT(*) AS count FROM products'),

  // Orders
  insertOrder: db.prepare(`
    INSERT INTO orders (
      id, user_id, customer_name, customer_phone, delivery_address, city, pincode,
      payment_method, items_json, subtotal, coupon_code, discount_amount,
      total_payable, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getAllOrders: db.prepare('SELECT * FROM orders ORDER BY datetime(created_at) DESC'),
  getOrderById: db.prepare('SELECT * FROM orders WHERE id = ?'),
  getUserOrders: db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY datetime(created_at) DESC'),
  countOrdersStats: db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(total_payable), 0) AS total_revenue
    FROM orders
  `),

  // Global Counts
  countUsers: db.prepare('SELECT COUNT(*) AS count FROM users'),
  countWishlists: db.prepare('SELECT COUNT(*) AS count FROM wishlists'),
  countSessions: db.prepare('SELECT COUNT(*) AS count FROM sessions'),
  getAllUsersWithWishlistCount: db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.auth_provider, u.created_at,
           (SELECT COUNT(*) FROM wishlists w WHERE w.user_id = u.id) AS wishlist_count
    FROM users u
    ORDER BY datetime(u.created_at) DESC
  `)
};

const SQLiteDB = {
  // --- User Auth ---
  getUserByEmail(email) {
    if (!email) return null;
    return queries.getUserByEmail.get(email.trim());
  },

  getUserById(id) {
    return queries.getUserById.get(id);
  },

  createUser({ id, name, email, phone, passwordHash, salt, authProvider = 'email' }) {
    const createdAt = new Date().toISOString();
    queries.insertUser.run(
      toStr(id),
      toStr(name),
      toStr(email).toLowerCase().trim(),
      toStr(phone),
      toStr(passwordHash),
      toStr(salt),
      toStr(authProvider, 'email'),
      createdAt
    );
    return { id, name, email: email.toLowerCase().trim(), phone: phone || '', authProvider, createdAt };
  },

  createSession(token, userId) {
    const createdAt = new Date().toISOString();
    queries.insertSession.run(toStr(token), toStr(userId), createdAt);
    return { token, userId, createdAt };
  },

  getAuthenticatedUser(token) {
    if (!token) return null;
    const row = queries.getSessionWithUser.get(token);
    if (!row) return null;
    return {
      session: { token: row.token, createdAt: row.session_created_at },
      user: {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        authProvider: row.auth_provider,
        createdAt: row.created_at
      }
    };
  },

  deleteSession(token) {
    if (token) queries.deleteSession.run(toStr(token));
  },

  // --- Admin Sessions ---
  createAdminSession(token) {
    queries.insertAdminSession.run(toStr(token), new Date().toISOString());
  },

  getAdminSession(token) {
    if (!token) return null;
    return queries.getAdminSession.get(toStr(token));
  },

  deleteAdminSession(token) {
    if (token) queries.deleteAdminSession.run(toStr(token));
  },

  // --- Wishlist ---
  getWishlist(userId) {
    const rows = queries.getUserWishlist.all(toStr(userId));
    return rows.map(r => {
      try { return JSON.parse(r.product_json); } catch { return null; }
    }).filter(Boolean);
  },

  addToWishlist(userId, product) {
    if (!product || !product.id) return false;
    const createdAt = new Date().toISOString();
    queries.insertWishlistItem.run(toStr(userId), toStr(product.id), JSON.stringify(product), createdAt);
    return true;
  },

  removeFromWishlist(userId, productId) {
    queries.deleteWishlistItem.run(toStr(userId), toStr(productId));
  },

  toggleWishlist(userId, product) {
    if (!product || !product.id) return { isWishlisted: false, wishlist: [] };
    const existing = queries.getWishlistItem.get(toStr(userId), toStr(product.id));
    let isWishlisted = false;
    if (existing) {
      queries.deleteWishlistItem.run(toStr(userId), toStr(product.id));
      isWishlisted = false;
    } else {
      queries.insertWishlistItem.run(toStr(userId), toStr(product.id), JSON.stringify(product), new Date().toISOString());
      isWishlisted = true;
    }
    const wishlist = this.getWishlist(userId);
    return { isWishlisted, wishlist };
  },

  // --- Categories ---
  getCategories() {
    const rows = queries.getAllCategories.all();
    return rows.map(mapCategoryRow);
  },

  getCategoryById(id) {
    const row = queries.getCategoryById.get(toStr(id), toStr(id));
    return mapCategoryRow(row);
  },

  addCategory(data) {
    const label = toStr(data.label);
    const slug = toStr(data.slug) || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const id = toStr(data.id) || slug;
    const tagline = toStr(data.tagline);
    const types = Array.isArray(data.types)
      ? data.types
      : (data.types ? String(data.types).split(',').map(s => s.trim()).filter(Boolean) : []);
    const createdAt = new Date().toISOString();

    queries.insertCategory.run(id, label, slug, tagline, toJsonStr(types), createdAt);
    return this.getCategoryById(id);
  },

  updateCategory(id, data) {
    const existing = queries.getCategoryById.get(toStr(id), toStr(id));
    if (!existing) return null;

    const label = data.label !== undefined ? toStr(data.label) : existing.label;
    const slug = data.slug !== undefined ? toStr(data.slug) : existing.slug;
    const tagline = data.tagline !== undefined ? toStr(data.tagline) : (existing.tagline || '');
    let types = existing.types_json;
    if (data.types !== undefined) {
      types = toJsonStr(Array.isArray(data.types) ? data.types : String(data.types).split(',').map(s => s.trim()).filter(Boolean));
    }

    queries.updateCategory.run(label, slug, tagline, types, existing.id);
    return this.getCategoryById(existing.id);
  },

  deleteCategory(id) {
    const existing = queries.getCategoryById.get(toStr(id), toStr(id));
    if (!existing) return false;
    queries.deleteCategory.run(existing.id, existing.id);
    return true;
  },

  // --- Brands ---
  getBrands() {
    const rows = queries.getAllBrandsWithCounts.all();
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      origin: r.origin || '',
      tag: r.tag || '',
      logoText: r.logo_text || r.name,
      count: Number(r.count || 0)
    }));
  },

  getBrandById(id) {
    const r = queries.getBrandById.get(toStr(id), toStr(id));
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      origin: r.origin || '',
      tag: r.tag || '',
      logoText: r.logo_text || r.name
    };
  },

  addBrand(data) {
    const name = toStr(data.name);
    const slug = toStr(data.slug) || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const id = toStr(data.id) || slug;
    const origin = toStr(data.origin, 'India');
    const tag = toStr(data.tag, 'Luxury Beauty');
    const logoText = toStr(data.logoText, name);
    const createdAt = new Date().toISOString();

    queries.insertBrand.run(id, name, slug, origin, tag, logoText, createdAt);
    return this.getBrandById(id);
  },

  updateBrand(id, data) {
    const existing = queries.getBrandById.get(toStr(id), toStr(id));
    if (!existing) return null;

    const name = data.name !== undefined ? toStr(data.name) : existing.name;
    const slug = data.slug !== undefined ? toStr(data.slug) : existing.slug;
    const origin = data.origin !== undefined ? toStr(data.origin) : existing.origin;
    const tag = data.tag !== undefined ? toStr(data.tag) : existing.tag;
    const logoText = data.logoText !== undefined ? toStr(data.logoText) : existing.logo_text;

    queries.updateBrand.run(name, slug, origin, tag, logoText, existing.id);
    return this.getBrandById(existing.id);
  },

  deleteBrand(id) {
    const existing = queries.getBrandById.get(toStr(id), toStr(id));
    if (!existing) return false;
    queries.deleteBrand.run(existing.id, existing.id);
    return true;
  },

  // --- Products ---
  getAllProducts(filter = {}) {
    let rows = queries.getAllProducts.all();
    let prods = rows.map(mapProductRow);

    if (filter.category && filter.category !== 'all' && filter.category !== 'all-beauty') {
      prods = prods.filter(p => p.category.toLowerCase() === filter.category.toLowerCase());
    }
    if (filter.brand) {
      prods = prods.filter(p => p.brandSlug === filter.brand || p.brand.toLowerCase() === filter.brand.toLowerCase());
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      prods = prods.filter(p => p.title.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q));
    }
    return prods;
  },

  getProductById(id) {
    const row = queries.getProductById.get(toStr(id));
    return mapProductRow(row);
  },

  addProduct(p) {
    const createdAt = new Date().toISOString();
    const id = toStr(p.id) || ('adm_' + Date.now() + '_' + Math.floor(Math.random() * 10000));
    const brand = toStr(p.brand);
    const brandSlug = toStr(p.brandSlug) || brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    queries.insertProduct.run(
      id,
      toStr(p.title),
      brand,
      brandSlug,
      toStr(p.category),
      toStr(p.productType, 'General'),
      toStr(p.skinType || p.hairType, 'All Types'),
      toStr(p.concern, 'General'),
      toNum(p.price),
      toNum(p.originalPrice, p.price),
      toNum(p.discount, 0),
      toNum(p.rating, 4.5),
      toNum(p.ratingCount, 100),
      toStr(p.delivery, 'Free Express Delivery'),
      p.isBestseller ? 1 : 0,
      p.isTrending ? 1 : 0,
      p.isFlashDeal ? 1 : 0,
      toStr(p.offerTag),
      toStr(p.image, 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=700&q=80'),
      toJsonStr(p.thumbnails || [p.image]),
      toJsonStr(p.sizes || []),
      toStr(p.description),
      toJsonStr(p.benefits || []),
      toStr(p.howToUse),
      toStr(p.ingredients),
      toStr(p.suitableFor, 'All skin types'),
      p.inStock !== false ? 1 : 0,
      p.isAdminProduct ? 1 : 0,
      createdAt,
      null
    );

    return this.getProductById(id);
  },

  updateProduct(id, p) {
    const existing = queries.getProductById.get(toStr(id));
    if (!existing) return null;

    const brand = p.brand !== undefined ? toStr(p.brand) : existing.brand;
    const brandSlug = p.brandSlug !== undefined ? toStr(p.brandSlug) : (brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    const updatedAt = new Date().toISOString();

    queries.updateProduct.run(
      p.title !== undefined ? toStr(p.title) : existing.title,
      brand,
      brandSlug,
      p.category !== undefined ? toStr(p.category) : existing.category,
      p.productType !== undefined ? toStr(p.productType) : existing.product_type,
      p.skinType !== undefined ? toStr(p.skinType) : existing.skin_type,
      p.concern !== undefined ? toStr(p.concern) : existing.concern,
      p.price !== undefined ? toNum(p.price) : Number(existing.price),
      p.originalPrice !== undefined ? toNum(p.originalPrice) : Number(existing.original_price),
      p.discount !== undefined ? toNum(p.discount) : Number(existing.discount),
      p.rating !== undefined ? toNum(p.rating) : Number(existing.rating),
      p.ratingCount !== undefined ? toNum(p.ratingCount) : Number(existing.rating_count),
      p.delivery !== undefined ? toStr(p.delivery) : existing.delivery,
      p.isBestseller !== undefined ? (p.isBestseller ? 1 : 0) : existing.is_bestseller,
      p.isTrending !== undefined ? (p.isTrending ? 1 : 0) : existing.is_trending,
      p.isFlashDeal !== undefined ? (p.isFlashDeal ? 1 : 0) : existing.is_flash_deal,
      p.offerTag !== undefined ? toStr(p.offerTag) : existing.offer_tag,
      p.image !== undefined ? toStr(p.image) : existing.image,
      p.thumbnails ? toJsonStr(p.thumbnails) : existing.thumbnails_json,
      p.sizes ? toJsonStr(p.sizes) : existing.sizes_json,
      p.description !== undefined ? toStr(p.description) : existing.description,
      p.benefits ? toJsonStr(p.benefits) : existing.benefits_json,
      p.howToUse !== undefined ? toStr(p.howToUse) : existing.how_to_use,
      p.ingredients !== undefined ? toStr(p.ingredients) : existing.ingredients,
      p.suitableFor !== undefined ? toStr(p.suitableFor) : existing.suitable_for,
      p.inStock !== undefined ? (p.inStock ? 1 : 0) : existing.in_stock,
      updatedAt,
      toStr(id)
    );

    return this.getProductById(id);
  },

  deleteProduct(id) {
    const existing = queries.getProductById.get(toStr(id));
    if (!existing) return false;
    queries.deleteProduct.run(toStr(id));
    return true;
  },

  // --- Orders ---
  createOrder(orderData) {
    const id = orderData.id || `LAV-${Math.floor(100000 + Math.random() * 900000)}`;
    const createdAt = new Date().toISOString();

    queries.insertOrder.run(
      toStr(id),
      toStr(orderData.userId),
      toStr(orderData.customerName),
      toStr(orderData.customerPhone),
      toStr(orderData.deliveryAddress),
      toStr(orderData.city),
      toStr(orderData.pincode),
      toStr(orderData.paymentMethod, 'upi'),
      toJsonStr(orderData.items || []),
      toNum(orderData.subtotal),
      toStr(orderData.couponCode),
      toNum(orderData.discountAmount, 0),
      toNum(orderData.totalPayable),
      toStr(orderData.status, 'Confirmed'),
      createdAt
    );

    return this.getOrderById(id);
  },

  getOrderById(id) {
    const row = queries.getOrderById.get(toStr(id));
    return mapOrderRow(row);
  },

  getAllOrders() {
    const rows = queries.getAllOrders.all();
    return rows.map(mapOrderRow);
  },

  getUserOrders(userId) {
    const rows = queries.getUserOrders.all(toStr(userId));
    return rows.map(mapOrderRow);
  },

  // --- Stats & User List ---
  getStats() {
    const usersCount = queries.countUsers.get().count;
    const prodsCount = queries.countProducts.get().count;
    const wishlistsCount = queries.countWishlists.get().count;
    const sessionsCount = queries.countSessions.get().count;
    const ordersStats = queries.countOrdersStats.get();
    const recentUsers = queries.getAllUsersWithWishlistCount.all().slice(0, 5).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.created_at
    }));

    return {
      stats: {
        totalUsers: usersCount,
        totalProducts: prodsCount,
        totalWishlistItems: wishlistsCount,
        totalSessions: sessionsCount,
        totalOrders: ordersStats.count,
        totalRevenue: Math.round(ordersStats.total_revenue)
      },
      recentUsers
    };
  },

  getAllUsers() {
    const rows = queries.getAllUsersWithWishlistCount.all();
    return rows.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      authProvider: u.auth_provider,
      wishlistCount: u.wishlist_count,
      createdAt: u.created_at
    }));
  }
};

// ---------------------------------------------------------------------------
// AUTOMATIC MIGRATION: SEED PRODUCTS, CATEGORIES, BRANDS & MIGRATE JSON
// ---------------------------------------------------------------------------
function autoMigrate() {
  const prodCount = queries.countProducts.get().count;
  const catCount = queries.countCategories.get().count;
  const brandCount = queries.countBrands.get().count;

  // Read catalog-seed.json if exists to seed empty tables
  if (fs.existsSync(CATALOG_SEED_FILE)) {
    try {
      const seedData = JSON.parse(fs.readFileSync(CATALOG_SEED_FILE, 'utf8'));

      // 1. Seed Categories into SQLite
      if (catCount === 0 && Array.isArray(seedData.categories)) {
        console.log('🌱 Seeding initial categories into SQLite...');
        for (const c of seedData.categories) {
          queries.insertCategory.run(
            toStr(c.id),
            toStr(c.label),
            toStr(c.slug),
            toStr(c.tagline),
            toJsonStr(c.types || []),
            new Date().toISOString()
          );
        }
        console.log(`✅ Seeded ${seedData.categories.length} categories into SQLite.`);
      }

      // 2. Seed Brands into SQLite
      if (brandCount === 0 && Array.isArray(seedData.brands)) {
        console.log('🌱 Seeding initial brands into SQLite...');
        for (const b of seedData.brands) {
          queries.insertBrand.run(
            toStr(b.id),
            toStr(b.name),
            toStr(b.slug || b.id),
            toStr(b.origin),
            toStr(b.tag),
            toStr(b.logoText),
            new Date().toISOString()
          );
        }
        console.log(`✅ Seeded ${seedData.brands.length} brands into SQLite.`);
      }

      // 3. Seed Products into SQLite if empty
      if (prodCount === 0 && Array.isArray(seedData.products)) {
        console.log('🌱 Seeding initial products from backend catalog seed into SQLite...');
        for (const p of seedData.products) {
          SQLiteDB.addProduct({
            ...p,
            isAdminProduct: false
          });
        }
        console.log(`✅ Seeded ${seedData.products.length} products into SQLite database.`);
      }
    } catch (err) {
      console.error('⚠️ Data seeding notice:', err.message);
    }
  }

  // 4. Migrate existing users, sessions, wishlists, and admin products from database.json
  if (fs.existsSync(JSON_MIGRATION_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(JSON_MIGRATION_FILE, 'utf8'));

      // Migrate users
      if (Array.isArray(data.users)) {
        for (const u of data.users) {
          const exists = queries.getUserById.get(u.id);
          if (!exists) {
            queries.insertUser.run(
              toStr(u.id),
              toStr(u.name),
              toStr(u.email).toLowerCase().trim(),
              toStr(u.phone),
              toStr(u.passwordHash),
              toStr(u.salt),
              toStr(u.authProvider, 'email'),
              toStr(u.createdAt, new Date().toISOString())
            );
          }
        }
      }

      // Migrate sessions
      if (Array.isArray(data.sessions)) {
        for (const s of data.sessions) {
          try {
            queries.insertSession.run(toStr(s.token), toStr(s.userId), toStr(s.createdAt, new Date().toISOString()));
          } catch (_) {}
        }
      }

      // Migrate wishlists
      if (data.wishlists && typeof data.wishlists === 'object') {
        for (const [userId, items] of Object.entries(data.wishlists)) {
          if (Array.isArray(items)) {
            for (const item of items) {
              if (item && item.id) {
                try {
                  queries.insertWishlistItem.run(toStr(userId), toStr(item.id), JSON.stringify(item), new Date().toISOString());
                } catch (_) {}
              }
            }
          }
        }
      }

      // Migrate admin products
      if (Array.isArray(data.products)) {
        for (const p of data.products) {
          const exists = queries.getProductById.get(p.id);
          if (!exists) {
            SQLiteDB.addProduct({
              ...p,
              isAdminProduct: true
            });
          }
        }
      }

      console.log('✅ Existing JSON data migrated into SQLite database successfully.');
    } catch (err) {
      console.error('⚠️ JSON Migration notice:', err.message);
    }
  }
}

autoMigrate();

module.exports = SQLiteDB;
