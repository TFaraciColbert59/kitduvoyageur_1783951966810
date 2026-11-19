(function () {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .getRegistrations()
    .then(function (regs) {
      return Promise.all(regs.map(function (r) { return r.unregister(); }));
    })
    .then(function (results) {
      var didUnregister = results.some(Boolean);
      if (window.caches && caches.keys) {
        return caches
          .keys()
          .then(function (keys) {
            return Promise.all(keys.map(function (k) { return caches.delete(k); }));
          })
          .then(function () {
            if (didUnregister) window.location.reload();
          });
      }
      if (didUnregister) window.location.reload();
    })
    .catch(function () {});
})();
