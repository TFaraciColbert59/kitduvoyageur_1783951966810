/**
 * Corps des scripts inline first-party — SOURCE UNIQUE.
 * `next.config.mjs` autorise exactement ces contenus via `sha256-…`
 * (CSP sans `unsafe-inline`). Toute modification ici DOIT être répercutée
 * dans la CSP — `tests/lib/csp/inline-hashes.spec.ts` verrouille la synchro.
 * Règle : contenus 100% statiques (aucune interpolation), sinon hash impossible.
 */

/** Initialisation thème pré-peinture (layout racine, toutes pages). */
export const THEME_INIT_JS = `(function(){var r=document.documentElement;var t=null;try{t=localStorage.getItem('lkdv_theme');}catch(e){}var isDark=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(isDark){r.classList.add('dark');r.setAttribute('data-theme','dark');r.style.colorScheme='dark';}else{r.classList.remove('dark');r.setAttribute('data-theme','light');r.style.colorScheme='light';}try{var g=localStorage.getItem('lkdv_glass_intensity');if(g)r.style.setProperty('--glass-intensity',g);}catch(e){}})();`;

/** Purge service workers résiduels — développement uniquement. */
export const SW_CLEANUP_JS = `
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    registrations.forEach(function(registration) { registration.unregister(); });
                  }).catch(function() {});
                  if (window.caches && caches.keys) {
                    caches.keys().then(function(keys) {
                      keys.forEach(function(key) { caches.delete(key); });
                    }).catch(function() {});
                  }
                }
              `;

/** Chargeur Travelpayouts Drive (snippet fournisseur, inchangé). */
export const TRAVELPAYOUTS_LOADER_JS = `(function () {
      var script = document.createElement("script");
      script.async = 1;
      script.setAttribute("data-cmp-ab","2");
      script.src = 'https://tpembars.com/NTYxMTY5.js?t=561169';
      document.head.appendChild(script);
  })();`;
