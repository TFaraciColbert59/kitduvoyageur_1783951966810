/**
 * Sonde de couverture injectée dans CHAQUE page (addInitScript), avant tout
 * script de l'application. Elle :
 *  - expose `window.__cpDescribe(el)` : la description d'un élément telle que
 *    le rapport la rapproche de l'inventaire (balise, rôle, classes, nom
 *    accessible, classes des parents, étape et écran courants) ;
 *  - enregistre PASSIVEMENT chaque activation (clic, saisie, changement,
 *    glisser, appui long) par la liaison `__cpCoverageRecord`. Ces
 *    enregistrements ne comptent jamais comme « vérifiés » : seul `cover.*`
 *    (coverage.ts) crédite un contrôle, après l'assertion de son effet.
 *
 * La fonction est sérialisée par Playwright : elle ne doit rien importer.
 */
export function installCoverageProbe() {
  type Info = { tag: string; role: string | null; type: string | null; classes: string[]; name: string };
  const w = window as unknown as {
    __cpDescribe?: (el: Element, gesture?: string) => unknown;
    __cpCoverageRecord?: (r: unknown) => Promise<void>;
  };
  if (w.__cpDescribe) return;

  const INTERACTIVE =
    'button,a[href],input,textarea,select,summary,[role=button],[role=tab],[role=switch],[role=slider],[role=checkbox],[role=radio],[role=link],[role=menuitem],[role=option]';
  const STEP_IDS: Record<string, string> = { Où: 'ou', Nous: 'nous', Résa: 'resa', Verdict: 'verdict', Kit: 'kit' };
  const squash = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

  const accName = (e: Element): string => {
    const aria = e.getAttribute('aria-label');
    if (aria && aria.trim()) return squash(aria);
    const by = e.getAttribute('aria-labelledby');
    if (by) {
      const t = by
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ');
      if (squash(t)) return squash(t);
    }
    const isField = e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement || e instanceof HTMLSelectElement;
    if (isField) {
      const labels = (e as HTMLInputElement).labels;
      if (labels && labels.length) {
        const t = Array.from(labels, (l) => {
          // Le texte du <label> sans la valeur des champs qu'il contient.
          const clone = l.cloneNode(true) as Element;
          clone.querySelectorAll('input,textarea,select,option').forEach((x) => x.remove());
          return clone.textContent ?? '';
        }).join(' ');
        if (squash(t)) return squash(t);
      }
    } else {
      const t = squash(e.textContent).slice(0, 300);
      if (t) return t;
    }
    const title = e.getAttribute('title');
    if (title && title.trim()) return squash(title);
    const ph = e.getAttribute('placeholder');
    if (ph && ph.trim()) return squash(ph);
    return '';
  };

  const info = (e: Element): Info => ({
    tag: e.tagName.toLowerCase(),
    role: e.getAttribute('role'),
    type: e.tagName === 'INPUT' ? (e.getAttribute('type') ?? 'text') : null,
    classes: Array.from(e.classList),
    name: accName(e),
  });

  const currentEtape = (): string => {
    if (document.querySelector('.compas--start')) return 'depart';
    const on = document.querySelector('.compas .cp-steps .cp-step[aria-current="step"] .cp-step__l');
    if (on) return STEP_IDS[squash(on.textContent)] ?? squash(on.textContent);
    return document.querySelector('.compas') ? 'commun' : 'hors-compas';
  };

  const currentEcran = (): string => {
    if (document.querySelector('.cp-prep')) return 'préparation';
    const sheets = document.querySelectorAll('.cp-sheet[role="dialog"]');
    const sheet = sheets[sheets.length - 1];
    if (sheet) {
      const tab = sheet.querySelector('.cp-seg [aria-pressed="true"]');
      return `tiroir « ${squash(sheet.getAttribute('aria-label'))} »${tab ? ` › ${squash(tab.textContent)}` : ''} (${sheet.getAttribute('data-detent') ?? '?'})`;
    }
    if (document.querySelector('.compas--start')) return 'Compas vide';
    return location.pathname;
  };

  const describe = (target: Element, gesture?: string) => {
    const start = (target.closest(INTERACTIVE) as Element | null) ?? target;
    const chain: Info[] = [];
    // Le contrôle visé, puis ses parents (une zone cliquable est un <div> parent de la cible).
    for (let e: Element | null = start, i = 0; e && e !== document.body && i < 6; e = e.parentElement, i += 1)
      chain.push(info(e));
    const ancestorClasses = new Set<string>();
    for (let e = start.parentElement; e && e !== document.body; e = e.parentElement)
      e.classList.forEach((c) => ancestorClasses.add(c));
    return {
      chain,
      ancestorClasses: [...ancestorClasses],
      etape: currentEtape(),
      ecran: currentEcran(),
      path: location.pathname + location.search,
      ...(gesture ? { gesture } : {}),
      disabled: (start as HTMLButtonElement).disabled === true || start.getAttribute('aria-disabled') === 'true',
    };
  };
  w.__cpDescribe = describe;

  const send = (r: unknown) => {
    try {
      void w.__cpCoverageRecord?.({ ...(r as object), action: (r as { action?: string }).action ?? 'clic' });
    } catch {
      /* liaison absente (page hors banc) : rien à enregistrer */
    }
  };

  // Deux touchers en moins de 320 ms sur le même élément : une double-touche (useDoubleTap).
  let lastClick: { el: Element; t: number } | null = null;
  document.addEventListener(
    'click',
    (ev) => {
      if (!(ev.target instanceof Element)) return;
      send({ ...describe(ev.target), action: 'clic' });
      const now = Date.now();
      if (lastClick && lastClick.el === ev.target && now - lastClick.t < 320) {
        send({ ...describe(ev.target, 'double-touche'), action: 'double-touche' });
        lastClick = null;
      } else lastClick = { el: ev.target, t: now };
    },
    true
  );
  // Une saisie produit un `input` par touche : un seul enregistrement par champ et par seconde.
  const lastInput = new WeakMap<Element, number>();
  document.addEventListener(
    'input',
    (ev) => {
      if (!(ev.target instanceof Element)) return;
      const now = Date.now();
      if (now - (lastInput.get(ev.target) ?? 0) < 1000) return;
      lastInput.set(ev.target, now);
      send({ ...describe(ev.target), action: 'saisie' });
    },
    true
  );
  document.addEventListener(
    'change',
    (ev) => {
      if (ev.target instanceof HTMLSelectElement || (ev.target instanceof HTMLInputElement && /checkbox|radio|range/.test(ev.target.type)))
        send({ ...describe(ev.target), action: 'changement' });
    },
    true
  );
  // Gestes : glisser (> 30 px) ou appui long (> 450 ms immobile) depuis l'élément touché.
  let down: { el: Element; x: number; y: number; t: number } | null = null;
  document.addEventListener(
    'pointerdown',
    (ev) => {
      if (ev.target instanceof Element) down = { el: ev.target, x: ev.clientX, y: ev.clientY, t: Date.now() };
    },
    true
  );
  document.addEventListener(
    'pointerup',
    (ev) => {
      const d = down;
      down = null;
      if (!d) return;
      const dist = Math.hypot(ev.clientX - d.x, ev.clientY - d.y);
      // Le geste appartient au premier parent qui le porte : la cible et ses parents sont décrits.
      if (dist > 30) send({ ...describe(d.el, 'glisser'), action: 'glisser' });
      else if (Date.now() - d.t > 450) send({ ...describe(d.el, 'appui long'), action: 'appui long' });
    },
    true
  );
}
