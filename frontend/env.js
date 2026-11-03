// ==========================================================================
// LAVENDER — FRONTEND ENVIRONMENT LOADER (frontend/env.js)
// Reads and parses frontend/.env dynamically in the browser
// ==========================================================================

(function() {
  // Default fallback values (Localhost)
  window.__ENV__ = {
    BACKEND_URL: 'http://localhost:3000',
    API_BASE_URL: 'http://localhost:3000/api'
  };

  // Helper function to resolve API endpoints
  window.getApiUrl = function(endpoint) {
    let base = 'http://localhost:3000/api';
    if (window.__ENV__) {
      if (window.__ENV__.API_BASE_URL) {
        base = window.__ENV__.API_BASE_URL;
      } else if (window.__ENV__.BACKEND_URL) {
        const root = window.__ENV__.BACKEND_URL.replace(/\/+$/, '');
        base = root.endsWith('/api') ? root : `${root}/api`;
      }
    }
    const cleanBase = base.replace(/\/+$/, '');
    const cleanPath = String(endpoint || '').replace(/^\/+/, '');
    return cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase;
  };

  // Async loader that fetches and parses the frontend/.env file
  window.__loadEnvPromise = fetch('/.env')
    .then(response => {
      if (!response.ok) throw new Error('Could not load .env file');
      return response.text();
    })
    .then(text => {
      text.split('\n').forEach(line => {
        const trimmed = line.trim();
        // Ignore comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) return;

        const equalsIndex = trimmed.indexOf('=');
        if (equalsIndex > 0) {
          const key = trimmed.substring(0, equalsIndex).trim();
          let val = trimmed.substring(equalsIndex + 1).trim();
          // Strip quotes if present
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          window.__ENV__[key] = val;
        }
      });

      // Synchronize single BACKEND_URL to API_BASE_URL automatically
      if (window.__ENV__.BACKEND_URL) {
        const cleanRoot = window.__ENV__.BACKEND_URL.replace(/\/+$/, '');
        if (!window.__ENV__.API_BASE_URL) {
          window.__ENV__.API_BASE_URL = cleanRoot.endsWith('/api') ? cleanRoot : `${cleanRoot}/api`;
        }
      } else if (window.__ENV__.API_BASE_URL) {
        window.__ENV__.BACKEND_URL = window.__ENV__.API_BASE_URL.replace(/\/api\/?$/, '');
      }

      console.log('🌱 Frontend .env loaded. Backend URL:', window.__ENV__.BACKEND_URL, '| API Base:', window.__ENV__.API_BASE_URL);
      return window.__ENV__;
    })
    .catch(err => {
      console.log('ℹ️ Using default local .env configuration (http://localhost:3000)');
      return window.__ENV__;
    });
})();

