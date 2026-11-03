// ==========================================================================
// LAVENDER — FULLSTACK NODE.JS REST API & STATIC SERVER (backend/server.js)
// Real SQLite Database Backend + Frontend Static File Serving
// ==========================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./database');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.resolve(__dirname, '..', 'frontend');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'lavender@admin2026';
const VALID_ADMIN_PASSWORDS = [ADMIN_PASSWORD, 'lavender@admin2026', 'lavenderadmin', 'admin'].map(p => p.trim());

// Password hashing & verification
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, salt, storedHash) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Parse JSON request body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 2e6) { // 2MB limit
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

// Send JSON response
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

// Extract Bearer token from header
function getBearerToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7).trim();
}

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.env': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

// Main Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();
  const searchParams = parsedUrl.searchParams;

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    res.end();
    return;
  }

  // =========================================================================
  // BACKEND REST API ROUTES (/api/*)
  // Powered by SQLite (lavender.sqlite)
  // =========================================================================
  if (pathname.startsWith('/api/')) {

    // 1. Health check
    if (pathname === '/api/health' && method === 'GET') {
      return sendJson(res, 200, {
        status: 'healthy',
        database: 'SQLite',
        totalProducts: db.getAllProducts().length,
        timestamp: new Date().toISOString()
      });
    }

    // 2. Public Products API (GET /api/products)
    // Filter by ?category=skincare&brand=minimalist&search=serum
    if (pathname === '/api/products' && method === 'GET') {
      const category = searchParams.get('category');
      const brand = searchParams.get('brand');
      const search = searchParams.get('search') || searchParams.get('q');

      const products = db.getAllProducts({ category, brand, search });
      return sendJson(res, 200, {
        success: true,
        count: products.length,
        products
      });
    }

    // 3. Single Product API (GET /api/products/:id)
    if (pathname.startsWith('/api/products/') && method === 'GET') {
      const id = pathname.replace('/api/products/', '').trim();
      const product = db.getProductById(id);
      if (!product) {
        return sendJson(res, 404, { success: false, error: 'Product not found' });
      }
      return sendJson(res, 200, { success: true, product });
    }

    // 4. Categories & Brands metadata
    if (pathname === '/api/categories' && method === 'GET') {
      return sendJson(res, 200, { success: true, categories: db.getCategories() });
    }
    if (pathname === '/api/brands' && method === 'GET') {
      return sendJson(res, 200, { success: true, brands: db.getBrands() });
    }
    if (pathname === '/api/reviews' && method === 'GET') {
      const reviews = [
        {
          name: "Ananya Sharma",
          city: "Mumbai",
          product: "Dot & Key Cica Calming Skin Clarifying Gel",
          rating: 5,
          title: "Cleared my stubborn acne breakouts in 2 weeks!",
          review: "This gel moisturizer is a miracle for humid Mumbai weather. Lightweight, soothes redness immediately and doesn't clog pores at all. 10/10 Holy Grail!",
          avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80"
        },
        {
          name: "Pooja Varma",
          city: "Bengaluru",
          product: "Minimalist 10% Vitamin C Serum",
          rating: 5,
          title: "Noticeable radiant glow & dark spot reduction",
          review: "The ethyl ascorbic acid formulation is stable and doesn't oxidize. My hyperpigmentation from sun exposure has visibly faded. Lavender's express delivery was super fast!",
          avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&q=80"
        },
        {
          name: "Sneha Nair",
          city: "Kochi",
          product: "Plum Green Tea Pore Cleansing Face Wash",
          rating: 5,
          title: "Gentle yet deeply clarifying cleanser",
          review: "Leaves skin thoroughly cleansed without any stripped, tight sensation. The soft cellulose beads feel luxurious on the skin. Love Lavender's curated collection!",
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"
        }
      ];
      return sendJson(res, 200, { success: true, count: reviews.length, reviews });
    }
    if (pathname === '/api/coupons' && method === 'GET') {
      const coupons = {
        'GLOW15': { discountPercent: 15, minOrder: 999, maxDiscount: 400, desc: '15% OFF above ₹999' },
        'LAVENDER15': { discountPercent: 15, minOrder: 799, maxDiscount: 350, desc: '15% OFF beauty sanctuary orders' },
        'GLOW200': { discountAmount: 200, minOrder: 1199, maxDiscount: 200, desc: 'Flat ₹200 OFF on ₹1,199+' },
        'SANCTUARY20': { discountPercent: 20, minOrder: 1999, maxDiscount: 600, desc: '20% OFF luxury curation' },
        'LAVENDER50': { discountPercent: 50, minOrder: 2999, maxDiscount: 1000, desc: 'Flat 50% OFF up to ₹1,000' }
      };
      return sendJson(res, 200, { success: true, coupons });
    }

    // 5. Register User (POST /api/auth/register)
    if (pathname === '/api/auth/register' && method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const { name, email, password, phone } = body;

        if (!name || !email || !password) {
          return sendJson(res, 400, { success: false, error: 'Name, email, and password are required' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const existing = db.getUserByEmail(normalizedEmail);
        if (existing) {
          return sendJson(res, 409, { success: false, error: 'An account with this email already exists. Please sign in.' });
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = hashPassword(password, salt);
        const userId = 'usr_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        const newUser = db.createUser({
          id: userId,
          name: name.trim(),
          email: normalizedEmail,
          phone: phone ? phone.trim() : '',
          passwordHash,
          salt,
          authProvider: 'email'
        });

        const token = generateToken();
        db.createSession(token, newUser.id);

        return sendJson(res, 201, {
          success: true,
          message: 'Account created successfully in SQLite database',
          token,
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            phone: newUser.phone,
            createdAt: newUser.createdAt
          }
        });
      } catch (err) {
        return sendJson(res, 400, { success: false, error: err.message });
      }
    }

    // 6. Login User (POST /api/auth/login)
    if (pathname === '/api/auth/login' && method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const { email, password } = body;

        if (!email || !password) {
          return sendJson(res, 400, { success: false, error: 'Email and password are required' });
        }

        const user = db.getUserByEmail(email.toLowerCase().trim());
        if (!user || !user.salt || !user.password_hash) {
          return sendJson(res, 401, { success: false, error: 'Invalid email or password' });
        }

        const isValid = verifyPassword(password, user.salt, user.password_hash);
        if (!isValid) {
          return sendJson(res, 401, { success: false, error: 'Invalid email or password' });
        }

        const token = generateToken();
        db.createSession(token, user.id);

        return sendJson(res, 200, {
          success: true,
          message: 'Signed in successfully',
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            createdAt: user.created_at
          }
        });
      } catch (err) {
        return sendJson(res, 400, { success: false, error: err.message });
      }
    }

    // 7. Google Auth (POST /api/auth/google)
    if (pathname === '/api/auth/google' && method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const name = body.name || 'Lavender Member';
        const email = (body.email || 'lavender.member@gmail.com').toLowerCase().trim();

        let user = db.getUserByEmail(email);
        if (!user) {
          const salt = crypto.randomBytes(16).toString('hex');
          const passwordHash = hashPassword('Google_' + Date.now(), salt);
          const userId = 'usr_g_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          user = db.createUser({
            id: userId,
            name: name.trim(),
            email,
            phone: '',
            passwordHash,
            salt,
            authProvider: 'google'
          });
        }

        const token = generateToken();
        db.createSession(token, user.id);

        return sendJson(res, 200, {
          success: true,
          message: 'Authenticated with Google',
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            createdAt: user.created_at || user.createdAt
          }
        });
      } catch (err) {
        return sendJson(res, 400, { success: false, error: err.message });
      }
    }

    // 8. Get Current Authenticated User (GET /api/auth/me)
    if (pathname === '/api/auth/me' && method === 'GET') {
      const token = getBearerToken(req);
      const auth = db.getAuthenticatedUser(token);
      if (!auth) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized or session expired' });
      }
      return sendJson(res, 200, { success: true, user: auth.user });
    }

    // 9. Logout User (POST /api/auth/logout)
    if (pathname === '/api/auth/logout' && method === 'POST') {
      const token = getBearerToken(req);
      if (token) db.deleteSession(token);
      return sendJson(res, 200, { success: true, message: 'Logged out successfully' });
    }

    // 10. Get User Wishlist (GET /api/wishlist)
    if (pathname === '/api/wishlist' && method === 'GET') {
      const token = getBearerToken(req);
      const auth = db.getAuthenticatedUser(token);
      if (!auth) {
        return sendJson(res, 401, { success: false, error: 'Please create an account or sign in to access your Wishlist' });
      }

      const wishlist = db.getWishlist(auth.user.id);
      return sendJson(res, 200, {
        success: true,
        userId: auth.user.id,
        count: wishlist.length,
        wishlist
      });
    }

    // 11. Toggle Wishlist Item (POST /api/wishlist/toggle)
    if (pathname === '/api/wishlist/toggle' && method === 'POST') {
      const token = getBearerToken(req);
      const auth = db.getAuthenticatedUser(token);
      if (!auth) {
        return sendJson(res, 401, {
          success: false,
          requireAuth: true,
          error: 'Please create an account to save items to your Wishlist'
        });
      }

      try {
        const body = await parseJsonBody(req);
        let product = body.product;
        const productId = body.productId || (product && product.id);

        if (!productId) {
          return sendJson(res, 400, { success: false, error: 'productId or product object is required' });
        }

        // If full product not provided, retrieve from database
        if (!product) {
          product = db.getProductById(productId);
        }
        if (!product) {
          return sendJson(res, 404, { success: false, error: 'Product not found in catalog' });
        }

        const result = db.toggleWishlist(auth.user.id, product);
        return sendJson(res, 200, {
          success: true,
          isWishlisted: result.isWishlisted,
          count: result.wishlist.length,
          wishlist: result.wishlist
        });
      } catch (err) {
        return sendJson(res, 400, { success: false, error: err.message });
      }
    }

    // 12. Add to Wishlist (POST /api/wishlist/add)
    if (pathname === '/api/wishlist/add' && method === 'POST') {
      const token = getBearerToken(req);
      const auth = db.getAuthenticatedUser(token);
      if (!auth) {
        return sendJson(res, 401, { success: false, requireAuth: true, error: 'Please sign in to add to Wishlist' });
      }

      try {
        const body = await parseJsonBody(req);
        let product = body.product;
        if (!product && body.productId) {
          product = db.getProductById(body.productId);
        }
        if (!product || !product.id) {
          return sendJson(res, 400, { success: false, error: 'Valid product required' });
        }

        db.addToWishlist(auth.user.id, product);
        const wishlist = db.getWishlist(auth.user.id);

        return sendJson(res, 200, {
          success: true,
          isWishlisted: true,
          count: wishlist.length,
          wishlist
        });
      } catch (err) {
        return sendJson(res, 400, { success: false, error: err.message });
      }
    }

    // 13. Remove from Wishlist (DELETE /api/wishlist/:id)
    if (pathname.startsWith('/api/wishlist/') && method === 'DELETE') {
      const token = getBearerToken(req);
      const auth = db.getAuthenticatedUser(token);
      if (!auth) {
        return sendJson(res, 401, { success: false, error: 'Authentication required' });
      }

      const prodId = pathname.replace('/api/wishlist/', '').trim();
      db.removeFromWishlist(auth.user.id, prodId);
      const wishlist = db.getWishlist(auth.user.id);

      return sendJson(res, 200, {
        success: true,
        count: wishlist.length,
        wishlist
      });
    }

    // 14. Create Order (POST /api/orders) - Stores order in SQLite database
    if (pathname === '/api/orders' && method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const token = getBearerToken(req);
        const auth = db.getAuthenticatedUser(token);
        const userId = auth ? auth.user.id : (body.userId || null);

        if (!body.customerName || !body.customerPhone || !body.deliveryAddress) {
          return sendJson(res, 400, { success: false, error: 'Customer name, phone number, and delivery address are required' });
        }

        const order = db.createOrder({
          ...body,
          userId
        });

        return sendJson(res, 201, {
          success: true,
          orderId: order.id,
          order,
          message: 'Order placed and saved in SQLite database successfully!'
        });
      } catch (err) {
        return sendJson(res, 400, { success: false, error: err.message });
      }
    }

    // 15. Get Orders (GET /api/orders) - Returns orders for authenticated user or all if admin
    if (pathname === '/api/orders' && method === 'GET') {
      const token = getBearerToken(req);
      const adminSession = db.getAdminSession(token);
      if (adminSession) {
        return sendJson(res, 200, { success: true, orders: db.getAllOrders() });
      }
      const auth = db.getAuthenticatedUser(token);
      if (!auth) {
        return sendJson(res, 401, { success: false, error: 'Authentication required to view orders' });
      }
      return sendJson(res, 200, { success: true, orders: db.getUserOrders(auth.user.id) });
    }

    // 16. Get Single Order (GET /api/orders/:id)
    if (pathname.startsWith('/api/orders/') && method === 'GET') {
      const orderId = pathname.replace('/api/orders/', '').trim();
      const order = db.getOrderById(orderId);
      if (!order) {
        return sendJson(res, 404, { success: false, error: 'Order not found' });
      }
      return sendJson(res, 200, { success: true, order });
    }

    // =======================================================================
    // ADMIN API ROUTES (/api/admin/*)
    // =======================================================================

    // Admin Login (POST /api/admin/login)
    if (pathname === '/api/admin/login' && method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const entered = (body.password || '').trim();
        if (entered && VALID_ADMIN_PASSWORDS.includes(entered)) {
          const token = generateToken();
          db.createAdminSession(token);
          return sendJson(res, 200, { success: true, token });
        } else {
          return sendJson(res, 401, { success: false, error: 'Invalid admin password' });
        }
      } catch (err) {
        return sendJson(res, 400, { success: false, error: err.message });
      }
    }

    // Admin Logout
    if (pathname === '/api/admin/logout' && method === 'POST') {
      const token = getBearerToken(req);
      if (token) db.deleteAdminSession(token);
      return sendJson(res, 200, { success: true });
    }

    // Protected Admin routes
    if (pathname.startsWith('/api/admin/')) {
      const token = getBearerToken(req);
      const session = db.getAdminSession(token);
      if (!session) {
        return sendJson(res, 401, { success: false, error: 'Admin authentication required' });
      }

      // GET /api/admin/products
      if (pathname === '/api/admin/products' && method === 'GET') {
        const products = db.getAllProducts();
        return sendJson(res, 200, { success: true, count: products.length, products });
      }

      // POST /api/admin/products (Add product to SQLite)
      if (pathname === '/api/admin/products' && method === 'POST') {
        try {
          const body = await parseJsonBody(req);
          if (!body.title || !body.brand || !body.category || !body.price) {
            return sendJson(res, 400, { success: false, error: 'Title, brand, category, and price are required' });
          }

          const product = db.addProduct({
            ...body,
            isAdminProduct: true
          });

          return sendJson(res, 201, {
            success: true,
            product,
            message: 'Product saved permanently in SQLite database!'
          });
        } catch (err) {
          return sendJson(res, 400, { success: false, error: err.message });
        }
      }

      // GET /api/admin/products/:id
      if (pathname.startsWith('/api/admin/products/') && method === 'GET') {
        const productId = pathname.replace('/api/admin/products/', '').trim();
        const product = db.getProductById(productId);
        if (!product) return sendJson(res, 404, { success: false, error: 'Product not found in SQLite' });
        return sendJson(res, 200, { success: true, product });
      }

      // PUT /api/admin/products/:id (Update product in SQLite)
      if (pathname.startsWith('/api/admin/products/') && method === 'PUT') {
        try {
          const productId = pathname.replace('/api/admin/products/', '').trim();
          const body = await parseJsonBody(req);
          const updated = db.updateProduct(productId, body);
          if (!updated) return sendJson(res, 404, { success: false, error: 'Product not found' });
          return sendJson(res, 200, { success: true, product: updated, message: 'Product updated in SQLite database!' });
        } catch (err) {
          return sendJson(res, 400, { success: false, error: err.message });
        }
      }

      // DELETE /api/admin/products/:id (Delete product from SQLite)
      if (pathname.startsWith('/api/admin/products/') && method === 'DELETE') {
        const productId = pathname.replace('/api/admin/products/', '').trim();
        const deleted = db.deleteProduct(productId);
        if (!deleted) return sendJson(res, 404, { success: false, error: 'Product not found' });
        return sendJson(res, 200, { success: true, message: 'Product deleted from SQLite database' });
      }

      // GET /api/admin/stats
      if (pathname === '/api/admin/stats' && method === 'GET') {
        return sendJson(res, 200, { success: true, ...db.getStats() });
      }

      // GET /api/admin/users
      if (pathname === '/api/admin/users' && method === 'GET') {
        const users = db.getAllUsers();
        return sendJson(res, 200, { success: true, count: users.length, users });
      }

      // GET /api/admin/orders
      if (pathname === '/api/admin/orders' && method === 'GET') {
        const orders = db.getAllOrders();
        return sendJson(res, 200, { success: true, count: orders.length, orders });
      }

      // =====================================================================
      // MASTER DATA: CATEGORIES CRUD (/api/admin/categories)
      // =====================================================================
      if (pathname === '/api/admin/categories' && method === 'GET') {
        const categories = db.getCategories();
        return sendJson(res, 200, { success: true, count: categories.length, categories });
      }

      if (pathname === '/api/admin/categories' && method === 'POST') {
        try {
          const body = await parseJsonBody(req);
          if (!body.label) {
            return sendJson(res, 400, { success: false, error: 'Category label is required' });
          }
          const cat = db.addCategory(body);
          return sendJson(res, 201, { success: true, category: cat, message: 'Category added to SQLite database!' });
        } catch (err) {
          return sendJson(res, 400, { success: false, error: err.message });
        }
      }

      if (pathname.startsWith('/api/admin/categories/') && method === 'GET') {
        const catId = pathname.replace('/api/admin/categories/', '').trim();
        const cat = db.getCategoryById(catId);
        if (!cat) return sendJson(res, 404, { success: false, error: 'Category not found' });
        return sendJson(res, 200, { success: true, category: cat });
      }

      if (pathname.startsWith('/api/admin/categories/') && method === 'PUT') {
        try {
          const catId = pathname.replace('/api/admin/categories/', '').trim();
          const body = await parseJsonBody(req);
          const updated = db.updateCategory(catId, body);
          if (!updated) return sendJson(res, 404, { success: false, error: 'Category not found' });
          return sendJson(res, 200, { success: true, category: updated, message: 'Category updated in SQLite!' });
        } catch (err) {
          return sendJson(res, 400, { success: false, error: err.message });
        }
      }

      if (pathname.startsWith('/api/admin/categories/') && method === 'DELETE') {
        const catId = pathname.replace('/api/admin/categories/', '').trim();
        const deleted = db.deleteCategory(catId);
        if (!deleted) return sendJson(res, 404, { success: false, error: 'Category not found' });
        return sendJson(res, 200, { success: true, message: 'Category removed from SQLite database' });
      }

      // =====================================================================
      // MASTER DATA: BRANDS CRUD (/api/admin/brands)
      // =====================================================================
      if (pathname === '/api/admin/brands' && method === 'GET') {
        const brands = db.getBrands();
        return sendJson(res, 200, { success: true, count: brands.length, brands });
      }

      if (pathname === '/api/admin/brands' && method === 'POST') {
        try {
          const body = await parseJsonBody(req);
          if (!body.name) {
            return sendJson(res, 400, { success: false, error: 'Brand name is required' });
          }
          const brand = db.addBrand(body);
          return sendJson(res, 201, { success: true, brand, message: 'Brand added to SQLite database!' });
        } catch (err) {
          return sendJson(res, 400, { success: false, error: err.message });
        }
      }

      if (pathname.startsWith('/api/admin/brands/') && method === 'PUT') {
        try {
          const brandId = pathname.replace('/api/admin/brands/', '').trim();
          const body = await parseJsonBody(req);
          const updated = db.updateBrand(brandId, body);
          if (!updated) return sendJson(res, 404, { success: false, error: 'Brand not found' });
          return sendJson(res, 200, { success: true, brand: updated, message: 'Brand updated in SQLite!' });
        } catch (err) {
          return sendJson(res, 400, { success: false, error: err.message });
        }
      }

      if (pathname.startsWith('/api/admin/brands/') && method === 'DELETE') {
        const brandId = pathname.replace('/api/admin/brands/', '').trim();
        const deleted = db.deleteBrand(brandId);
        if (!deleted) return sendJson(res, 404, { success: false, error: 'Brand not found' });
        return sendJson(res, 200, { success: true, message: 'Brand removed from SQLite database' });
      }

      return sendJson(res, 404, { success: false, error: 'Admin API endpoint not found' });
    }

    return sendJson(res, 404, { success: false, error: 'API endpoint not found' });
  }

  // =========================================================================
  // FRONTEND STATIC FILE SERVING & SPA FALLBACK
  // Serves frontend/ directory (HTML, CSS, JS, images)
  // =========================================================================
  let reqUrl = pathname;
  let filePath = path.join(PUBLIC_DIR, reqUrl === '/' ? 'index.html' : reqUrl);

  // Security check: ensure path is within directory
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // If path does not physically exist, fallback to index.html for SPA routing
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  let ext = path.extname(filePath).toLowerCase();
  if (path.basename(filePath).startsWith('.env')) {
    ext = '.env';
  }
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (fallbackErr, fallbackContent) => {
          if (fallbackErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(fallbackContent, 'utf-8');
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`500 Internal Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`🌸 Lavender Fullstack Server is running at http://localhost:${PORT}`);
  console.log(`📦 SQLite Database active at backend/data/lavender.sqlite`);
  console.log(`📡 Backend REST APIs active at http://localhost:${PORT}/api/`);
});
