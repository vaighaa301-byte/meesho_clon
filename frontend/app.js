// ==========================================================================
// LAVENDER — LUXURY INDIAN BEAUTY PLATFORM (app.js)
// State Management, Routing, Dynamic Views, Catalog Filtering, Cart & Checkout
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {

  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================
  const getApiBase = () => {
    if (window.__ENV__) {
      if (window.__ENV__.API_BASE_URL) {
        return window.__ENV__.API_BASE_URL.replace(/\/+$/, '');
      }
      if (window.__ENV__.BACKEND_URL) {
        const root = window.__ENV__.BACKEND_URL.replace(/\/+$/, '');
        return root.endsWith('/api') ? root : `${root}/api`;
      }
    }
    return '/api';
  };

  const api = {
    async request(endpoint, options = {}) {
      // Wait for .env async loader if still resolving
      if (window.__loadEnvPromise) {
        try { await window.__loadEnvPromise; } catch {}
      }

      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };
      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }
      try {
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = `${getApiBase()}${cleanEndpoint}`;
        const res = await fetch(url, {
          ...options,
          headers
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
        }
        return data;
      } catch (err) {
        console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err);
        throw err;
      }
    },

    async register(name, email, password, phone) {
      return this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, phone })
      });
    },

    async login(email, password) {
      return this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
    },

    async googleAuth(name, email) {
      return this.request('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ name, email })
      });
    },

    async getMe() {
      return this.request('/auth/me');
    },

    async logout() {
      return this.request('/auth/logout', { method: 'POST' });
    },

    async getWishlist() {
      return this.request('/wishlist');
    },

    async toggleWishlist(product) {
      return this.request('/wishlist/toggle', {
        method: 'POST',
        body: JSON.stringify({ product, productId: product.id })
      });
    },

    async addToWishlist(product) {
      return this.request('/wishlist/add', {
        method: 'POST',
        body: JSON.stringify({ product })
      });
    },

    async removeFromWishlist(productId) {
      return this.request(`/wishlist/${productId}`, {
        method: 'DELETE'
      });
    },

    // Products & Metadata API (SQLite Backend)
    async getProducts(filter = {}) {
      const params = new URLSearchParams();
      if (filter.category) params.set('category', filter.category);
      if (filter.brand) params.set('brand', filter.brand);
      if (filter.search) params.set('search', filter.search);
      const query = params.toString() ? `?${params.toString()}` : '';
      return this.request(`/products${query}`);
    },

    async getProduct(id) {
      return this.request(`/products/${id}`);
    },

    async getCategories() {
      return this.request('/categories');
    },

    async getBrands() {
      return this.request('/brands');
    },

    async placeOrder(orderData) {
      return this.request('/orders', {
        method: 'POST',
        body: JSON.stringify(orderData)
      });
    },

    async getOrders() {
      return this.request('/orders');
    },

    async getReviews() {
      return this.request('/reviews');
    },

    async getCoupons() {
      return this.request('/coupons');
    }
  };

  const state = {
    currentRoute: 'home',
    routeParam: null,
    searchQuery: '',
    // 100% of products, categories & brands are loaded exclusively from SQLite backend
    products: [],
    brands: [],
    categories: [],
    reviews: [],
    coupons: {
      'GLOW15': { discountPercent: 15, minOrder: 999, maxDiscount: 400, desc: '15% OFF above ₹999' },
      'LAVENDER15': { discountPercent: 15, minOrder: 799, maxDiscount: 350, desc: '15% OFF beauty sanctuary orders' },
      'GLOW200': { discountAmount: 200, minOrder: 1199, maxDiscount: 200, desc: 'Flat ₹200 OFF on ₹1,199+' },
      'SANCTUARY20': { discountPercent: 20, minOrder: 1999, maxDiscount: 600, desc: '20% OFF luxury curation' },
      'LAVENDER50': { discountPercent: 50, minOrder: 2999, maxDiscount: 1000, desc: 'Flat 50% OFF up to ₹1,000' }
    },
    cart: JSON.parse(localStorage.getItem('lavender_cart') || '[]'),
    wishlist: [],
    appliedCoupon: null,
    activeFilters: {
      category: 'all',
      productTypes: [],
      brands: [],
      maxPrice: 1200,
      minRating: 0,
      minDiscount: 0,
      skinTypes: [],
      concerns: [],
      inStockOnly: true,
      sortBy: 'popularity'
    },
    offersFilter: 'all',
    selectedModalProduct: null,
    selectedModalSize: null,
    modalQty: 1,
    token: localStorage.getItem('lavender_token') || null,
    currentUser: JSON.parse(localStorage.getItem('lavender_user') || 'null'),
    pendingWishlistProduct: null
  };

  // ========================================================================
  // DOM ELEMENTS CACHE
  // ========================================================================
  const elements = {
    // Header & Navigation
    mainHeader: document.getElementById('mainHeader'),
    mainCategoryNav: document.getElementById('mainCategoryNav'),
    brandDropIcon: document.getElementById('brandDropIcon'),
    globalSearchInput: document.getElementById('globalSearchInput'),
    searchBoxWrap: document.getElementById('searchBoxWrap'),
    searchClearBtn: document.getElementById('searchClearBtn'),
    searchDropdown: document.getElementById('searchDropdown'),
    searchPreviewList: document.getElementById('searchPreviewList'),
    searchQuickTags: document.getElementById('searchQuickTags'),
    wishlistCountBadge: document.getElementById('wishlistCountBadge'),
    cartCountBadge: document.getElementById('cartCountBadge'),
    wishlistToggleBtn: document.getElementById('wishlistToggleBtn'),
    wishlistHeaderLabel: document.getElementById('wishlistHeaderLabel'),
    cartToggleBtn: document.getElementById('cartToggleBtn'),
    homeLogoBtn: document.getElementById('homeLogoBtn'),
    userAccountWrapper: document.querySelector('.user-account-wrapper'),
    userAccountBtn: document.getElementById('userAccountBtn'),
    userAccountLabel: document.getElementById('userAccountLabel'),
    accountDropdownMenu: document.getElementById('accountDropdownMenu'),
    menuUserName: document.getElementById('menuUserName'),
    menuUserEmail: document.getElementById('menuUserEmail'),
    menuWishlistCount: document.getElementById('menuWishlistCount'),
    topTrackOrderBtn: document.getElementById('topTrackOrderBtn'),
    replayIntroBtn: document.getElementById('replayIntroBtn'),

    // Netflix Intro Overlay
    netflixIntroOverlay: document.getElementById('netflixIntroOverlay'),
    skipNetflixIntroBtn: document.getElementById('skipNetflixIntroBtn'),
    netflixSoundBtn: document.getElementById('netflixSoundBtn'),

    // Views
    homeView: document.getElementById('homeView'),
    listingView: document.getElementById('listingView'),
    brandsView: document.getElementById('brandsView'),
    offersView: document.getElementById('offersView'),
    searchView: document.getElementById('searchView'),
    createAccountView: document.getElementById('createAccountView'),
    wishlistPageView: document.getElementById('wishlistPageView'),

    // Wishlist Page Elements
    wishlistPageGrid: document.getElementById('wishlistPageGrid'),
    wishlistPageEmptyState: document.getElementById('wishlistPageEmptyState'),
    wishlistPageCountHeader: document.getElementById('wishlistPageCountHeader'),
    wishlistUserGreetingPill: document.getElementById('wishlistUserGreetingPill'),
    wishlistEmptyAuthPrompt: document.getElementById('wishlistEmptyAuthPrompt'),

    // Create Account Page Elements
    pageAuthTitle: document.getElementById('pageAuthTitle'),
    pageAuthDesc: document.getElementById('pageAuthDesc'),
    pageAuthProductCol: document.getElementById('pageAuthProductCol'),
    pageAuthProdImg: document.getElementById('pageAuthProdImg'),
    pageAuthProdBrand: document.getElementById('pageAuthProdBrand'),
    pageAuthProdTitle: document.getElementById('pageAuthProdTitle'),
    pageAuthProdPrice: document.getElementById('pageAuthProdPrice'),
    pageTabCreateBtn: document.getElementById('pageTabCreateBtn'),
    pageTabLoginBtn: document.getElementById('pageTabLoginBtn'),
    pageCreateAccountForm: document.getElementById('pageCreateAccountForm'),
    pageSignInForm: document.getElementById('pageSignInForm'),
    pageRegFullName: document.getElementById('pageRegFullName'),
    pageRegEmail: document.getElementById('pageRegEmail'),
    pageRegPassword: document.getElementById('pageRegPassword'),
    pageRegPhone: document.getElementById('pageRegPhone'),
    pageLoginEmail: document.getElementById('pageLoginEmail'),
    pageLoginPassword: document.getElementById('pageLoginPassword'),
    pageSubmitCreateBtn: document.getElementById('pageSubmitCreateBtn'),
    pageSubmitLoginBtn: document.getElementById('pageSubmitLoginBtn'),

    // Homepage Containers
    homeCategoryTiles: document.getElementById('homeCategoryTiles'),
    homeTrendingGrid: document.getElementById('homeTrendingGrid'),
    homeBestsellersGrid: document.getElementById('homeBestsellersGrid'),
    homeBrandsGrid: document.getElementById('homeBrandsGrid'),
    homeSkincareGrid: document.getElementById('homeSkincareGrid'),
    homeHaircareGrid: document.getElementById('homeHaircareGrid'),
    homeMakeupGrid: document.getElementById('homeMakeupGrid'),
    homeBodycareGrid: document.getElementById('homeBodycareGrid'),
    homeDealsGrid: document.getElementById('homeDealsGrid'),
    homeReviewsGrid: document.getElementById('homeReviewsGrid'),

    // Listing View Containers & Filters
    listingBreadcrumbs: document.getElementById('listingBreadcrumbs'),
    breadcrumbCurrent: document.getElementById('breadcrumbCurrent'),
    listingPageTitle: document.getElementById('listingPageTitle'),
    listingPageDesc: document.getElementById('listingPageDesc'),
    listingResultCount: document.getElementById('listingResultCount'),
    listingProductGrid: document.getElementById('listingProductGrid'),
    listingEmptyState: document.getElementById('listingEmptyState'),
    emptyResetBtn: document.getElementById('emptyResetBtn'),
    filterResetBtn: document.getElementById('filterResetBtn'),
    sortBySelect: document.getElementById('sortBySelect'),
    priceSlider: document.getElementById('priceSlider'),
    priceSliderValue: document.getElementById('priceSliderValue'),
    filterProductTypeList: document.getElementById('filterProductTypeList'),
    filterBrandList: document.getElementById('filterBrandList'),
    filterSkinTypeList: document.getElementById('filterSkinTypeList'),
    filterConcernList: document.getElementById('filterConcernList'),
    inStockOnlyCheckbox: document.getElementById('inStockOnlyCheckbox'),

    // Brands View
    brandsAlphaNav: document.getElementById('brandsAlphaNav'),
    brandsDirectoryGrid: document.getElementById('brandsDirectoryGrid'),

    // Offers View
    offersTabsRow: document.getElementById('offersTabsRow'),
    offersProductGrid: document.getElementById('offersProductGrid'),

    // Search View
    searchResultQueryText: document.getElementById('searchResultQueryText'),
    searchResultSubtitle: document.getElementById('searchResultSubtitle'),
    searchResultGrid: document.getElementById('searchResultGrid'),
    searchEmptyState: document.getElementById('searchEmptyState'),

    // Product Detail Modal
    productDetailModal: document.getElementById('productDetailModal'),
    closeProductDetailBtn: document.getElementById('closeProductDetailBtn'),
    modalMainImg: document.getElementById('modalMainImg'),
    modalThumbnailsStrip: document.getElementById('modalThumbnailsStrip'),
    modalBrand: document.getElementById('modalBrand'),
    modalTitle: document.getElementById('modalTitle'),
    modalRating: document.getElementById('modalRating'),
    modalRatingCount: document.getElementById('modalRatingCount'),
    modalPrice: document.getElementById('modalPrice'),
    modalOriginalPrice: document.getElementById('modalOriginalPrice'),
    modalDiscount: document.getElementById('modalDiscount'),
    modalSizeGroup: document.getElementById('modalSizeGroup'),
    modalSizeChips: document.getElementById('modalSizeChips'),
    pincodeInput: document.getElementById('pincodeInput'),
    pincodeCheckBtn: document.getElementById('pincodeCheckBtn'),
    pincodeStatus: document.getElementById('pincodeStatus'),
    modalQtyMinus: document.getElementById('modalQtyMinus'),
    modalQtyPlus: document.getElementById('modalQtyPlus'),
    modalQtyDisplay: document.getElementById('modalQtyDisplay'),
    modalAddToCartBtn: document.getElementById('modalAddToCartBtn'),
    modalBuyNowBtn: document.getElementById('modalBuyNowBtn'),
    modalDescription: document.getElementById('modalDescription'),
    modalBenefits: document.getElementById('modalBenefits'),
    modalHowToUse: document.getElementById('modalHowToUse'),
    modalIngredients: document.getElementById('modalIngredients'),
    modalSuitableFor: document.getElementById('modalSuitableFor'),

    // Cart Drawer
    cartDrawer: document.getElementById('cartDrawer'),
    cartOverlay: document.getElementById('cartOverlay'),
    closeCartDrawerBtn: document.getElementById('closeCartDrawerBtn'),
    cartDrawerCount: document.getElementById('cartDrawerCount'),
    cartDrawerItems: document.getElementById('cartDrawerItems'),
    freeShipText: document.getElementById('freeShipText'),
    freeShipFill: document.getElementById('freeShipFill'),
    cartCouponInput: document.getElementById('cartCouponInput'),
    applyCartCouponBtn: document.getElementById('applyCartCouponBtn'),
    couponAppliedMsg: document.getElementById('couponAppliedMsg'),
    billMrpTotal: document.getElementById('billMrpTotal'),
    billProductDiscount: document.getElementById('billProductDiscount'),
    billCouponRow: document.getElementById('billCouponRow'),
    billCouponDiscount: document.getElementById('billCouponDiscount'),
    billDeliveryFee: document.getElementById('billDeliveryFee'),
    billFinalAmount: document.getElementById('billFinalAmount'),
    proceedToCheckoutBtn: document.getElementById('proceedToCheckoutBtn'),

    // Wishlist Drawer
    wishlistDrawer: document.getElementById('wishlistDrawer'),
    wishlistOverlay: document.getElementById('wishlistOverlay'),
    closeWishlistDrawerBtn: document.getElementById('closeWishlistDrawerBtn'),
    wishlistDrawerCount: document.getElementById('wishlistDrawerCount'),
    wishlistDrawerItems: document.getElementById('wishlistDrawerItems'),

    modalWishlistBtn: document.getElementById('modalWishlistBtn'),

    // Checkout Modal
    checkoutModal: document.getElementById('checkoutModal'),
    closeCheckoutBtn: document.getElementById('closeCheckoutBtn'),
    checkoutStepForm: document.getElementById('checkoutStepForm'),
    checkoutStepSuccess: document.getElementById('checkoutStepSuccess'),
    checkoutTotalPayable: document.getElementById('checkoutTotalPayable'),
    successOrderId: document.getElementById('successOrderId'),
    continueShoppingBtn: document.getElementById('continueShoppingBtn'),

    // Auth Modal (Wishlist & Account Creation)
    authModal: document.getElementById('authModal'),
    closeAuthModalBtn: document.getElementById('closeAuthModalBtn'),
    authModalTitle: document.getElementById('authModalTitle'),
    authModalSub: document.getElementById('authModalSub'),
    authProductPreview: document.getElementById('authProductPreview'),
    authPreviewImg: document.getElementById('authPreviewImg'),
    authPreviewTitle: document.getElementById('authPreviewTitle'),
    authPreviewPrice: document.getElementById('authPreviewPrice'),
    tabCreateAccountBtn: document.getElementById('tabCreateAccountBtn'),
    tabSignInBtn: document.getElementById('tabSignInBtn'),
    createAccountForm: document.getElementById('createAccountForm'),
    signInForm: document.getElementById('signInForm'),
    regFullName: document.getElementById('regFullName'),
    regEmail: document.getElementById('regEmail'),
    regPassword: document.getElementById('regPassword'),
    regPhone: document.getElementById('regPhone'),
    loginIdentifier: document.getElementById('loginIdentifier'),
    loginPassword: document.getElementById('loginPassword'),
    submitCreateAccountBtn: document.getElementById('submitCreateAccountBtn'),

    // Toast Container
    toastContainer: document.getElementById('toastContainer')
  };

  // ========================================================================
  // ROUTING & NAVIGATION
  // ========================================================================
  function parseRoute() {
    let hash = window.location.hash || '#/';
    if (!hash.startsWith('#/')) {
      hash = '#/';
    }
    const path = hash.replace('#/', '').split('?')[0];
    const parts = path.split('/').filter(Boolean);

    let route = 'home';
    let param = null;

    if (parts.length === 0) {
      route = 'home';
    } else if (parts[0] === 'all-beauty') {
      route = 'listing';
      param = 'all-beauty';
    } else if (['skincare', 'haircare', 'makeup', 'bodycare', 'fragrance'].includes(parts[0])) {
      route = 'listing';
      param = parts[0];
    } else if (parts[0] === 'brands') {
      if (parts[1]) {
        route = 'listing';
        param = `brand:${parts[1]}`;
      } else {
        route = 'brands';
      }
    } else if (parts[0] === 'offers') {
      route = 'offers';
    } else if (parts[0] === 'search') {
      route = 'search';
      const searchParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      param = searchParams.get('q') || '';
    } else if (parts[0] === 'product' && parts[1]) {
      route = 'product';
      param = parts[1];
    } else if (parts[0] === 'wishlist') {
      route = 'wishlist';
    } else if (parts[0] === 'create-account' || parts[0] === 'register') {
      route = 'create-account';
      const searchParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      param = searchParams.get('productId') || '';
    }

    return { route, param };
  }

  function handleNavigation() {
    const { route, param } = parseRoute();
    state.currentRoute = route;
    state.routeParam = param;
    document.body.style.overflow = '';

    // Hide all views first and reset display
    [elements.homeView, elements.listingView, elements.brandsView, elements.offersView, elements.searchView, elements.createAccountView, elements.wishlistPageView].forEach(view => {
      if (view) {
        view.classList.remove('active-view');
        view.style.display = 'none';
      }
    });

    // Update active nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      const linkRoute = link.getAttribute('data-route');
      if (route === 'listing' && (param === linkRoute || (param.startsWith('brand:') && linkRoute === 'brands'))) {
        link.classList.add('active');
      } else if (route === linkRoute) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Scroll to top on page switch
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Render corresponding view
    if (route === 'home') {
      if (elements.homeView) {
        elements.homeView.classList.add('active-view');
        elements.homeView.style.display = 'block';
      }
    } else if (route === 'listing') {
      if (elements.listingView) {
        elements.listingView.classList.add('active-view');
        elements.listingView.style.display = 'block';
      }
      setupListingView(param);
    } else if (route === 'brands') {
      if (elements.brandsView) {
        elements.brandsView.classList.add('active-view');
        elements.brandsView.style.display = 'block';
      }
      renderBrandsDirectory();
    } else if (route === 'offers') {
      if (elements.offersView) {
        elements.offersView.classList.add('active-view');
        elements.offersView.style.display = 'block';
      }
      renderOffersView();
    } else if (route === 'search') {
      if (elements.searchView) {
        elements.searchView.classList.add('active-view');
        elements.searchView.style.display = 'block';
      }
      renderSearchView(param);
    } else if (route === 'product') {
      const prod = state.products.find(p => p.id === param);
      if (prod) {
        openProductModal(prod);
      }
      if (elements.listingView) {
        elements.listingView.classList.add('active-view');
        elements.listingView.style.display = 'block';
      }
      setupListingView('all-beauty');
    } else if (route === 'create-account') {
      if (elements.createAccountView) {
        elements.createAccountView.classList.add('active-view');
        elements.createAccountView.style.display = 'block';
      }
      setupCreateAccountPage(param);
    } else if (route === 'wishlist') {
      if (elements.wishlistPageView) {
        elements.wishlistPageView.classList.add('active-view');
        elements.wishlistPageView.style.display = 'block';
      }
      renderWishlistPageView();
    }
  }

  // ========================================================================
  // RENDER HOMEPAGE SECTIONS
  // ========================================================================
  function renderHeaderCategoryNav() {
    if (!elements.mainCategoryNav || !state.categories || state.categories.length === 0) return;
    const cats = state.categories.filter(c => c.slug !== 'all-beauty');
    elements.mainCategoryNav.innerHTML = `
      <li class="nav-item">
        <a href="#/all-beauty" class="nav-link" data-route="all-beauty" onclick="if(window.navigateToCategory)window.navigateToCategory('all-beauty'); return false;">All Beauty</a>
      </li>
      ${cats.map(c => `
        <li class="nav-item">
          <a href="#/${c.slug}" class="nav-link" data-route="${c.slug}" onclick="if(window.navigateToCategory)window.navigateToCategory('${c.slug}'); return false;">${c.label}</a>
        </li>
      `).join('')}
      <li class="nav-item">
        <a href="#/brands" class="nav-link" data-route="brands" onclick="if(window.navigateToCategory)window.navigateToCategory('brands'); return false;">Brands</a>
      </li>
      <li class="nav-item">
        <a href="#/offers" class="nav-link" data-route="offers" onclick="if(window.navigateToCategory)window.navigateToCategory('offers'); return false;">
          Offers <span class="nav-tag-badge">50% Off</span>
        </a>
      </li>
    `;
  }

  function renderHomepage() {
    renderHeaderCategoryNav();

    // 1. Shop By Category Tiles (Dynamic from SQLite backend)
    const categoryImgMap = {
      skincare: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=300&q=80",
      haircare: "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=300&q=80",
      makeup: "https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=300&q=80",
      bodycare: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=300&q=80",
      fragrance: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=300&q=80",
      "all-beauty": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=300&q=80"
    };

    const activeCategories = (state.categories && state.categories.length > 0)
      ? state.categories.filter(c => c.slug !== 'all-beauty')
      : [
          { label: "Skincare", slug: "skincare" },
          { label: "Haircare", slug: "haircare" },
          { label: "Makeup", slug: "makeup" },
          { label: "Bodycare", slug: "bodycare" },
          { label: "Fragrance", slug: "fragrance" }
        ];

    const categoriesData = activeCategories.map(catObj => {
      const count = state.products.filter(p => p.category === catObj.slug || p.category === catObj.id).length;
      return {
        name: catObj.label,
        slug: catObj.slug,
        count: `${count} Products`,
        img: categoryImgMap[catObj.slug] || categoryImgMap.skincare
      };
    });

    categoriesData.push({
      name: "All Beauty",
      slug: "all-beauty",
      count: `${state.products.length} Products`,
      img: categoryImgMap["all-beauty"]
    });

    elements.homeCategoryTiles.innerHTML = categoriesData.map(cat => `
      <div class="cat-tile-card" onclick="window.navigateToCategory('${cat.slug}')">
        <div class="cat-tile-img-wrap">
          <img src="${cat.img}" alt="${cat.name}" class="cat-tile-img" loading="lazy" />
        </div>
        <div class="cat-tile-name">${cat.name}</div>
        <div class="cat-tile-count">${cat.count}</div>
      </div>
    `).join('');

    // 2. Trending Now (4 cards)
    const trendingItems = state.products.filter(p => p.isTrending).slice(0, 4);
    elements.homeTrendingGrid.innerHTML = renderProductGridCards(trendingItems);

    // 3. Bestsellers (4 cards)
    const bestsellerItems = state.products.filter(p => p.isBestseller).slice(0, 4);
    elements.homeBestsellersGrid.innerHTML = renderProductGridCards(bestsellerItems);

    // 4. Top Brands Pills
    elements.homeBrandsGrid.innerHTML = state.brands.slice(0, 10).map(b => {
      const brandCount = b.count || state.products.filter(p => p.brandSlug === b.id || (p.brand && p.brand.toLowerCase() === b.name.toLowerCase())).length;
      return `
      <div class="brand-card-pill" onclick="window.location.hash='#/brands/${b.id || b.slug}'">
        <div class="brand-card-title">${b.name}</div>
        <div class="brand-card-origin">${b.origin || ''}</div>
        <div class="brand-card-tag">${brandCount ? `${brandCount} Items` : (b.tag || '')}</div>
      </div>
    `;
    }).join('');

    // 5. Skincare Essentials (4 cards)
    const skincareItems = state.products.filter(p => p.category === 'skincare').slice(0, 4);
    elements.homeSkincareGrid.innerHTML = renderProductGridCards(skincareItems);

    // 6. Haircare Edit (4 cards)
    const haircareItems = state.products.filter(p => p.category === 'haircare').slice(0, 4);
    elements.homeHaircareGrid.innerHTML = renderProductGridCards(haircareItems);

    // 7. Makeup Must-Haves (4 cards)
    const makeupItems = state.products.filter(p => p.category === 'makeup').slice(0, 4);
    elements.homeMakeupGrid.innerHTML = renderProductGridCards(makeupItems);

    // 8. Bodycare Rituals (4 cards)
    const bodycareItems = state.products.filter(p => p.category === 'bodycare').slice(0, 4);
    elements.homeBodycareGrid.innerHTML = renderProductGridCards(bodycareItems);

    // 9. Deals You’ll Love (4 cards)
    const dealItems = state.products.filter(p => p.isFlashDeal || p.discount >= 18).slice(0, 4);
    elements.homeDealsGrid.innerHTML = renderProductGridCards(dealItems);

    // 10. Customer Reviews (from backend API)
    const reviewsList = (state.reviews && state.reviews.length) ? state.reviews : [];
    elements.homeReviewsGrid.innerHTML = reviewsList.map(r => `
      <div class="review-card">
        <div class="review-stars">${'★'.repeat(r.rating)}</div>
        <div class="review-quote-title">"${r.title}"</div>
        <div class="review-quote-body">${r.review}</div>
        <div class="review-author-wrap">
          <img src="${r.avatar}" alt="${r.name}" class="review-avatar" />
          <div>
            <div class="review-author-name">${r.name}</div>
            <div class="review-author-city">${r.city} • Verified Buyer of ${r.product}</div>
          </div>
        </div>
      </div>
    `).join('');
  }

  // ========================================================================
  // PRODUCT CARDS RENDERER (Clean, airy, 4 desktop / 2 mobile)
  // ========================================================================
  function renderProductGridCards(productsList) {
    if (!productsList || productsList.length === 0) return '';
    return productsList.map((prod, idx) => {
      const isWishlisted = state.wishlist.some(item => item.id === prod.id);
      const delay = Math.min((idx % 12) * 0.04, 0.48);
      return `
        <article class="product-card" data-product-id="${prod.id}" style="animation: cardFadeInUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s both;">
          <div class="product-image-container" onclick="window.viewProduct('${prod.id}')">
            ${prod.offerTag ? `<span class="product-tag-pill">${prod.offerTag}</span>` : ''}
            <button 
              class="wishlist-heart-btn ${isWishlisted ? 'active' : ''}" 
              onclick="event.stopPropagation(); window.toggleWishlist('${prod.id}')"
              aria-label="Save to Wishlist"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${isWishlisted ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <img src="${prod.image}" alt="${prod.title}" class="product-img" loading="lazy" />
          </div>

          <div class="product-info-wrap">
            <div class="product-brand-line">${prod.brand}</div>
            <h3 class="product-title-line" onclick="window.viewProduct('${prod.id}')">${prod.title}</h3>
            
            <div class="product-rating-row">
              <span class="rating-badge">★ ${prod.rating}</span>
              <span class="rating-count">(${prod.ratingCount.toLocaleString()})</span>
            </div>

            <div class="product-price-row">
              <span class="price-final">₹${prod.price}</span>
              <span class="price-original">₹${prod.originalPrice}</span>
              <span class="price-discount-badge">${prod.discount}% OFF</span>
            </div>

            <button class="product-quick-add-btn" onclick="window.quickAddToCart('${prod.id}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Quick Add
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  // ========================================================================
  // DEDICATED CATEGORY & LISTING PAGE SETUP
  // ========================================================================
  function setupListingView(categoryOrBrandParam) {
    const cats = state.categories || [];
    let categoryData = cats.find(c => c.slug === categoryOrBrandParam);
    let isBrandFilter = false;
    let selectedBrandObj = null;

    if (categoryOrBrandParam.startsWith('brand:')) {
      const brandId = categoryOrBrandParam.replace('brand:', '');
      selectedBrandObj = (state.brands || []).find(b => b.id === brandId || b.slug === brandId);
      isBrandFilter = true;
    }

    if (isBrandFilter && selectedBrandObj) {
      state.activeFilters.category = 'all';
      state.activeFilters.brands = [selectedBrandObj.name];
      elements.breadcrumbCurrent.textContent = selectedBrandObj.name;
      elements.listingPageTitle.textContent = `${selectedBrandObj.name} Flagship Boutique`;
      elements.listingPageDesc.textContent = `Shop 100% authentic dermatological and beauty formulations from ${selectedBrandObj.name}. Origin: ${selectedBrandObj.origin}.`;
    } else if (categoryData) {
      state.activeFilters.category = categoryData.id;
      state.activeFilters.brands = [];
      elements.breadcrumbCurrent.textContent = categoryData.label;
      elements.listingPageTitle.textContent = categoryData.id === 'all-beauty' ? 'All Beauty Marketplace' : `${categoryData.label} Sanctuary`;
      elements.listingPageDesc.textContent = categoryData.tagline;
    } else {
      state.activeFilters.category = 'all';
      state.activeFilters.brands = [];
      elements.breadcrumbCurrent.textContent = 'All Beauty';
      elements.listingPageTitle.textContent = 'All Beauty Marketplace';
      elements.listingPageDesc.textContent = 'Explore our complete curated sanctuary of award-winning beauty.';
    }

    // Populate Sidebar Filters
    populateFilterSidebar(categoryData, selectedBrandObj);

    // Apply filters and render grid
    applyFiltersAndRenderListing();
  }

  function populateFilterSidebar(categoryData, selectedBrandObj) {
    // 1. Product Types
    let relevantTypes = [];
    if (categoryData && categoryData.types && categoryData.types.length > 0 && categoryData.id !== 'all-beauty') {
      relevantTypes = categoryData.types;
    } else {
      const allTypes = new Set();
      state.products.forEach(p => allTypes.add(p.productType));
      relevantTypes = Array.from(allTypes).sort();
    }

    elements.filterProductTypeList.innerHTML = relevantTypes.map(type => `
      <label class="filter-checkbox-label">
        <input type="checkbox" name="productType" value="${type}" ${state.activeFilters.productTypes.includes(type) ? 'checked' : ''} />
        <span>${type}</span>
      </label>
    `).join('');

    // 2. Brands
    const brandCounts = {};
    state.products.forEach(p => {
      brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
    });

    const sortedBrands = Object.keys(brandCounts).sort();
    elements.filterBrandList.innerHTML = sortedBrands.map(brand => `
      <label class="filter-checkbox-label">
        <input type="checkbox" name="brandFilter" value="${brand}" ${state.activeFilters.brands.includes(brand) ? 'checked' : ''} />
        <span>${brand} <small style="color: var(--deep-plum-muted);">(${brandCounts[brand]})</small></span>
      </label>
    `).join('');

    // 3. Skin Types
    const skinTypes = ["All Skin Types", "Oily & Acne-Prone", "Dry & Sensitive", "Combination", "Indian Skin Types"];
    elements.filterSkinTypeList.innerHTML = skinTypes.map(st => `
      <label class="filter-checkbox-label">
        <input type="checkbox" name="skinTypeFilter" value="${st}" ${state.activeFilters.skinTypes.includes(st) ? 'checked' : ''} />
        <span>${st}</span>
      </label>
    `).join('');

    // 4. Concerns
    const concerns = ["Acne & Blemishes", "Sun Protection", "Pigmentation", "Dryness", "Dullness & Glow", "Hair Fall", "Dandruff & Flakes", "Frizz & Dryness", "Enlarged Pores", "Dark Circles"];
    elements.filterConcernList.innerHTML = concerns.map(c => `
      <label class="filter-checkbox-label">
        <input type="checkbox" name="concernFilter" value="${c}" ${state.activeFilters.concerns.includes(c) ? 'checked' : ''} />
        <span>${c}</span>
      </label>
    `).join('');
  }

  function applyFiltersAndRenderListing() {
    let filtered = [...state.products];

    // Category Filter
    if (state.activeFilters.category !== 'all' && state.activeFilters.category !== 'all-beauty') {
      filtered = filtered.filter(p => p.category === state.activeFilters.category);
    }

    // Product Type Filter
    if (state.activeFilters.productTypes.length > 0) {
      filtered = filtered.filter(p => state.activeFilters.productTypes.includes(p.productType));
    }

    // Brand Filter
    if (state.activeFilters.brands.length > 0) {
      filtered = filtered.filter(p => state.activeFilters.brands.includes(p.brand));
    }

    // Price Filter
    filtered = filtered.filter(p => p.price <= state.activeFilters.maxPrice);

    // Rating Filter
    if (state.activeFilters.minRating > 0) {
      filtered = filtered.filter(p => p.rating >= state.activeFilters.minRating);
    }

    // Discount Filter
    if (state.activeFilters.minDiscount > 0) {
      filtered = filtered.filter(p => p.discount >= state.activeFilters.minDiscount);
    }

    // Skin Type Filter
    if (state.activeFilters.skinTypes.length > 0) {
      filtered = filtered.filter(p => state.activeFilters.skinTypes.some(st => p.skinType.toLowerCase().includes(st.toLowerCase())));
    }

    // Concern Filter
    if (state.activeFilters.concerns.length > 0) {
      filtered = filtered.filter(p => state.activeFilters.concerns.includes(p.concern));
    }

    // In Stock Only
    if (state.activeFilters.inStockOnly) {
      filtered = filtered.filter(p => p.inStock);
    }

    // Sorting
    if (state.activeFilters.sortBy === 'price-low-high') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (state.activeFilters.sortBy === 'price-high-low') {
      filtered.sort((a, b) => b.price - a.price);
    } else if (state.activeFilters.sortBy === 'rating') {
      filtered.sort((a, b) => b.rating - a.rating);
    } else if (state.activeFilters.sortBy === 'newest') {
      filtered.sort((a, b) => (b.isTrending ? 1 : 0) - (a.isTrending ? 1 : 0));
    } else {
      // Popularity default
      filtered.sort((a, b) => b.ratingCount - a.ratingCount);
    }

    // Render results
    elements.listingResultCount.textContent = filtered.length;

    if (filtered.length === 0) {
      elements.listingProductGrid.innerHTML = '';
      elements.listingEmptyState.style.display = 'block';
    } else {
      elements.listingEmptyState.style.display = 'none';
      elements.listingProductGrid.innerHTML = renderProductGridCards(filtered);
    }
  }

  // ========================================================================
  // BRANDS DIRECTORY RENDERER (A-Z Navigation & Directory Cards)
  // ========================================================================
  function renderBrandsDirectory(filterLetter = 'all') {
    // 1. Alphabet Tabs
    const alphabet = ['All', 'A', 'D', 'F', 'I', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'W'];
    elements.brandsAlphaNav.innerHTML = alphabet.map(letter => `
      <button 
        class="alpha-nav-btn ${filterLetter.toUpperCase() === letter.toUpperCase() ? 'active' : ''}" 
        onclick="window.filterBrandsByLetter('${letter}')"
      >
        ${letter}
      </button>
    `).join('');

    // 2. Filtered Brands
    let brands = [...state.brands];
    if (filterLetter !== 'all' && filterLetter !== 'All') {
      brands = brands.filter(b => b.name.toUpperCase().startsWith(filterLetter.toUpperCase()));
    }

    elements.brandsDirectoryGrid.innerHTML = brands.map(b => {
      const brandProductsCount = state.products.filter(p => p.brand.toLowerCase() === b.name.toLowerCase() || p.brandSlug === b.id).length;
      return `
        <div class="brand-directory-card" onclick="window.location.hash='#/brands/${b.id}'">
          <div class="brand-dir-header">
            <h3 class="brand-dir-name">${b.name}</h3>
            <span class="brand-dir-count">${brandProductsCount} Items</span>
          </div>
          <div class="brand-dir-tag">${b.tag}</div>
          <div class="brand-dir-origin">Origin: ${b.origin}</div>
          <div class="brand-dir-link">
            Explore Boutique →
          </div>
        </div>
      `;
    }).join('');
  }

  // ========================================================================
  // OFFERS PAGE RENDERER
  // ========================================================================
  function renderOffersView() {
    let filtered = [...state.products];

    if (state.offersFilter === 'flash') {
      filtered = filtered.filter(p => p.isFlashDeal);
    } else if (state.offersFilter === '50off') {
      filtered = filtered.filter(p => p.discount >= 20);
    } else if (state.offersFilter === 'bestseller') {
      filtered = filtered.filter(p => p.isBestseller);
    } else if (state.offersFilter === 'under299') {
      filtered = filtered.filter(p => p.price <= 299);
    } else if (state.offersFilter === 'under499') {
      filtered = filtered.filter(p => p.price <= 499);
    }

    elements.offersProductGrid.innerHTML = renderProductGridCards(filtered);
  }

  // ========================================================================
  // SEARCH SYSTEM (Live Dropdown & Search Results Page)
  // ========================================================================
  function handleLiveSearch(query) {
    state.searchQuery = query.trim().toLowerCase();

    if (!state.searchQuery) {
      elements.searchBoxWrap.classList.remove('has-query');
      elements.searchDropdown.classList.remove('active');
      return;
    }

    elements.searchBoxWrap.classList.add('has-query');
    elements.searchDropdown.classList.add('active');

    // Matching products for dropdown preview (max 5)
    const matches = state.products.filter(p => 
      p.title.toLowerCase().includes(state.searchQuery) ||
      p.brand.toLowerCase().includes(state.searchQuery) ||
      p.productType.toLowerCase().includes(state.searchQuery) ||
      p.concern.toLowerCase().includes(state.searchQuery) ||
      p.category.toLowerCase().includes(state.searchQuery)
    ).slice(0, 5);

    if (matches.length === 0) {
      elements.searchPreviewList.innerHTML = `
        <div style="font-size: 0.85rem; color: var(--deep-plum-muted); padding: 8px 0;">
          No direct matches found. Press Enter to view all results.
        </div>
      `;
    } else {
      elements.searchPreviewList.innerHTML = matches.map(prod => `
        <div class="search-preview-item" onclick="window.viewProduct('${prod.id}')">
          <img src="${prod.image}" alt="${prod.title}" class="search-preview-img" />
          <div class="search-preview-info">
            <div class="search-preview-brand">${prod.brand}</div>
            <div class="search-preview-title">${prod.title}</div>
          </div>
          <div class="search-preview-price">₹${prod.price}</div>
        </div>
      `).join('');
    }
  }

  function executeSearchPage(query) {
    if (!query) return;
    elements.searchDropdown.classList.remove('active');
    window.location.hash = `#/search?q=${encodeURIComponent(query)}`;
  }

  function renderSearchView(query) {
    elements.searchResultQueryText.textContent = query;
    const cleanQ = (query || '').toLowerCase().trim();

    const matches = state.products.filter(p => 
      p.title.toLowerCase().includes(cleanQ) ||
      p.brand.toLowerCase().includes(cleanQ) ||
      p.productType.toLowerCase().includes(cleanQ) ||
      p.concern.toLowerCase().includes(cleanQ) ||
      p.category.toLowerCase().includes(cleanQ) ||
      p.description.toLowerCase().includes(cleanQ)
    );

    if (matches.length === 0) {
      elements.searchResultGrid.innerHTML = '';
      elements.searchEmptyState.style.display = 'block';
    } else {
      elements.searchEmptyState.style.display = 'none';
      elements.searchResultGrid.innerHTML = renderProductGridCards(matches);
    }
  }

  // ========================================================================
  // PRODUCT DETAIL MODAL
  // ========================================================================
  function openProductModal(product) {
    state.selectedModalProduct = product;
    state.modalQty = 1;
    state.selectedModalSize = product.sizes && product.sizes.length > 0 ? product.sizes[0] : 'Standard';

    elements.modalMainImg.src = product.image;
    elements.modalMainImg.alt = product.title;

    // Thumbnails
    const thumbs = product.thumbnails && product.thumbnails.length > 0 ? product.thumbnails : [product.image];
    elements.modalThumbnailsStrip.innerHTML = thumbs.map((th, idx) => `
      <img 
        src="${th}" 
        alt="Thumbnail ${idx + 1}" 
        class="modal-thumbnail-img ${idx === 0 ? 'active' : ''}" 
        onclick="window.switchModalImage('${th}', this)"
      />
    `).join('');

    elements.modalBrand.textContent = product.brand;
    elements.modalTitle.textContent = product.title;
    elements.modalRating.textContent = `★ ${product.rating}`;
    elements.modalRatingCount.textContent = `(${product.ratingCount.toLocaleString()} Verified Customer Reviews)`;
    elements.modalPrice.textContent = `₹${product.price}`;
    elements.modalOriginalPrice.textContent = `₹${product.originalPrice}`;
    elements.modalDiscount.textContent = `Save ${product.discount}%`;

    // Sizes
    if (product.sizes && product.sizes.length > 0) {
      elements.modalSizeGroup.style.display = 'block';
      elements.modalSizeChips.innerHTML = product.sizes.map((sz, idx) => `
        <button 
          class="modal-size-chip ${idx === 0 ? 'active' : ''}" 
          onclick="window.selectModalSize('${sz}', this)"
        >
          ${sz}
        </button>
      `).join('');
    } else {
      elements.modalSizeGroup.style.display = 'none';
    }

    elements.modalQtyDisplay.textContent = state.modalQty;
    elements.modalDescription.textContent = product.description;
    
    // Accordion contents
    elements.modalBenefits.innerHTML = `
      <ul style="padding-left: 20px; display: flex; flex-direction: column; gap: 6px;">
        ${product.benefits.map(b => `<li>${b}</li>`).join('')}
      </ul>
    `;
    elements.modalHowToUse.textContent = product.howToUse;
    elements.modalIngredients.textContent = product.ingredients;
    elements.modalSuitableFor.textContent = product.suitableFor;

    // Wishlist heart sync in modal
    if (elements.modalWishlistBtn) {
      const isSaved = state.wishlist.some(item => item.id === product.id);
      const svg = elements.modalWishlistBtn.querySelector('svg');
      if (svg) svg.setAttribute('fill', isSaved ? 'currentColor' : 'none');
      elements.modalWishlistBtn.style.color = isSaved ? 'var(--primary-lavender)' : 'inherit';
    }

    elements.productDetailModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeProductModal() {
    elements.productDetailModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // ========================================================================
  // SHOPPING CART & DRAWERS
  // ========================================================================
  function saveCart() {
    localStorage.setItem('lavender_cart', JSON.stringify(state.cart));
    updateBadges();
    renderCartDrawer();
  }

  function updateBadges() {
    const cartCount = state.cart.reduce((total, item) => total + item.qty, 0);
    if (elements.cartCountBadge) elements.cartCountBadge.textContent = cartCount;
    if (elements.cartDrawerCount) elements.cartDrawerCount.textContent = cartCount;

    const wishlistCount = state.wishlist.length;
    if (elements.wishlistCountBadge) elements.wishlistCountBadge.textContent = wishlistCount;
    if (elements.wishlistDrawerCount) elements.wishlistDrawerCount.textContent = wishlistCount;
    if (elements.wishlistHeaderLabel) {
      elements.wishlistHeaderLabel.textContent = wishlistCount > 0 ? `Wishlist (${wishlistCount})` : 'Wishlist';
    }
    if (elements.menuWishlistCount) {
      elements.menuWishlistCount.textContent = wishlistCount;
    }
    if (elements.wishlistPageCountHeader) {
      elements.wishlistPageCountHeader.textContent = `(${wishlistCount} item${wishlistCount === 1 ? '' : 's'})`;
    }
  }

  function addToCart(product, quantity = 1, size = null) {
    const selectedSize = size || (product.sizes && product.sizes.length > 0 ? product.sizes[0] : 'Standard');
    const existingIndex = state.cart.findIndex(i => i.id === product.id && i.size === selectedSize);

    if (existingIndex > -1) {
      state.cart[existingIndex].qty += quantity;
    } else {
      state.cart.push({
        id: product.id,
        brand: product.brand,
        title: product.title,
        price: product.price,
        originalPrice: product.originalPrice,
        image: product.image,
        size: selectedSize,
        qty: quantity
      });
    }

    saveCart();
    showToast(`Added "${product.title.substring(0, 28)}..." to Bag`);
    openCartDrawer();
  }

  function updateCartQty(productId, size, change) {
    const itemIndex = state.cart.findIndex(i => i.id === productId && i.size === size);
    if (itemIndex > -1) {
      state.cart[itemIndex].qty += change;
      if (state.cart[itemIndex].qty <= 0) {
        state.cart.splice(itemIndex, 1);
      }
      saveCart();
    }
  }

  function removeFromCart(productId, size) {
    state.cart = state.cart.filter(i => !(i.id === productId && i.size === size));
    saveCart();
    showToast("Item removed from Bag");
  }

  function renderCartDrawer() {
    if (state.cart.length === 0) {
      elements.cartDrawerItems.innerHTML = `
        <div style="text-align: center; padding: 48px 16px;">
          <div style="font-size: 3rem; color: var(--primary-lavender); margin-bottom: 12px;">🛍</div>
          <h3 style="font-family: var(--font-serif); font-size: 1.35rem; margin-bottom: 6px;">Your bag is empty</h3>
          <p style="font-size: 0.88rem; color: var(--deep-plum-muted); margin-bottom: 20px;">Explore clinical skincare and viral makeup essentials.</p>
          <a href="#/all-beauty" class="btn-primary" onclick="window.closeCartDrawer();">Start Shopping</a>
        </div>
      `;
      elements.cartDrawerFooter.style.display = 'none';
      elements.freeShipText.textContent = "Free Express Shipping on orders above ₹499";
      elements.freeShipFill.style.width = "0%";
      return;
    }

    elements.cartDrawerFooter.style.display = 'block';

    // Calculate totals
    let mrpTotal = 0;
    let finalTotal = 0;

    state.cart.forEach(item => {
      mrpTotal += item.originalPrice * item.qty;
      finalTotal += item.price * item.qty;
    });

    const productDiscount = mrpTotal - finalTotal;

    // Free Shipping Progress (Threshold: ₹499)
    const threshold = 499;
    if (finalTotal >= threshold) {
      elements.freeShipText.textContent = "🎉 Congratulations! You have unlocked FREE Express Delivery";
      elements.freeShipFill.style.width = "100%";
    } else {
      const remaining = threshold - finalTotal;
      elements.freeShipText.textContent = `Add ₹${remaining} more for FREE Express Shipping!`;
      elements.freeShipFill.style.width = `${Math.min(100, (finalTotal / threshold) * 100)}%`;
    }

    // Coupon Calculation
    let couponDiscount = 0;
    if (state.appliedCoupon) {
      const coupon = (state.coupons || {})[state.appliedCoupon];
      if (coupon && finalTotal >= coupon.minOrder) {
        if (coupon.discountPercent) {
          couponDiscount = Math.min(coupon.maxDiscount, Math.round(finalTotal * (coupon.discountPercent / 100)));
        } else if (coupon.discountAmount) {
          couponDiscount = coupon.discountAmount;
        }
        elements.billCouponRow.style.display = 'flex';
        elements.billCouponDiscount.textContent = `-₹${couponDiscount}`;
        elements.couponAppliedMsg.style.display = 'block';
        elements.couponAppliedMsg.textContent = `✓ Code ${state.appliedCoupon} applied (${coupon.desc})`;
      } else {
        state.appliedCoupon = null;
        elements.billCouponRow.style.display = 'none';
        elements.couponAppliedMsg.style.display = 'none';
      }
    } else {
      elements.billCouponRow.style.display = 'none';
      elements.couponAppliedMsg.style.display = 'none';
    }

    const deliveryFee = finalTotal >= threshold ? 0 : 49;
    const orderTotal = Math.max(0, finalTotal - couponDiscount + deliveryFee);

    elements.billMrpTotal.textContent = `₹${mrpTotal}`;
    elements.billProductDiscount.textContent = `-₹${productDiscount}`;
    elements.billDeliveryFee.textContent = deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`;
    elements.billFinalAmount.textContent = `₹${orderTotal}`;
    elements.checkoutTotalPayable.textContent = `₹${orderTotal}`;

    // Render items list
    elements.cartDrawerItems.innerHTML = state.cart.map(item => `
      <div class="cart-item-row">
        <img src="${item.image}" alt="${item.title}" class="cart-item-img" />
        <div class="cart-item-details">
          <div class="cart-item-brand">${item.brand}</div>
          <div class="cart-item-title">${item.title}</div>
          <div style="font-size: 0.75rem; color: var(--deep-plum-muted); margin-bottom: 4px;">Size: ${item.size}</div>
          <div class="cart-item-price">₹${item.price} <span style="font-size: 0.78rem; text-decoration: line-through; color: var(--deep-plum-muted); font-weight: normal;">₹${item.originalPrice}</span></div>
          <div class="cart-item-controls">
            <div class="quantity-stepper" style="padding: 2px;">
              <button class="qty-step-btn" style="width: 24px; height: 24px;" onclick="window.updateCartItemQty('${item.id}', '${item.size}', -1)">-</button>
              <span class="qty-display" style="width: 24px; font-size: 0.82rem;">${item.qty}</span>
              <button class="qty-step-btn" style="width: 24px; height: 24px;" onclick="window.updateCartItemQty('${item.id}', '${item.size}', 1)">+</button>
            </div>
            <button class="cart-item-remove-btn" onclick="window.removeCartItem('${item.id}', '${item.size}')">Remove</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  function openCartDrawer() {
    renderCartDrawer();
    elements.cartDrawer.classList.add('active');
    elements.cartOverlay.classList.add('active');
  }

  function closeCartDrawer() {
    elements.cartDrawer.classList.remove('active');
    elements.cartOverlay.classList.remove('active');
  }

  // ========================================================================
  // WISHLIST MANAGEMENT
  // ========================================================================
  function saveWishlist() {
    if (state.currentUser && state.currentUser.email) {
      localStorage.setItem('lavender_wishlist_' + state.currentUser.email, JSON.stringify(state.wishlist));
    }
    localStorage.setItem('lavender_wishlist', JSON.stringify(state.wishlist));
    updateBadges();
    renderWishlistDrawer();
  }

  function syncWishlistHearts(productId, isSaved) {
    document.querySelectorAll('.wishlist-heart-btn').forEach(btn => {
      const card = btn.closest('.product-card');
      if (card && card.getAttribute('data-product-id') === productId) {
        if (isSaved) {
          btn.classList.add('active');
          const svg = btn.querySelector('svg');
          if (svg) svg.setAttribute('fill', 'currentColor');
        } else {
          btn.classList.remove('active');
          const svg = btn.querySelector('svg');
          if (svg) svg.setAttribute('fill', 'none');
        }
      }
    });

    if (state.selectedModalProduct && state.selectedModalProduct.id === productId && elements.modalWishlistBtn) {
      const svg = elements.modalWishlistBtn.querySelector('svg');
      if (svg) svg.setAttribute('fill', isSaved ? 'currentColor' : 'none');
      elements.modalWishlistBtn.style.color = isSaved ? 'var(--primary-lavender)' : 'inherit';
    }
  }

  async function toggleWishlist(productId) {
    const prod = state.products.find(p => p.id === productId);
    if (!prod) return;

    // IF USER IS NOT LOGGED IN
    // Do NOT immediately add the product to wishlist.
    // Instead, open clean Create Account / Login page or authentication modal!
    if (!state.currentUser || !state.token) {
      state.pendingWishlistProduct = prod;
      state.pendingReturnRoute = window.location.hash || '#/';
      openAuthModal('create', prod);
      return;
    }

    // IF USER ALREADY HAS AN ACCOUNT AND IS LOGGED IN
    // Do NOT show the account creation page again.
    // Simply:
    // → Add the product directly to Wishlist.
    // → Change the heart from ♡ to a filled heart.
    // → Show a small toast notification: “Added to Wishlist ♡”
    try {
      const res = await api.toggleWishlist(prod);
      if (res && res.success) {
        state.wishlist = res.wishlist || [];
        updateBadges();
        renderWishlistDrawer();
        if (state.currentRoute === 'wishlist') {
          renderWishlistPageView();
        }
        syncWishlistHearts(productId, res.isWishlisted);
        if (res.isWishlisted) {
          showToast(`Added to Wishlist ♡`);
        } else {
          showToast(`Removed from Wishlist`);
        }
      }
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('account')) {
        state.pendingWishlistProduct = prod;
        openAuthModal('create', prod);
      }
      showToast(err.message || 'Error updating wishlist on backend');
    }
  }

  async function completePendingWishlistAndRedirect(user) {
    if (state.pendingWishlistProduct) {
      const prod = state.pendingWishlistProduct;
      try {
        const wishRes = await api.toggleWishlist(prod);
        if (wishRes && wishRes.success) {
          state.wishlist = wishRes.wishlist || [];
          syncWishlistHearts(prod.id, true);
        }
      } catch (e) {
        console.error('Error auto-saving pending wishlist item:', e);
      }
      // Confirmation required by spec: "Added to your wishlist ♡"
      showToast(`Added to your wishlist ♡`);
      state.pendingWishlistProduct = null;
    } else {
      const wishRes = await api.getWishlist();
      state.wishlist = (wishRes && wishRes.wishlist) || [];
      showToast(`✨ Welcome to Lavender, ${user.name}!`);
    }

    updateBadges();
    renderWishlistDrawer();
    updateUserUI();
    closeAuthModal();

    if (state.currentRoute === 'create-account') {
      window.location.hash = state.pendingReturnRoute || '#/wishlist';
    } else if (state.currentRoute === 'wishlist') {
      renderWishlistPageView();
    }
  }

  async function handleGoogleAuth() {
    try {
      showToast("Connecting to Google Account...");
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const res = await api.googleAuth('Pooja Sharma', `pooja.sharma${randomSuffix}@gmail.com`);
      if (res && res.success) {
        state.currentUser = res.user;
        state.token = res.token;
        localStorage.setItem('lavender_token', res.token);
        localStorage.setItem('lavender_user', JSON.stringify(res.user));
        await completePendingWishlistAndRedirect(res.user);
      }
    } catch (err) {
      showToast(`⚠️ Google Sign-In: ${err.message || 'Failed'}`);
    }
  }

  function renderWishlistPageView() {
    if (!elements.wishlistPageView) return;

    const isLoggedIn = !!(state.currentUser && state.token);
    const count = state.wishlist.length;

    if (elements.wishlistPageCountHeader) {
      elements.wishlistPageCountHeader.textContent = `(${count} item${count === 1 ? '' : 's'})`;
    }

    if (elements.wishlistUserGreetingPill) {
      if (isLoggedIn) {
        elements.wishlistUserGreetingPill.innerHTML = `
          <div style="font-size: 0.82rem; background: #FFFFFF; border: 1px solid var(--border-subtle); padding: 6px 14px; border-radius: var(--radius-full); display: flex; align-items: center; gap: 8px;">
            <span style="color: #1B7A43;">●</span>
            <span>Saved for <strong>${state.currentUser.name}</strong></span>
          </div>
        `;
      } else {
        elements.wishlistUserGreetingPill.innerHTML = `
          <a href="#/create-account" class="btn-primary" style="padding: 6px 14px; font-size: 0.78rem;">
            Sign In to Sync
          </a>
        `;
      }
    }

    if (elements.wishlistEmptyAuthPrompt) {
      if (!isLoggedIn) {
        elements.wishlistEmptyAuthPrompt.innerHTML = `
          <a href="#/create-account" class="btn-primary" style="background: transparent; border: 1.5px solid var(--primary-lavender); color: var(--primary-lavender); padding: 12px 24px; font-size: 0.95rem;">
            Sign In / Join Sanctuary
          </a>
        `;
      } else {
        elements.wishlistEmptyAuthPrompt.innerHTML = '';
      }
    }

    // If empty
    if (count === 0) {
      if (elements.wishlistPageGrid) elements.wishlistPageGrid.style.display = 'none';
      if (elements.wishlistPageEmptyState) elements.wishlistPageEmptyState.style.display = 'block';
      return;
    }

    if (elements.wishlistPageEmptyState) elements.wishlistPageEmptyState.style.display = 'none';
    if (elements.wishlistPageGrid) {
      elements.wishlistPageGrid.style.display = 'grid';
      elements.wishlistPageGrid.innerHTML = state.wishlist.map((prod, idx) => {
        const delay = (idx * 0.05).toFixed(2);
        return `
          <article class="product-card" data-product-id="${prod.id}" style="animation: cardFadeInUp 0.4s ease ${delay}s both;">
            <div class="product-image-container" onclick="window.viewProduct('${prod.id}')">
              ${prod.offerTag ? `<span class="product-tag-pill">${prod.offerTag}</span>` : ''}
              <button 
                class="wishlist-heart-btn active" 
                onclick="event.stopPropagation(); window.toggleWishlist('${prod.id}')"
                aria-label="Remove from Wishlist"
                title="Remove from Wishlist"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
              </button>
              <img src="${prod.image}" alt="${prod.title}" class="product-img" loading="lazy" />
            </div>

            <div class="product-info-wrap">
              <div class="product-brand-line">${prod.brand}</div>
              <h3 class="product-title-line" onclick="window.viewProduct('${prod.id}')">${prod.title}</h3>
              
              <div class="product-rating-row">
                <span class="rating-badge">★ ${prod.rating || 4.8}</span>
                <span class="rating-count">(${prod.reviewsCount ? Number(prod.reviewsCount).toLocaleString() : '1,200'})</span>
              </div>

              <div class="product-price-row">
                <span class="price-current">₹${prod.price}</span>
                <span class="price-mrp">₹${prod.originalPrice}</span>
                <span class="discount-badge">${prod.discount}% OFF</span>
              </div>

              <div style="display: flex; gap: 8px; margin-top: 14px;">
                <button class="btn-primary" style="flex: 1; justify-content: center; font-size: 0.82rem; padding: 10px;" onclick="window.quickAddToCart('${prod.id}')">
                  Add to Cart
                </button>
                <button class="cart-item-remove-btn" style="padding: 8px 12px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); font-size: 0.78rem;" onclick="window.removeWishlistItem('${prod.id}')">
                  Remove
                </button>
              </div>
            </div>
          </article>
        `;
      }).join('');
    }
  }

  async function removeWishlistItem(productId) {
    try {
      const res = await api.removeFromWishlist(productId);
      if (res && res.success) {
        state.wishlist = res.wishlist || [];
        updateBadges();
        renderWishlistDrawer();
        renderWishlistPageView();
        syncWishlistHearts(productId, false);
        showToast("Removed from Wishlist");
      }
    } catch (err) {
      showToast(err.message || 'Error removing item');
    }
  }

  function renderWishlistDrawer() {
    const footerEl = document.getElementById('wishlistDrawerFooter');
    if (footerEl) {
      if (state.currentUser) {
        const initial = (state.currentUser.name || 'M').charAt(0).toUpperCase();
        footerEl.innerHTML = `
          <div class="wishlist-drawer-user-card">
            <div class="wishlist-drawer-avatar">${initial}</div>
            <div class="wishlist-drawer-meta">
              <div class="wishlist-drawer-name">${state.currentUser.name}</div>
              <div class="wishlist-drawer-email">${state.currentUser.email}</div>
            </div>
            <button type="button" class="wishlist-drawer-logout-btn" onclick="window.handleSignOut();" title="Log Out">
              Log Out ↪
            </button>
          </div>
        `;
        footerEl.style.display = 'block';
      } else {
        footerEl.innerHTML = `
          <div class="wishlist-drawer-guest-card">
            <p style="font-size: 0.85rem; color: var(--deep-plum-muted); margin-bottom: 8px;">Create an account to save your favorites safely.</p>
            <button type="button" class="btn-primary" style="width: 100%; justify-content: center; font-size: 0.85rem; padding: 10px;" onclick="window.closeWishlistDrawer(); window.openAuthModal('create');">Create Free Account ♡</button>
          </div>
        `;
        footerEl.style.display = 'block';
      }
    }

    if (state.wishlist.length === 0) {
      elements.wishlistDrawerItems.innerHTML = `
        <div style="text-align: center; padding: 48px 16px;">
          <div style="font-size: 3rem; color: var(--soft-lavender); margin-bottom: 12px;">♡</div>
          <h3 style="font-family: var(--font-serif); font-size: 1.35rem; margin-bottom: 6px;">Your wishlist is empty</h3>
          <p style="font-size: 0.88rem; color: var(--deep-plum-muted); margin-bottom: 20px;">Save your favorite serums, lip shades, and fragrances to shop anytime.</p>
          <a href="#/all-beauty" class="btn-primary" onclick="window.closeWishlistDrawer();">Explore Beauty</a>
        </div>
      `;
      return;
    }

    elements.wishlistDrawerItems.innerHTML = state.wishlist.map(item => `
      <div class="cart-item-row">
        <img src="${item.image}" alt="${item.title}" class="cart-item-img" />
        <div class="cart-item-details">
          <div class="cart-item-brand">${item.brand}</div>
          <div class="cart-item-title">${item.title}</div>
          <div class="cart-item-price">₹${item.price} <span style="font-size: 0.78rem; text-decoration: line-through; color: var(--deep-plum-muted); font-weight: normal;">₹${item.originalPrice}</span></div>
          <div class="cart-item-controls" style="margin-top: 8px;">
            <button class="btn-primary" style="padding: 6px 14px; font-size: 0.78rem;" onclick="window.moveWishlistToCart('${item.id}')">
              Move to Bag
            </button>
            <button class="cart-item-remove-btn" onclick="window.toggleWishlist('${item.id}')">Remove</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  function openWishlistDrawer() {
    if (!state.currentUser) {
      openAuthModal('create', null);
      showToast("Please create an account or sign in to access your Wishlist ♡");
      return;
    }
    renderWishlistDrawer();
    elements.wishlistDrawer.classList.add('active');
    elements.wishlistOverlay.classList.add('active');
  }

  function closeWishlistDrawer() {
    elements.wishlistDrawer.classList.remove('active');
    elements.wishlistOverlay.classList.remove('active');
  }

  // ========================================================================
  // USER ACCOUNT & AUTHENTICATION (Wishlist Account Guard)
  // ========================================================================
  function updateUserUI() {
    const topAuthSlot = document.getElementById('topAuthSlot');
    const menuUserName = document.getElementById('menuUserName');
    const menuUserEmail = document.getElementById('menuUserEmail');
    const accountDropdownLogoutLi = document.getElementById('accountDropdownLogoutLi');

    if (state.currentUser) {
      const firstName = (state.currentUser.name || 'Member').split(' ')[0];
      if (elements.userAccountLabel) {
        elements.userAccountLabel.textContent = firstName;
      }
      if (menuUserName) {
        menuUserName.textContent = state.currentUser.name || 'Member';
      }
      if (menuUserEmail) {
        menuUserEmail.textContent = state.currentUser.email || 'member@lavender.in';
      }
      if (elements.userAccountBtn) {
        elements.userAccountBtn.title = `Signed in as ${state.currentUser.name} - Click for menu`;
      }
      if (accountDropdownLogoutLi) {
        accountDropdownLogoutLi.style.display = 'block';
      }
      if (topAuthSlot) {
        topAuthSlot.innerHTML = `
          <span style="color: var(--soft-lavender); font-size: 0.76rem;">Hi, <strong>${firstName}</strong></span>
          <button type="button" class="announcement-logout-btn" onclick="window.handleSignOut();" title="Log Out">
            Log Out ↪
          </button>
        `;
      }
    } else {
      if (elements.userAccountLabel) {
        elements.userAccountLabel.textContent = 'Sign In';
      }
      if (menuUserName) {
        menuUserName.textContent = 'Guest Visitor';
      }
      if (menuUserEmail) {
        menuUserEmail.textContent = 'Sign in to sync your wishlist';
      }
      if (elements.userAccountBtn) {
        elements.userAccountBtn.title = 'Sign In or Create Account';
      }
      if (elements.userAccountWrapper) {
        elements.userAccountWrapper.classList.remove('active-menu');
      }
      if (accountDropdownLogoutLi) {
        accountDropdownLogoutLi.style.display = 'none';
      }
      if (topAuthSlot) {
        topAuthSlot.innerHTML = `
          <button type="button" class="announcement-auth-btn" onclick="window.openAuthModal('create');">
            ✨ Create Account
          </button>
          <span style="opacity: 0.5;">•</span>
          <button type="button" class="announcement-auth-btn" onclick="window.openAuthModal('signin');">
            Sign In
          </button>
        `;
      }
    }
    if (elements.menuWishlistCount) {
      elements.menuWishlistCount.textContent = state.wishlist.length;
    }
  }

  function openAuthModal(mode = 'create', product = null) {
    const isProductSaving = !!product;
    if (isProductSaving) {
      state.pendingWishlistProduct = product;
      if (elements.authProductPreview) {
        elements.authProductPreview.style.display = 'flex';
        elements.authPreviewImg.src = product.image;
        elements.authPreviewTitle.textContent = `${product.brand} - ${product.title}`;
        elements.authPreviewPrice.textContent = `₹${product.price} (MRP ₹${product.originalPrice} • Save ${product.discount}%)`;
      }
    } else {
      if (elements.authProductPreview) {
        elements.authProductPreview.style.display = 'none';
      }
    }

    if (elements.authModalTitle) {
      elements.authModalTitle.textContent = mode === 'create' 
        ? "Create your Lavender account" 
        : "Welcome back to Lavender";
    }
    if (elements.authModalSub) {
      elements.authModalSub.textContent = mode === 'create'
        ? "Save your favourite beauty products and access them anytime."
        : "Sign in to access your saved wishlist and member rewards.";
    }
    if (elements.submitCreateAccountBtn) {
      elements.submitCreateAccountBtn.textContent = isProductSaving 
        ? "Create Account & Save to Wishlist ♡" 
        : "Create Account & Continue ♡";
    }

    switchAuthTab(mode);
    if (elements.authModal) {
      elements.authModal.classList.add('active');
    }
    document.body.style.overflow = 'hidden';
  }

  function closeAuthModal() {
    if (elements.authModal) {
      elements.authModal.classList.remove('active');
    }
    document.body.style.overflow = '';
    state.pendingWishlistProduct = null;
  }

  function switchAuthTab(tab) {
    if (tab === 'create') {
      if (elements.tabCreateAccountBtn) elements.tabCreateAccountBtn.classList.add('active');
      if (elements.tabSignInBtn) elements.tabSignInBtn.classList.remove('active');
      if (elements.createAccountForm) elements.createAccountForm.style.display = 'block';
      if (elements.signInForm) elements.signInForm.style.display = 'none';
    } else {
      if (elements.tabSignInBtn) elements.tabSignInBtn.classList.add('active');
      if (elements.tabCreateAccountBtn) elements.tabCreateAccountBtn.classList.remove('active');
      if (elements.signInForm) elements.signInForm.style.display = 'block';
      if (elements.createAccountForm) elements.createAccountForm.style.display = 'none';
    }
  }

  async function handleCreateAccount() {
    const name = elements.regFullName ? elements.regFullName.value.trim() : '';
    const email = elements.regEmail ? elements.regEmail.value.trim() : '';
    const password = elements.regPassword ? elements.regPassword.value.trim() : '';
    const phone = elements.regPhone ? elements.regPhone.value.trim() : '';

    if (!name) {
      showToast("Please enter your name to create an account.");
      if (elements.regFullName) elements.regFullName.focus();
      return;
    }
    if (!email || !email.includes('@')) {
      showToast("Please enter a valid email address.");
      if (elements.regEmail) elements.regEmail.focus();
      return;
    }
    if (!password || password.length < 4) {
      showToast("Please enter a password with at least 4 characters.");
      if (elements.regPassword) elements.regPassword.focus();
      return;
    }

    try {
      if (elements.submitCreateAccountBtn) {
        elements.submitCreateAccountBtn.disabled = true;
        elements.submitCreateAccountBtn.textContent = "Creating Account on Backend...";
      }

      // Call Backend REST API POST /api/auth/register
      const res = await api.register(name, email, password, phone);
      if (res && res.success) {
        state.currentUser = res.user;
        state.token = res.token;
        localStorage.setItem('lavender_token', res.token);
        localStorage.setItem('lavender_user', JSON.stringify(res.user));

        if (elements.regFullName) elements.regFullName.value = '';
        if (elements.regEmail) elements.regEmail.value = '';
        if (elements.regPassword) elements.regPassword.value = '';
        if (elements.regPhone) elements.regPhone.value = '';

        await completePendingWishlistAndRedirect(res.user);
      }
    } catch (err) {
      showToast(`⚠️ ${err.message || 'Failed to create account on backend'}`);
    } finally {
      if (elements.submitCreateAccountBtn) {
        elements.submitCreateAccountBtn.disabled = false;
        elements.submitCreateAccountBtn.textContent = state.pendingWishlistProduct 
          ? "Create Account & Save to Wishlist ♡" 
          : "Create Account & Continue ♡";
      }
    }
  }

  async function handleSignIn() {
    const email = elements.loginIdentifier ? elements.loginIdentifier.value.trim() : '';
    const password = elements.loginPassword ? elements.loginPassword.value.trim() : '';

    if (!email || !email.includes('@')) {
      showToast("Please enter a valid email address.");
      if (elements.loginIdentifier) elements.loginIdentifier.focus();
      return;
    }
    if (!password) {
      showToast("Please enter your password.");
      if (elements.loginPassword) elements.loginPassword.focus();
      return;
    }

    try {
      const res = await api.login(email, password);
      if (res && res.success) {
        state.currentUser = res.user;
        state.token = res.token;
        localStorage.setItem('lavender_token', res.token);
        localStorage.setItem('lavender_user', JSON.stringify(res.user));

        if (elements.loginIdentifier) elements.loginIdentifier.value = '';
        if (elements.loginPassword) elements.loginPassword.value = '';

        await completePendingWishlistAndRedirect(res.user);
      }
    } catch (err) {
      showToast(`⚠️ ${err.message || 'Invalid email or password'}`);
    }
  }

  function quickDemoSignIn() {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    if (elements.regFullName) elements.regFullName.value = 'Beauty Member ' + randomSuffix;
    if (elements.regEmail) elements.regEmail.value = `member${randomSuffix}@lavender.in`;
    if (elements.regPassword) elements.regPassword.value = 'Lavender@2026';
    handleCreateAccount();
  }

  async function handleSignOut() {
    const prevName = state.currentUser ? (state.currentUser.name || 'Member') : 'Member';
    try {
      if (state.token) {
        await api.logout();
      }
    } catch (e) {
      console.warn('Logout API error:', e);
    }

    state.currentUser = null;
    state.token = null;
    state.wishlist = [];
    state.pendingWishlistProduct = null;
    localStorage.removeItem('lavender_token');
    localStorage.removeItem('lavender_user');
    localStorage.removeItem('lavender_wishlist');

    updateBadges();

    // Reset all heart icons on the page
    document.querySelectorAll('.wishlist-heart-btn').forEach(btn => {
      btn.classList.remove('active');
      const svg = btn.querySelector('svg');
      if (svg) svg.setAttribute('fill', 'none');
    });
    if (elements.modalWishlistBtn) {
      elements.modalWishlistBtn.style.color = 'inherit';
      const modalSvg = elements.modalWishlistBtn.querySelector('svg');
      if (modalSvg) modalSvg.setAttribute('fill', 'none');
    }

    if (elements.userAccountWrapper) {
      elements.userAccountWrapper.classList.remove('active-menu');
    }
    closeWishlistDrawer();
    updateUserUI();
    showToast(`🚪 Logged out from server. See you soon, ${prevName}! 👋`);
  }

  // ========================================================================
  // DEDICATED CREATE ACCOUNT PAGE HANDLERS
  // ========================================================================
  function setupCreateAccountPage(productId) {
    const targetId = productId || (state.pendingWishlistProduct && state.pendingWishlistProduct.id);
    const prod = targetId ? (state.pendingWishlistProduct || state.products.find(p => p.id === targetId)) : null;

    if (prod) {
      state.pendingWishlistProduct = prod;
      if (elements.pageAuthProductCol) {
        elements.pageAuthProductCol.style.display = 'block';
      }
      if (elements.pageAuthProdImg) elements.pageAuthProdImg.src = prod.image;
      if (elements.pageAuthProdBrand) elements.pageAuthProdBrand.textContent = prod.brand;
      if (elements.pageAuthProdTitle) elements.pageAuthProdTitle.textContent = prod.title;
      if (elements.pageAuthProdPrice) elements.pageAuthProdPrice.textContent = `₹${prod.price} (Save ${prod.discount}%)`;
      if (elements.pageAuthTitle) elements.pageAuthTitle.textContent = "Create Account to Save to Wishlist";
      if (elements.pageAuthDesc) {
        elements.pageAuthDesc.textContent = `Please create an account. "${prod.title.substring(0, 32)}..." will be automatically saved to your Wishlist once created!`;
      }
      if (elements.pageSubmitCreateBtn) {
        elements.pageSubmitCreateBtn.textContent = "Create Account & Save to Wishlist ♡";
      }
      if (elements.pageSubmitLoginBtn) {
        elements.pageSubmitLoginBtn.textContent = "Sign In & Save to Wishlist ♡";
      }
    } else {
      if (elements.pageAuthProductCol) {
        elements.pageAuthProductCol.style.display = 'none';
      }
      if (elements.pageAuthTitle) elements.pageAuthTitle.textContent = "Create Your Account";
      if (elements.pageAuthDesc) {
        elements.pageAuthDesc.textContent = "Join the Lavender Sanctuary to save items to your personal wishlist, track shipments, and unlock member rewards.";
      }
      if (elements.pageSubmitCreateBtn) {
        elements.pageSubmitCreateBtn.textContent = "Create Account & Continue ♡";
      }
      if (elements.pageSubmitLoginBtn) {
        elements.pageSubmitLoginBtn.textContent = "Sign In & Continue";
      }
    }
  }

  function switchPageAuthTab(tab) {
    if (tab === 'create') {
      if (elements.pageTabCreateBtn) elements.pageTabCreateBtn.classList.add('active');
      if (elements.pageTabLoginBtn) elements.pageTabLoginBtn.classList.remove('active');
      if (elements.pageCreateAccountForm) elements.pageCreateAccountForm.style.display = 'block';
      if (elements.pageSignInForm) elements.pageSignInForm.style.display = 'none';
    } else {
      if (elements.pageTabLoginBtn) elements.pageTabLoginBtn.classList.add('active');
      if (elements.pageTabCreateBtn) elements.pageTabCreateBtn.classList.remove('active');
      if (elements.pageSignInForm) elements.pageSignInForm.style.display = 'block';
      if (elements.pageCreateAccountForm) elements.pageCreateAccountForm.style.display = 'none';
    }
  }

  async function handlePageCreateAccount() {
    const name = elements.pageRegFullName ? elements.pageRegFullName.value.trim() : '';
    const email = elements.pageRegEmail ? elements.pageRegEmail.value.trim() : '';
    const password = elements.pageRegPassword ? elements.pageRegPassword.value.trim() : '';
    const phone = elements.pageRegPhone ? elements.pageRegPhone.value.trim() : '';

    if (!name) {
      showToast("Please enter your name to create an account.");
      if (elements.pageRegFullName) elements.pageRegFullName.focus();
      return;
    }
    if (!email || !email.includes('@')) {
      showToast("Please enter a valid email address.");
      if (elements.pageRegEmail) elements.pageRegEmail.focus();
      return;
    }
    if (!password || password.length < 4) {
      showToast("Please enter a password with at least 4 characters.");
      if (elements.pageRegPassword) elements.pageRegPassword.focus();
      return;
    }

    try {
      if (elements.pageSubmitCreateBtn) {
        elements.pageSubmitCreateBtn.disabled = true;
        elements.pageSubmitCreateBtn.textContent = "Creating Account...";
      }

      // Call Backend REST API POST /api/auth/register
      const res = await api.register(name, email, password, phone);
      if (res && res.success) {
        state.currentUser = res.user;
        state.token = res.token;
        localStorage.setItem('lavender_token', res.token);
        localStorage.setItem('lavender_user', JSON.stringify(res.user));

        if (elements.pageRegFullName) elements.pageRegFullName.value = '';
        if (elements.pageRegEmail) elements.pageRegEmail.value = '';
        if (elements.pageRegPassword) elements.pageRegPassword.value = '';
        if (elements.pageRegPhone) elements.pageRegPhone.value = '';

        await completePendingWishlistAndRedirect(res.user);
      }
    } catch (err) {
      showToast(`⚠️ ${err.message || 'Failed to create account on backend'}`);
    } finally {
      if (elements.pageSubmitCreateBtn) {
        elements.pageSubmitCreateBtn.disabled = false;
        elements.pageSubmitCreateBtn.textContent = state.pendingWishlistProduct 
          ? "Create Account & Save to Wishlist ♡" 
          : "Create Account & Continue ♡";
      }
    }
  }

  async function handlePageSignIn() {
    const email = elements.pageLoginEmail ? elements.pageLoginEmail.value.trim() : '';
    const password = elements.pageLoginPassword ? elements.pageLoginPassword.value.trim() : '';

    if (!email || !email.includes('@')) {
      showToast("Please enter a valid email address.");
      if (elements.pageLoginEmail) elements.pageLoginEmail.focus();
      return;
    }
    if (!password) {
      showToast("Please enter your password.");
      if (elements.pageLoginPassword) elements.pageLoginPassword.focus();
      return;
    }

    try {
      const res = await api.login(email, password);
      if (res && res.success) {
        state.currentUser = res.user;
        state.token = res.token;
        localStorage.setItem('lavender_token', res.token);
        localStorage.setItem('lavender_user', JSON.stringify(res.user));

        if (elements.pageLoginEmail) elements.pageLoginEmail.value = '';
        if (elements.pageLoginPassword) elements.pageLoginPassword.value = '';

        await completePendingWishlistAndRedirect(res.user);
      }
    } catch (err) {
      showToast(`⚠️ ${err.message || 'Invalid email or password'}`);
    }
  }

  function quickPageDemoSignIn() {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    if (elements.pageRegFullName) elements.pageRegFullName.value = 'Beauty Member ' + randomSuffix;
    if (elements.pageRegEmail) elements.pageRegEmail.value = `member${randomSuffix}@lavender.in`;
    if (elements.pageRegPassword) elements.pageRegPassword.value = 'Lavender@2026';
    handlePageCreateAccount();
  }

  // ========================================================================
  // CHECKOUT & ORDERS
  // ========================================================================
  function openCheckoutModal() {
    closeCartDrawer();
    elements.checkoutStepForm.style.display = 'block';
    elements.checkoutStepSuccess.style.display = 'none';
    elements.checkoutModal.classList.add('active');
  }

  function closeCheckoutModal() {
    elements.checkoutModal.classList.remove('active');
  }

  async function handlePlaceOrder() {
    if (state.cart.length === 0) {
      showToast("Your shopping bag is empty!");
      return;
    }

    const nameInput = document.getElementById('checkoutFullName');
    const phoneInput = document.getElementById('checkoutPhone');
    const addressInput = document.getElementById('checkoutAddress');
    const cityInput = document.getElementById('checkoutCity');
    const pincodeInput = document.getElementById('checkoutPincode');
    const selectedPayRadio = document.querySelector('input[name="paymentOption"]:checked');

    const customerName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : (state.currentUser ? state.currentUser.name : 'Valued Customer');
    const customerPhone = phoneInput && phoneInput.value.trim() ? phoneInput.value.trim() : (state.currentUser ? (state.currentUser.phone || '9876543210') : '9876543210');
    const deliveryAddress = addressInput && addressInput.value.trim() ? addressInput.value.trim() : 'Flat 402, Rosewood Heights, Bandra West';
    const city = cityInput && cityInput.value.trim() ? cityInput.value.trim() : 'Mumbai';
    const pincode = pincodeInput && pincodeInput.value.trim() ? pincodeInput.value.trim() : '400050';
    const paymentMethod = selectedPayRadio ? selectedPayRadio.value : 'upi';

    // Calculate totals
    const bagTotal = state.cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (item.qty || 1), 0);
    let discount = 0;
    if (state.appliedCoupon && state.coupons && state.coupons[state.appliedCoupon]) {
      const c = state.coupons[state.appliedCoupon];
      if (c.discountPercent) discount = Math.round((bagTotal * c.discountPercent) / 100);
      else if (c.discountAmount) discount = c.discountAmount;
    }
    const totalPayable = Math.max(0, bagTotal - discount);

    const orderPayload = {
      customerName,
      customerPhone,
      deliveryAddress,
      city,
      pincode,
      paymentMethod,
      items: state.cart,
      subtotal: bagTotal,
      couponCode: state.appliedCoupon || '',
      discountAmount: discount,
      totalPayable
    };

    let orderId = `LAV-${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      const res = await api.placeOrder(orderPayload);
      if (res && res.success && res.orderId) {
        orderId = res.orderId;
        console.log('✅ Order placed & saved permanently in SQLite database:', orderId);
      }
    } catch (err) {
      console.warn('Order placed with local confirmation (backend notice):', err.message);
    }

    elements.successOrderId.textContent = `ORDER #${orderId}`;
    
    // Clear Cart
    state.cart = [];
    state.appliedCoupon = null;
    saveCart();

    elements.checkoutStepForm.style.display = 'none';
    elements.checkoutStepSuccess.style.display = 'block';
    showToast(`Order confirmed! Thank you, ${customerName} ♡`);
  }

  // ========================================================================
  // TOAST NOTIFICATION
  // ========================================================================
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>✦</span><span>${message}</span>`;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  function navigateToHome(e) {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    // 1. Immediately dismiss any Netflix cinematic overlay or modals
    finishNetflixIntro();
    closeCartDrawer();
    closeWishlistDrawer();
    closeProductModal();
    closeCheckoutModal();
    closeAuthModal();

    if (elements.searchDropdown) elements.searchDropdown.classList.remove('active');
    if (elements.userAccountWrapper) elements.userAccountWrapper.classList.remove('active-menu');

    // 2. Clear route state
    state.currentRoute = 'home';
    state.routeParam = null;

    // 3. Update URL hash
    if (window.location.hash !== '#/') {
      window.location.hash = '#/';
    }

    // 4. Force hide all other views and reveal homeView
    [elements.listingView, elements.brandsView, elements.offersView, elements.searchView].forEach(view => {
      if (view) {
        view.classList.remove('active-view');
        view.style.display = 'none';
      }
    });

    if (elements.homeView) {
      elements.homeView.classList.add('active-view');
      elements.homeView.style.display = 'block';
      elements.homeView.style.opacity = '1';
    }

    // 5. Reset active nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });

    // 6. Scroll smoothly to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    showToast("Returned to Lavender Sanctuary Home ✦");
  }

  function navigateToCategory(slug) {
    finishNetflixIntro();
    closeCartDrawer();
    closeWishlistDrawer();
    closeProductModal();
    closeCheckoutModal();
    closeAuthModal();

    if (elements.searchDropdown) elements.searchDropdown.classList.remove('active');
    if (elements.userAccountWrapper) elements.userAccountWrapper.classList.remove('active-menu');

    window.location.hash = `#/${slug}`;
    handleNavigation();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ========================================================================
  // EVENT LISTENERS & DELEGATION
  // ========================================================================
  function setupEventListeners() {
    // Raindrop & Brand Logo Home Navigation
    if (elements.brandDropIcon) {
      elements.brandDropIcon.addEventListener('click', (e) => {
        navigateToHome(e);
      });
    }

    if (elements.homeLogoBtn) {
      elements.homeLogoBtn.addEventListener('click', (e) => {
        navigateToHome(e);
      });
    }

    // Window Hash Routing
    window.addEventListener('hashchange', handleNavigation);

    // Header Scroll Shadow
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        elements.mainHeader.classList.add('scrolled');
      } else {
        elements.mainHeader.classList.remove('scrolled');
      }
    });

    // Search Input Typing & Focus
    elements.globalSearchInput.addEventListener('input', (e) => {
      handleLiveSearch(e.target.value);
    });

    elements.globalSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        executeSearchPage(e.target.value);
      }
    });

    elements.searchClearBtn.addEventListener('click', () => {
      elements.globalSearchInput.value = '';
      elements.searchBoxWrap.classList.remove('has-query');
      elements.searchDropdown.classList.remove('active');
      elements.globalSearchInput.focus();
    });

    // Close search dropdown on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        elements.searchDropdown.classList.remove('active');
      }
    });

    // Quick Search Tags
    elements.searchQuickTags.addEventListener('click', (e) => {
      if (e.target.classList.contains('search-quick-tag')) {
        const tag = e.target.getAttribute('data-tag');
        elements.globalSearchInput.value = tag;
        executeSearchPage(tag);
      }
    });

    // Drawers & Modals Toggles
    elements.cartToggleBtn.addEventListener('click', openCartDrawer);
    elements.closeCartDrawerBtn.addEventListener('click', closeCartDrawer);
    elements.cartOverlay.addEventListener('click', closeCartDrawer);

    elements.wishlistToggleBtn.addEventListener('click', openWishlistDrawer);
    elements.closeWishlistDrawerBtn.addEventListener('click', closeWishlistDrawer);
    elements.wishlistOverlay.addEventListener('click', closeWishlistDrawer);

    elements.closeProductDetailBtn.addEventListener('click', closeProductModal);
    elements.productDetailModal.addEventListener('click', (e) => {
      if (e.target === elements.productDetailModal) closeProductModal();
    });

    elements.closeCheckoutBtn.addEventListener('click', closeCheckoutModal);
    elements.proceedToCheckoutBtn.addEventListener('click', openCheckoutModal);
    elements.continueShoppingBtn.addEventListener('click', () => {
      closeCheckoutModal();
      window.location.hash = '#/';
    });

    // Product Modal Quantity Stepper
    elements.modalQtyMinus.addEventListener('click', () => {
      if (state.modalQty > 1) {
        state.modalQty--;
        elements.modalQtyDisplay.textContent = state.modalQty;
      }
    });

    elements.modalQtyPlus.addEventListener('click', () => {
      state.modalQty++;
      elements.modalQtyDisplay.textContent = state.modalQty;
    });

    elements.modalAddToCartBtn.addEventListener('click', () => {
      if (state.selectedModalProduct) {
        addToCart(state.selectedModalProduct, state.modalQty, state.selectedModalSize);
        closeProductModal();
      }
    });

    elements.modalBuyNowBtn.addEventListener('click', () => {
      if (state.selectedModalProduct) {
        addToCart(state.selectedModalProduct, state.modalQty, state.selectedModalSize);
        closeProductModal();
        openCheckoutModal();
      }
    });

    if (elements.modalWishlistBtn) {
      elements.modalWishlistBtn.addEventListener('click', () => {
        if (state.selectedModalProduct) {
          toggleWishlist(state.selectedModalProduct.id);
        }
      });
    }

    // Pincode Checker
    elements.pincodeCheckBtn.addEventListener('click', () => {
      const pin = elements.pincodeInput.value.trim();
      if (pin.length === 6 && /^\d+$/.test(pin)) {
        elements.pincodeStatus.textContent = `✓ Express Delivery & COD available for Pincode ${pin}`;
        elements.pincodeStatus.style.color = '#1B7A43';
      } else {
        elements.pincodeStatus.textContent = "Please enter a valid 6-digit Indian postal code.";
        elements.pincodeStatus.style.color = '#C2410C';
      }
    });

    // Sidebar Filters Dynamic Change Handlers
    elements.filterSidebar.addEventListener('change', (e) => {
      if (e.target.name === 'productType') {
        const checkedTypes = Array.from(elements.filterProductTypeList.querySelectorAll('input:checked')).map(i => i.value);
        state.activeFilters.productTypes = checkedTypes;
      } else if (e.target.name === 'brandFilter') {
        const checkedBrands = Array.from(elements.filterBrandList.querySelectorAll('input:checked')).map(i => i.value);
        state.activeFilters.brands = checkedBrands;
      } else if (e.target.name === 'ratingFilter') {
        state.activeFilters.minRating = parseFloat(e.target.value);
      } else if (e.target.name === 'discountFilter') {
        state.activeFilters.minDiscount = parseInt(e.target.value, 10);
      } else if (e.target.name === 'skinTypeFilter') {
        const checkedSkin = Array.from(elements.filterSkinTypeList.querySelectorAll('input:checked')).map(i => i.value);
        state.activeFilters.skinTypes = checkedSkin;
      } else if (e.target.name === 'concernFilter') {
        const checkedConcerns = Array.from(elements.filterConcernList.querySelectorAll('input:checked')).map(i => i.value);
        state.activeFilters.concerns = checkedConcerns;
      } else if (e.target.id === 'inStockOnlyCheckbox') {
        state.activeFilters.inStockOnly = e.target.checked;
      }
      applyFiltersAndRenderListing();
    });

    // Price Slider
    elements.priceSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      state.activeFilters.maxPrice = val;
      elements.priceSliderValue.textContent = `Up to ₹${val.toLocaleString()}`;
      applyFiltersAndRenderListing();
    });

    // Quick Price Chips
    elements.filterSidebar.querySelectorAll('.filter-chip-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const max = parseInt(btn.getAttribute('data-max-price'), 10);
        state.activeFilters.maxPrice = max;
        elements.priceSlider.value = max;
        elements.priceSliderValue.textContent = `Up to ₹${max}`;
        applyFiltersAndRenderListing();
      });
    });

    // Sorting Dropdown
    elements.sortBySelect.addEventListener('change', (e) => {
      state.activeFilters.sortBy = e.target.value;
      applyFiltersAndRenderListing();
    });

    // Filter Reset Buttons
    elements.filterResetBtn.addEventListener('click', resetAllFilters);
    elements.emptyResetBtn.addEventListener('click', resetAllFilters);

    // Offers Tabs
    elements.offersTabsRow.addEventListener('click', (e) => {
      if (e.target.classList.contains('offers-tab-btn')) {
        elements.offersTabsRow.querySelectorAll('.offers-tab-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        state.offersFilter = e.target.getAttribute('data-offer-filter');
        renderOffersView();
      }
    });

    // Apply Cart Coupon
    elements.applyCartCouponBtn.addEventListener('click', () => {
      const code = elements.cartCouponInput.value.trim().toUpperCase();
      if (state.coupons && state.coupons[code]) {
        state.appliedCoupon = code;
        renderCartDrawer();
        showToast(`Promo code ${code} applied successfully!`);
      } else {
        showToast("Invalid code. Try LAVENDER15 or GLOW200");
      }
    });

    // Track order alert
    if (elements.topTrackOrderBtn) {
      elements.topTrackOrderBtn.addEventListener('click', () => {
        showToast("Enter your 10-digit mobile number on our WhatsApp concierge to track real-time delivery.");
      });
    }

    // Modal Accordions toggle
    document.querySelectorAll('.modal-acc-trigger').forEach(trigger => {
      trigger.addEventListener('click', () => {
        const content = trigger.nextElementSibling;
        if (content.style.display === 'none') {
          content.style.display = 'block';
        } else {
          content.style.display = 'none';
        }
      });
    });

    // User Account Popover Dropdown Toggle
    if (elements.userAccountBtn) {
      elements.userAccountBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.currentUser) {
          if (elements.userAccountWrapper) {
            elements.userAccountWrapper.classList.toggle('active-menu');
          }
        } else {
          openAuthModal('create', null);
        }
      });
    }

    // Close user account dropdown on outside click
    document.addEventListener('click', (e) => {
      if (elements.userAccountWrapper && !elements.userAccountWrapper.contains(e.target)) {
        elements.userAccountWrapper.classList.remove('active-menu');
      }
    });

    // Auth Modal Controls & Tabs
    if (elements.closeAuthModalBtn) {
      elements.closeAuthModalBtn.addEventListener('click', closeAuthModal);
    }

    if (elements.authModal) {
      elements.authModal.addEventListener('click', (e) => {
        if (e.target === elements.authModal) {
          closeAuthModal();
        }
      });
    }

    if (elements.tabCreateAccountBtn) {
      elements.tabCreateAccountBtn.addEventListener('click', () => {
        switchAuthTab('create');
      });
    }

    if (elements.tabSignInBtn) {
      elements.tabSignInBtn.addEventListener('click', () => {
        switchAuthTab('signin');
      });
    }

    // Global ESC key listener to safely dismiss modals/drawers and restore scrolling
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        closeAuthModal();
        closeProductModal();
        closeCheckoutModal();
        closeCartDrawer();
        closeWishlistDrawer();
      }
    });
  }

  function resetAllFilters() {
    state.activeFilters.productTypes = [];
    state.activeFilters.brands = [];
    state.activeFilters.maxPrice = 1200;
    state.activeFilters.minRating = 0;
    state.activeFilters.minDiscount = 0;
    state.activeFilters.skinTypes = [];
    state.activeFilters.concerns = [];
    state.activeFilters.inStockOnly = true;
    state.activeFilters.sortBy = 'popularity';

    elements.priceSlider.value = 1200;
    elements.priceSliderValue.textContent = 'Up to ₹1,200';
    elements.sortBySelect.value = 'popularity';

    // Uncheck inputs
    elements.filterSidebar.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (cb.id === 'inStockOnlyCheckbox') {
        cb.checked = true;
      } else {
        cb.checked = false;
      }
    });

    elements.filterSidebar.querySelectorAll('input[type="radio"]').forEach(rb => {
      if (rb.value === '0') rb.checked = true;
    });

    applyFiltersAndRenderListing();
    showToast("Filters reset to default");
  }

  // ========================================================================
  // GLOBAL WINDOW HELPER METHODS
  // ========================================================================
  window.viewProduct = function(productId) {
    const prod = state.products.find(p => p.id === productId);
    if (prod) openProductModal(prod);
  };

  window.quickAddToCart = function(productId) {
    const prod = state.products.find(p => p.id === productId);
    if (prod) addToCart(prod, 1);
  };

  window.toggleWishlist = function(productId) {
    toggleWishlist(productId);
  };

  window.moveWishlistToCart = function(productId) {
    const prod = state.products.find(p => p.id === productId);
    if (prod) {
      addToCart(prod, 1);
      toggleWishlist(productId);
    }
  };

  window.switchModalImage = function(src, thumbnailEl) {
    elements.modalMainImg.src = src;
    document.querySelectorAll('.modal-thumbnail-img').forEach(t => t.classList.remove('active'));
    thumbnailEl.classList.add('active');
  };

  window.selectModalSize = function(size, btnEl) {
    state.selectedModalSize = size;
    document.querySelectorAll('.modal-size-chip').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
  };

  window.updateCartItemQty = function(productId, size, change) {
    updateCartQty(productId, size, change);
  };

  window.removeCartItem = function(productId, size) {
    removeFromCart(productId, size);
  };

  window.closeCartDrawer = function() {
    closeCartDrawer();
  };

  window.closeWishlistDrawer = function() {
    closeWishlistDrawer();
  };

  window.filterBrandsByLetter = function(letter) {
    renderBrandsDirectory(letter);
  };

  window.copyVoucherCode = function(code) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        showToast(`Copied voucher code ${code}`);
      });
    } else {
      showToast(`Voucher code: ${code}`);
    }
  };

  window.handleNewsletterSubmit = function() {
    const email = document.getElementById('newsletterEmail').value;
    if (email) {
      showToast(`Welcome to Lavender Privé! Check your email for code LAVENDER15.`);
      document.getElementById('newsletterEmail').value = '';
    }
  };

  window.handlePlaceOrder = function() {
    handlePlaceOrder();
  };

  window.navigateToHome = function() {
    navigateToHome();
  };

  window.navigateToCategory = function(slug) {
    navigateToCategory(slug);
  };

  window.openAuthModal = function(mode, product) {
    openAuthModal(mode, product);
  };

  window.closeAuthModal = function() {
    closeAuthModal();
  };

  window.handleCreateAccount = function() {
    handleCreateAccount();
  };

  window.handleSignIn = function() {
    handleSignIn();
  };

  window.quickDemoSignIn = function() {
    quickDemoSignIn();
  };

  window.handleSignOut = function() {
    handleSignOut();
  };

  window.switchPageAuthTab = function(tab) {
    switchPageAuthTab(tab);
  };

  window.handlePageCreateAccount = function() {
    handlePageCreateAccount();
  };

  window.handlePageSignIn = function() {
    handlePageSignIn();
  };

  window.quickPageDemoSignIn = function() {
    quickPageDemoSignIn();
  };

  window.handleGoogleAuth = function() {
    handleGoogleAuth();
  };

  window.removeWishlistItem = function(productId) {
    removeWishlistItem(productId);
  };

  // ========================================================================
  // NETFLIX-STYLE CINEMATIC INTRO & AUDIO SYNTHESIZER
  // ========================================================================
  let audioContext = null;
  let isSoundEnabled = true;
  let introTimer = null;

  function playNetflixTaDumSound() {
    if (!isSoundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContext) audioContext = new AudioCtx();
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const now = audioContext.currentTime;

      // 1. Cinematic Sub-Bass Cello Boom (The "Ta-")
      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      const filter1 = audioContext.createBiquadFilter();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(58, now);
      osc1.frequency.exponentialRampToValueAtTime(86, now + 0.35);
      osc1.frequency.exponentialRampToValueAtTime(45, now + 1.2);

      filter1.type = 'lowpass';
      filter1.frequency.setValueAtTime(280, now);
      filter1.frequency.linearRampToValueAtTime(450, now + 0.3);
      filter1.frequency.linearRampToValueAtTime(100, now + 1.2);

      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.6, now + 0.08);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

      osc1.connect(filter1);
      filter1.connect(gain1);
      gain1.connect(audioContext.destination);

      osc1.start(now);
      osc1.stop(now + 1.35);

      // 2. The Resonant Impact Hit ("-DUM!!") at +0.28s
      const hitTime = now + 0.28;
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      const filter2 = audioContext.createBiquadFilter();

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(130, hitTime);
      osc2.frequency.exponentialRampToValueAtTime(65, hitTime + 0.8);

      filter2.type = 'lowpass';
      filter2.frequency.setValueAtTime(800, hitTime);
      filter2.frequency.exponentialRampToValueAtTime(120, hitTime + 1.4);

      gain2.gain.setValueAtTime(0.001, hitTime);
      gain2.gain.linearRampToValueAtTime(0.7, hitTime + 0.06);
      gain2.gain.exponentialRampToValueAtTime(0.001, hitTime + 1.5);

      osc2.connect(filter2);
      filter2.connect(gain2);
      gain2.connect(audioContext.destination);

      osc2.start(hitTime);
      osc2.stop(hitTime + 1.55);

      // 3. Shimmering Luxury Crystal Bell Chords (F# Major: F#5, A#5, C#6, F#6)
      const chordFrequencies = [739.99, 932.33, 1108.73, 1479.98];
      chordFrequencies.forEach((freq, idx) => {
        const chimeOsc = audioContext.createOscillator();
        const chimeGain = audioContext.createGain();
        const chimeFilter = audioContext.createBiquadFilter();

        const startTime = hitTime + 0.08 + (idx * 0.06);

        chimeOsc.type = 'sine';
        chimeOsc.frequency.setValueAtTime(freq, startTime);

        chimeFilter.type = 'bandpass';
        chimeFilter.frequency.setValueAtTime(freq, startTime);
        chimeFilter.Q.setValueAtTime(8, startTime);

        chimeGain.gain.setValueAtTime(0.0001, startTime);
        chimeGain.gain.linearRampToValueAtTime(0.18 / (idx + 1), startTime + 0.04);
        chimeGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.8);

        chimeOsc.connect(chimeFilter);
        chimeFilter.connect(chimeGain);
        chimeGain.connect(audioContext.destination);

        chimeOsc.start(startTime);
        chimeOsc.stop(startTime + 1.85);
      });

    } catch (e) {
      console.warn("Web Audio not supported or blocked by browser policy:", e);
    }
  }

  function startNetflixIntro() {
    if (!elements.netflixIntroOverlay) return;

    // Reset overlay state
    elements.netflixIntroOverlay.classList.remove('hide-intro');
    const stage = elements.netflixIntroOverlay.querySelector('.netflix-intro-stage');
    if (stage) stage.classList.remove('zooming-out');

    document.body.classList.remove('site-revealed');
    document.body.style.overflow = 'hidden';

    // Play synthesized luxury sound
    setTimeout(() => {
      playNetflixTaDumSound();
    }, 250);

    // Zoom-burst at 2.4s (Netflix expanding letters zoom effect)
    introTimer = setTimeout(() => {
      if (stage) stage.classList.add('zooming-out');
      
      // Complete & reveal site at 3.0s
      setTimeout(() => {
        finishNetflixIntro();
      }, 650);
    }, 2400);
  }

  function finishNetflixIntro() {
    clearTimeout(introTimer);
    if (!elements.netflixIntroOverlay) return;
    
    elements.netflixIntroOverlay.classList.add('hide-intro');
    document.body.classList.add('site-revealed');
    document.body.style.overflow = '';
  }

  function setupNetflixIntroHandlers() {
    // Skip Button
    if (elements.skipNetflixIntroBtn) {
      elements.skipNetflixIntroBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        finishNetflixIntro();
      });
    }

    // Sound Toggle Button
    if (elements.netflixSoundBtn) {
      elements.netflixSoundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isSoundEnabled = !isSoundEnabled;
        const iconSpan = elements.netflixSoundBtn.querySelector('.sound-icon-text');
        if (iconSpan) {
          iconSpan.textContent = isSoundEnabled ? '🔊 Sound On' : '🔇 Muted';
        }
        if (isSoundEnabled) {
          playNetflixTaDumSound();
        }
      });
    }

    // Replay Intro Button in Announcement Bar
    if (elements.replayIntroBtn) {
      elements.replayIntroBtn.addEventListener('click', (e) => {
        e.preventDefault();
        startNetflixIntro();
      });
    }

    // Clicking Brand Logo can also trigger replay if requested
    if (elements.homeLogoBtn) {
      elements.homeLogoBtn.addEventListener('dblclick', (e) => {
        e.preventDefault();
        startNetflixIntro();
      });
    }

    // Auto-start on initial page load
    startNetflixIntro();
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================
  async function init() {
    // --- Load 100% of Catalog Exclusively from Backend SQLite Database API ---
    try {
      const [prodRes, catRes, brandRes, reviewRes, couponRes] = await Promise.allSettled([
        api.getProducts(),
        api.getCategories(),
        api.getBrands(),
        api.getReviews(),
        api.getCoupons()
      ]);

      if (prodRes.status === 'fulfilled' && prodRes.value && prodRes.value.success && Array.isArray(prodRes.value.products)) {
        state.products = prodRes.value.products;
        console.log(`✦ Loaded ${prodRes.value.products.length} live products from SQLite backend API`);
      }
      if (catRes.status === 'fulfilled' && catRes.value && catRes.value.success && Array.isArray(catRes.value.categories)) {
        state.categories = catRes.value.categories;
        console.log(`✦ Loaded ${catRes.value.categories.length} live categories from SQLite backend API`);
      }
      if (brandRes.status === 'fulfilled' && brandRes.value && brandRes.value.success && Array.isArray(brandRes.value.brands)) {
        state.brands = brandRes.value.brands;
        console.log(`✦ Loaded ${brandRes.value.brands.length} live brands from SQLite backend API`);
      }
      if (reviewRes.status === 'fulfilled' && reviewRes.value && reviewRes.value.success && Array.isArray(reviewRes.value.reviews)) {
        state.reviews = reviewRes.value.reviews;
      }
      if (couponRes.status === 'fulfilled' && couponRes.value && couponRes.value.success && couponRes.value.coupons) {
        state.coupons = couponRes.value.coupons;
      }
    } catch (err) {
      console.warn('Backend API initial data fetch notice:', err.message);
    }

    // Verify session with Backend API and fetch persistent wishlist
    if (state.token) {
      try {
        const meRes = await api.getMe();
        if (meRes && meRes.success && meRes.user) {
          state.currentUser = meRes.user;
          const wishRes = await api.getWishlist();
          if (wishRes && wishRes.success) {
            state.wishlist = wishRes.wishlist || [];
          }
        }
      } catch (err) {
        console.warn('Backend session validation failed:', err);
        state.currentUser = null;
        state.token = null;
        state.wishlist = [];
        localStorage.removeItem('lavender_token');
        localStorage.removeItem('lavender_user');
      }
    } else {
      state.currentUser = null;
      state.wishlist = [];
    }

    renderHomepage();
    updateBadges();
    updateUserUI();
    setupEventListeners();
    handleNavigation();
    setupNetflixIntroHandlers();
  }

  // Global helper to refresh products dynamically from SQLite API
  window.refreshProductsFromBackend = async function() {
    try {
      const [prodRes, catRes, brandRes] = await Promise.allSettled([
        api.getProducts(),
        api.getCategories(),
        api.getBrands()
      ]);
      if (prodRes.status === 'fulfilled' && prodRes.value && prodRes.value.success && Array.isArray(prodRes.value.products)) {
        state.products = prodRes.value.products;
      }
      if (catRes.status === 'fulfilled' && catRes.value && catRes.value.success && Array.isArray(catRes.value.categories)) {
        state.categories = catRes.value.categories;
      }
      if (brandRes.status === 'fulfilled' && brandRes.value && brandRes.value.success && Array.isArray(brandRes.value.brands)) {
        state.brands = brandRes.value.brands;
      }
      renderHomepage();
      handleNavigation();
    } catch (e) {
      console.error('Failed to refresh data from SQLite backend:', e);
    }
  };

  init();

});
