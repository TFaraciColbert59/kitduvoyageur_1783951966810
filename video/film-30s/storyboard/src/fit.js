// Ajuste la taille des mots qui claquent à la largeur voulue (data-fit="940"), sans dépasser data-max.
(function () {
  function fit() {
    document.querySelectorAll("[data-fit]").forEach((el) => {
      const W = +el.dataset.fit, max = +(el.dataset.max || 320);
      let lo = 20, hi = max;
      el.style.display = "inline-block";
      while (hi - lo > 1) { const m = (lo + hi) / 2; el.style.fontSize = m + "px"; if (el.scrollWidth <= W) lo = m; else hi = m; }
      el.style.fontSize = Math.floor(lo) + "px";
      el.dataset.size = Math.floor(lo);
      const g = el.dataset.ghost && document.getElementById(el.dataset.ghost); if (g) g.style.fontSize = el.style.fontSize;
      console.log("fit", el.textContent.trim(), Math.floor(lo) + "px");
    });
  }
  document.fonts.ready.then(fit);
})();
