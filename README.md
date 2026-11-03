# 🌸 Lavender Beauty Platform — Project Architecture

Lavender is a luxury beauty marketplace built with a clean separation between **Frontend** and **Backend**, powered by a persistent **SQLite Database** (`node:sqlite`).

---

## 📁 Project Structure

```
meesho_clon/
│
├── 🌐 frontend/              # Client Side (User-Facing)
│   ├── index.html            # Main Storefront & Product Marketplace
│   ├── admin.html            # Admin Dashboard (Add / Edit / Delete Products)
│   ├── app.js                # Frontend Routing, State, Auth & Wishlist Controller (API Linked)
│   ├── data.js               # Beauty catalog dataset fallback / initial seed
│   └── styles.css            # Luxury theme styling, animations & responsive layout
│
├── ⚙️ backend/               # Server & SQLite Database (REST API)
│   ├── server.js             # Node.js HTTP REST API Server
│   ├── database.js           # SQLite Database Engine (users, sessions, wishlists, products)
│   ├── package.json          # Backend package definition
│   └── data/
│       ├── lavender.sqlite   # 📦 Real SQLite Database file (WAL mode)
│       └── database.json     # Backup / initial migration archive
│
├── package.json              # Root script runner (`npm start`)
└── README.md                 # Project Documentation
```

---

## 📦 SQLite Database Architecture (`lavender.sqlite`)

The database contains 5 core tables:
- `users`: User profiles (id, name, email, phone, password_hash, salt, auth_provider, created_at)
- `sessions`: Active bearer auth tokens linked to users
- `wishlists`: User saved products with full JSON snapshots
- `products`: Complete catalog (109+ items) with prices, discounts, ratings, images, and admin items
- `admin_sessions`: Secure 24-hour admin login tokens

---

## 📡 REST API Endpoints

### 🛍️ Public / Storefront APIs
- `GET /api/health` — Healthcheck & database status
- `GET /api/products` — Retrieve all products from SQLite (supports `?category=...&brand=...&search=...`)
- `GET /api/products/:id` — Retrieve a single product by ID
- `GET /api/categories` — Distinct categories list
- `GET /api/brands` — Distinct brands list

### 🔐 User Authentication
- `POST /api/auth/register` — Create account in SQLite
- `POST /api/auth/login` — Sign in with email & password
- `POST /api/auth/google` — 1-click Google sign-in
- `GET /api/auth/me` — Verify active token and get user profile
- `POST /api/auth/logout` — Revoke active token

### ❤️ Wishlist (Requires Bearer Token)
- `GET /api/wishlist` — Get user's saved wishlist items from SQLite
- `POST /api/wishlist/toggle` — Add or remove a product from user's wishlist
- `POST /api/wishlist/add` — Force add to wishlist
- `DELETE /api/wishlist/:id` — Remove item from wishlist

### 🔧 Admin Management (Requires Admin Token)
- `POST /api/admin/login` — Admin login (`lavender@admin2026`)
- `POST /api/admin/logout` — Admin logout
- `GET /api/admin/products` — All products in SQLite
- `POST /api/admin/products` — Add a new product to SQLite
- `GET /api/admin/products/:id` — Single product details
- `PUT /api/admin/products/:id` — Update existing product
- `DELETE /api/admin/products/:id` — Delete product permanently
- `GET /api/admin/stats` — Real-time counts (users, products, wishlists, sessions)
- `GET /api/admin/users` — List registered users with their wishlist counts

---

## 🚀 How to Run

### Option 1: From the Root Directory
```bash
npm start
```

### Option 2: From the Backend Directory
```bash
cd backend
node server.js
```

---

## 🌐 URLs & Access

| Page | URL | Description |
|---|---|---|
| **🛍️ Main Store** | `http://localhost:3000` | Full luxury beauty marketplace |
| **🔧 Admin Dashboard** | `http://localhost:3000/admin.html` | Add, edit & delete products in SQLite |
| **📡 REST API** | `http://localhost:3000/api/` | SQLite-powered REST endpoints |

### 🔐 Admin Password
`lavender@admin2026`
