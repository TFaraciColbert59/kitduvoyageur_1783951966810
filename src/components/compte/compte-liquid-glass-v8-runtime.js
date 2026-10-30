/* eslint-disable */

/**
 * Résout l'action `setvis` vers l'index exact de `S.vis`.
 *
 * Contrat public : `'public'` → 2 (Publique), `'prive'` → 0 (Privée).
 * Les index historiques 0/1/2 (et leurs équivalents chaînes posés par les
 * `data-v` du menu de visibilité) restent acceptés pour ne pas casser le menu
 * trois états existant. Toute autre valeur retourne `null` : l'action doit
 * alors être rejetée sans mutation. Fonction pure, exportée pour le test
 * unitaire car le reste du runtime exige un DOM complet.
 */
export function resolveSetVis(value) {
  if (value === 'public') return 2;
  if (value === 'prive') return 0;
  if (value === 0 || value === 1 || value === 2) return value;
  if (value === '0' || value === '1' || value === '2') return Number(value);
  return null;
}

/**
 * Transition pure de l'action `setvis` : applique la cible exacte à l'index
 * courant. `null` = valeur inconnue (l'appelant rejette sans mutation) ;
 * sinon le résultat est stable : deux applications identiques donnent le même
 * état, ce qui rend l'action idempotente. Exporté pour le test unitaire.
 */
export function applySetVis(current, value) {
  const target = resolveSetVis(value);
  if (target == null) return null;
  return current === target ? current : target;
}

/**
 * Résout l'action `setprofilevis` vers une confidentialité de compte exacte.
 *
 * Contrairement à `setvis` (trois états d'empreinte), le compte n'a que deux
 * valeurs, celles du CHECK `user_profiles.profile_visibility` :
 * `'public'` | `'prive'`. Toute autre valeur retourne `null` et doit être
 * rejetée sans mutation. Exporté pour le test unitaire.
 */
export function resolveProfileVis(value) {
  if (value === 'public') return 'public';
  if (value === 'prive') return 'prive';
  return null;
}

/**
 * Transition pure de `setprofilevis` : applique la cible exacte. Une cible
 * déjà atteinte renvoie l'état courant inchangé (idempotence) ; une valeur
 * inconnue renvoie `null` (aucune mutation). Exporté pour le test unitaire.
 */
export function applyProfileVis(current, value) {
  const target = resolveProfileVis(value);
  if (target == null) return null;
  return current === target ? current : target;
}

/**
 * Une mutation ne peut entrer dans la pile d'annulation que si elle a changé
 * l'état et si elle est réversible localement.
 *
 * `profilevis` est persistée en base (`user_profiles.profile_visibility`) :
 * annuler le runtime sans réécrire la base laisserait l'UI sur une valeur qui
 * n'est plus la vérité serveur. Elle n'est donc jamais annulable. Exporté pour
 * le test unitaire.
 */
export function canUndoMutation(key, changed) {
  return Boolean(changed) && key !== 'profilevis';
}

/* Nationalités proposées par le runtime : la valeur reçue doit être l'une de
   ces chaînes exactes, sans normalisation silencieuse. */
const NATIONALITY_VALUES = Object.freeze([
  'France',
  'Italie',
  'Suisse',
  'Belgique',
  'Canada',
  'Espagne',
]);

/** Résout une nationalité exacte ; `null` pour vide, inconnue ou non-chaîne. */
export function resolveNationality(value) {
  if (typeof value !== 'string') return null;
  return NATIONALITY_VALUES.includes(value) ? value : null;
}

/**
 * Plan pur de l'action `setnat`. La nationalité est un choix unique : `nats`
 * devient un tableau à une seule valeur, aligné sur `nationality` et le profil.
 * `changed: false` = l'état est déjà exactement la cible, aucun pont à appeler.
 */
export function applySetNationality(current, value) {
  const target = resolveNationality(value);
  if (target == null) return null;
  const nats = current && Array.isArray(current.nats) ? current.nats : [];
  const exact =
    nats.length === 1 &&
    nats[0] === target &&
    current?.nationality === target &&
    current?.profileNationality === target;

  return {
    value: target,
    changed: !exact,
    nats: exact ? nats : [target],
    nationality: target,
    profileNationality: target,
  };
}

/* La page derrière le drawer : uniquement les sections du profil et la carte.
   Les menus/popovers/dialogues restent hors de cette liste pour rester
   utilisables depuis une feuille. */
const SHEET_BACKGROUND_SELECTOR =
  '#phone > .status, #phone > .island, #phone > .top, #phone > .tabbar, #phone > .home';
const SHEET_FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** Photographie de l'état inert/aria-hidden avant ouverture, par feuille. */
const sheetModalBackgrounds = new WeakMap();

/**
 * Applique ou retire la modalité du drawer : `aria-modal` sur `#sheet`,
 * `inert` + `aria-hidden` sur la page derrière, avec restauration exacte des
 * valeurs préexistantes (le statut est déjà `aria-hidden="true"`).
 */
export function applySheetModalState(sheet, active) {
  if (!sheet || typeof sheet.setAttribute !== 'function') return;

  if (active) {
    sheet.setAttribute('aria-modal', 'true');
    if (sheetModalBackgrounds.has(sheet)) return;
    const doc = sheet.ownerDocument;
    if (!doc || typeof doc.querySelectorAll !== 'function') return;
    const records = Array.from(doc.querySelectorAll(SHEET_BACKGROUND_SELECTOR))
      .filter((element) => element !== sheet && !sheet.contains(element))
      .map((element) => ({
        element,
        inert: element.hasAttribute('inert'),
        ariaHidden: element.getAttribute('aria-hidden'),
      }));
    records.forEach(({ element }) => {
      element.setAttribute('inert', '');
      try { element.inert = true; } catch (_) {}
      element.setAttribute('aria-hidden', 'true');
    });
    sheetModalBackgrounds.set(sheet, records);
    return;
  }

  sheet.removeAttribute('aria-modal');
  const records = sheetModalBackgrounds.get(sheet);
  if (!records) return;
  records.forEach(({ element, inert, ariaHidden }) => {
    try { element.inert = inert; } catch (_) {}
    if (inert) element.setAttribute('inert', '');
    else element.removeAttribute('inert');
    if (ariaHidden === null) element.removeAttribute('aria-hidden');
    else element.setAttribute('aria-hidden', ariaHidden);
  });
  sheetModalBackgrounds.delete(sheet);
}

/**
 * Cible du piège de focus aux bornes de `#sheet`.
 * `null` = laisser le comportement natif (Tab au milieu de la liste, ou focus
 * déjà hors de la feuille pour ne jamais voler le focus d'une feuille React
 * imbriquée). La feuille elle-même est renvoyée si rien n'est focusable.
 */
export function nextSheetFocus(sheet, active, shift) {
  if (!sheet || typeof sheet.querySelectorAll !== 'function') return null;
  const focusables = Array.from(
    sheet.querySelectorAll(SHEET_FOCUSABLE_SELECTOR)
  ).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.hidden &&
      !element.closest('[inert]') &&
      !element.closest('[hidden]')
  );
  if (focusables.length === 0) return sheet;

  const index = active ? focusables.indexOf(active) : -1;
  if (active && active !== sheet && index < 0) return null;
  if (index < 0) return shift ? focusables[focusables.length - 1] : focusables[0];
  if (shift && index === 0) return focusables[focusables.length - 1];
  if (!shift && index === focusables.length - 1) return focusables[0];
  return null;
}

export function initCompteLiquidGlassRuntime(rootContainer, account = {}) {
  if (!rootContainer) return () => {};
  window.__LKDV_NEXT_PROD = true;
  // The host div is reused; keep DOM reads attached to this account's tree.
  const accountRoot = rootContainer.querySelector('.stage') || rootContainer;
  let disposed = false;
  let exportedActions = null;
  let interactionState = null;
  const isCurrent = () => !disposed && (!account.isCurrent || account.isCurrent());
  const storageKey = key => `${key}:${account.userId || 'guest'}`;
  const timers = new Set();
  const frames = new Set();
  // Every deferred runtime callback belongs to this account instance.
  const setTimeout = (callback, delay, ...args) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (isCurrent()) callback(...args);
    }, delay);
    timers.add(id);
    return id;
  };
  const clearTimeout = id => { timers.delete(id); window.clearTimeout(id); };
  const requestAnimationFrame = callback => {
    const id = window.requestAnimationFrame ? window.requestAnimationFrame(time => {
      frames.delete(id);
      if (isCurrent()) callback(time);
    }) : setTimeout(() => { frames.delete(id); callback(Date.now()); }, 16);
    frames.add(id);
    return id;
  };
  const cancelAnimationFrame = id => {
    frames.delete(id);
    if (window.cancelAnimationFrame) window.cancelAnimationFrame(id);
    else clearTimeout(id);
  };
  const fetch = async (...args) => {
    if (!isCurrent()) throw new Error('stale_account');
    const response = await globalThis.fetch(...args);
    if (!isCurrent()) throw new Error('stale_account');
    return response;
  };

  if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : (cb) => setTimeout(cb, 16);
  }
  if (typeof globalThis.cancelAnimationFrame === 'undefined') {
    globalThis.cancelAnimationFrame = typeof window.cancelAnimationFrame === 'function'
      ? window.cancelAnimationFrame.bind(window)
      : (id) => clearTimeout(id);
  }

  const trackedWindowListeners = [];
  const trackedDocListeners = [];
  const origWinAdd = window.addEventListener.bind(window);
  const origDocAdd = document.addEventListener.bind(document);

  window.addEventListener = function(type, listener, options) {
    trackedWindowListeners.push({ type, listener, options });
    return origWinAdd(type, listener, options);
  };
  document.addEventListener = function(type, listener, options) {
    trackedDocListeners.push({ type, listener, options });
    return origDocAdd(type, listener, options);
  };

  /* Photographie des calques de contexte, portée par le montage courant.
     Remise à null à l'init (état neuf) et au cleanup (aucune fuite entre
     montages). */
  let mapContextLayerSnapshot = null;

  try {
    (function() {

const $ = id => accountRoot.querySelector(`[id="${id}"]`);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const fmt = n => Math.round(n).toLocaleString('fr-FR') + ' €';
const fmtE = n => n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
const kgs = g => g >= 1000 ? (g / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' kg' : Math.round(g) + ' g';
const haptic = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

const TONY_AVATAR = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/7QCEUGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAGgcAigAYkZCTUQwYTAwMGFhOTAxMDAwMGFjMDIwMDAwZTIwMzAwMDA3ZjA0MDAwMDM4MDUwMDAwN2EwNjAwMDBiMTA5MDAwMGU0MDkwMDAwOTkwYTAwMDAwNzBiMDAwMGE0MGUwMDAwAP/bAIQABQYGCwgLCwsLCw0LCwsNDg4NDQ4ODw0ODg4NDxAQEBEREBAQEA8TEhMPEBETFBQTERMWFhYTFhUVFhkWGRYWEgEFBQUKBwoICQkICwgKCAsKCgkJCgoMCQoJCgkMDQsKCwsKCw0MCwsICwsMDAwNDQwMDQoLCg0MDQ0MExQTExOc/8IAEQgAZABkAwEiAAIRAQMRAf/EAHQAAAEFAQEAAAAAAAAAAAAAAAMBAgQFBgAHEAABAwIDBAcGBQUAAAAAAAABAAIRAyESMUEEEFFhEyJxgZGh8CAwMkKxwQVS0eHxFDNiorIRAAEDAwMEAwEBAAAAAAAAAAEAESExQVFhcYEQkaHwwdHhsfH/2gAMAwEAAgADAAAAAcxVz41Y6MyVxkG+K9ekGUQe7T11GJ1rUPMZKP1Dyj1ewFjgW9fXos6qnGWnnxTtW4rCQBpqsFeUhmwpiT5Aqf1jzP0wzMZHhsAk+2h3YpOWsos1BTBzCwD5cNqOxrYU0DnNBuvP/QJSedwpkFkzYXef0dVd5M6HnZtnNeaIZedwa555BiwdVVWp3Y6Z6P5tTaKm9DyDuudRHxklaac8S3GYlEDzwOkQ5DyyLGqtX9feJ+uVeY2GKuK204tFMu2SIEFgT2FCQscpAqvOMztBn9A5MdY6DqDYec+jpzm24K/opgwLXnRswmo6yz2YTUdOh0F/3FF//9oACAEBAAEFAujT3IzD1EppLRTia569B96ldgbtFUvY7HTD3lxoVVVHWBVWIYbkSmhNBcpewbQ8FdP0qrTBdKxBorvtTIJ2zZ2MGFMGFYZVB4Y51ZrGVboNTmuWBNyeLMTj1SZTWyqczUmarg5jgmhPasCqVFUfDSYbUxikMmCEOs2tYNbKexMYnsldCinqiGrbwCYTWqn8OLGGNVRiCcVh3asEsr9Sg3cDuan7sKwqoU0qibYelolwWGyATU5BAKENlqFU/wAOcDXZgfsRTcARr4N4R3DdVe4Cv+IPqraXBw2UyKj3MexwciUCgUSgpUqu0uaQaZpulUXQqrYDPhA3D2JQq22rZv6gCi6iX7G6eh6MVKUq4O6fY2GljVSq6in13Pd+G1DUpBOaANopgB1ERvlAr//aAAgBAwABPwFRvmEb7hV0Rq/EIHJY8vFOqahVKy6RdNz8lSz7LpzS2mXOHxnLtylTDhPygap0EWsSLIvWO2av+ZURZzuRXx0WGNGz3LaA6SYPh6CNQ8Ual0HLGm7O2n3qn1qZ5j/n0VUfDXdhThErVYlKe2Ux5DfFbQwlpjwVQf4wdf4RAbpJ+n7olSh8ITDfdXYCDIC234u5BFf/2gAIAQIAAT8BpyHEO0803PxRatZ4CO4o0hVeDFuRkdhtb0EwYMLC0C7rH/W/qyAhU4Lssjn60UXHmqg0NkylMsJmQP55rZaWDtkyibhQuiAhAjFHC5KqGQeZ9euKBLXZS0Ov64ceaDusvmC7lOSjC9wP5j5qm3zXQroUykuiQrOfyThiCbTyTbqE0bqToscinATnCY+4+qY7D80iPV01+LkPNBylG7yPWSrNGHLhuc4gCDqtjyPbv//aAAgBAQAGPwKIuEI+VdnqU3ij9VBNjItmh5ou+WZWIzH1QwkGT3wUHcTB+ybwPDlxUk5og3UlcOaCjRQMpUFG11lIHjZBzbcQU0HTig5pyyjTdl1u9NzQDpNr+fmqeC/JZROQuh5+KAHjfIqPqjiGKcvBCN3LRabhuHYuxT4oDUnNGQgJy03hZ77cgoqjrT1TaY1QUz28l9DqsvX39nPcEMc4dYTcP9vCMH380fJepRJ7lhOfuJ5Klrr+3vIWFxM0py1ldncpzHEX9x8BU4D2Oj9U4c006P6h+yGIM1jX6qNCI7yPckZN5JscL/ZOGcQ6OzPyWKcWcHyTeLfPn7hzb3B9clBsQjNwstCPEIdn8oSMlY+4EQHDL9FDhFl1pbwhREjxUt1V8/bPWcIjIwhBxT+b0E4k8V1rwYXaiV2oe1//2gAIAQEBAT8hvEDgEveZBenCGGXXkSTeNMYQlRY1Z9FCHKkADM0kqMqCS3N8soyCZBmvYNCICAmCSRqxFPG6umODSSJ15ZWJAEktDomGgIy2QoFS2qOIFj1BDllhWXRjSROWKHgQyHmaqbU5YoPAQSycQQS0vYjY6J5ixdjqRXh/pRkMHDK0D+MnAPNWYXD7Z1RgDGL+VO1kDegBMNl6OnBI7XrXIkiXTJMh2pg5Kk3S7kLot7Kmq6AtSXBwX4UQE8Qc+Run9AJUXgsfhHNzJKBcgjKjA5Odq1whEoeQHMAB271QjAFsmFZA1EtQpGxqOpLkjVEiWZrAFwN8oVRwRZH4umGBmqoLNtndMjJpg4l5+Tsi9LkC9iDzi11tTUx9oxTISNQudZqn57kAE8FSSy0+8oZ0UCQzSMv9IrikV0aNtKoW0Amhs2vdGBdByGIJuPooapM0EzOQZ2VIYClCpKLaUBAwhhFzbRMLC5AMpvYsvSNLCRxBRRXJJnRAMhBo3DXKOIglprUBtcZGqJp6nkRs7vY6eKSqkCEQmzJmKJ0Tt0KcH5oyK4tTcfK50KWD+kwHcDKGXiJNDmr66luyLt14ocVBBpXBZjRNFOFCxTxRQhEvtDILKqADaJHIJrschAWBPmvRnZAzPCqTE0oJ7r9IAs6eIBtRQRIrMh50TWRIwNcQgShIdgwSCA0xG6BQtQJAAJFIU9AG6QnohAb+GUGGy4oCxrEI1KeQNJhFLUimE/JHsliSMaIBMGUPJlwwCzSDohE2CmAAQmBEa7IeUOuOoAIyGmPpTC9dwMZ00Tui4qyNQLC0Faag5jL5FcDGrcEnFmcwghEkgMG4geCkj/OoOelEgzposDfpo4ZR7kARxCg8ohYHjECc5MsaMk7I+VIABKQJI1/qCTIDZ9fcJmRIMansiBYun16IxBeGaaaahAubEYcXo2blHspoIIyDwjwJgaM4JqTScYRYlfuMvaSiCJ5F9NrfyLIwgbUJQLk6P4RmLX/UyrJpsdbLTpF2I/U+48Im5caAP8CWrDBYB6DRAQqEpJD3fCAAAAQ5x3+kFwY+LKPaP8Q5pcow13idCh0CEaq//9oADAMBAQIBAwEAABASjiCrSLvuagxuk3kNd1AGww1s6EKAVfawkhzpEUkyIBILAPGH/9oACAEDAQE/EOi3SH7VQ6D96GNAnutMKr1lbEhGQMhtRrHCcw2yexL+FtpN5MAS4RWrwBYVvgmDBlQYiv8AVWUhq0TQkpxICo4W52Cowh2gSD9YwqRslyB8o0wYF6ANx8kEhSx00tqpTnVdvCqbMQgCou5byCeOEQlWvn8TVos6awVCA4d2MVUnR7iBYIx1BAT/AIa6rjm1tGTyhOWTFEgj/UcyJNehcKIoWlUPVAV8kcncr//aAAgBAgEBPxBSiylq3vlR7j046AqUdkFF0GghlcEnQyJDkQG/QURfQ13/AAtxdwLL3BMpygSn44JwkzkwE6/0WCINkCm1bOuozAFwHQwCOtbpweaGfzph1MAhaflfQ/vWzKnUA+IE9TUoWQC//9oACAEBAQE/EDUoWBG+zDMoIcSnHkG/BZdYACIFQ+xmupAOKE9xPxZEJTcKxqY5ZMQPU7LWSHqF5mWBmHGwyfDhqDQF7zyKWF3E+4Imi6n7GCyFVK6I4iczsoOYD9wA2hLKvKB3OzwUFU4YjTtNzJVKd5D8zIshzgkgKaCCA7N5D6exQMKTfzJbmS4UXyZsJlUoNNVbQhV6BLPhO6+YZFxjsiPfgYAYLLrM1Ebgxa3yMnFyIO+SvhDbF0o6icBvOBIBQ9akHmaQBwrUDhyQ+OKkh4mi05lBQXjo6AUEHR3yGFtmsmznnCSqPSEeMi6MqChuxD2ZAHgoFhGAXXJQMVXIseLoccJFrTXDk7oZoCTTbnMsog3yrSLwAPoQ0Q/EqzjeQugH4zyaeUJbdN86nsKiFDy6mZp3XoDkaOU4FptgbG7VlTQfkEFDwEPKGG5LJbYUSww5CcuhD+oojNA+V6CtoCK4+RkUUIQcWFfVsuAChCa0JMyTJcipGGGKbqqKMPxBB5nhHoAM+FVk0UEEncQnAAN0NOacEzbyirYtJvyyy2XDGb9iiewAk+JCLq4p2AbfCKKGS/ghvC3Q3EN4JpB+AbyqRRN5RuNk6f1RxOf8XriiEcBORB8hPi9yFNpssgd0snmGhB5iqKLOdDw6hAtKqGqa4oHSi9Hz7RaX7IhDJor5nUC9s6otwGAHkgXaHv2LSFpyH7hEFDDZJDlIAi9nGWTaL79J5F+yHO/sK4Y8OpqM3HvZBTGlwB7BECOzGQH0wjw4sy5h0WCEYaGsNGxjRc6XI0QEuDuCsUHKWgLqikLnle+qLx57/SADU9JpkSgSaQOPhF8tPIEJjJCHZTOkCrUWxFOKPTsiWYxgUicZEah/rBAQJoIrAvhZAJEGDCB/q+qJz4TVveFKcttBT/46bGZPtI+UGUUDGjBGs1Bj/XR43pZRDDm1FPSogjwV0ZgroniMeZWROhZ4dFaeSmUS1jkJ8k42NiRW4TOQUE7IOHcWQlIdmMIe1lz97IrNvJKj9nZRwSRG6btBLdqS4aSyEQqMlfAQSh2++qMpyJ7CA82r7twyO4k1RWa/XdcoIf8Ar9QCg7JSMUYTFDAf5t7KbAehS/8AETSoZaj68aqN9mZPDd3IIQC7Rm5s9iYtJ0gsAC8Ef2sbgCpsQnIJgU+hXiw1S5oZYWoGWnkECMQvNWG17oi+7nXIJxZExIzB4Tx7ZEbduyMAuX//2Q==";

const IC = {
  user: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20c.8-3.8 3.8-6 8-6s7.2 2.2 8 6",
  people: "M9 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM3 19.5c.6-3.3 3-5.3 6-5.3s5.4 2 6 5.3M16.5 11a2.6 2.6 0 1 0 0-5.2M17 14.4c2.2.3 3.6 2 4 5",
  route: "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 15V9a3 3 0 0 1 3-3h7M18 9v6a3 3 0 0 1-3 3H8",
  book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H19v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5ZM4 19.5A2.5 2.5 0 0 1 6.5 17H19",
  bookmark: "M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.4L6 21V4.5Z",
  pack: "M9 6.5V5a3 3 0 0 1 6 0v1.5M6 10.5a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8.5ZM9.5 14h5v4h-5z",
  sliders: "M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4",
  list: "M4 7h16M4 12h16M4 17h16",
  grid: "M4 4h6.5v6.5H4V4ZM13.5 4H20v6.5h-6.5V4ZM4 13.5h6.5V20H4v-6.5ZM13.5 13.5H20V20h-6.5v-6.5Z",
  carousel: "M5 5h11v11H5V5ZM9 19h10V9",
  image: "M4 5h16v14H4V5ZM8.5 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM4 16l5-5 4 4 3-3 4 4",
  camera: "M4 8h3.2L9 5.6h6L16.8 8H20v11H4V8ZM12 17a3.4 3.4 0 1 0 0-6.8A3.4 3.4 0 0 0 12 17Z",
  pencil: "M4 20l4.5-1 10-10a2.8 2.8 0 0 0-4-4l-10 10L4 20ZM13.5 6.5l4 4",
  leaf: "M20 4C10 4 4 9 4 17c0 2 1 3 3 3 8 0 13-6 13-16ZM7 17c3-5 7-8 11-10",
  x: "M6.5 6.5l11 11M17.5 6.5l-11 11",
  expand: "M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5",
  shrink: "M20 10h-6V4M4 14h6v6M14 10l6.5-6.5M10 14l-6.5 6.5",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  chevL: "M15 6l-6 6 6 6",
  chevR: "M9 6l6 6-6 6",
  chevD: "M7 10l5 5 5-5",
  share: "M12 3v12M8 7l4-4 4 4M6 11v9h12v-9",
  send: "M12 19V5M6 11l6-6 6 6",
  heart: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16ZM10 20.5a2 2 0 0 0 4 0",
  bag: "M5 8h14l-1 12H6L5 8ZM9 8a3 3 0 0 1 6 0",
  mount: "M3 19 9.5 8l4 6.5L16 11l5 8H3Z",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9h-13z",
  hub: "M4 5h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  layers: "M12 3 3 8l9 5 9-5-9-5ZM3 12.5l9 5 9-5M3 17l9 5 9-5",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4",
  box: "M4 8l8-4 8 4v9l-8 4-8-4V8ZM4 8l8 4 8-4M12 12v9",
  pin: "M12 21s-6-5.6-6-11a6 6 0 1 1 12 0c0 5.4-6 11-6 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  wallet: "M4 7h15a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4zM4 7l11-3v3M16 13h2",
  ticket: "M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4V7.5ZM14.5 7v1.5M14.5 11v2M14.5 15.5V17",
  gauge: "M4 16.5a8 8 0 1 1 16 0M12 16.5l3.8-4.6M12 18.2a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4Z",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3.5 9h17M3.5 15h17M12 3c2.5 2.6 3.6 5.6 3.6 9s-1.1 6.4-3.6 9c-2.5-2.6-3.6-5.6-3.6-9S9.5 5.6 12 3Z",
  shield: "M12 3 19 6v6c0 4.5-3.2 7.8-7 9-3.8-1.2-7-4.5-7-9V6l7-3Z",
  link: "M10 13a5 5 0 0 0 7.1 0l2.1-2.1a5 5 0 0 0-7.1-7.1L10.8 5M14 11a5 5 0 0 0-7.1 0l-2.1 2.1a5 5 0 0 0 7.1 7.1L13.2 19"
};
const SPARK = "M12 2.5c.6 4.4 2.5 6.4 7 7-4.5.6-6.4 2.6-7 7-.6-4.4-2.5-6.4-7-7 4.5-.6 6.4-2.6 7-7Z";
const ic = (p, c = "") => p ? `<svg class="ic${c ? " " + c : ""}" viewBox="0 0 24 24" aria-hidden="true"><path d="${p}"/></svg>` : "";
const icf = (p, c = "") => p ? `<svg class="ic${c ? " " + c : ""}" viewBox="0 0 24 24" aria-hidden="true"><path class="f" d="${p}"/></svg>` : "";
const AI = `<span class="ai" title="Dérivé du terrain GPS" aria-label="Dérivé du terrain" style="display:inline-flex;align-items:center;vertical-align:-1px;margin-left:3px">${icf(SPARK, "xs")}</span>`;
const FLAGS_IT_FR = `<span class="flag-badge">IT · FR</span>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hlArt = id => {
  if (id === "hl1") return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#17402C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19 9.5 8l4 6.5L16 11l5 8H3Z"/></svg>`;
  if (id === "hl2") return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#17402C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="3,19 12,5 21,19"/><polygon points="9,19 12,12 15,19"/></svg>`;
  if (id === "hl3") return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#17402C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18c3-4 6-2 9-5s6-1 9-5"/><path d="M3 18h18"/></svg>`;
  if (id === "hl4") return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#17402C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6.5V5a3 3 0 0 1 6 0v1.5M6 10.5a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8.5ZM9.5 14h5v4h-5z"/></svg>`;
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17402C" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
};
const seg = (a, labels, sel, extra = "") => `<div class="segc" role="group" ${extra}>${labels.map((l, i) => `<button data-a="${a}" data-v="${i}" aria-pressed="${sel === i}">${l}</button>`).join("")}<span class="th" style="width:calc((100% - 4px)/${labels.length});transform:translateX(${Math.max(0, sel) * 100}%);${sel < 0 ? "opacity:0" : ""}"></span></div>`;

const STEPL = ["Identité", "Aventures", "Carnets", "Lignées", "Réglages"];
const TABS = [
  ["hub", "HUB", IC.hub],
  ["explorer", "Explorer", IC.globe],
  ["communaute", "Communauté", IC.people],
  ["messagerie", "Messages", IC.send],
  ["compte", "Compte", IC.user]
];

/* ---------- Sceau d'empreinte déterministe (FieldSeal ADR-010) ---------- */
let renderSeal = function(size = 18, density = 0.82) {
  const branches = 7, cx = size / 2, cy = size / 2, R = size / 2 - 1.5;
  let spokes = "";
  for (let i = 0; i < branches; i++) {
    const ang = 0.4 + (Math.PI * 2 / branches) * i;
    const len = R * (0.52 + 0.28 * density);
    const x1 = cx + Math.cos(ang) * (R * 0.2), y1 = cy + Math.sin(ang) * (R * 0.2);
    const x2 = cx + Math.cos(ang) * len, y2 = cy + Math.sin(ang) * len;
    spokes += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${i % 2 === 0 ? "#17402C" : "#5B7F55"}" stroke-width="1.5" stroke-linecap="round"/>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${cx}" cy="${cy}" r="${(R * 0.72).toFixed(1)}" fill="none" stroke="#5B7F55" stroke-width="1" opacity=".75"/>
    ${spokes}
    <circle cx="${cx}" cy="${cy}" r="${(R * 0.16).toFixed(1)}" fill="#17402C"/>
  </svg>`;
}

/* ---------- Illustrations SVG des tuiles Instagram (3 publications + sorties terrain) ---------- */
let tileArt = function(kind) {
  if (kind === "ca2") {
    return `<svg class="art" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="g_ca2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E4D3B"/><stop offset=".55" stop-color="#4A7C66"/><stop offset="1" stop-color="#223D33"/></linearGradient></defs>
      <rect width="120" height="120" fill="url(#g_ca2)"/>
      <circle cx="90" cy="24" r="10" fill="#F9E7B2" opacity=".88"/>
      <polygon points="0,78 34,32 68,78" fill="#2A5844"/>
      <polygon points="34,32 46,48 24,50" fill="#F4F7F3" opacity=".9"/>
      <polygon points="42,78 78,24 120,78" fill="#17402C"/>
      <polygon points="78,24 93,46 65,44" fill="#fff" opacity=".92"/>
      <rect y="76" width="120" height="44" fill="#326356" opacity=".85"/>
      <path d="M10 88 H110 M22 96 H98 M35 104 H85" stroke="rgba(255,255,255,.32)" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
  }
  if (kind === "ca1") {
    return `<svg class="art" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="g_ca1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#284E3A"/><stop offset=".6" stop-color="#6B8E62"/><stop offset="1" stop-color="#203A2B"/></linearGradient></defs>
      <rect width="120" height="120" fill="url(#g_ca1)"/>
      <polygon points="0,84 42,36 88,84" fill="#355E45"/>
      <polygon points="48,84 88,38 120,84" fill="#1F422F"/>
      <polygon points="42,82 60,56 78,82" fill="#E8C068"/>
      <polygon points="60,56 60,82 78,82" fill="#CFA144"/>
    </svg>`;
  }
  if (kind === "ca3") {
    return `<svg class="art" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="g_ca3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#264653"/><stop offset="1" stop-color="#17402C"/></linearGradient></defs>
      <rect width="120" height="120" fill="url(#g_ca3)"/>
      <polygon points="0,90 48,26 98,90" fill="#3B6E5C"/>
      <polygon points="48,26 68,54 32,54" fill="#F2F6F5"/>
      <path d="M48 54 Q60 72 42 115" fill="none" stroke="#fff" stroke-width="5" opacity=".75" stroke-linecap="round"/>
    </svg>`;
  }
  if (kind === "ca0") {
    return `<svg class="art" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="g_ca0" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1B362A"/><stop offset="1" stop-color="#4A6B49"/></linearGradient></defs>
      <rect width="120" height="120" fill="url(#g_ca0)"/>
      <circle cx="28" cy="24" r="1.5" fill="#fff"/><circle cx="72" cy="18" r="1.8" fill="#fff"/><circle cx="96" cy="30" r="1.4" fill="#fff"/>
      <path d="M0 68 L35 52 L92 48 L120 66 L120 120 L0 120 Z" fill="#2A4D39"/>
      <path d="M18 92 Q58 64 104 78" fill="none" stroke="#DCEAD7" stroke-width="2.2" stroke-dasharray="3 3"/>
    </svg>`;
  }
  if (kind === "o1") {
    return `<svg class="art" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice">
      <rect width="120" height="120" fill="#224936"/>
      <path d="M0 84 Q30 40 60 66 T120 44 L120 120 L0 120 Z" fill="#3B694E"/>
      <path d="M14 92 Q45 48 72 68 T108 36" fill="none" stroke="#fff" stroke-width="2.6" stroke-dasharray="4 4" stroke-linecap="round"/>
      <circle cx="14" cy="92" r="4" fill="#5B7F55" stroke="#fff" stroke-width="1.5"/>
      <circle cx="108" cy="36" r="4.5" fill="#17402C" stroke="#fff" stroke-width="1.5"/>
    </svg>`;
  }
  return `<svg class="art" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice">
    <rect width="120" height="120" fill="#2D5A43"/>
    <circle cx="60" cy="54" r="24" fill="rgba(255,255,255,.16)"/>
    <path d="M36 58 Q60 34 84 58 Q68 48 60 62 Q52 48 36 58 Z" fill="#fff" opacity=".9"/>
  </svg>`;
}

/* ---------- Données du Compte @tony_frc (alignées sur Supabase LKDV) ---------- */
var hlList = () => (Array.isArray(HIGHLIGHTS) ? HIGHLIGHTS : []);
let HIGHLIGHTS = [{ id: "hl5", title: "Nouveau", mass: "m1", step: 0, sub: "Ajouter un moment terrain à la une" }];
let _MOCK_HIGHLIGHTS = [
  { id: "hl1", title: "Alpes IT·FR", mass: "m2", step: 1, sub: "5 sorties · Mont-Blanc & Grand Paradis · 94 km" },
  { id: "hl2", title: "Néouvielle", mass: "m1", step: 2, sub: "Bivouac 3 jours · 2 450 m · 18 photos" },
  { id: "hl3", title: "Vercors", mass: "m3", step: 2, sub: "Traversée Hauts Plateaux · 34 km · Gypaète" },
  { id: "hl4", title: "Sac 4,8kg", mass: "m1", step: 3, sub: "Kit souche G1 · 91 % d'endurance terrain" },
  { id: "hl5", title: "Nouveau", mass: "m1", step: 0, sub: "Ajouter un moment terrain à la une" }
];

let STORY_HIGHLIGHTS = [];

let _MOCK_MASSIFS = [
  { id: "m1", name: "Hautes-Pyrénées", reg: "PYRÉNÉES", outings: 4, km: 112, dplus: 5840, x: 96, y: 174, r: 28, cacheMb: 22, cached: true },
  { id: "m2", name: "Mont-Blanc & Alpes IT·FR", reg: "ALPES · IT/FR", outings: 5, km: 94, dplus: 4920, x: 266, y: 118, r: 32, cacheMb: 14, cached: true },
  { id: "m3", name: "Hauts Plateaux du Vercors", reg: "VERCORS", outings: 3, km: 68, dplus: 2420, x: 232, y: 158, r: 24, cacheMb: 12, cached: true },
  { id: "m4", name: "Écrins", reg: "HAUTES-ALPES", outings: 2, km: 44, dplus: 2240, x: 258, y: 174, r: 18, cacheMb: 19, cached: false },
  { id: "m5", name: "Corse — Aiguilles de Bavella", reg: "CORSE (GR20)", outings: 2, km: 38, dplus: 2180, x: 280, y: 220, r: 20, cacheMb: 16, cached: true }
];
let MASSIFS = JSON.parse(JSON.stringify(_MOCK_MASSIFS));

let _MOCK_OUTINGS = [
  { id: "o1", title: "Trek des 3 Vallées, Pyrénées", mass: "Hautes-Pyrénées", date: "12–15 oct. · J-4", km: 58, dplus: 3420, maxAlt: 2640, status: "upcoming", ready: 82, comp: ["Тоny", "Léa", "Marc", "Sarah"], kit: "k1", x: 96, y: 174 },
  { id: "o2", title: "Boucle du Lac Blanc", mass: "Mont-Blanc", date: "18 sept. 2026", km: 12, dplus: 950, maxAlt: 2352, status: "done", proven: true, comp: ["Тоny", "Léa"], kit: "k4", x: 266, y: 118 },
  { id: "o3", title: "Traversée des Hauts Plateaux", mass: "Vercors", date: "29–30 août 2026", km: 34, dplus: 1600, maxAlt: 2020, status: "done", proven: true, comp: ["Тоny", "Marc", "Yanis"], kit: "k2", x: 232, y: 158 },
  { id: "o4", title: "Tour du Néouvielle", mass: "Hautes-Pyrénées", date: "11–13 août 2026", km: 41, dplus: 2380, maxAlt: 2450, status: "done", proven: true, comp: ["Тоny", "Léa", "Inès"], kit: "k1", x: 114, y: 184 },
  { id: "o5", title: "Aiguilles de Bavella (GR20)", mass: "Corse", date: "24–26 juin 2026", km: 28, dplus: 1820, maxAlt: 1660, status: "done", proven: true, comp: ["Тоny", "Marc"], kit: "k1", x: 280, y: 220 }
];
let OUTINGS = JSON.parse(JSON.stringify(_MOCK_OUTINGS));

/* Visuels de couverture des sorties : partagés par la carte et le drawer de sortie */
const OUTING_COVERS = [
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600',
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600',
  'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=600',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600',
  'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=600',
  'https://images.unsplash.com/photo-1465056836041-7f43ac27dcb5?w=600'
];

let _MOCK_CARNETS = [
  { id: "ca2", title: "Reflet du Mont-Blanc au Lac Blanc", short: "Mont-Blanc 🇮🇹🇫🇷", mass: "Haute-Savoie", massId: "m2", date: "Publié · 19 sept.", status: "pub", photos: 9, species: ["Bouquetin des Alpes"], likes: 64, views: 420, quote: "Montée avant 7 h pour le miroir parfait sans vent.", x: 292, y: 104, h: 200 },
  { id: "ca1", title: "Trois jours autour du Néouvielle", short: "Néouvielle", mass: "Hautes-Pyrénées", massId: "m1", date: "Publié · 15 août", status: "pub", photos: 18, species: ["Gentiane de Koch", "Marmotte"], likes: 48, views: 312, quote: "Lacs glacés à l'aube et granit doré au camp d'Aubert.", x: 70, y: 158, h: 165 },
  { id: "ca3", title: "Glacier Blanc & Pré de Mme Carle", short: "Écrins", mass: "Écrins", massId: "m4", date: "Publié · 14 juil.", status: "pub", photos: 15, species: ["Aigle royal", "Edelweiss"], likes: 39, views: 255, quote: "Traces de crampons sur le névé matinal.", x: 282, y: 184, h: 32 },
  { id: "ca0", title: "Traversée du Vercors, bivouac", short: "Vercors", mass: "Vercors", massId: "m3", date: "Brouillon prêt · 30 août", status: "draft", photos: 12, species: ["Gypaète barbu", "Chamois"], likes: 27, views: 180, quote: "Bivouac sous les étoiles au pas de l'Aiguille, source du km 14 à sec.", x: 204, y: 146, h: 145 }
];
let CARNETS = JSON.parse(JSON.stringify(_MOCK_CARNETS));

let _MOCK_SPECIES = [
  { id: "sp1", n: "Gypaète barbu", lat: "Gypaetus barbatus", mass: "Vercors", date: "30 août", conf: "98 %", x: 228, y: 152 },
  { id: "sp2", n: "Gentiane de Koch", lat: "Gentiana acaulis", mass: "Hautes-Pyrénées", date: "12 août", conf: "96 %", x: 102, y: 179 },
  { id: "sp3", n: "Bouquetin des Alpes", lat: "Capra ibex", mass: "Haute-Savoie", date: "18 sept.", conf: "99 %", x: 270, y: 122 },
  { id: "sp4", n: "Aigle royal", lat: "Aquila chrysaetos", mass: "Écrins", date: "14 juil.", conf: "94 %", x: 262, y: 170 },
  { id: "sp5", n: "Mouflon de Corse", lat: "Ovis gmelini musimon", mass: "Corse", date: "25 juin", conf: "97 %", x: 280, y: 220 }
];
let SPECIES = JSON.parse(JSON.stringify(_MOCK_SPECIES));

let _MOCK_KITS_LINEAGE = [
  { id: "k1", n: "Trek 3 saisons · Pyrénées", gen: "Kit souche (G1)", proven: 14, prop: 118, endur: 91, credit: 28.5, w: 6150, items: 10, desc: "Gardé par 9 voyageurs sur 10 après ≥ 1 km sur le terrain", x: 106, y: 170 },
  { id: "k2", n: "Bivouac léger · Vercors", gen: "Lignée G2 (depuis @marc.trail)", proven: 6, prop: 52, endur: 88, credit: 9.8, w: 4820, items: 7, desc: "Gardé par 9 voyageurs sur 10 · 2 forks actifs", x: 236, y: 162 },
  { id: "k4", n: "Journée montagne · Alpes 🇮🇹🇫🇷", gen: "Kit souche (G1)", proven: 5, prop: 24, endur: 94, credit: 4.2, w: 2760, items: 5, desc: "Plancher de 5 sessions atteint · éligible part créateur", x: 262, y: 114 }
];
let KITS_LINEAGE = JSON.parse(JSON.stringify(_MOCK_KITS_LINEAGE));

const INV_ITEMS = [
  { id: "p11", n: "Frontale 200 lm", b: "Petzl", c: "Sécurité", w: 80, cond: "bon", lent: "Noah", since: "2 sept.", so: 30, paid: 35, maint: null },
  { id: "p3", n: "Sac de couchage −2 °C", b: "Mammut", c: "Couchage", w: 980, cond: "usé", lent: null, so: 38, paid: 240, maint: "Gonflant réduit, lavage duvet conseillé", verdict: "essentiel" },
  { id: "p7", n: "Gourde 2 L + filtre", b: "Katadyn", c: "Eau", w: 640, cond: "bon", lent: null, so: 12, paid: 69, maint: "Cartouche à remplacer avant le trek", verdict: "essentiel" },
  { id: "p2", n: "Tente 2P Hubba", b: "MSR", c: "Couchage", w: 1720, cond: "bon", lent: null, so: 17, paid: 499, maint: null, rentOut: true, verdict: "essentiel" },
  { id: "p4", n: "Matelas R 4,2", b: "Therm-a-Rest", c: "Couchage", w: 540, cond: "bon", lent: null, so: 17, paid: 189, maint: null, verdict: "essentiel" },
  { id: "p5", n: "Veste imperméable 3L", b: "Arc'teryx", c: "Vêtements", w: 390, cond: "bon", lent: null, so: 44, paid: 320, maint: null, verdict: "essentiel" }
];

let _MOCK_ORDERS_BOOKINGS = [
  { id: "b1", kind: "booking", n: "Garden & City Cauterets Balneo", sub: "RouteStack · nuit du 11 oct. · 2 chambres", price: 188.7, status: "confirmed", prov: "RouteStack" },
  { id: "b2", kind: "booking", n: "Refuge Ledormeur", sub: "Direct refuge · nuit du 13 oct. · 4 pers.", price: 184, status: "pending", prov: "Refuge (direct)" },
  { id: "or1", kind: "order", n: "Duvet Trek 900 −11 °C + Cartouche Katadyn", sub: "Boutique LKDV · Commande #LK-4829 · crédit déduit", price: 249, status: "confirmed", prov: "Boutique LKDV" }
];
let ORDERS_BOOKINGS = JSON.parse(JSON.stringify(_MOCK_ORDERS_BOOKINGS));
let ORDERS = [
  { id: "#LK-4829", realId: "or1", d: "14 sept.", t: "Duvet Trek 900 −11 °C + Cartouche Katadyn", st: "Livrée · preuve terrain active", amt: 249 },
  { id: "#RS-9402", realId: "b1", d: "28 août", t: "Réservation Balnéo Cauterets", st: "Confirmée · bon d'accès", amt: 188.7 },
  { id: "#DIR-1029", realId: "b2", d: "10 août", t: "Nuitée Refuge Ledormeur (4 pers.)", st: "Confirmée · acompte versé", amt: 184 }
];

let _MOCK_TRIBU = [
  { id: "t1", n: "Léa", i: "L", ps: "montagne_lea", rel: "Abonnés mutuels", tr: 91, mass: "Pyrénées & Mont-Blanc", online: 1 },
  { id: "t2", n: "Marc", i: "M", ps: "marc.trail", rel: "Abonnés mutuels", tr: 86, mass: "Vercors & Écrins", online: 1 },
  { id: "t3", n: "Noah", i: "N", ps: "noah.run", rel: "Emprunte ta frontale", tr: 77, mass: "Lille & Flandres", online: 0, borrow: "p11" },
  { id: "t4", n: "Yanis", i: "Y", ps: "yanis.alpi", rel: "Abonnés mutuels", tr: 93, mass: "Mont-Blanc", online: 1 }
];
let TRIBU = JSON.parse(JSON.stringify(_MOCK_TRIBU));
let FOLLOWERS = [];
let FOLLOWING = [];

let _MOCK_CLUBS = [
  { id: "cl1", n: "Club Alpin Pyrénées", role: "Membre actif", members: 142, next: "Sortie Néouvielle · 24 oct.", joined: true },
  { id: "cl2", n: "Torino & Chamonix Alpi 🇮🇹🇫🇷", role: "Co-organisateur", members: 89, next: " Grand Paradis · 2 nov.", joined: true },
  { id: "cl3", n: "Bivouac 4 Saisons", role: "Découvrir", members: 310, next: "Traversée Vercors hiver", joined: false }
];
let CLUBS = JSON.parse(JSON.stringify(_MOCK_CLUBS));

let MONTHS_12 = [
  ["Oct.", 18, 620, "m1"], ["Nov.", 12, 340, "m3"], ["Déc.", 8, 210, "m3"],
  ["Janv.", 14, 890, "m2"], ["Févr.", 22, 1450, "m2"], ["Mars", 19, 980, "m3"],
  ["Avr.", 28, 1320, "m1"], ["Mai", 35, 1840, "m1"], ["Juin", 42, 2310, "m4"],
  ["Juil.", 44, 2240, "m4"], ["Août", 75, 3980, "m1"], ["Sept.", 24, 1240, "m2"]
];

const ORIENT_OPTS = {
  terrain: [["sentier", "Sentier"], ["montagne", "Montagne"], ["hors_sentier", "Hors sentier"], ["itinerance", "Itinérance"]],
  autonomy: [["journee", "Journée"], ["bivouac_1_2", "Bivouac 1–2 n."], ["itinerance_longue", "Itinérance longue"]],
  priority: [["legerete", "Légèreté"], ["confort", "Confort"], ["budget", "Budget"], ["securite", "Sécurité"]],
  experience: [["debut", "Débutant·e"], ["regulier", "Régulier·ère"], ["aguerri", "Aguerri·e"]]
};

const VIS_LABELS = ["Privée", "Communauté", "Publique"];
const SLOT_IDS = ["vitrine", "kit", "prets", "souvenirs", "communaute"];
const SLOT_LABELS = { vitrine: "Vitrine", kit: "Kit", prets: "Prêts", souvenirs: "Souvenirs", communaute: "Communauté" };
const slotIdOf = v => (SLOT_IDS.indexOf(v) >= 0 ? v : "vitrine");

/* Carte contexte (spec drawer 3.3) : calque de la carte du bas affiché tant
   qu'un slot du drawer Profil est ouvert.
   Les quatre calques référencés existent réellement dans `S.map` et sont lus
   par `drawMap()` : `empreinte`, `traces`, `carnets`, `lignees`. Aucun calque
   n'est inventé.
   Gaps assumés, documentés ici plutôt que maquillés :
   - `prets` → `traces` : le runtime n'a pas de calque « prêts / circulation du
     matériel » ni de tracé de circulation réelle. Le rendu `traces` est un
     tracé décoratif à coordonnées fixes (il n'exprime pas les mouvements de
     matériel) ; si `OUTINGS` est vide, `drawMap()` ne dessine rien. Aucun faux
     flux de prêts n'est fabriqué.
   - `communaute` → `lignees` : le runtime n'a pas de calque « clubs et
     événements ». On réutilise les lignées existantes ; aucun club/événement
     n'est fabriqué sur la carte.
   - `lignees` n'était dessiné que dans les vues Lignées/Kit : `drawMap()` ouvre
     aussi ce rendu en mode contexte kit/communaute, sinon le calque serait
     marqué actif sans être visible. */
const mapContextLayers = {
  vitrine: ['empreinte'],
  kit: ['lignees'],
  prets: ['traces'],
  souvenirs: ['carnets'],
  communaute: ['lignees']
};
const MAP_CONTEXT_LAYER_KEYS = ['empreinte', 'traces', 'carnets', 'lignees'];
/* Seules les clés pilotées par la carte contexte sont photographiées et
   restaurées ; les préférences hors contexte (offline, labels, contours, acc)
   ne sont jamais annulées à la fermeture du drawer. */
const MAP_LAYER_KEYS = [...MAP_CONTEXT_LAYER_KEYS];
const activeMapContextSlot = () => (S.sh && S.sh.k === "step" && S.step === 0) ? slotIdOf(S.slot) : null;
const COUNTRIES = NATIONALITY_VALUES;
const CURRENCIES = ["EUR (€)", "CHF (CHF)", "CAD ($)", "USD ($)"];

/* ---------- État réactif du Compte @tony_frc ---------- */
const S = {
  step: 0,       // 0: Identité, 1: Aventures, 2: Carnets, 3: Lignées, 4: Réglages (pour les tiroirs)
  igTab: 0,      // 0: Grille (Publications), 1: Carte/Sorties, 2: Lignées/Sac, 3: Tribu/Identifié
  visited: [0],
  sh: null,
  stk: [],
  big: false,
  mopts: false,
  popv: false,
  outdoor: false,
  glass: 0.3,
  z: 1,
  pan: [0, 0],
  focus: null,
  callout: null,
  tabMin: false,
  slot: "vitrine", // Slot actif du drawer Profil v2 (S.step === 0)
  prof: "km",
  vis: 1, // 0: Privée, 1: Communauté, 2: Publique
  /* Confidentialité du compte (`user_profiles.profile_visibility`), distincte
     de `vis`. `null` = pas encore connue : le bootstrap hôte fait foi. */
  profileVisibility: null,
  profile: {
    handle: "",
    name: "",
    followersCount: 0,
    followingCount: 0,
    followersLabel: "0",
    bioLine: "",
    avatarUrl: null,
    isGuest: false,
    isDemo: true,
    storeCreditEur: 42.50
  },
  orient: { terrain: "montagne", autonomy: "bivouac_1_2", priority: "legerete", experience: "regulier" },
  traveller: { nationality: "France", residence: "France", home: "Lyon", currency: "EUR (€)", tz: "Europe/Paris" },
  carnetFilter: 0,
  draftPublished: false,
  creditUsed: false,
  invs: JSON.parse(JSON.stringify(INV_ITEMS)),
  clubs: JSON.parse(JSON.stringify(CLUBS)),
  massifs: JSON.parse(JSON.stringify(MASSIFS)),
  sosShare: true,
  autoOffline: true,
  unitsMetric: true,
  map: { style: 0, empreinte: 1, traces: 1, carnets: 1, lignees: 1, offline: 1, labels: 1, contours: 1, acc: 1, zoomBtns: 0 }
};

const G = { fit: {}, live: false, lp: null, lpp: null, sup: 0, supEl: null, ctx: null, tap: null, sc: 1, role: null };
const U = [];
const clone = o => JSON.parse(JSON.stringify(o));
const restore = snap => { Object.keys(S).forEach(k => delete S[k]); Object.assign(S, clone(snap)); };

let derive = function() {
  const pubMassifs = (S.massifs || []).filter(m => m.outings >= 3);
  const totalOutings = OUTINGS.length;
  const totalKm = OUTINGS.reduce((s, o) => s + (Number(o.km) || 0), 0);
  const totalDplus = OUTINGS.reduce((s, o) => s + (Number(o.dplus) || 0), 0);
  const lentItem = (S.invs || []).find(p => p.lent);
  const maintItems = (S.invs || []).filter(p => p.maint && !p.mplan);
  const totalCredit = S.profile?.storeCreditEur ?? (KITS_LINEAGE.reduce((s, k) => s + (k.credit || 0), 0));
  const avgEndur = KITS_LINEAGE.length ? Math.round(KITS_LINEAGE.reduce((s, k) => s + (k.endur || 0), 0) / KITS_LINEAGE.length) : 0;
  const totalProp = KITS_LINEAGE.reduce((s, k) => s + (k.prop || 0), 0);
  const cacheMb = (S.massifs || []).filter(m => m.cached).reduce((s, m) => s + m.cacheMb, 0);
  const drafts = CARNETS.filter(c => c.status === "draft" || c.vis === "private" || c.visibility === "private");
  const pubCount = CARNETS.filter(c => c.status !== "draft" && c.vis !== "private" && c.visibility !== "private").length;
  const followingCount = S.profile?.followingCount ?? 0;
  const sigText = S.vis === 0
    ? "Empreinte privée (visible par toi seul·e)"
    : totalOutings === 0
      ? "Aucune sortie enregistrée sur le terrain"
      : totalOutings + " sorties vérifiées · " + totalKm + " km · " + totalDplus + " m D+";

  return {
    pubMassifs, totalOutings, totalKm, totalDplus, sigText,
    lentItem, maintItems, totalCredit: Math.max(0, totalCredit),
    avgEndur, totalProp, cacheMb, drafts, pubCount, followingCount
  };
}

let nextDecision = function(D) {
  if (D.lentItem) return { step: 3, t: `Récupérer : ${D.lentItem.n} (prêtée à ${D.lentItem.lent})`, a: "recover", v: D.lentItem.id };
  if (D.drafts.length) return { step: 2, t: `Publier la 4e publication : ${D.drafts[0].title}`, a: "pubdraft", v: "ca0" };
  if (D.maintItems.length) return { step: 3, t: `Planifier l'entretien : ${D.maintItems[0].n}`, a: "maint", v: D.maintItems[0].id };
  if (D.totalCredit > 0) return { step: 3, t: `Utiliser ${fmtE(D.totalCredit)} de part créateur sur ton sac`, a: "usecredit", v: "1" };
  return null;
}

/* La confidentialité du compte vit à la fois sur `S.profileVisibility`
   (source exacte lue par le pont) et dans `S.profile` (compatibilité des
   consommateurs historiques). Les deux restent toujours alignés. */
let setProfileVisibility = function(value) {
  S.profileVisibility = value;
  if (!S.profile || typeof S.profile !== "object") S.profile = {};
  S.profile.profileVisibility = value;
};

const MUT = {
  vis: v => { S.vis = +v; return "Empreinte @tony_frc : " + VIS_LABELS[+v]; },
  /* Confidentialité du compte : valeur exacte, aucune conversion d'index.
     Le pont `__lkdvOnMutate` persiste `user_profiles.profile_visibility`. */
  profilevis: v => {
    const target = resolveProfileVis(v);
    if (target == null) return null;
    setProfileVisibility(target);
    return "Confidentialité du compte : " + (target === "prive" ? "Privé (sur invitation)" : "Public");
  },
  orient: v => { const [k, val] = v.split(":"); S.orient[k] = val; const lbl = (ORIENT_OPTS[k].find(x => x[0] === val) || [0, val])[1]; return "Pratique : " + lbl; },
  home: v => { S.traveller.home = v; return "Domicile : " + v + " (gardé à 1 km près)"; },
  nat: v => { S.traveller.nationality = v; return "Nationalité : " + v; },
  /* Nationalité exacte à choix unique : `nats` reste un singleton aligné sur
     `traveller.nationality` et `profile.nationality`. `nat` (multi-sélection
     historique) n'est jamais modifié ici. */
  setnat: v => {
    const plan = applySetNationality({
      nats: S.traveller.nats,
      nationality: S.traveller.nationality,
      profileNationality: S.profile && S.profile.nationality,
    }, v);
    if (!plan) return null;
    S.traveller.nats = [plan.value];
    S.traveller.nationality = plan.value;
    if (!S.profile || typeof S.profile !== "object") S.profile = {};
    S.profile.nationality = plan.value;
    return "Nationalité : " + plan.value;
  },
  curr: v => { S.traveller.currency = v; return "Devise : " + v; },
  recover: v => { const p = S.invs.find(x => x.id === v); if (!p || !p.lent) return null; const who = p.lent; p.lent = null; return p.n + " récupérée auprès de " + who; },
  maint: v => { const p = S.invs.find(x => x.id === v); if (!p) return null; p.mplan = !p.mplan; return p.mplan ? "Rappel d'entretien activé : " + p.n : "Rappel retiré : " + p.n; },
  rentout: v => { const p = S.invs.find(x => x.id === v); if (!p) return null; p.rentOut = !p.rentOut; return p.rentOut ? p.n + " proposée en location" : p.n + " retirée de la location"; },
  cond: v => { const [id, c] = v.split("|"); const p = S.invs.find(x => x.id === id); if (!p) return null; p.cond = c; return p.n + " : état " + c; },
  pubdraft: () => { S.draftPublished = !S.draftPublished; return S.draftPublished ? "4e publication en ligne : Traversée du Vercors" : "Publication remise en brouillon (3 publications)"; },
  usecredit: () => { S.creditUsed = !S.creditUsed; return S.creditUsed ? "42,50 € de part créateur appliqués au panier" : "Crédit boutique rétabli (42,50 €)"; },
  club: v => { const c = S.clubs.find(x => x.id === v); if (!c) return null; c.joined = !c.joined; return (c.joined ? "Rejoint : " : "Quitté : ") + c.n; },
  cache: v => { const m = S.massifs.find(x => x.id === v); if (!m) return null; m.cached = !m.cached; return (m.cached ? "Téléchargé hors-ligne : " : "Cache libéré : ") + m.name + " (" + m.cacheMb + " Mo)"; },
  sos: () => { S.sosShare = !S.sosShare; return S.sosShare ? "Partage SOS en sortie activé" : "Partage SOS désactivé"; },
  autooff: () => { S.autoOffline = !S.autoOffline; return S.autoOffline ? "Pré-téléchargement hors-ligne actif" : "Pré-téléchargement coupé"; },
  units: v => { S.unitsMetric = +v === 0; return "Unités : " + (S.unitsMetric ? "Métriques (km, m, °C)" : "Impériales (mi, ft, °F)"); }
};

let diffAccount = function(a, b) {
  const parts = [];
  if (a.sigText !== b.sigText) parts.push(VIS_LABELS[S.vis]);
  if (a.pubCount !== b.pubCount) parts.push(`${b.pubCount} publications`);
  if (a.totalCredit !== b.totalCredit) parts.push(`Crédit ${fmtE(b.totalCredit)}`);
  if (a.cacheMb !== b.cacheMb) parts.push(`Hors-ligne ${b.cacheMb} Mo`);
  if (Boolean(a.lentItem) !== Boolean(b.lentItem)) parts.push(b.lentItem ? "1 prêt en cours" : "Inventaire complet");
  return parts.slice(0, 3).join(" · ");
}

let doMut = function(a, v, meta) {
  if (!MUT[a]) return;
  const b0 = derive(), snap = clone(S);
  const lab = MUT[a](v);
  if (!lab) return;
  const changed = JSON.stringify(snap) !== JSON.stringify(S);
  /* `profilevis` n'entre jamais dans la pile : annuler le runtime sans
     réécrire `profile_visibility` en base afficherait un état faux. */
  const undoable = canUndoMutation(a, changed);
  if (undoable) { U.push(snap); if (U.length > 40) U.shift(); }
  const b1 = derive();
  island(lab, changed ? diffAccount(b0, b1) : "", undoable);
  haptic(changed ? 10 : [8, 40, 8]);
  /* Une mutation lancée depuis le drawer React ne doit pas reconstruire le
     portail : l'écran garde son état de persistance en vol. */
  if (meta && meta.preserveSlot) refreshWithoutSheet(true);
  else refresh(true);
}

let undo = function() {
  if (!U.length) { island("Rien à annuler", "", false); return; }
  const b0 = derive();
  const keep = { step: S.step, igTab: S.igTab, sh: S.sh, stk: S.stk, big: S.big, mopts: S.mopts, popv: S.popv, outdoor: S.outdoor, glass: S.glass, z: S.z, pan: S.pan, profileVisibility: S.profileVisibility };
  restore(U.pop());
  Object.assign(S, keep);
  /* Pas d'undo pour `profilevis` : la confidentialité du compte reste la
     valeur persistée, même quand on annule une autre mutation. */
  if (S.profile && (S.profileVisibility === "public" || S.profileVisibility === "prive")) {
    S.profile.profileVisibility = S.profileVisibility;
  } else if (S.profile) {
    delete S.profile.profileVisibility;
  }
  const b1 = derive();
  island("Annulé", diffAccount(b0, b1), false);
  haptic(12);
  applyShell();
  refresh(true);
  applyGlass();
}

let whatIf = function(a, v) {
  if (!MUT[a]) return;
  const snap = clone(S), b0 = derive();
  let lab = null;
  try { lab = MUT[a](v); } catch (e) {}
  const b1 = derive(), same = JSON.stringify(snap) === JSON.stringify(S);
  restore(snap);
  const rows = [
    ["Visibilité @" + ((S.profile && S.profile.handle) || 'moi'), VIS_LABELS[snap.vis], VIS_LABELS[a === "vis" ? +v : snap.vis]],
    ["Publications", String(b0.pubCount), String(b1.pubCount)],
    ["Crédit part créateur", fmtE(b0.totalCredit), fmtE(b1.totalCredit)],
    ["Stockage hors-ligne", b0.cacheMb + " Mo", b1.cacheMb + " Mo"]
  ];
  $("ctx").innerHTML = `<div class="box"><div class="lg pv"><b>${same ? "État actuel" : "Si tu valides"} · ${lab || "—"}</b>${rows.map(r => {
    const ch = r[1] !== r[2];
    return `<div class="ef" style="${ch ? "" : "opacity:.48"}"><span>${r[0]}</span><span style="color:${ch ? "var(--good)" : "inherit"}">${ch ? r[1] + " → " + r[2] : r[1]}</span></div>`;
  }).join("")}</div>
  <div class="lg menu">${same ? "" : `<button class="p" data-a="ctxok">Valider</button>`}<button data-a="ctxno">Fermer</button></div></div>`;
  G.ctx = { a, v };
  $("ctx").classList.add("on");
  haptic(15);
}

/* ---------- Dynamic Island ---------- */
let isT = null;
let island = function(t, sub, undoable) {
  if (!isCurrent()) return;
  $("isn").innerHTML = `<div class="t"><b>${t}</b>${sub ? `<span>${sub}</span>` : ""}</div>${undoable ? `<button data-a="undo" aria-label="Annuler">Annuler</button>` : ""}`;
  $("island").dataset.s = "note";
  let sr = $("live-status");
  if (!sr && $("phone")) {
    sr = document.createElement("div");
    sr.id = "live-status";
    sr.className = "sr-only";
    sr.setAttribute("role", "status");
    sr.setAttribute("aria-live", "polite");
    sr.setAttribute("aria-atomic", "true");
    $("phone").appendChild(sr);
  }
  if (sr) sr.textContent = t + (sub ? " — " + sub : "");
  clearTimeout(isT);
  isT = setTimeout(islandRest, 3800);
}
let islandRest = function() {
  if (!isCurrent()) return; $("island").dataset.s = G.live ? "live" : "idle"; }
let islandNext = function() {
  if (!isCurrent()) return;
  const D = derive(), N = nextDecision(D);
  if (!N) { island("Tout est à jour", "Empreinte @tony_frc, inventaire et hors-ligne synchronisés", false); return; }
  $("isn").innerHTML = `<div class="t"><b>${N.t}</b><span>Prochaine action · ${STEPL[N.step]}</span></div><button data-a="nextgo">Appliquer</button>`;
  $("island").dataset.s = "note";
  clearTimeout(isT);
  isT = setTimeout(islandRest, 5500);
  haptic(8);
}

/* ---------- Carte d'Empreinte & d'Aventures (Zone basse) ---------- */
const MSTYLE = [
  { bg: ["#EEF1E6", "#E2EAD8", "#D5E1CC"], ct: "rgba(91,127,85,", wa: "#8EC0D6", fo: "rgba(120,160,110,.22)", route: "#17402C", cas: "#fff", lab: "rgba(23,43,36,.58)" },
  { bg: ["#F7F5EF", "#F1EEE6", "#E9E6DC"], ct: "rgba(130,120,100,", wa: "#A9D0E0", fo: "rgba(150,170,130,.14)", route: "#17402C", cas: "#fff", lab: "rgba(23,43,36,.5)" },
  { bg: ["#2f4637", "#3a5443", "#1f2e25"], ct: "rgba(228,224,214,", wa: "#6fa3b8", fo: "rgba(40,70,50,.4)", route: "#F4F3ED", cas: "rgba(10,16,12,.78)", lab: "rgba(244,243,237,.65)" }
];

const mapT = () => `translate(${S.pan[0].toFixed(1)}px,${S.pan[1].toFixed(1)}px) scale(${S.z.toFixed(3)})`;

let focusPos = function(f) {
  if (!f) return null;
  if (f.k === "m") { const m = S.massifs.find(x => x.id === f.id); return m ? [m.x, m.y] : null; }
  if (f.k === "o") { const o = OUTINGS.find(x => x.id === f.id); return o ? [o.x, o.y] : null; }
  if (f.k === "ca") { const c = CARNETS.find(x => x.id === f.id); return c ? [c.x, c.y] : null; }
  if (f.k === "k") { const k = KITS_LINEAGE.find(x => x.id === f.id); return k ? [k.x, k.y] : null; }
  return null;
}

let drawMap = function() {
  const st = MSTYLE[S.map.style], M = S.map;
  let g = `<defs>
    <radialGradient id="hs"><stop offset="0" stop-color="#fff" stop-opacity="${M.style === 2 ? .12 : .48}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="emp"><stop offset="0" stop-color="#5B7F55" stop-opacity=".38"/><stop offset=".65" stop-color="#5B7F55" stop-opacity=".14"/><stop offset="1" stop-color="#5B7F55" stop-opacity="0"/></radialGradient>
    <linearGradient id="gt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${st.bg[0]}"/><stop offset=".55" stop-color="${st.bg[1]}"/><stop offset="1" stop-color="${st.bg[2]}"/></linearGradient>
  </defs>
  <rect x="-400" y="-400" width="1170" height="1120" fill="url(#gt)"/>`;

  g += `<g class="tmg" id="tmg" style="transform-origin:185px 150px;transform:${mapT()}">`;
  g += `<ellipse cx="105" cy="178" rx="95" ry="42" fill="${st.fo}"/><ellipse cx="255" cy="145" rx="98" ry="56" fill="${st.fo}"/>`;
  g += `<path d="M-10 218 C70 190 140 210 210 176 S310 148 380 182" fill="none" stroke="${st.wa}" stroke-width="3.2" stroke-linecap="round"/>`;

  S.massifs.forEach((m, idx) => {
    if (!Number.isFinite(m.x) || !Number.isFinite(m.y) || !Number.isFinite(m.r)) return;
    g += `<circle cx="${m.x}" cy="${m.y}" r="${m.r * 2.1}" fill="url(#hs)"/>`;
    if (M.contours) {
      for (let r = 1; r <= 4; r++) {
        let d = "";
        for (let k = 0; k <= 36; k++) {
          const t = (k / 36) * Math.PI * 2;
          const rad = r * (m.r * 0.42) * (1 + 0.12 * Math.sin(3 * t + idx) + 0.07 * Math.cos(5 * t));
          d += (k ? "L" : "M") + (m.x + rad * 1.25 * Math.cos(t)).toFixed(1) + " " + (m.y + rad * Math.sin(t)).toFixed(1);
        }
        g += `<path d="${d}Z" fill="none" stroke="${st.ct}${r === 3 ? .38 : .18})" stroke-width="${r === 3 ? 1 : .6}"/>`;
      }
    }
  });

  if (M.traces && OUTINGS.length > 0) {
    g += `<path d="M96 174 Q165 130 232 158 T266 118" fill="none" stroke="${st.cas}" stroke-width="5" stroke-linecap="round" opacity=".65"/>`;
    g += `<path d="M96 174 Q165 130 232 158 T266 118" fill="none" stroke="${st.route}" stroke-width="2.4" stroke-dasharray="4 5" stroke-linecap="round" opacity=".75"/>`;
  }

  if (M.offline) {
    S.massifs.filter(m => m.cached && Number.isFinite(m.x) && Number.isFinite(m.y)).forEach(m => {
      g += `<g transform="translate(${m.x},${m.y})" data-pin="m:${m.id}" style="cursor:pointer">
        <rect x="${-m.r - 8}" y="${-m.r + 2}" width="${(m.r + 8) * 2}" height="${(m.r - 2) * 2}" rx="10" fill="none" stroke="#3D7A52" stroke-width="1.3" stroke-dasharray="3 3" opacity=".75"/>
      </g>`;
    });
  }

  if (M.empreinte) {
    S.massifs.forEach(m => {
      if (!Number.isFinite(m.x) || !Number.isFinite(m.y) || !Number.isFinite(m.r)) return;
      const visible = (S.vis === 0 || m.outings >= 3) && m.outings > 0;
      if (!visible) return;
      g += `<g transform="translate(${m.x},${m.y})" data-pin="m:${m.id}" style="cursor:pointer">
        <circle r="${m.r * 1.25}" fill="url(#emp)"/>
        <circle r="11" fill="#17402C" stroke="#fff" stroke-width="2"/>
        <text y="3.5" text-anchor="middle" font-family="-apple-system,Inter,sans-serif" font-weight="700" font-size="9.5" fill="#fff">${m.outings}</text>
      </g>`;
    });
  }

  if (M.labels) {
    S.massifs.forEach(m => {
      if (!Number.isFinite(m.x) || !Number.isFinite(m.y) || !Number.isFinite(m.r)) return;
      g += `<text x="${m.x}" y="${m.y - m.r - 4}" text-anchor="middle" font-family="-apple-system,Inter,sans-serif" font-size="8" font-weight="700" fill="${st.lab}" letter-spacing=".5">${m.reg}</text>`;
    });
  }

  if (M.carnets) {
    CARNETS.forEach(c => {
      if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) return;
      const isDraft = c.status === "draft" && !(c.id === "ca0" && S.draftPublished);
      g += `<g transform="translate(${c.x},${c.y})" data-pin="ca:${c.id}" style="cursor:pointer">
        <circle r="14" fill="transparent"/>
        <rect x="-8.5" y="-8.5" width="17" height="17" rx="5" fill="${isDraft ? "#FBF1DC" : "#fff"}" stroke="${isDraft ? "#B98A2E" : "#17402C"}" stroke-width="1.5"/>
        <text y="3.5" text-anchor="middle" font-family="-apple-system,Inter,sans-serif" font-weight="800" font-size="9" fill="${isDraft ? "#8a6418" : "#17402C"}">C</text>
      </g>`;
    });
  }

  const ctxSlot = activeMapContextSlot();
  const ctxWantsLignees = !!(ctxSlot && (mapContextLayers[ctxSlot] || []).indexOf("lignees") >= 0);
  if (M.lignees && (S.igTab === 2 || S.step === 3 || S.sh?.k === "kit" || ctxWantsLignees)) {
    KITS_LINEAGE.forEach(k => {
      if (!Number.isFinite(k.x) || !Number.isFinite(k.y)) return;
      g += `<g transform="translate(${k.x + 14},${k.y - 12})" data-pin="k:${k.id}" style="cursor:pointer">
        <circle r="9" fill="#5B7F55" stroke="#fff" stroke-width="1.8"/>
        <text y="3.3" text-anchor="middle" font-family="-apple-system,Inter,sans-serif" font-weight="700" font-size="8.5" fill="#fff">${k.proven}</text>
      </g>`;
    });
  }

  const fp = focusPos(S.focus);
  if (fp) {
    g += `<circle class="focusring" cx="${fp[0]}" cy="${fp[1]}" r="15" fill="none" stroke="#5B7F55" stroke-width="3"/><circle cx="${fp[0]}" cy="${fp[1]}" r="16" fill="none" stroke="#5B7F55" stroke-width="2"/>`;
  }
  g += `<g id="dot" transform="translate(-60,-60)"><circle r="12" fill="#17402C" fill-opacity=".22"/><circle r="6" fill="#fff" stroke="#17402C" stroke-width="2.4"/></g></g>`;
  const tmEl = $("tm"); if (tmEl) tmEl.innerHTML = g;
  $("map").style.background = st.bg[0];
}

let setT = function() { const t = $("tmg"); if (t) t.style.transform = mapT(); }
let zoomAt = function(f, px, py) {
  const z0 = S.z, z1 = clamp(z0 * f, 1, 3.2);
  if (z1 === z0) return;
  const ox = 185, oy = 150, mx = px != null ? px : ox, my = py != null ? py : oy;
  S.pan = [S.pan[0] + (mx - ox - S.pan[0]) * (1 - z1 / z0), S.pan[1] + (my - oy - S.pan[1]) * (1 - z1 / z0)];
  S.z = z1;
  if (S.z <= 1.01) { S.z = 1; S.pan = [0, 0]; }
  setT();
  renderMctl();
}
let centerOn = function(p) {
  if (!p) return;
  if (S.z < 1.35) S.z = 1.45;
  S.pan = [-S.z * (p[0] - 185), 112 - 150 - S.z * (p[1] - 150)];
  setT();
}

let renderMctl = function() {
  if (!$("mctl")) return;
  $("mctl").innerHTML = `<button data-a="mopts" aria-label="Personnaliser la carte d'empreinte" aria-expanded="${S.mopts}">${ic(IC.layers, "s")}</button><button data-a="recenter" aria-label="Recentrer">${ic(IC.pin, "s")}</button><button data-a="zoom" data-v="1" aria-label="Zoom avant">${ic(IC.plus, "s")}</button><button data-a="zoom" data-v="-1" aria-label="Zoom arrière">${ic(IC.minus, "s")}</button>`;
}

let renderMopts = function() {
  const M = S.map, p = $("mopts");
  p.classList.toggle("on", !!S.mopts);
  p.classList.toggle("up", !!S.big);
  const T = (k, l) => `<button class="mt" role="switch" aria-checked="${!!M[k]}" data-a="mset" data-v="${k}"><span>${l}</span></button>`;
  const n = Object.keys(M).filter(k => k !== "style" && M[k]).length;
  p.innerHTML = `<div class="mo-h"><b>Carte d'empreinte</b><span class="sub">${n} calques actifs</span></div>${seg("mstyle", ["Relief", "Clair", "Satellite"], M.style)}<div class="mgrid">${T("empreinte", "Empreinte")}${T("traces", "Sorties")}${T("carnets", "Carnets")}${T("lignees", "Lignées")}${T("offline", "Hors-ligne")}${T("labels", "Massifs")}${T("contours", "Courbes")}${T("acc", "Chrono")}<button class="mt" role="switch" aria-checked="${S.big}" data-a="mapbig"><span>${S.big ? 'Réduire' : 'Agrandir'}</span></button></div><div class="mo-f"><button class="lnk" data-a="mmin">Carte nue</button><button class="lnk" data-a="mall">Tout afficher</button></div>`;
}

let renderCallout = function() {
  if (!$("callout")) return;
  const el = $("callout"), c = S.callout;
  if (!c || S.sh) { el.hidden = true; return; }
  const x_ = `<button class="ib" data-a="co-x" aria-label="Fermer" style="font-weight:700;font-size:13px">×</button>`;
  let h = "";
  if (c.k === "m") {
    const m = S.massifs.find(q => q.id === c.id);
    if (!m) { el.hidden = true; return; }
    h = `<b>${m.name} · ${m.outings} sorties</b><div class="ca"><button class="ib ${m.cached ? "" : "p"}" data-a="cache" data-v="${m.id}" data-sim="1" aria-label="Hors-ligne">${ic(m.cached ? IC.check : IC.plus, "xs")}</button>${x_}</div><div class="s2">${m.km} km · D+ ${m.dplus.toLocaleString("fr-FR")} m · ${m.cached ? "Hors-ligne (" + m.cacheMb + " Mo)" : "Non téléchargé"}</div>`;
  } else if (c.k === "ca") {
    const ca = CARNETS.find(q => q.id === c.id);
    if (!ca) { el.hidden = true; return; }
    const isDraft = ca.status === "draft" && !(ca.id === "ca0" && S.draftPublished);
    h = `<b>${ca.title}</b><div class="ca"><button class="ib p" data-a="openCarnet" data-v="${ca.id}" aria-label="Ouvrir le carnet">${ic(IC.book, "xs")}</button>${x_}</div><div class="s2">${ca.mass} · ${isDraft ? "Brouillon prêt à publier" : "♥ " + ca.likes + " · " + ca.views + " lectures"}</div>`;
  } else if (c.k === "k") {
    const k = KITS_LINEAGE.find(q => q.id === c.id);
    if (!k) { el.hidden = true; return; }
    h = `<b>${k.n}</b><div class="ca"><button class="ib p" data-a="openKit" data-v="${k.id}" aria-label="Voir la lignée">${ic(IC.pack, "xs")}</button>${x_}</div><div class="s2">${k.proven} preuves terrain · endurance ${k.endur} % · +${fmtE(k.credit)}</div>`;
  }
  el.innerHTML = h;
  el.hidden = false;
}

/* ---------- Barre accessoire (Chronologie 12 mois / Endurance kits) + Tabbar ---------- */
let renderAcc = function() {
  if (!$("acc")) return;
  const byKm = S.prof === "km";
  const vals = byKm ? MONTHS_12.map(m => m[1]) : [82, 84, 85, 86, 88, 87, 89, 90, 91, 90, 92, 91];
  const mn = Math.min(...vals), mx = Math.max(...vals), W = 200, H = 28;
  const x = i => (i * W) / (vals.length - 1);
  const y = v => H - 2 - ((v - mn) / ((mx - mn) || 1)) * (H - 6);
  const p = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const D = derive();
  $("acc").innerHTML = `<button class="ab" data-a="profmode" aria-label="${byKm ? "Voir l'endurance des kits" : "Voir les km par mois"}" style="font-weight:700;font-size:11px;color:#17402C">${byKm ? "KM" : "%"}</button>
  <div class="ro"><b id="ro1">${byKm ? D.totalKm + " km" : D.avgEndur + " %"}</b><span id="ro2">${byKm ? "12 derniers mois" : "endurance kits"}</span></div>
  <svg class="spk" id="spk" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="slider" aria-label="Chronologie des 12 derniers mois" tabindex="0"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5B7F55" stop-opacity=".4"/><stop offset="1" stop-color="#5B7F55" stop-opacity="0"/></linearGradient></defs><path d="${p}L${W} ${H}L0 ${H}Z" fill="url(#sg)"/><path d="${p}" fill="none" stroke="#17402C" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round"/><line id="sl" x1="-9" x2="-9" y1="0" y2="${H}" stroke="#17402C" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>`;
}

let scrub = function(clientX) {
  const el = $("spk");
  if (!el) return;
  const r = el.getBoundingClientRect(), n = MONTHS_12.length;
  const t = clamp((clientX - r.left) / r.width, 0, 1), i = Math.round(t * (n - 1));
  const m = MONTHS_12[i], mass = S.massifs.find(q => q.id === m[3]);
  const dot = $("dot");
  if (dot && mass) dot.setAttribute("transform", `translate(${mass.x},${mass.y})`);
  $("sl").setAttribute("x1", t * 200);
  $("sl").setAttribute("x2", t * 200);
  if (S.prof === "km") {
    $("ro1").textContent = m[1] + " km · " + m[2] + " m";
    $("ro2").textContent = m[0] + " · " + (mass ? mass.name.split(" ")[0] : "");
  } else {
    const endV = [82, 84, 85, 86, 88, 87, 89, 90, 91, 90, 92, 91][i];
    $("ro1").textContent = endV + " % gardés";
    $("ro2").textContent = m[0] + " · preuve terrain";
  }
}

let renderTB = function() {
  $("tb").innerHTML = `<span class="lens" id="lens" style="transform:translateX(400%)"></span>${TABS.map((t, i) => `<button data-a="ttab" data-v="${i}" class="${i === 4 ? "on" : ""}" aria-label="${t[1]}" ${i === 4 ? 'aria-current="page"' : ""}>${t[2] ? ic(t[2]) : ""}<span>${t[1]}</span></button>`).join("")}`;
}

/* ---------- Lentille réfractive Liquid Glass ---------- */
const NS = "http://www.w3.org/2000/svg", LENS = { on: /Chrome\//.test(navigator.userAgent), made: {} };
let lensMap = function(w, h, r, bz) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d"), im = x.createImageData(w, h), D = im.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const px = i + .5 - w / 2, py = j + .5 - h / 2, qx = Math.abs(px) - (w / 2 - r), qy = Math.abs(py) - (h / 2 - r);
    const d = -(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r);
    let nx = 0, ny = 0, m = 0;
    if (d >= 0 && d < bz) {
      if (qx > 0 && qy > 0) { const L = Math.hypot(qx, qy) || 1; nx = Math.sign(px) * qx / L; ny = Math.sign(py) * qy / L; }
      else if (qx > qy) nx = Math.sign(px); else ny = Math.sign(py);
      const t = 1 - d / bz; m = t * t * (3 - 2 * t);
    }
    const k = (j * w + i) * 4;
    D[k] = 128 - nx * m * 127; D[k + 1] = 128 - ny * m * 127; D[k + 2] = 128; D[k + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  return c.toDataURL();
}
let lensFilter = function(w, h, r, bz, sc) {
  const id = `lf${w}x${h}r${r}`;
  if (LENS.made[id]) return id;
  let defs = $("lensdefs");
  if (!defs) {
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("width", "0"); s.setAttribute("height", "0"); s.setAttribute("aria-hidden", "true"); s.style.position = "absolute";
    s.innerHTML = '<defs id="lensdefs"></defs>';
    document.body.appendChild(s);
    defs = $("lensdefs");
  }
  const f = document.createElementNS(NS, "filter");
  f.id = id; f.setAttribute("x", "0"); f.setAttribute("y", "0"); f.setAttribute("width", w); f.setAttribute("height", h);
  f.setAttribute("filterUnits", "userSpaceOnUse"); f.setAttribute("color-interpolation-filters", "sRGB");
  f.innerHTML = `<feImage href="${lensMap(w, h, r, bz)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="m"/><feDisplacementMap in="SourceGraphic" in2="m" scale="${sc}" xChannelSelector="R" yChannelSelector="G"/>`;
  defs.appendChild(f); LENS.made[id] = 1; return id;
}
let lensAll = function() {
  if (!LENS.on) return;
  const ph = $("phone");
  if (!ph) return;
  const gb = parseFloat(getComputedStyle(ph).getPropertyValue("--gb"));
  document.querySelectorAll("#phone .tb,#phone .ig-handle,#phone .acc,#phone .gbtn,#phone .mctl,#phone .callout,#phone .ig-tabs,#phone .map-scale-selector,#phone .sheet .flow,#phone .sheet .segc,#phone .sheet .reseau-toggle,#phone .sheet .ig-sub").forEach(el => {
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h || w > 420) {
      el.style.removeProperty("backdrop-filter");
      el.style.removeProperty("-webkit-backdrop-filter");
      el.classList.remove("lens-on");
      return;
    }
    const r = Math.round(Math.min(h / 2, parseFloat(getComputedStyle(el).borderTopLeftRadius) || h / 2));
    const id = lensFilter(w, h, r, Math.max(6, Math.min(16, Math.round(h * .34))), Math.round(Math.min(30, h * .55)));
    const lensValue = `url(#${id}) blur(${(gb * .55 || 3).toFixed(1)}px) saturate(1.9) brightness(1.07)`;
    el.style.setProperty("backdrop-filter", lensValue, "important");
    el.style.setProperty("-webkit-backdrop-filter", lensValue, "important");
    el.classList.add("lens-on");
  });
}
const lensSoon = () => { cancelAnimationFrame(G.lr); G.lr = requestAnimationFrame(lensAll); };

/* ---------- Contenu de la zone d'onglets Instagram (@tony_frc) ---------- */
let renderIgTabContent = function(D) {
  /* Onglet 0 : Grille 3 colonnes Instagram (3 publications + brouillon IA + sortie J-4 + herbier IA) */
  if (S.igTab === 0) {
    const isDraft = !S.draftPublished;
    const tiles = [
      { id: "ca2", focus: "ca:ca2", top: "Alpes IT·FR", bot: "Lac Blanc", stat: "♥ 64", multi: true },
      { id: "ca1", focus: "ca:ca1", top: "Pyrénées", bot: "Néouvielle", stat: "♥ 48", multi: true },
      { id: "ca3", focus: "ca:ca3", top: "Écrins", bot: "Glacier Blanc", stat: "♥ 39", multi: true },
      { id: "ca0", focus: "ca:ca0", top: isDraft ? "Brouillon IA" : "Vercors", draft: isDraft, bot: "Hauts Plateaux", stat: isDraft ? "Publier" : "♥ 27", multi: true, act: isDraft ? "pubdraft" : "openCarnet" },
      { id: "o1", focus: "m:m1", top: "Compas J-4", bot: "3 Vallées", stat: "58 km", multi: false, act: "openOuting" },
      { id: "sp1", focus: "m:m3", top: "Herbier IA", bot: "4 espèces", stat: "98 %", multi: false, act: "openSpecies" }
    ];
    return `<div class="ig-grid" role="region" aria-label="Grille des publications">${tiles.map(t => `
      <button class="ig-tile" data-a="${t.act || "openCarnet"}" data-v="${t.id}" data-focus="${t.focus}" ${t.act === "pubdraft" ? 'data-sim="1"' : ""} aria-label="${esc(t.bot)} · ${esc(t.top)}">
        ${tileArt(t.id)}
        <div class="t-top">
          <span class="t-pill ${t.draft ? "draft" : ""}">${esc(t.top)}</span>
          ${t.multi ? `<span class="t-ic">${ic(IC.carousel, "xs")}</span>` : ""}
        </div>
        <div class="t-bot">
          <b>${esc(t.bot)}</b>
          <small>${t.stat}</small>
        </div>
      </button>`).join("")}
    </div>`;
  }

  /* Onglet 1 : Carte & Sorties GPS vérifiées */
  if (S.igTab === 1) {
    const up = OUTINGS[0];
    return `<div class="ig-alt" role="region" aria-label="Sorties GPS et Empreinte terrain">
      <div class="kpis">
        <button class="kpi" data-a="openStep" data-v="1:0"><b class="num">${D.totalOutings}</b><small>Sorties GPS</small></button>
        <button class="kpi" data-a="openStep" data-v="1:0"><b class="num">${D.totalKm} km</b><small>Cette année</small></button>
        <button class="kpi" data-a="openStep" data-v="1:0"><b class="num">13,4 k</b><small>D+ cumulé</small></button>
        <button class="kpi" data-a="openStep" data-v="0:2"><b class="num">${D.pubMassifs.length}</b><small>Massifs ≥ 3</small></button>
      </div>
      <div class="oc" data-focus="m:m1" style="margin-bottom:0;padding:7px 9px">
        <div class="oc-img" style="--h:145;width:36px;height:36px">${ic(IC.route)}</div>
        <div style="min-width:0">
          <div class="oc-t"><b>${up.title}</b></div>
          <div class="oc-s">${up.date} · ${up.km} km · D+ ${up.dplus.toLocaleString("fr-FR")} m</div>
        </div>
        <div class="oc-r"><button class="mbtn p" data-a="openOuting" data-v="o1">Ouvrir</button></div>
      </div>
      <div class="sumline" style="padding:5px 9px">
        <span><b>Carte d'empreinte</b> · ${D.cacheMb} Mo hors-ligne prêts</span>
        <button class="lnk" data-a="mapbig" style="padding:0">Plein écran →</button>
      </div>
    </div>`;
  }

  /* Onglet 2 : Lignées de kits & Sac (Propagation, Endurance, Part créateur) */
  if (S.igTab === 2) {
    return `<div class="ig-alt" role="region" aria-label="Lignées de kits et Part créateur">
      <div class="axes2">
        <div class="axis-box">
          <div class="ah"><span>Propagation</span><b class="num">${D.totalProp}</b></div>
          <div class="bar"><i style="width:82%;background:#5B7F55"></i></div>
          <small>Reprises de tes kits souches</small>
        </div>
        <div class="axis-box">
          <div class="ah"><span>Endurance</span><b class="num">${D.avgEndur} %</b></div>
          <div class="bar"><i style="width:${D.avgEndur}%;background:#3D7A52"></i></div>
          <small>Gardés après ≥ 1 km GPS</small>
        </div>
      </div>
      <button class="credit-pill" data-a="openStep" data-v="3:1">
        <div>
          <div class="hl" style="font-size:12.5px;color:var(--tint)">Part créateur · Crédit boutique</div>
          <small>300 bps (70/20/10) · 18 objets dans ton sac</small>
        </div>
        <div style="text-align:right">
          <b class="num">${fmtE(D.totalCredit)}</b>
          <small>${S.creditUsed ? "appliqué" : "disponible"}</small>
        </div>
      </button>
    </div>`;
  }

  /* Onglet 3 : Identifié & Tribu (1 080 followers · 339 suivi(e)s · prêts matériel) */
  return `<div class="ig-alt" role="region" aria-label="Tribu, Clubs et Matériel prêté">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
      ${TRIBU.slice(0, 2).map(t => `<button class="kpi" data-a="openFollowers" style="text-align:left;padding:6px 8px">
        <div class="row" style="justify-content:space-between"><b style="font-size:12.5px">@${t.ps}</b><span class="tg confirmed">91 %</span></div>
        <small>${t.mass}</small>
      </button>`).join("")}
    </div>
    <div class="sumline" style="padding:6px 9px">
      <span>${D.lentItem ? `<b>Prêt actif</b> · ${D.lentItem.n} à ${D.lentItem.lent}` : "<b>Inventaire complet</b> · aucun prêt en cours"}</span>
      ${D.lentItem ? `<button class="mbtn p" data-a="recover" data-v="${D.lentItem.id}" data-sim="1">Récupérer</button>` : `<button class="lnk" data-a="openFollowers" style="padding:0">Voir la tribu →</button>`}
    </div>
  </div>`;
}

let card = function() {
  const D = derive();
  const shortSig = S.vis === 0
    ? "Empreinte privée (toi seul·e)"
    : "quatorze sorties, cinq saisons · Pyrénées, Mont-Blanc, Vercors";
  const avatarUrl = (S.profile && S.profile.avatarUrl) || '';
  const aviImg = avatarUrl
    ? `<img src="${avatarUrl}" alt="Photo de profil">`
    : `<span style="font:700 22px var(--sf);color:#17402C">…</span>`;

  return `
  <!-- Barre des 2 onglets (Grille | Sorties) — Style Capsule Bottom Bar Haut Droite -->
  <div class="ig-tabs" role="tablist" aria-label="Contenus du profil">
    <span class="ig-th lens" style="transform:translateX(${S.igTab * 100}%)"></span>
    <button role="tab" aria-selected="${S.igTab === 0}" data-a="igtab" data-v="0" aria-label="Grille des publications"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></button>
    <button role="tab" aria-selected="${S.igTab === 1}" data-a="igtab" data-v="1" aria-label="Sorties et voyages faits"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg></button>
  </div>

  <!-- En-tête Instagram (identité hydratée) -->
  <div class="ig-header">
    <div class="ig-left">
      <button class="ig-avi-wrap" data-a="openStep" data-v="0:2" aria-label="Avatar et Sceau d'empreinte du profil">
        <span class="ig-avi-in">${aviImg}</span>
        <span class="ig-seal-bdg" title="Sceau d'empreinte déterministe (ADR-010)">${renderSeal(16, 0.85)}</span>
      </button>
    </div>
    <div class="ig-right">
      <div class="ig-stats" role="group" aria-label="Statistiques du profil">
        <button class="ig-stat" data-a="igtab" data-v="0" aria-label="${D.pubCount} publications">
          <b class="num">${D.pubCount}</b>
          <span>publications</span>
        </button>
        <button class="ig-stat" data-a="openFollowers" aria-label="${S.profile.followersLabel || 0} followers">
          <b class="num">${S.profile.followersLabel || 0}</b>
          <span>followers</span>
        </button>
        <button class="ig-stat" data-a="openFollowing" aria-label="${S.profile.followingCount || 0} suivi(e)s">
          <b class="num">${S.profile.followingCount || 0}</b>
          <span>suivi(e)s</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Bio Instagram @tony_frc : 🇮🇹🇫🇷 + Empreinte GPS + Lignée -->
  <div class="ig-bio">
    <div class="ig-bio-flags">${FLAGS_IT_FR} <span>${S.profile.bioLine || 'Chargement du profil…'}</span></div>
    <div class="ig-bio-emp" title="Calculée uniquement depuis tes sorties GPS vérifiées"><i></i><span>${shortSig}</span></div>
    <button class="ig-bio-link" data-a="openStep" data-v="3:0"><span>kitduvoyageur.fr/${S.profile.handle || '…'} · ${D.totalProp} reprises · +${fmtE(D.totalCredit)}</span></button>
  </div>

  <!-- Stories À la une (Highlights Instagram) -->
  <div class="ig-hl-row" role="region" aria-label="Stories à la une">
    ${HIGHLIGHTS.map(h => `<button class="ig-hl" data-a="openHighlight" data-v="${h.id}" aria-label="Story à la une ${h.title}">
      <span class="ig-hl-ring"><span class="ig-hl-in">${hlArt(h.id)}</span></span>
      <span>${h.title}</span>
    </button>`).join("")}
  </div>

  <!-- Contenu de l'onglet actif (Grille 3x2 par défaut) -->
  ${renderIgTabContent(D)}
  `;
}

let renderTop = function() {
  if (!isCurrent()) return;
  const D = derive(), N = nextDecision(D), ns = N ? N.step : null;
  G.next = N;
  $("phone").classList.toggle("hasnext", ns != null);
  $("top").innerHTML = `<div class="ig-top">
    <button class="lg ig-handle rp" id="rpvis" data-a="vismenu" aria-haspopup="menu" aria-label="Profil · Visibilité : ${VIS_LABELS[S.vis]}">
      <span>${S.profile.handle || '…'}</span>
    </button>
    <div class="ig-top-r">
      <button class="lg gbtn" data-a="openCreate" aria-label="Créer dans l'application">${ic(IC.plus, "s")}</button>
      <button class="lg gbtn" data-a="popv" aria-label="Affichage : mode extérieur et intensité du verre" aria-expanded="${S.popv}">${ic(IC.sun, "s")}</button>
      <button class="lg gbtn" data-a="openDrawer" aria-label="Menu Commandes, Notifications et Paramètres">${ic(IC.sliders, "s")}</button>
    </div>
  </div>
  <button class="cs mini" data-a="mapbig" aria-label="Réduire la carte et revenir au profil">
    <b>${S.profile.name || 'Chargement…'} · @${S.profile.handle || '…'} <span class="flag-badge">IT · FR</span> ${AI}</b>
    <span>${D.sigText}</span>
  </button>
  <div class="card cs" id="card">${card()}</div>`;
}

/* ---------- Feuilles linéaires à 3 hauteurs (peek / medium / large) ---------- */
const note = t => `<div class="note">${t}</div>`;
const swRow = (t, s, on, a, v) => `<div class="li nt"><div style="min-width:0"><div class="ttl"><span>${t}</span></div><div class="s2">${s}</div></div><button class="sw" role="switch" aria-checked="${!!on}" aria-label="${t}" data-a="${a}" data-v="${v || ""}" data-sim="1"></button></div>`;

let listHead = function(title, pg, pages) {
  return `<div class="lh"><span class="cap">${title}</span>${pages > 1 ? `<span class="pg"><button data-a="pg" data-v="-1" ${pg === 0 ? "disabled" : ""} aria-label="Page précédente" style="font-weight:700;font-size:13px">‹</button>${pg + 1} / ${pages}<button data-a="pg" data-v="1" ${pg >= pages - 1 ? "disabled" : ""} aria-label="Page suivante" style="font-weight:700;font-size:13px">›</button></span>` : ""}</div>`;
}

let defs = function() {
  const sh = S.sh, D = derive();
  const P = S.profile || { handle: 'visiteur', name: 'Voyageur invité' };
  const hName = P.handle && P.handle !== 'visiteur' ? '@' + P.handle : '';

  if (sh.k === "share") {
    return {
      title: "Partager " + (hName || "mon profil"),
      peek: "kitduvoyageur.fr/u/" + (P.handle || 'visiteur'),
      flow: [
        { l: "Profil", r: () => ({
          per: [3, 5],
          title: "Carte de profil & Sceau d'empreinte vérifié",
          rows: [
            `<div class="li nt"><div style="min-width:0"><div class="ttl"><span>${P.name || 'Voyageur'} (${hName || '@visiteur'})</span><span class="tg confirmed">Vérifié GPS</span></div><div class="s2">${D.pubCount} publication${D.pubCount > 1 ? 's' : ''} · ${(P.followersCount || 0)} followers · ${(P.followingCount || 0)} suivi(e)s</div></div>${renderSeal(28, 0.85)}</div>`,
            `<div class="li nt"><div style="min-width:0"><div class="ttl"><span>Lien LKDV</span></div><div class="s2">https://kitduvoyageur.fr/u/${P.handle || 'visiteur'}</div></div><button class="mbtn p" data-a="copylink">Copier</button></div>`,
            note("Ton lien de partage n'expose que les massifs où tu comptes au moins 3 sorties vérifiées (k-anonymat ADR-010).")
          ]
        })}
      ]
    };
  }

  if (sh.k === "item") {
    const p = (S.invs || []).find(x => x.id === sh.id) || (S.invs || [])[0];
    if (!p) {
      return {
        title: "Équipement",
        peek: "Aucun objet",
        flow: [{ l: "Fiche", r: () => ({ per: [2, 4], rows: [`<div class="note">Aucun équipement sélectionné.</div>`] }) }]
      };
    }
    return {
      title: p.n,
      peek: `${p.b} · ${kgs(p.w)} · ${p.cond}`,
      flow: [
        { l: "Fiche", r: () => ({ per: [3, 5], rows: [
          `<div class="phero"><span class="pth xl" style="--h:150;--bgc:#DDEBD8">${ic(IC.pack)}</span><div><div class="pbr"><span>${p.b}</span></div><div class="pnx">${p.n}</div><div class="row" style="gap:5px;margin-top:6px"><span class="cd ${p.cond === "bon" ? "g" : "o"}">${p.cond}</span><span class="tg">${p.c}</span>${p.lent ? `<span class="pbad o">Prêté à ${p.lent}</span>` : ""}</div></div></div>`,
          `<div class="sgrid"><div><small>Poids</small><b>${kgs(p.w)}</b></div><div><small>Prix payé</small><b>${fmtE(p.paid)}</b></div><div><small>Sorties GPS</small><b>${p.so} sorties</b></div><div><small>Coût / sortie</small><b>${p.so ? fmtE(Math.round((p.paid / p.so) * 10) / 10) : '—'}</b></div></div>`,
          note(p.maint ? `Entretien recommandé : ${p.maint}.` : "Aucune alerte d'usure sur cet équipement.")
        ]})},
        { l: "Actions", r: () => ({ per: [4, 6], rows: [
          p.lent ? `<div class="menu2 one"><button class="mi" data-a="recover" data-v="${p.id}" data-sim="1"><span>Marquer comme récupéré auprès de ${p.lent}</span></button></div>` : "",
          p.maint ? `<div class="menu2 one"><div class="mi"><span>Rappel d'entretien (${p.maint})</span><button class="sw" role="switch" aria-checked="${!!p.mplan}" data-a="maint" data-v="${p.id}" data-sim="1"></button></div></div>` : "",
          `<div class="menu2 one"><div class="mi"><span>Proposer en location à la tribu</span><button class="sw" role="switch" aria-checked="${!!p.rentOut}" data-a="rentout" data-v="${p.id}" data-sim="1"></button></div></div>`,
          `<div class="menu2 one"><div class="mi col"><div class="row"><span>État de l'objet</span></div><div class="chips">${["neuf", "bon", "usé", "à remplacer"].map(c => `<button class="chip" data-a="cond" data-v="${p.id}|${c}" data-sim="1" aria-pressed="${p.cond === c}">${c}</button>`).join("")}</div></div></div>`
        ].filter(Boolean)})}
      ]
    };
  }

  // 0. Tiroir IDENTITÉ
  if (S.step === 0) {
    return {
      title: hName ? ("Profil " + hName) : "Profil personnel",
      peek: `${P.name || 'Voyageur'} · ${VIS_LABELS[S.vis]} · ${D.totalOutings} sorties`,
      flow: [
        { l: "Pratique", r: () => ({
          per: [2, 4],
          head: `<div class="sumline" style="margin-bottom:8px"><span><b>Profil d'allure</b> · 4,2 km/h</span><span class="tg confirmed">Optimisé Compas</span></div>`,
          title: "Modifier le profil · Comment tu marches ? (privé)",
          rows: [
            `<div class="cap" style="margin-bottom:4px">Terrain principal</div><div class="chips">${ORIENT_OPTS.terrain.map(([k, l]) => `<button class="chip" data-a="orient" data-v="terrain:${k}" data-sim="1" aria-pressed="${S.orient.terrain === k}">${l}</button>`).join("")}</div>
             <div class="cap" style="margin:9px 0 4px">Autonomie dehors</div><div class="chips">${ORIENT_OPTS.autonomy.map(([k, l]) => `<button class="chip" data-a="orient" data-v="autonomy:${k}" data-sim="1" aria-pressed="${S.orient.autonomy === k}">${l}</button>`).join("")}</div>`,
            `<div class="cap" style="margin-bottom:4px">Priorité dans le sac</div><div class="chips">${ORIENT_OPTS.priority.map(([k, l]) => `<button class="chip" data-a="orient" data-v="priority:${k}" data-sim="1" aria-pressed="${S.orient.priority === k}">${l}</button>`).join("")}</div>
             <div class="cap" style="margin:9px 0 4px">Habitude</div><div class="chips">${ORIENT_OPTS.experience.map(([k, l]) => `<button class="chip" data-a="orient" data-v="experience:${k}" data-sim="1" aria-pressed="${S.orient.experience === k}">${l}</button>`).join("")}</div>`,
            note("ADR-010 : ces 4 réponses factuelles ne sont jamais affichées publiquement. Elles pré-remplissent le Compas.")
          ]
        })},
        { l: "Voyageur", r: () => ({
          per: [3, 5],
          head: `<div class="sumline" style="margin-bottom:8px"><span><b>Identité voyageur</b> · @${P.handle || 'visiteur'}</span><span class="tg confirmed">RLS Active</span></div>`,
          title: "Ce que le Compas sait de toi (privé, RLS stricte)",
          rows: [
            `<div class="cap" style="margin-bottom:4px">Nationalité (formalités & visas)</div><div class="chips">${COUNTRIES.map(c => `<button class="chip" data-a="nat" data-v="${c}" data-sim="1" aria-pressed="${S.traveller.nationality === c}">${c}</button>`).join("")}</div>`,
            `<div class="cap" style="margin-bottom:4px">Ville de départ habituelle (gardée à 1 km près)</div><div class="chips">${["Lyon", "Paris", "Annecy", "Turin", "Lille", "Chamonix"].map(h => `<button class="chip" data-a="home" data-v="${h}" data-sim="1" aria-pressed="${S.traveller.home === h}">${h}</button>`).join("")}</div>`,
            `<div class="cap" style="margin-bottom:4px">Devise d'affichage du budget</div><div class="chips">${CURRENCIES.map(c => `<button class="chip" data-a="curr" data-v="${c}" data-sim="1" aria-pressed="${S.traveller.currency === c}">${c}</button>`).join("")}</div>`,
            note("Lot Z1 : ni ta nationalité ni ton domicile ne sont jamais envoyés à l'IA ni révélés aux autres membres.")
          ]
        })},
        { l: "Empreinte", r: () => ({
          per: [3, 6],
          head: `<div class="sumline" style="margin-bottom:6px"><span><b>Trace globale</b> · ${D.totalKm} km vérifiés</span><span class="tg confirmed">D+ ${D.totalDplus.toLocaleString("fr-FR")} m</span></div><div style="margin-bottom:6px">${seg("vis", VIS_LABELS, S.vis, 'data-simseg="1"')}</div>`,
          title: "100 % dérivée de tes sorties GPS (plancher 3 sorties)",
          rows: (S.massifs.length ? (S.massifs.filter(m => m.outings > 0).length ? S.massifs.filter(m => m.outings > 0) : S.massifs).map(m => `<div class="li nt" data-focus="m:${m.id}"><div><div class="ttl"><span>${m.name}</span>${m.outings >= 3 ? '<span class="tg confirmed">Public ≥ 3</span>' : '<span class="tg">Sous plancher (privé)</span>'}</div><div class="s2">${m.outings} sorties · ${m.km} km · D+ ${m.dplus.toLocaleString("fr-FR")} m</div></div><b class="num">${m.outings}</b></div>`) : [`<div style="padding:20px 14px;text-align:center;color:var(--label2);font:400 12px/1.4 var(--sf);">Aucun massif rattaché à vos sorties pour le moment.</div>`]).concat([
            note("Aucun grade, aucun rang, aucun classement entre membres. Le sceau se densifie uniquement avec tes kilomètres réels.")
          ])
        })},
        { l: "Cordée", r: () => ({
          per: [1, 1],
          head: `<div class="sumline" style="margin-bottom:8px"><span><b>Cordée</b> · ${FOLLOWERS.length} abonnés</span><span class="tg confirmed">${FOLLOWING.length} suivis</span></div>`,
          title: "Cordée & Membres de confiance",
          rows: (TRIBU.length ? TRIBU.map(t => `<div class="li" style="cursor:pointer"><span class="avi" data-a="openUserProfile" data-v="${t.ps}">${t.i}${t.online ? '<i class="on"></i>' : ""}</span><div style="min-width:0" data-a="openUserProfile" data-v="${t.ps}"><div class="ttl"><span>${t.n}</span><span class="sub">@${t.ps}</span></div><div class="s2">${t.rel} · confiance ${t.tr} · ${t.mass}</div></div>${t.borrow ? `<button class="mbtn p" data-a="recover" data-v="${t.borrow}" data-sim="1">Récupérer</button>` : `<span class="tg p">Suivi</span>`}</div>`) : [`<div style="padding:22px 14px;text-align:center"><b style="font:600 14px var(--sf);color:var(--label);display:block;margin-bottom:4px;">Aucun compagnon dans votre tribu</b><p style="font:400 12px/1.4 var(--sf);color:var(--label2);max-width:240px;margin:0 auto 10px;">Rejoignez des clubs ou invitez d'autres randonneurs pour partager vos sorties et votre matériel.</p><a href="/communaute" class="mbtn p" style="text-decoration:none;display:inline-block;height:30px;padding:0 14px;font-size:12px;">Découvrir la communauté</a></div>`]).concat(
            (CLUBS.length ? CLUBS : S.clubs).filter(c => c.members > 0).map(c => `<div class="li nt"><div><div class="ttl"><span>${c.n}</span></div><div class="s2">${c.members} membres · ${c.next}</div></div><button class="mbtn ${c.joined ? "soft" : "p"}" data-a="club" data-v="${c.id}" data-sim="1">${c.joined ? "Membre" : "Rejoindre"}</button></div>`)
          )
        })},
        { l: "Vie privée", r: () => ({
          per: [3, 5],
          head: `<div class="sumline" style="margin-bottom:8px"><span><b>Protection active</b> · Chiffrement local</span><span class="tg confirmed">RGPD Art. 20</span></div>`,
          title: "Contrôles RGPD & Transparence",
          rows: [
            `<div class="li nt"><div><div class="ttl"><span>Coordonnées GPS dans les publications</span></div><div class="s2">Toujours tronquées au massif (jamais de trace brute publique)</div></div><span class="tg confirmed">Verrouillé</span></div>`,
            `<div class="li nt"><div><div class="ttl"><span>Documents d'identité (passeport, visa)</span></div><div class="s2">Inaccessibles aux invités et exclus de tous les exports</div></div><span class="tg confirmed">Isolé RLS</span></div>`,
            `<div class="li nt"><div><div class="ttl"><span>Exporter toutes mes données (JSON + GPX)</span></div><div class="s2">Archive complète conforme art. 20 RGPD</div></div><button class="mbtn p" data-a="export" data-v="full">Exporter</button></div>`,
            P.isGuest
              ? `<div class="menu2 one" style="margin-top:6px"><a href="/connexion" class="mi p" style="text-decoration:none"><span>Se connecter avec un compte LKDV</span></a></div>`
              : `<div class="menu2 one" style="margin-top:6px"><button class="mi bad" data-a="signout"><span>Se déconnecter de @${P.handle}</span></button></div>`
          ]
        })}
      ]
    };
  }

  // 1. Tiroir AVENTURES
  if (S.step === 1) {
    return {
      title: "Sorties & Voyages",
      peek: `${D.totalOutings} sortie${D.totalOutings > 1 ? 's' : ''} vérifiée${D.totalOutings > 1 ? 's' : ''} · ${D.totalKm} km`,
      flow: [
        { l: "Parcours", r: () => ({
          per: [3, 6],
          title: hName ? ("Sorties GPS de " + hName) : "Sorties GPS & Préparations",
          rows: OUTINGS.length ? OUTINGS.map(o => `<div class="oc" data-focus="m:${o.mass === 'Mont-Blanc' ? 'm2' : o.mass === 'Vercors' ? 'm3' : 'm1'}">
            <div class="oc-img" style="--h:${o.status === 'upcoming' ? 145 : 195}">${ic(IC.route)}</div>
            <div style="min-width:0">
              <div class="oc-t"><b>${o.title}</b></div>
              <div class="oc-s">${o.date} · ${o.km} km · D+ ${o.dplus.toLocaleString("fr-FR")} m</div>
              <div class="oc-c"><span class="st ${o.status === 'upcoming' ? 'pending' : 'confirmed'}">${o.status === "upcoming" ? "Prêt " + (o.ready || 100) + " %" : "Preuve GPS ✓"}</span><span>${(o.comp || []).join(", ")}</span></div>
            </div>
            <div class="oc-r"><b>${o.maxAlt} m</b><small>alt. max</small></div>
          </div>`) : [
            `<div style="padding:28px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;"><b style="font:600 14px var(--sf);color:var(--label);">Aucune sortie enregistrée</b><p style="font:400 12px/1.4 var(--sf);color:var(--label2);max-width:240px;margin:0 auto;">Vos traces GPX, dénivelés et statistiques de saison apparaîtront dès votre premier voyage validé.</p><a href="/compas" class="mbtn p" style="text-decoration:none;height:30px;padding:0 14px;font-size:12px;">Planifier un voyage</a></div>`
          ]
        })},
        { l: "Météo", r: () => ({
          per: [2, 4],
          title: "Saisons & Régularité (12 derniers mois)",
          rows: OUTINGS.length ? [
            `<div class="wx">${[["Automne", "38 km", "Sec"],["Hiver", "Neige", "Froid"],["Printemps", "Doux", "Vert"],["Été", "Haute alt.", "Sec"]].map(w => `<div><b>${w[0]}</b>${w[1]}<br>${w[2]}</div>`).join("")}</div>`,
            note("Chaque sortie d'au moins 1 km enregistrée au GPS incrémente automatiquement la preuve terrain des objets de ton kit.")
          ] : [
            `<div style="padding:20px 14px;text-align:center;color:var(--label2);font:400 12px/1.4 var(--sf);">Enregistrez vos premières sorties en montagne pour débloquer l'analyse de régularité par saison.</div>`,
            note("Chaque sortie d'au moins 1 km enregistrée au GPS incrémente automatiquement la preuve terrain des objets de ton kit.")
          ]
        })}
      ]
    };
  }

  // 2. Tiroir PUBLICATIONS & CARNETS
  if (S.step === 2) {
    return {
      title: "Publications & Carnets",
      peek: `${D.pubCount} publication${D.pubCount > 1 ? 's' : ''} · ${SPECIES.length} espèces identifiées`,
      flow: [
        { l: "Mes choix", r: () => ({
          per: [3, 6],
          title: hName ? ("Publications & récits de " + hName) : "Publications & récits d'expédition",
          rows: CARNETS.length ? CARNETS.map(c => {
            const isDraft = c.status === "draft";
            return `<div class="oc" data-focus="ca:${c.id}">
              <div class="oc-img" style="--h:${c.h || 180}">${ic(IC.book)}</div>
              <div style="min-width:0">
                <div class="oc-t"><b>${esc(c.title)}</b></div>
                <div class="oc-s">« ${c.quote || 'Carnet de voyage'} »</div>
                <div class="oc-c"><span class="st ${isDraft ? "pending" : "confirmed"}">${isDraft ? "Brouillon IA" : "Publié"}</span><span>${c.photos || 0} photos</span><span>${c.mass || ''}</span></div>
              </div>
              <div class="oc-r">${isDraft ? `<button class="mbtn p" data-a="pubdraft" data-v="${c.id}">Publier</button>` : `<b>♥ ${c.likes || 0}</b><small>${c.views || 0} vues</small>`}</div>
            </div>`;
          }) : [
            `<div style="padding:28px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;"><b style="font:600 14px var(--sf);color:var(--label);">Aucun carnet publié</b><p style="font:400 12px/1.4 var(--sf);color:var(--label2);max-width:240px;margin:0 auto;">Racontez vos aventures en montagne, partagez vos photos et vos traces GPS vérifiées.</p><a href="/carnets/nouveau" class="mbtn p" style="text-decoration:none;height:30px;padding:0 14px;font-size:12px;">+ Rédiger un carnet</a></div>`
          ]
        })},
        { l: "Sources", r: () => ({
          per: [4, 6],
          title: SPECIES.length ? "Espèces identifiées en sortie (IA + validation)" : "Herbier & Espèces",
          rows: SPECIES.length ? SPECIES.map(sp => `<div class="li nt"><div><div class="ttl"><span>${sp.n}</span><span class="sub" style="font-style:italic">${sp.lat}</span></div><div class="s2">${sp.mass} · ${sp.date} · fiabilité ${sp.conf}</div></div><span class="tg confirmed">Herbier</span></div>`) : [
            `<div style="padding:20px 14px;text-align:center;color:var(--label2);font:400 12px/1.4 var(--sf);">Aucune espèce répertoriée dans votre herbier pour le moment. Identifiez la flore et la faune lors de vos sorties.</div>`
          ]
        })}
      ]
    };
  }

  // 3. Tiroir LIGNÉES & INVENTAIRE (5 onglets complets)
  if (S.step === 3) {
    return {
      title: "Lignées & Inventaire",
      peek: `${KITS_LINEAGE.length} kit${KITS_LINEAGE.length > 1 ? 's' : ''} · ${D.totalProp} reprises · +${fmtE(D.totalCredit)}`,
      flow: [
        {
          l: "Mes Kits",
          r: () => ({
            per: [5, 8],
            title: "Mes Kits & Lignées (ADR-008)",
            rows: [
              `<div class="sumline" style="margin-bottom:8px">
                <span>Total <b>${D.totalProp} reprises</b></span>
                <span>Part créateur <b class="num" style="color:var(--good)">+${fmtE(D.totalCredit)}</b></span>
                <span>Endurance moy. <b>${D.avgEndur} %</b></span>
              </div>`,
              ...(KITS_LINEAGE.length ? KITS_LINEAGE.map(k => `
                <div class="oc" data-focus="k:${k.id}">
                  <div class="oc-img" style="--h:150">${ic(IC.pack)}</div>
                  <div style="min-width:0">
                    <div class="oc-t"><b>${k.n}</b></div>
                    <div class="oc-s">${k.gen}${k.desc ? ' · ' + k.desc : ''}</div>
                    <div class="oc-c">
                      <span class="st confirmed">${k.items} objets</span>
                      <span>${k.prop} reprises</span>
                      <span>${k.proven} sorties GPS</span>
                    </div>
                  </div>
                  <div class="oc-r">
                    <b style="color:var(--good)">+${fmtE(k.credit)}</b>
                    <small>${kgs(k.w)}</small>
                  </div>
                </div>
              `) : [`<div style="padding:24px 14px;text-align:center;color:var(--label2);font:400 12px/1.4 var(--sf);">Aucun kit enregistré sur votre compte.</div>`]),
              `<div class="tree-box" style="padding:10px 12px;border-radius:16px;background:rgba(255,255,255,0.6);box-shadow:inset 0 1px 0 rgba(255,255,255,0.95),0 1px 4px rgba(23,43,36,0.06);margin-top:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                  <b style="font:600 12.5px var(--sf);color:var(--label);">Arbre de filiation des kits</b>
                  <span class="tg confirmed">${D.totalProp} reprises</span>
                </div>
                <div style="font:400 11.5px/1.4 var(--sf);color:var(--label2);">
                  ${KITS_LINEAGE.length ? KITS_LINEAGE.map(k => `<b>${k.n}</b> · ${k.gen} · ${k.prop} reprises`).join('<br>') : 'Aucune filiation disponible.'}
                </div>
              </div>`
            ]
          })
        },
        {
          l: "Inventaire",
          r: () => {
            const items = Array.isArray(S.invs) ? S.invs : [];
            const total = items.reduce((sum, item) => sum + (Number(item.w) || 0), 0);
            const groups = items.reduce((acc, item) => {
              const cat = item.c || 'Autre';
              (acc[cat] = acc[cat] || []).push(item);
              return acc;
            }, {});
            return {
              per: [6, 12],
              title: "Inventaire matériel réel",
              rows: [
                `<div class="sumline" style="margin-bottom:8px">
                  <span>${items.length} objet${items.length > 1 ? 's' : ''} <b class="num">${kgs(total)}</b></span>
                  <span class="tg p">Poids réel</span>
                </div>`,
                ...(items.length ? Object.entries(groups).map(([cat, list]) => `
                  <div class="inv-category-group" style="margin-bottom:10px;">
                    <div style="font:700 12px var(--sf);color:var(--tint);letter-spacing:0.03em;margin-bottom:4px;display:flex;align-items:center;gap:6px;">
                      <span>${cat}</span>
                    </div>
                    ${list.map(it => `
                      <div class="li nt" style="min-height:38px;padding:4px 2px;">
                        <div style="min-width:0">
                          <div class="ttl"><span>${it.n}</span></div>
                          <div class="s2">${it.b || ''}${it.b ? ' · ' : ''}${it.w} g · <span class="tg ${it.lent ? 'pending' : 'confirmed'}" style="font-size:9.5px;padding:1px 6px;">${it.lent ? 'Prêté à ' + it.lent : (it.cond || 'Disponible')}</span></div>
                        </div>
                        <b class="num" style="font-size:13px;color:var(--label);">${it.w} g</b>
                      </div>
                    `).join('')}
                  </div>
                `) : [`<div style="padding:24px 14px;text-align:center;color:var(--label2);font:400 12px/1.4 var(--sf);">Aucun matériel enregistré sur votre compte.</div>`])
              ]
            };
          }
        },
        {
          l: "Prêts",
          r: () => {
            const lent = (Array.isArray(S.invs) ? S.invs : []).filter(item => item.lent);
            return {
              per: [4, 6],
              title: "Prêts en cours",
              rows: lent.length ? lent.map(item => `
                <div class="oc">
                  <div class="oc-img" style="--h:150">${ic(IC.pack)}</div>
                  <div style="min-width:0">
                    <div class="oc-t"><b>${item.n}</b></div>
                    <div class="oc-s">Prêté à <b>${item.lent}</b></div>
                    <div class="oc-c"><span class="st pending">En prêt</span><span>${item.w} g</span></div>
                  </div>
                  <div class="oc-r"><button class="mbtn p" style="height:26px;font-size:11px;padding:0 10px;" data-a="recover" data-v="${item.id}">Récupérer</button></div>
                </div>
              `) : [`<div style="padding:24px 14px;text-align:center;color:var(--label2);font:400 12px/1.4 var(--sf);">Aucun prêt en cours.</div>`]
            };
          }
        },
        {
          l: "Fidélité",
          r: () => {
            const pts = Number((S.profile && S.profile.loyaltyPoints) || 0);
            return {
              per: [4, 6],
              title: "Programme fidélité",
              rows: [
                `<div class="sumline" style="margin-bottom:8px"><span>Solde actuel <b class="num" style="color:var(--tint);font-size:16px;">${pts.toLocaleString('fr-FR')} pts</b></span></div>`,
                pts > 0
                  ? `<div class="li nt"><div><div class="ttl"><span>Points disponibles</span></div><div class="s2">Utilisables selon les avantages du programme.</div></div><span class="tg confirmed">${pts.toLocaleString('fr-FR')} pts</span></div>`
                  : `<div style="padding:24px 14px;text-align:center;color:var(--label2);font:400 12px/1.4 var(--sf);">Aucun point fidélité pour le moment. Vos points apparaîtront après vos commandes et sorties éligibles.</div>`,
                `<div class="li nt"><div><div class="ttl"><span>Avantages</span></div><div class="s2">Les paliers et récompenses disponibles s’afficheront ici.</div></div></div>`
              ]
            };
          }
        },
        {
          l: "Parrainage",
          r: () => {
            const handle = (S.profile && S.profile.handle) || 'voyageur';
            const code = handle.toUpperCase().replace(/[^A-Z0-9]/g, '-');
            const credit = Number((S.profile && S.profile.storeCreditEur) || 0);
            return {
              per: [4, 6],
              title: "Parrainage",
              rows: [
                `<div class="ref-card" style="padding:14px;border-radius:18px;background:linear-gradient(135deg,rgba(235,242,236,0.9),rgba(255,255,255,0.8));border:1px solid rgba(91,127,85,0.3);box-shadow:0 4px 14px rgba(23,64,44,0.08);margin-bottom:8px;">
                  <small style="font:600 11px var(--sf);color:var(--label2);text-transform:uppercase;letter-spacing:0.05em;">Votre code de parrainage</small>
                  <div style="display:flex;align-items:center;justify-content:space-between;margin:8px 0;gap:8px;">
                    <b style="font:700 18px monospace;color:#17402C;letter-spacing:0.06em;">${code}</b>
                    <button class="mbtn p" data-a="copyReferral" style="height:32px;font-size:12px;padding:0 14px;">Copier</button>
                  </div>
                  <div style="font:400 11.5px/1.35 var(--sf);color:var(--label2);">Partagez ce code avec vos proches.</div>
                </div>`,
                `<div class="sumline" style="margin-bottom:8px"><span>Crédit boutique <b class="num" style="color:var(--good);font-size:15px;">${fmtE(credit)}</b></span></div>`,
                credit > 0
                  ? `<button class="mbtn soft" style="width:100%;height:36px;justify-content:center;font-size:13px;" data-a="usecredit">Utiliser mon crédit boutique</button>`
                  : `<div style="padding:16px 14px;text-align:center;color:var(--label2);font:400 12px/1.4 var(--sf);">Aucun crédit de parrainage disponible.</div>`
              ]
            };
          }
        }
      ]
    };
  }

  // 4. Tiroir RÉGLAGES : Commandes → Hors-ligne → Sécurité SOS → Unités → RGPD
  if (S.step === 4) {
    return {
      title: "Réglages & Sécurité",
      peek: `${ORDERS_BOOKINGS.length} commandes · ${D.cacheMb} Mo hors-ligne`,
      flow: [
        { l: "Offres", r: () => ({
          per: [3, 5],
          title: "Commandes boutique & réservations",
          rows: ORDERS_BOOKINGS.length ? ORDERS_BOOKINGS.map(o => `<div class="oc">
            <div class="oc-img" style="--h:150">${ic(o.kind === 'order' ? IC.bag : IC.ticket)}</div>
            <div style="min-width:0">
              <div class="oc-t"><b>${o.n}</b></div>
              <div class="oc-s">${o.sub}</div>
              <div class="oc-c"><span class="st ${o.status === 'confirmed' ? 'confirmed' : 'pending'}">${o.status === 'confirmed' ? 'Confirmé' : 'En attente'}</span><span>${o.prov}</span></div>
            </div>
            <div class="oc-r"><b>${fmtE(o.price)}</b></div>
          </div>`) : [
            `<div style="padding:28px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;"><div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.7);display:grid;place-items:center;color:#17402C">${ic(IC.bag, "s")}</div><b style="font:600 14px var(--sf);color:var(--label);">Aucune commande passée</b><p style="font:400 12.5px/1.4 var(--sf);color:var(--label2);max-width:240px;margin:0 auto;">Vos commandes d'équipement et réservations d'hébergements apparaîtront ici.</p><a href="/boutique" class="mbtn p" style="text-decoration:none;height:30px;padding:0 14px;font-size:12px;">Visiter la boutique</a></div>`
          ]
        })},
        { l: "Sources", r: () => ({
          per: [3, 5],
          title: `Cartes & Tuiles hors-ligne (${D.cacheMb} Mo)`,
          rows: (S.massifs || []).map(m => swRow(`${m.name} (${m.cacheMb} Mo)`, `Topographie + points d'eau + refuges · ${m.outings} sorties`, m.cached, "cache", m.id))
        })},
        { l: "Veille", r: () => ({
          per: [3, 5],
          title: "Centre de sécurité & Contacts SOS",
          rows: [
            swRow("Partage de position en sortie active", "Envoie votre trace en direct à vos proches dès le départ", S.sosShare, "sos", "1"),
            `<div class="li nt"><div><div class="ttl"><span>Secours en montagne (Europe)</span></div><div class="s2">112 · SMS d'urgence avec coordonnées GPS hors-ligne</div></div><span class="tg confirmed">Prêt</span></div>`,
            `<div class="li nt"><div><div class="ttl"><span>Contact d'urgence SOS</span></div><div class="s2">Alerte automatique si retard après l'heure d'arrivée prévue</div></div><a href="/compte/modifier" class="tg p" style="text-decoration:none">Configurer</a></div>`
          ]
        })},
        { l: "Préférences", r: () => ({
          per: [3, 5],
          title: "Unités, Affichage & Données",
          rows: [
            `<div class="cap" style="margin-bottom:5px">Système d'unités</div><div class="segc" role="group" aria-label="Système d'unités" style="--n:2;max-width:100%"><span class="sel-lens" aria-hidden="true" style="--i:${S.unitsMetric ? 0 : 1}"></span><button data-a="units" data-v="0" aria-pressed="${S.unitsMetric}" aria-label="Métrique (km, m, °C)" title="Métrique (km, m, °C)">${ic(IC.gauge, 's')}</button><button data-a="units" data-v="1" aria-pressed="${!S.unitsMetric}" aria-label="Impérial (mi, ft, °F)" title="Impérial (mi, ft, °F)">${ic(IC.globe, 's')}</button></div>`,
            swRow("Mode plein soleil (contraste renforcé)", "Augmente l'opacité du verre Liquid Glass en extérieur", S.outdoor, "outdoor", "1"),
            `<div class="menu2 one" style="margin-top:6px"><button class="mi" data-a="rgpdexport"><span>Exporter mes données (RGPD / JSON)</span></button></div>`,
            `<div class="menu2 one" style="margin-top:6px"><button class="mi bad" data-a="signout"><span>Se déconnecter de @${S.profile ? (S.profile.handle || 'moi') : 'moi'}</span></button></div>`
          ]
        })}
      ]
    };
  }

  if (sh.k === "story_action_sheet") {
    const hlId = sh.hlId || "hl1";
    const hlTitle = sh.hlTitle || "Story à la une";
    return {
      title: "Story à la une",
      peek: hlTitle,
      flow: [
        {
          l: "Options",
          r: () => ({
            per: [5, 8],
            title: hlTitle,
            rows: [
              `<div style="text-align:center;padding:4px 0 8px;font-weight:600;font-size:13px;color:var(--label2);">Gérer la sélection à la une</div>`,
              `<button class="mbtn soft" style="width:100%;height:44px;justify-content:center;font-size:14.5px;font-weight:600;border-radius:14px;margin-bottom:6px;" data-a="editHighlightTitle" data-v="${hlId}">Modifier le titre</button>`,
              `<button class="mbtn soft" style="width:100%;height:44px;justify-content:center;font-size:14.5px;font-weight:600;border-radius:14px;margin-bottom:6px;" data-a="changeHighlightCover" data-v="${hlId}">Changer la photo de couverture</button>`,
              `<button class="mbtn" style="width:100%;height:44px;justify-content:center;font-size:14.5px;font-weight:600;border-radius:14px;background:rgba(168,68,58,0.12);color:#A8443A!important;margin-bottom:8px;" data-a="removeHighlight" data-v="${hlId}">Supprimer des stories à la une</button>`,
              `<button class="mbtn p" style="width:100%;height:44px;justify-content:center;font-size:14.5px;font-weight:600;border-radius:14px;" data-a="closeSheet">Annuler</button>`
            ]
          })
        }
      ]
    };
  }

  return { title: 'Détails', peek: '', flow: [{ l: 'Détails', r: () => ({ per: [3, 5], title: 'Détails', rows: [] }) }] };
};
const FLI = {
  "Profil": "user", "Pratique": "mount", "Voyageur": "globe", "Empreinte": "pin", "Tribu": "people", "Vie privée": "shield",
  "Parcours": "route", "Météo": "sun", "Mes choix": "book", "Sources": "layers", "Kit": "pack",
  "Budget": "wallet", "Inventaire": "box", "Offres": "ticket", "Veille": "shield", "Préférences": "sliders",
  "Fiche": "box", "Actions": "sliders"
};
const flIc = l => IC[FLI[l]] || IC.list;

let sheetAvail = function(det) {
  const H = ($("phone") && $("phone").clientHeight) || 844;
  const top = 48;
  const bot = det === "large" ? 8 : Math.round(H * 0.31) + 46;
  const sh = $("sheet"), cs = getComputedStyle(sh);
  let used = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom), n = 0;
  [...sh.children].forEach(e => { if (e.classList.contains("sh-b") || getComputedStyle(e).display === "none") return; used += e.offsetHeight; n++; });
  return H - top - bot - used - n * (parseFloat(cs.rowGap) || 6);
}

const FLI_SVG = {
  "Pratique": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  "Voyageur": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
  "Empreinte": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>',
  "Cordée": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  "Tribu": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  "Vie privée": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  "Mes Kits": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6.5V5a3 3 0 0 1 6 0v1.5M6 10.5a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8.5ZM9.5 14h5v4h-5z"/></svg>',
  "Kits & Lignées": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6.5V5a3 3 0 0 1 6 0v1.5M6 10.5a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8.5ZM9.5 14h5v4h-5z"/></svg>',
  "Inventaire": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  "Prêts": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  "Prêts & Locations": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  "Fidélité": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  "Parrainage": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  "Parcours": ic(IC.route, 's'),
  "Météo": ic(IC.sun, 's'),
  "Mes choix": ic(IC.book, 's'),
  "Sources": ic(IC.layers, 's'),
  "Offres": ic(IC.ticket, 's'),
  "Veille": ic(IC.shield, 's'),
  "Préférences": ic(IC.sliders, 's'),
  "Fiche": ic(IC.box, 's'),
  "Actions": ic(IC.sliders, 's')
};

const captureMapLayers = function() {
  const snapshot = {};
  MAP_LAYER_KEYS.forEach(k => { snapshot[k] = S.map[k] ? 1 : 0; });
  return snapshot;
};

const applyMapContextLayers = function(slot) {
  // Capture unique à l'entrée en mode contexte : un changement de slot ne doit
  // pas écraser la photographie de l'état utilisateur prise avant l'ouverture.
  if (!mapContextLayerSnapshot) mapContextLayerSnapshot = captureMapLayers();
  // Les calques pilotés par la carte contexte sont isolés : seul le calque du
  // slot reste actif. Les préférences hors contexte (offline, labels,
  // contours, acc) ne sont ni modifiées ni restaurées par ce cycle de vie.
  MAP_CONTEXT_LAYER_KEYS.forEach(k => { S.map[k] = 0; });
  (mapContextLayers[slot] || []).forEach(k => { S.map[k] = 1; });
  if ($("tm")) drawMap();
  if (S.mopts) renderMopts();
};

const restoreMapContextLayers = function() {
  if (!mapContextLayerSnapshot) return;
  // Seules les clés de contexte sont restaurées : un réglage hors contexte
  // modifié pendant l'ouverture du drawer n'est pas annulé à la fermeture.
  MAP_LAYER_KEYS.forEach(k => { S.map[k] = mapContextLayerSnapshot[k]; });
  mapContextLayerSnapshot = null;
  if ($("tm")) drawMap();
  if (S.mopts) renderMopts();
};

const applyMapContext = function() {
  notifyMapContext();
};

function currentMapContext() {
  const sh = S.sh;
  if (!sh) {
    return { kind: null, step: S.step || 0, slot: S.slot || null, detent: "closed", outingId: null };
  }
  return {
    kind: sh.k || null,
    step: Number(S.step || 0),
    slot: sh.k === "step" && S.step === 0 ? slotIdOf(S.slot) : null,
    detent: sh.det || "card",
    outingId: sh.outingId || (sh.extra && sh.extra.outingId) || null,
  };
}

function notifyMapContext() {
  const context = currentMapContext();
  window.__lkdvCompteMapState = context;
  if (typeof window.__lkdvCompteMapContext === "function") {
    try { window.__lkdvCompteMapContext(context); } catch (_) {}
  }
}

let sheetSlideDir = 0;
let drawerHintMode = 'followers';
let drawerHintTab = 0;
let renderSheet = function() {
  if (!isCurrent()) return;
  const sheetEl = $("sheet");
  if (!sheetEl) return;
  sheetEl.tabIndex = -1;
  if (G.closing) return;
  /* `aria-modal` + page inactive tant que le drawer est réellement ouvert ;
     la fermeture (finishClose → renderSheet) restaure les valeurs d'origine. */
  applySheetModalState(sheetEl, !!(S.sh && S.sh.det !== "closed"));
  notifyMapContext();
  const w = $("sw");
  if (!S.sh) {
    w.dataset.det = "closed";
    if ($("sheet")) $("sheet").inert = true;
    const phoneEl = $("phone");
    if (phoneEl) {
      phoneEl.classList.remove("sheet-open");
      phoneEl.setAttribute("data-sheet-open", "false");
      phoneEl.removeAttribute("data-det");
    }
    if (typeof window.__lkdvUnmountSlot === "function") {
      try { window.__lkdvUnmountSlot(); } catch (_) {}
    }
    if (typeof window.__lkdvUnmountDrawer === "function") {
      try { window.__lkdvUnmountDrawer(); } catch (_) {}
    }
    applyMapContext();
    renderCallout();
    return;
  }
  const sh = S.sh;
  /* Drawer Profil v2 : la feuille est remplacée par l'hôte React des 5 slots.
     La carte du bas passe en mode contexte tant que ce tiroir est ouvert. */
  if (sh.k === "step" && S.step === 0) {
    const slotId = slotIdOf(S.slot);
    S.slot = slotId;
    const back = S.stk.length ? `<button class="lg gbtn sm sh-back" data-a="close" aria-label="Retour">${ic(IC.chevL, "s")}</button>` : "";
    $("sheet").setAttribute("aria-label", "Profil · " + (SLOT_LABELS[slotId] || slotId));
    $("sheet").innerHTML = `<div class="grab" data-drag>
  <span aria-hidden="true"></span>${back}
</div>
<div id="lkdv-slot-root" class="lkdv-slot-root" data-slot="${slotId}"></div>`;
    $("sheet").inert = false;
    w.dataset.det = sh.det;
    w.dataset.k = sh.k || "";
    const phoneEl = $("phone");
    if (phoneEl) {
      phoneEl.classList.toggle("sheet-open", sh.det !== "closed");
      phoneEl.setAttribute("data-sheet-open", sh.det !== "closed" ? "true" : "false");
      phoneEl.setAttribute("data-det", sh.det);
    }
    applyMapContext();
    renderCallout();
    const root = $("lkdv-slot-root");
    if (root && typeof window.__lkdvMountSlot === "function") {
      try {
        window.__lkdvMountSlot(root, slotId, S);
      } catch (err) {
        console.warn("[CompteLiquidGlassV8] slot mount failed:", err);
      }
    }
    return;
  }
  const REACT_DRAWERS = { account_drawer: "compte", followers_sheet: "reseau", outing_drawer: "sortie" };
  if (REACT_DRAWERS[sh.k]) {
    const kind = REACT_DRAWERS[sh.k];
    if (typeof window.__lkdvUnmountSlot === "function") {
      try { window.__lkdvUnmountSlot(); } catch (_) {}
    }
    if (typeof window.__lkdvUnmountDrawer === "function") {
      try { window.__lkdvUnmountDrawer(); } catch (_) {}
    }
    const label = kind === "reseau"
      ? (drawerHintMode === "following" ? "Abonnements" : "Abonnés")
      : kind === "sortie" ? "Sortie" : "Compte & Activité";
    const back = S.stk.length ? `<button class="lg gbtn sm sh-back" data-a="close" aria-label="Retour">${ic(IC.chevL, "s")}</button>` : "";
    $("sheet").setAttribute("aria-label", label);
    $("sheet").innerHTML = `<div class="grab" data-drag>
  <span aria-hidden="true"></span>${back}
</div>
<div id="lkdv-drawer-root" class="lkdv-drawer-root" data-kind="${kind}"></div>`;
    $("sheet").inert = false;
    w.dataset.det = sh.det;
    w.dataset.k = sh.k || "";
    const phoneEl = $("phone");
    if (phoneEl) {
      phoneEl.classList.toggle("sheet-open", sh.det !== "closed");
      phoneEl.setAttribute("data-sheet-open", sh.det !== "closed" ? "true" : "false");
      phoneEl.setAttribute("data-det", sh.det);
    }
    applyMapContext();
    renderCallout();
    const root = $("lkdv-drawer-root");
    const props = kind === "reseau"
      ? { tab: drawerHintMode || "followers" }
      : kind === "sortie"
        ? { outingId: sh.outingId || (sh.extra && sh.extra.outingId) || "" }
        : { tab: drawerHintTab || 0 };
    if (root && typeof window.__lkdvMountDrawer === "function") {
      try { window.__lkdvMountDrawer(root, kind, props); } catch (err) {
        console.warn("[CompteLiquidGlassV8] drawer mount failed:", err);
      }
    }
    return;
  }
  // Toute feuille non-React remplace le contenu de #sheet : on démonte le
  // portail React pour ne pas laisser un arbre monté dans un nœud détaché.
  if (typeof window.__lkdvUnmountDrawer === "function") {
    try { window.__lkdvUnmountDrawer(); } catch (_) {}
  }
  if (typeof window.__lkdvUnmountSlot === "function") {
    try { window.__lkdvUnmountSlot(); } catch (_) {}
  }
  applyMapContext();
  const Dd = defs();
  if (!Dd.flow || !Dd.flow.length) {
    Dd.flow = [{ l: Dd.title || "Détails", r: () => ({ per: [3, 5], title: Dd.title || "", rows: [] }) }];
  }
  if (sh.tab >= Dd.flow.length) sh.tab = 0;
  const F = Dd.flow[sh.tab], T = F.r(), fk = [sh.k, sh.id, sh.tab, sh.det, S.step].join("|");
  const isIdentityOrCustom = sh.k === "edit_profile_full" || sh.k === "followers_sheet" || sh.k === "user_profile_preview" || sh.k === "account_drawer" || sh.k === "create_menu" || sh.k === "story_action_sheet" || sh.k === "outing_drawer" || sh.k === "step";
  const per = isIdentityOrCustom ? 999 : Math.max(1, Math.min(T.per[sh.det === "large" ? 1 : 0], G.fit[fk] || 99));
  const pages = Math.max(1, Math.ceil(T.rows.length / per));
  if (sh.page >= pages) sh.page = pages - 1;
  const lab = T.title || "", last = sh.tab >= Dd.flow.length - 1, nF = Dd.flow.length;
  const navCls = sh.k === "step" && S.step === 1 ? "segc lg-tabs lens-on" : "flow";
  const flow = nF > 1 ? `<div class="${navCls}" role="tablist" aria-label="${Dd.title || 'Sections'}" style="--n:${nF}"><span class="sel-lens" aria-hidden="true" style="--i:${sh.tab}"></span>${Dd.flow.map((f, i) => `<button data-a="stab" data-v="${i}" role="tab" aria-selected="${i === sh.tab}" aria-label="${f.l}" class="${i === sh.tab ? "cur active" : ""}">${f.icon && IC[f.icon] ? ic(IC[f.icon], "s") : (FLI_SVG[f.l] || `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`)}</button>`).join("")}</div>` : "";
  const isWorkflow = nF > 1;
  const footerHtml = isWorkflow
    ? `${!Dd.noFooter
      ? `<button class="mbtn soft" data-a="fprev" ${sh.tab === 0 ? "disabled" : ""} style="height:36px;padding:0 16px">Précédent</button><div style="flex:1"></div><button class="mbtn p" data-a="fnext" style="height:36px;padding:0 20px">${last ? "Terminer" : "Suivant"}</button>`
      : ""}`
    : "";
  const prevFocus = document.activeElement && $("sheet").contains(document.activeElement)
    ? { a: document.activeElement.dataset.a, v: document.activeElement.dataset.v }
    : null;
  $("sheet").setAttribute("aria-label", Dd.title || "Détails");
  const oldBody = sheetSlideDir ? $("sheet").querySelector(".sh-b") : null;
  const oldRect = oldBody ? oldBody.getBoundingClientRect() : null;
  $("sheet").innerHTML = `<div class="grab" data-drag>
  <span aria-hidden="true"></span>${S.stk.length ? `<button class="lg gbtn sm sh-back" data-a="close" aria-label="Retour">${ic(IC.chevL, "s")}</button>` : ""}
</div>
${flow ? `<div class="sheet-nav">${flow}</div>` : ""}
<div class="sh-b">${T.head || ""}${pages > 1 ? listHead(lab, sh.page, pages) : ""}${T.rows.slice(sh.page * per, sh.page * per + per).join("")}</div>
${footerHtml ? `<div class="sh-f">${footerHtml}</div>` : ""}${Dd.footer ? `<div class="sh-f">${Dd.footer}</div>` : ""}`;
  if (sheetSlideDir && oldBody && oldRect) {
    const dir = sheetSlideDir;
    const ghost = oldBody.cloneNode(true);
    ghost.classList.add("sh-b-ghost");
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.left = oldRect.left + "px";
    ghost.style.top = oldRect.top + "px";
    ghost.style.width = oldRect.width + "px";
    ghost.style.height = oldRect.height + "px";
    ghost.style.transform = "translateX(0)";
    document.body.appendChild(ghost);
    requestAnimationFrame(() => {
      ghost.style.transform = `translateX(${dir > 0 ? "-102%" : "102%"})`;
      ghost.style.opacity = "0.2";
    });
    setTimeout(() => ghost.remove(), 480);
    const fresh = $("sheet").querySelector(".sh-b");
    if (fresh) fresh.dataset.slide = dir > 0 ? "1" : "-1";
  }
  sheetSlideDir = null;
  const nav = $("sheet").querySelector(".sheet-nav");
  if (nav) nav.setAttribute("data-drag", "");
  if (nav && S.stk.length) nav.classList.add("has-back");
  $("sheet").inert = false;
  if (prevFocus && prevFocus.a) {
    const selector = `[data-a="${prevFocus.a}"]` + (prevFocus.v !== undefined ? `[data-v="${prevFocus.v}"]` : '');
    const next = $("sheet").querySelector(selector);
    if (next) { try { next.focus({ preventScroll: true }); } catch (_) {} }
  }
  w.dataset.det = sh.det;
  w.dataset.k = sh.k || "";
  const phoneEl = $("phone");
  if (phoneEl) {
    phoneEl.classList.toggle("sheet-open", sh.det !== "closed");
    phoneEl.setAttribute("data-sheet-open", sh.det !== "closed" ? "true" : "false");
    phoneEl.setAttribute("data-det", sh.det);
  }
  if (!isIdentityOrCustom && sh.det !== "peek" && per > 1) {
    const b = $("sheet").querySelector(".sh-b");
    let ch = 0;
    if (b) [...b.children].forEach(c => { const cs = getComputedStyle(c); ch += c.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom); });
    if (ch > sheetAvail(sh.det) + 1) { G.fit[fk] = per - 1; return renderSheet(); }
  }
  renderCallout();
  if (G.flowFrom != null) {
    G.flowFrom = null;
    const l = $("flens");
    if (l) requestAnimationFrame(() => requestAnimationFrame(() => { l.style.transform = `translateX(${sh.tab * 100}%)`; }));
  }
  lensSoon();
  bindSelectorPress();
}

function bindSelectorPress() {
  document.querySelectorAll("#sheet .flow, #sheet .segc, #sheet .reseau-toggle, #sheet .ig-sub").forEach(sel => {
    if (sel._pressBound) return;
    sel._pressBound = 1;
    const lens = sel.querySelector(".sel-lens, .th");
    const buttons = [...sel.querySelectorAll("button")];
    if (!lens || buttons.length < 2) return;
    const baseTransform = lens.style.transform;
    const baseTransition = lens.style.transition;
    let press = null;
    sel.addEventListener("pointerdown", e => {
      const b = e.target.closest("button");
      const i = buttons.indexOf(b);
      if (!b || i < 0) return;
      press = { i, x: e.clientX };
      sel.classList.add("pressing");
      lens.style.setProperty("transition", "transform .18s cubic-bezier(.2,.9,.3,1.2)", "important");
      lens.style.setProperty("transform", `translateX(${i * 100}%)`, "important");
      haptic(4);
    });
    sel.addEventListener("pointermove", e => {
      if (!press || Math.abs(e.clientX - press.x) <= 4) return;
      const r = sel.getBoundingClientRect();
      const w = r.width / buttons.length;
      if (!w) return;
      const nearest = clamp(Math.floor((e.clientX - r.left) / w), 0, buttons.length - 1);
      if (nearest === press.i) return;
      press.i = nearest;
      lens.style.setProperty("transition", "transform .16s cubic-bezier(.2,.9,.3,1.15)", "important");
      lens.style.setProperty("transform", `translateX(${nearest * 100}%)`, "important");
    });
    const end = () => {
      if (!press) return;
      press = null;
      sel.classList.remove("pressing");
      lens.style.transition = baseTransition;
      lens.style.transform = baseTransform;
    };
    sel.addEventListener("pointerup", end);
    sel.addEventListener("pointercancel", end);
    sel.addEventListener("pointerleave", end);
  });
}

let sheetOpener = null;
let sheetOpenerSel = null;
const captureSheetOpener = () => {
  if (S.sh) return;
  const el = (typeof document !== 'undefined' && document.activeElement) || null;
  sheetOpener = el;
  sheetOpenerSel = el && el.dataset && el.dataset.a
    ? '[data-a="' + el.dataset.a + '"]' + (el.dataset.v !== undefined ? '[data-v="' + el.dataset.v + '"]' : '')
    : null;
};
let finishClose = function() {
  if (!isCurrent()) return;
  if (!G.closing) return;
  G.closing = false;
  clearTimeout(G.closeT); G.closeT = null;
  const se = $("sheet"), wrap = $("sw");
  if (se) { se.style.removeProperty("transition"); se.style.removeProperty("transform"); se.innerHTML = ""; se.inert = true; }
  if (wrap) { wrap.classList.remove("in", "dragging"); wrap.dataset.det = "closed"; }
  const opener = sheetOpener && sheetOpener.isConnected
    ? sheetOpener
    : (sheetOpenerSel ? document.querySelector(sheetOpenerSel) : null);
  sheetOpener = null; sheetOpenerSel = null;
  S.sh = null; S.stk = []; S.focus = null; drawMap();
  const phoneEl = $("phone");
  if (phoneEl) {
    phoneEl.classList.remove("sheet-open");
    phoneEl.setAttribute("data-sheet-open", "false");
    phoneEl.removeAttribute("data-det");
  }
  renderSheet();
  if (opener && opener.isConnected) requestAnimationFrame(() => { try { opener.focus({ preventScroll: true }); } catch (_) {} });
};

let startSheetClose = function() {
  if (!S.sh || S.sh.det === "closed" || G.closing) return;
  G.closing = true;
  closeVisMenu(true);
  const se = $("sheet");
  if (se) {
    se.inert = true;
    se.style.setProperty("transition", "transform .56s cubic-bezier(.16,1,.3,1)", "important");
    se.style.transform = "translateY(100%)";
  }
  clearTimeout(G.closeT);
  clearTimeout(G.dragT); G.dragT = null;
  const reduce = typeof matchMedia === "function" && matchMedia('(prefers-reduced-motion: reduce)').matches;
  G.closeT = setTimeout(finishClose, reduce ? 0 : 570);
};

let cancelClose = function() {
  clearTimeout(G.closeT); G.closeT = null;
  clearTimeout(G.dragT); G.dragT = null;
  if (!G.closing) return;
  G.closing = false;
  const se = $("sheet"), wrap = $("sw");
  if (se) { se.style.removeProperty("transition"); se.style.removeProperty("transform"); }
  if (wrap) wrap.classList.remove("dragging");
};

const animateSheetIn = () => {
  const se = $("sheet"), wrap = $("sw");
  if (!se || !wrap) return;
  cancelClose();
  se.classList.remove("anim-in");
  wrap.classList.remove("in");
  se.style.setProperty("transition", "none", "important");
  se.style.setProperty("transform", "translateY(100%)", "important");
  void se.offsetWidth;
  se.style.removeProperty("transition");
  se.style.removeProperty("transform");
  wrap.classList.add("in");
  se.classList.add("anim-in");
  clearTimeout(se._animT);
  se._animT = setTimeout(() => se.classList.remove("anim-in"), 820);
};
let openSheet = function(k = "step", tab = 0, det = "card", extra = {}) {
  if (!isCurrent()) return;
  cancelClose();
  const wasBig = !!S.big;
  if (S.big) { S.big = false; applyShell(); }
  syncCardBounds();
  if (wasBig) setTimeout(syncCardBounds, 620);
  captureSheetOpener();
  S.sh = { k, tab, page: 0, det, ...extra };
  const sheetEl = $("sheet");
  if (sheetEl) sheetEl.dataset.kind = String(k || "");
  if (S.sh.det !== "closed") S.sh.det = "card";
  S.callout = null; S.popv = false; S.mopts = false;
  const phoneEl = $("phone");
  const isOpen = det !== "closed";
  if (phoneEl) {
    phoneEl.classList.toggle("sheet-open", isOpen);
    phoneEl.setAttribute("data-sheet-open", isOpen ? "true" : "false");
    phoneEl.setAttribute("data-det", det);
  }
  renderPopv(); renderMopts(); renderMctl(); closeVisMenu(true); renderSheet(); animateSheetIn();
  requestAnimationFrame(() => { const b = $("sheet")?.querySelector('[data-a="close"]'); if (b) b.focus({ preventScroll: true }); else $("sheet")?.focus({ preventScroll: true }); });
}
/* Entrée publique du drawer Profil v2 : sélectionne le slot puis ouvre la feuille. */
window.__lkdvOpenSlot = function(slotId) {
  if (!isCurrent()) return;
  S.step = 0;
  S.slot = slotIdOf(slotId);
  openSheet("step", 0, "large");
  haptic(6);
};
/* Changement de slot SANS rouvrir la feuille : le contenu glisse côté React,
   la carte du bas et son badge suivent le slot sélectionné. */
window.__lkdvSetSlot = function(slotId) {
  if (!isCurrent()) return;
  const id = slotIdOf(slotId);
  S.slot = id;
  const sheet = $("sheet");
  if (sheet) sheet.setAttribute("aria-label", "Profil · " + (SLOT_LABELS[id] || id));
  applyMapContext();
  haptic(4);
  return id;
};
let pushSheet = function(o) {
  cancelClose();
  if (S.sh) S.stk.push({ ...S.sh });
  syncCardBounds();
  captureSheetOpener();
  S.sh = { tab: 0, page: 0, det: "card", ...o };
  if (S.sh.det !== "closed") S.sh.det = "card";
  S.callout = null;
  const phoneEl = $("phone");
  if (phoneEl) {
    phoneEl.classList.add("sheet-open");
    phoneEl.setAttribute("data-sheet-open", "true");
    phoneEl.setAttribute("data-det", "card");
  }
  closeVisMenu(true); renderSheet(); animateSheetIn();
  requestAnimationFrame(() => { const b = $("sheet")?.querySelector('[data-a="close"]'); if (b) b.focus({ preventScroll: true }); else $("sheet")?.focus({ preventScroll: true }); });
  haptic(8);
}
let popSheet = function() {
  if (S.stk.length) { S.sh = S.stk.pop(); renderSheet(); return true; }
  return false;
}
let setDet = function(det) {
  if (!S.sh) return;
  if (det !== "closed") det = "card";
  if (det === "closed") {
    startSheetClose(); return;
  } else {
    S.sh.det = det;
    const phoneEl = $("phone");
    const isOpen = det !== "closed";
    if (phoneEl) {
      phoneEl.classList.toggle("sheet-open", isOpen);
      phoneEl.setAttribute("data-sheet-open", isOpen ? "true" : "false");
      phoneEl.setAttribute("data-det", det);
    }
  }
  closeVisMenu(true); renderSheet();
}
const DETS = ["closed", "card"];

/* Piège de focus du drawer : Tab/Shift+Tab restent dans `#sheet`. On ne prend
   la main qu'aux bornes ; un focus déjà hors de la feuille (feuille React
   imbriquée, portail) n'est jamais volé. */
const onSheetKeyDown = e => {
  if (e.key !== "Tab") return;
  if (!S.sh || S.sh.det === "closed" || G.closing) return;
  const sheetEl = $("sheet");
  if (!sheetEl) return;
  const target = nextSheetFocus(sheetEl, document.activeElement, e.shiftKey);
  if (!target) return;
  e.preventDefault();
  try { target.focus({ preventScroll: true }); } catch (_) {
    try { target.focus(); } catch (__) {}
  }
};
document.addEventListener("keydown", onSheetKeyDown, true);

/* ---------- Menu morphing iOS 27 pour la pilule @tony_frc ---------- */
let relRect = function(el) {
  const p = $("phone").getBoundingClientRect(), r = el.getBoundingClientRect(), s = G.sc || 1;
  return { x: (r.left - p.left) / s, y: (r.top - p.top) / s, w: r.width / s, h: r.height / s };
}
const syncCardBounds = function() {
  const phone = $("phone"), card = $("card");
  if (!phone || !card) return;
  const p = phone.getBoundingClientRect(), c = card.getBoundingClientRect(), s = G.sc || 1;
  if (!c.width || !c.height) return;
  phone.style.setProperty("--card-top", ((c.top - p.top) / s).toFixed(2) + "px");
  phone.style.setProperty("--card-left", ((c.left - p.left) / s).toFixed(2) + "px");
  phone.style.setProperty("--card-right", ((p.right - c.right) / s).toFixed(2) + "px");
  phone.style.setProperty("--card-bottom", ((p.bottom - c.bottom) / s).toFixed(2) + "px");
  phone.style.setProperty("--card-radius", (getComputedStyle(card).borderRadius.split(" ")[0] || "24px"));
  positionIgTabsFloat();
};
const positionIgTabsFloat = function() {
  const card = $("card"), float = document.querySelector(".ig-tabs-float");
  if (!card || !float) return;
  float.style.setProperty("bottom", "10px", "important");
};
let openVisMenu = function() {
  const pill = $("rpvis"); if (!pill) return;
  const m = $("rmenu"), R = relRect(pill), W = 205, H = 4 * 36 + 18;
  G.role = { R };
  m.style.transition = "none";
  Object.assign(m.style, { left: R.x + "px", top: R.y + "px", width: R.w + "px", height: R.h + "px" });
  const opts = [[0, "Privée (toi seul·e)", IC.lock], [1, "Communauté LKDV", IC.people], [2, "Publique (≥ 3 sorties)", IC.globe]];
  m.innerHTML = `<div class="ri">${opts.map(x => `<button role="menuitemradio" aria-checked="${S.vis === x[0]}" data-a="setvis" data-v="${x[0]}">${ic(x[2], "s")}${x[1]}</button>`).join("")}<div style="height:1px;background:rgba(23,43,36,0.1);margin:4px 0"></div><button role="menuitem" data-a="signout" style="color:var(--bad);font-weight:600">${ic(IC.x, "s")}Se déconnecter</button></div>`;
  void m.offsetWidth;
  m.style.transition = "";
  m.classList.add("on");
  const top = clamp(R.y + R.h + 6, 48, 844 - H - 20), left = clamp(R.x, 12, 390 - W - 12);
  Object.assign(m.style, { left: left + "px", top: top + "px", width: W + "px", height: H + "px" });
  pill.style.opacity = "0";
  haptic(8);
}
let closeVisMenu = function(instant) {
  const m = $("rmenu");
  if (!G.role) { m.classList.remove("on"); return; }
  const { R } = G.role; G.role = null;
  const pill = $("rpvis");
  if (instant) { m.classList.remove("on"); if (pill) pill.style.opacity = ""; return; }
  const R2 = pill ? relRect(pill) : R;
  m.classList.remove("on");
  Object.assign(m.style, { left: R2.x + "px", top: (R2.y + R2.h + 8) + "px", width: R2.w + "px", height: R2.h + "px" });
  setTimeout(() => { const p2 = $("rpvis"); if (p2) { p2.style.opacity = ""; p2.classList.add("morph"); setTimeout(() => p2.classList.remove("morph"), 520); } }, 260);
}

/* ---------- Popover Affichage (Mode extérieur + Verre Liquid Glass) ---------- */
let renderPopv = function() {
  const p = $("popv");
  p.classList.toggle("on", !!S.popv);
  p.innerHTML = `<div class="pr"><div><div class="hl" style="font-size:14px">Mode extérieur</div><div class="sub">Plus opaque, plus contrasté</div></div><button class="sw" role="switch" aria-checked="${S.outdoor}" data-a="outdoor" aria-label="Mode extérieur"></button></div>
  <div class="pr" style="flex-direction:column;align-items:stretch;justify-content:center;padding-top:9px;gap:5px"><div class="hl" style="font-size:14px">Verre Liquid Glass</div><input id="glassr" type="range" min="0" max="100" value="${Math.round(S.glass * 100)}" aria-label="Intensité du verre"><div class="lbl2"><span>Clair</span><span>Teinté</span></div></div>`;
}
let applyGlass = function() {
  const t = S.outdoor ? 1 : S.glass, p = $("phone");
  p.style.setProperty("--gb", (S.outdoor ? 24 : 3 + 14 * t).toFixed(1) + "px");
  p.style.setProperty("--ga", (S.outdoor ? .62 : .05 + .45 * t).toFixed(3));
  p.classList.toggle("outdoor", !!S.outdoor);
  lensSoon();
}
let applyShell = function() {
  const p = $("phone");
  p.classList.toggle("tabmin", !!S.tabMin);
  p.classList.toggle("mapbig", !!S.big);
  p.classList.toggle("noacc", !S.map.acc);
  const isSheetOpen = !!(S.sh && S.sh.det !== "closed");
  p.classList.toggle("sheet-open", isSheetOpen);
  p.setAttribute("data-sheet-open", isSheetOpen ? "true" : "false");
  if (S.sh && S.sh.det) p.setAttribute("data-det", S.sh.det); else p.removeAttribute("data-det");
  lensSoon();
  clearTimeout(G.lt);
  G.lt = setTimeout(lensAll, 620);
}

let refresh = function(map) {
  if (!isCurrent()) return;
  renderTop();
  if (map) drawMap();
  renderAcc();
  renderSheet();
  renderCallout();
  if (S.popv) renderPopv();
  if (S.mopts) renderMopts();
  lensSoon();
}

/* Rafraîchissement d'une mutation venue du drawer React : tout est mis à
   jour sauf `renderSheet()`, qui reconstruirait `#lkdv-slot-root` et
   démonterait le slot en pleine persistance (état d'attente perdu). */
let refreshWithoutSheet = function(map) {
  if (!isCurrent()) return;
  renderTop();
  if (map) drawMap();
  renderAcc();
  renderCallout();
  if (S.popv) renderPopv();
  if (S.mopts) renderMopts();
  lensSoon();
}

let go = function(n) {
  if (S.big) { S.big = false; applyShell(); }
  S.step = clamp(n, 0, 4);
  if (!S.visited.includes(S.step)) S.visited.push(S.step);
  refresh(true);
}

let say = function(txt) {
  const t = norm(txt.trim());
  if (!t) return;
  let m;
  if ((m = /(?:domicile|ville|habite)\s+([a-z]+)/.exec(t))) {
    const city = m[1].charAt(0).toUpperCase() + m[1].slice(1);
    doMut("home", city); return;
  }
  if (/prive/.test(t)) { doMut("vis", 0); return; }
  if (/communaut/.test(t)) { doMut("vis", 1); return; }
  if (/publi(?:que|c)/.test(t) && !/carnet|vercors/.test(t)) { doMut("vis", 2); return; }
  if (/recuper|frontale|noah/.test(t)) { doMut("recover", "p11"); return; }
  if (/publi|vercors|brouillon/.test(t)) { doMut("pubdraft"); return; }
  if (/credit|part createur|42/.test(t)) { doMut("usecredit"); return; }
  if (/annul/.test(t)) { undo(); return; }
  island("Commande comprise", "Essaie « domicile Turin », « empreinte privée », « récupère frontale », « publie carnet »", false);
}

let act = function(a, v, meta) {
  if (!isCurrent()) return;
  if (a === "setvis") {
    /* Visibilité exacte : `'public'` → 2, `'prive'` → 0. Les index 0/1/2 du
       menu historique restent acceptés. Valeur inconnue = rejet sans mutation ;
       valeur déjà courante = no-op idempotent. Depuis le menu, on conserve le
       délai de fermeture morphing ; depuis le drawer React, l'action est
       appliquée immédiatement, sans remonter le portail. */
    const target = applySetVis(S.vis, v);
    if (target == null) return;
    const fromMenu = !!G.role;
    closeVisMenu();
    if (S.vis === target) return;
    if (fromMenu) setTimeout(() => doMut("vis", target), 260);
    else doMut("vis", target, meta);
    return;
  }
  if (a === "setprofilevis") {
    /* Confidentialité du compte : deux valeurs exactes, distinctes de `setvis`.
       Valeur inconnue = rejet avant tout effet ; valeur déjà courante = no-op
       idempotent (aucun appel au pont de persistance). */
    const target = applyProfileVis(S.profileVisibility, v);
    if (target == null) return;
    if (S.profileVisibility === target) return;
    doMut("profilevis", target, meta);
    return;
  }
  if (a === "setnat") {
    /* Nationalité exacte à choix unique. Valeur vide/inconnue rejetée avant
       tout effet ; état déjà exact = no-op sans pont. `nat` reste le chemin
       historique de la multi-sélection. */
    const plan = applySetNationality({
      nats: S.traveller.nats,
      nationality: S.traveller.nationality,
      profileNationality: S.profile && S.profile.nationality,
    }, v);
    if (!plan || !plan.changed) return;
    doMut("setnat", plan.value, meta);
    return;
  }
  if (a === "igtab") { S.igTab = +v; S.step = [2, 1, 3, 0][+v] ?? 0; refresh(true); haptic(6); return; }
  if (a === "outdoor") { S.outdoor = !S.outdoor; applyGlass(); renderPopv(); if (S.sh) renderSheet(); island(S.outdoor ? "Mode extérieur activé" : "Mode extérieur coupé", "", false); return; }
  if (MUT[a]) { doMut(a, v); return; }
  if (typeof EXA !== "undefined" && typeof EXA[a] === "function") {
    EXA[a](v);
    return;
  }
  switch (a) {
    case "openPostModal": if (typeof EXA !== "undefined" && EXA.openPostModal) EXA.openPostModal(v); break;
    case "closePostModal": if (exportedActions?.closePostModal) exportedActions.closePostModal(); break;
    case "toggleLikePost": if (typeof EXA !== "undefined" && EXA.toggleLikePost) EXA.toggleLikePost(v); break;
    case "toggleSavePost": if (typeof EXA !== "undefined" && EXA.toggleSavePost) EXA.toggleSavePost(v); break;
    case "sharePost": if (typeof EXA !== "undefined" && EXA.sharePost) EXA.sharePost(v); break;
    case "copyReferral": if (typeof EXA !== "undefined" && EXA.copyReferral) EXA.copyReferral(); break;
    case "payoutReferral": if (typeof EXA !== "undefined" && EXA.payoutReferral) EXA.payoutReferral(); break;
    case "editHighlightTitle": if (typeof EXA !== "undefined" && EXA.editHighlightTitle) EXA.editHighlightTitle(v); break;
    case "changeHighlightCover": if (typeof EXA !== "undefined" && EXA.changeHighlightCover) EXA.changeHighlightCover(v); break;
    case "removeHighlight": if (typeof EXA !== "undefined" && EXA.removeHighlight) EXA.removeHighlight(v); break;
    case "goto": go(+v); break;
    case "editProfile": openSheet("edit_profile_full", 0, "large"); break;
    case "shareProfile": EXA.shareProfile(); break;
    case "copylink": island("Lien copié", "https://kitduvoyageur.fr/u/tony_frc", false); break;
    case "openUserProfile": if (typeof EXA !== "undefined" && EXA.openUserProfile) EXA.openUserProfile(v); break;
    case "openFollowers": EXA.openFollowers(); break;
    case "openFollowing": EXA.openFollowing(); break;
    case "openSettings": S.step = 4; openSheet("step", 0, "large"); break;
    case "hydrate": applyAccountBootstrap(v); break;
    case "openNotification": if (v) { try { window.location.href = v; } catch (_) {} } break;
    case "openStep": {
      const [st, tb] = (v || "0:0").split(":");
      S.step = +st;
      /* Les anciens onglets du tiroir Identité sont remappés sur les slots v2 :
         0:2 (Empreinte/avatar) → Vitrine, 0:3 (Clubs/Cordée) → Communauté. */
      if (S.step === 0) S.slot = tb === "3" ? "communaute" : "vitrine";
      openSheet("step", S.step === 0 ? 0 : (+tb || 0), "large");
      break;
    }
    case "openHighlight": {
      const hl = HIGHLIGHTS.find(x => x.id === v) || HIGHLIGHTS[0];
      S.focus = { k: "m", id: hl.mass };
      const p = focusPos(S.focus);
      drawMap();
      if (p) centerOn(p);
      S.step = hl.step;
      openSheet("step", 0, "large");
      island(hl.title, hl.sub, false);
      break;
    }
    case "open": openSheet("step", 0, "large"); break;
    case "openslot": S.step = 0; S.slot = slotIdOf(v); openSheet("step", 0, "large"); haptic(6); break;
    case "openf": openSheet("step", +v, "large"); break;
    case "openItem": pushSheet({ k: "item", id: v }); break;
    case "openOuting": S.step = 1; openSheet("step", 0, "large"); break;
    case "openOutingDrawer": EXA.openOutingDrawer(v); break;
    case "openCarnet": S.step = 2; openSheet("step", 0, "large"); break;
    case "openSpecies": S.step = 2; openSheet("step", 1, "large"); break;
    case "openKit": S.step = 3; openSheet("step", 0, "large"); break;
    case "close": if (!popSheet()) setDet("closed"); break;
    case "det": setDet(S.sh.det === "large" ? "medium" : "large"); break;
    case "cycle": setDet(S.sh.det === "peek" ? "medium" : S.sh.det === "medium" ? "large" : "medium"); break;
    case "stab": G.flowFrom = S.sh.tab; sheetSlideDir = (+v >= S.sh.tab ? 1 : -1); S.sh.tab = +v; S.sh.page = 0; renderSheet(); haptic(5); break;
    case "fnext": { const n = defs().flow.length; if (S.sh.tab >= n - 1) { if (!popSheet()) setDet("closed"); } else { G.flowFrom = S.sh.tab; S.sh.tab++; S.sh.page = 0; renderSheet(); haptic(5); } } break;
    case "fprev": if (S.sh.tab > 0) { G.flowFrom = S.sh.tab; S.sh.tab--; S.sh.page = 0; renderSheet(); } break;
    case "pg": S.sh.page += +v; renderSheet(); break;
    case "vismenu": if (G.role) closeVisMenu(); else openVisMenu(); break;
    case "popv": S.popv = !S.popv; renderPopv(); break;
    case "mopts": S.mopts = !S.mopts; renderMopts(); renderMctl(); break;
    case "mset": S.map[v] = S.map[v] ? 0 : 1; renderMopts(); renderMctl(); applyShell(); drawMap(); break;
    case "mmin": case "mall": { const on = a === "mall" ? 1 : 0; Object.keys(S.map).forEach(q => { if (q !== "style" && q !== "zoomBtns") S.map[q] = on; }); renderMopts(); renderMctl(); applyShell(); drawMap(); island(on ? "Tous les calques affichés" : "Carte nue", "", false); break; }
    case "mstyle":
      S.map.style = +v; renderMopts(); drawMap();
      if (window.__lkdvCompteMap3D) {
        try {
          const m = window.__lkdvCompteMap3D;
          const isTopo = +v === 1;
          if (m.getLayer("topo-layer")) {
            m.setLayoutProperty("topo-layer", "visibility", isTopo ? "visible" : "none");
          }
        } catch (_) {}
      }
      break;
    case "mapbig":
      S.big = !S.big; if (S.big && S.sh) { S.sh = null; renderSheet(); } applyShell(); renderMopts(); haptic(8);
      setTimeout(syncCardBounds, 620);
      if (window.__lkdvCompteMap3D) {
        setTimeout(() => {
          try { window.__lkdvCompteMap3D.resize(); } catch (_) {}
        }, 320);
      }
      break;
    case "zoom":
      zoomAt(+v > 0 ? 1.4 : 1 / 1.4);
      if (window.__lkdvCompteMap3D) {
        try {
          if (+v > 0) window.__lkdvCompteMap3D.zoomIn();
          else window.__lkdvCompteMap3D.zoomOut();
        } catch (_) {}
      }
      break;
    case "recenter":
      S.z = 1; S.pan = [0, 0]; setT(); renderMctl();
      if (window.__lkdvCompteMap3D) {
        try {
          window.__lkdvCompteMap3D.flyTo({
            center: [2.5, 46.5], zoom: 1.8, pitch: 0, bearing: 0,
            essential: true,
          });
          island("Mont-Blanc & Alpes IT·FR", "Centré sur ton parcours vivant 3D", false);
        } catch (_) {}
      }
      break;
    case "co-x": S.callout = null; S.focus = null; renderCallout(); drawMap(); break;
    case "profmode": S.prof = S.prof === "km" ? "endur" : "km"; renderAcc(); break;
    case "ttab": tabSelect(+v); break;
    case "exportrgpd": island("Archive RGPD prête", "Profil @tony_frc, sorties GPX, carnets et kits exportés (14,2 Mo)", false); break;
    case "signout": island("Déconnexion simulée", "Session protégée par cookie SameSite=Lax; Secure", false); break;
    case "ctxok": { const c = G.ctx; closeCtx(); if (c) act(c.a, c.v); } break;
    case "ctxno": closeCtx(); break;
    case "undo": undo(); break;
    case "nextgo": { const N = G.next || nextDecision(derive()); islandRest(); if (N) { if (S.step !== N.step) go(N.step); act(N.a, N.v); } } break;
  }
}

let closeCtx = function() { $("ctx").classList.remove("on"); G.ctx = null; }
let tabSelect = function(i) {
  if (S.tabMin) { S.tabMin = false; applyShell(); return; }
  const lens = $("lens"); if (lens) lens.style.transform = `translateX(${i * 100}%)`; haptic(6);
  if (i !== 4) {
    const tabRoute = '/' + TABS[i][0];
    notifyHostAction('navtab', tabRoute);
  }
}

/* ---------- Événements, gestes & interactions ---------- */
const phone = $("phone");
phone.addEventListener("contextmenu", e => {
  const hlBtn = e.target.closest && e.target.closest(".ig-hl");
  if (hlBtn) {
    e.preventDefault();
    const hlId = hlBtn.dataset.hlId || hlBtn.dataset.v;
    if (hlId && hlId !== "hl5") {
      const hl = hlList().find(q => q.id === hlId) || { id: hlId, title: "Story à la une" };
      openSheet("story_action_sheet", 0, "large", { hlId: hl.id, hlTitle: hl.title });
      haptic(10);
      return;
    }
  }
  e.preventDefault();
});
phone.addEventListener("input", e => {
  if (e.target && e.target.id === "ep_pace") {
    const lbl = $("ep_pace_lbl");
    if (lbl) {
      lbl.textContent = (Number(e.target.value) / 10).toFixed(1).replace(".", ",") + " km/h";
    }
  }
});
if (rootContainer && rootContainer !== phone) {
  rootContainer.addEventListener("click", e => {
    if (e.target.closest && e.target.closest("#phone")) return;
    const b = e.target.closest && e.target.closest("[data-a]");
    if (b) {
      if (b.disabled) return;
      e.preventDefault();
      act(b.dataset.a, b.dataset.v);
    }
  });
}
phone.addEventListener("pointermove", e => {
  if (G.raf) return;
  G.raf = requestAnimationFrame(() => {
    G.raf = 0;
    const r = phone.getBoundingClientRect();
    phone.style.setProperty("--la", (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI + 90).toFixed(0) + "deg");
  });
});

$("island").addEventListener("click", e => {
  if (e.target.closest("button")) return;
  if ($("island").dataset.s === "note") { islandRest(); return; }
  islandNext();
});

/* Appui long 500ms sur une Story à la une = menu d'actions (Point 6) */
phone.addEventListener("pointerdown", e => {
  const hlBtn = e.target.closest && e.target.closest(".ig-hl");
  if (!hlBtn) return;
  const hlId = hlBtn.dataset.hlId || hlBtn.dataset.v;
  if (!hlId || hlId === "hl5") return;
  const hl = hlList().find(q => q.id === hlId) || { id: hlId, title: "Story à la une" };
  G.lphl = {
    el: hlBtn,
    x: e.clientX,
    y: e.clientY,
    t: setTimeout(() => {
      G.lphl.fired = true;
      hlBtn.classList.add("bump");
      setTimeout(() => hlBtn.classList.remove("bump"), 300);
      haptic(14);
      openSheet("story_action_sheet", 0, "large", { hlId: hl.id, hlTitle: hl.title });
    }, 500)
  };
});
phone.addEventListener("pointermove", e => {
  if (G.lphl && !G.lphl.fired && Math.hypot(e.clientX - G.lphl.x, e.clientY - G.lphl.y) > 8) {
    clearTimeout(G.lphl.t);
    G.lphl = null;
  }
});
["pointerup", "pointercancel"].forEach(t => phone.addEventListener(t, () => {
  if (G.lphl) {
    if (!G.lphl.fired) clearTimeout(G.lphl.t);
    else { G.sup = Date.now() + 450; G.supEl = phone; }
    G.lphl = null;
  }
}));
phone.addEventListener("scroll", () => {
  if (G.lphl && !G.lphl.fired) {
    clearTimeout(G.lphl.t);
    G.lphl = null;
  }
}, { passive: true, capture: true });

/* Appui long sur un objet d'inventaire = sa fiche complète */
phone.addEventListener("pointerdown", e => {
  const pe = e.target.closest("[data-prod]");
  if (!pe || e.target.closest("[data-sim],.sw,input,.lnk")) return;
  G.lpp = { el: pe, x: e.clientX, y: e.clientY, t: setTimeout(() => {
    G.lpp.fired = true; pe.classList.add("lpress"); setTimeout(() => pe.classList.remove("lpress"), 350);
    haptic(14); pushSheet({ k: "item", id: pe.dataset.prod });
  }, 440) };
});
phone.addEventListener("pointermove", e => { if (G.lpp && !G.lpp.fired && Math.hypot(e.clientX - G.lpp.x, e.clientY - G.lpp.y) > 8) { clearTimeout(G.lpp.t); G.lpp = null; } });
["pointerup", "pointercancel"].forEach(t => phone.addEventListener(t, () => {
  if (G.lpp) { if (!G.lpp.fired) clearTimeout(G.lpp.t); else { G.sup = Date.now() + 350; G.supEl = phone; } G.lpp = null; }
}));

/* Appui long sur une action [data-sim] = aperçu de l'effet (What-If) */
phone.addEventListener("pointerdown", e => {
  const b = e.target.closest("[data-sim],[data-simseg] button");
  if (!b || b.disabled) return;
  G.lp = { el: b, x: e.clientX, y: e.clientY, t: setTimeout(() => {
    G.lp.fired = true; b.classList.add("bump"); setTimeout(() => b.classList.remove("bump"), 300);
    whatIf(b.dataset.a, b.dataset.v);
  }, 460) };
});
phone.addEventListener("pointermove", e => { if (G.lp && !G.lp.fired && Math.hypot(e.clientX - G.lp.x, e.clientY - G.lp.y) > 8) { clearTimeout(G.lp.t); G.lp = null; } });
phone.addEventListener("pointerup", () => { if (G.lp) { if (G.lp.fired) { G.sup = Date.now() + 450; G.supEl = G.lp.el; } else clearTimeout(G.lp.t); G.lp = null; } });
phone.addEventListener("pointercancel", () => { if (G.lp) { clearTimeout(G.lp.t); G.lp = null; } });

document.addEventListener("keydown", e => {
  if (!isCurrent()) return;
  if (e.key === "Escape" && interactionState?.activePostId) {
    const menu = document.getElementById('pmi_options_menu');
    const trigger = document.querySelector('#post_modal_instagram [data-a="openPostOptions"]');
    if (menu && !menu.hidden) {
      e.preventDefault();
      menu.hidden = true;
      if (trigger) { trigger.setAttribute('aria-expanded', 'false'); trigger.focus({ preventScroll: true }); }
      return;
    }
    if (exportedActions?.closePostModal) exportedActions.closePostModal();
  }
});

phone.addEventListener("click", e => {
  if (e.target.id === "post_modal_instagram" || (e.target.classList && e.target.classList.contains("post-modal-instagram")) || (e.target.closest && e.target.closest('[data-a="closePostModal"]'))) {
    if (exportedActions?.closePostModal) exportedActions.closePostModal();
    return;
  }
  if (Date.now() < G.sup && G.supEl && G.supEl.contains(e.target)) { G.sup = 0; e.preventDefault(); return; }
  if (e.target.id === "ctx") { closeCtx(); return; }
  if (G.role && !e.target.closest("#rmenu") && !e.target.closest(".rp")) { closeVisMenu(); return; }
  if (S.popv && !e.target.closest("#popv") && !e.target.closest('[data-a="popv"]')) { S.popv = false; renderPopv(); }
  if (S.mopts && !e.target.closest("#mopts") && !e.target.closest('[data-a="mopts"]')) { S.mopts = false; renderMopts(); renderMctl(); }
  const f = e.target.closest("[data-focus]");
  if (f) {
    const [k2, id] = f.dataset.focus.split(":");
    S.focus = { k: k2, id };
    const p = focusPos(S.focus);
    drawMap();
    if (p) centerOn(p);
  }
  const b = e.target.closest("[data-a]");
  if (b) { if (b.disabled) return; e.preventDefault(); e.stopPropagation(); act(b.dataset.a, b.dataset.v); return; }
});

/* Carte : épingles, pan, zoom, poignée */
(() => {
  const map = $("map"), tm = $("tm"); let st = null;
  if (tm) tm.addEventListener("pointerdown", e => { st = { x: e.clientX, y: e.clientY, p: S.pan.slice(), moved: false }; map.classList.add("dragging"); tm.setPointerCapture(e.pointerId); });
  if (tm) tm.addEventListener("pointermove", e => {
    if (!st) return;
    const dx = (e.clientX - st.x) / G.sc, dy = (e.clientY - st.y) / G.sc;
    if (!st.moved && Math.hypot(dx, dy) > 6) { st.moved = true; if (!S.tabMin) { S.tabMin = true; applyShell(); } }
    if (st.moved) { const lim = 60 + 130 * (S.z - 1); S.pan = [clamp(st.p[0] + dx, -lim, lim), clamp(st.p[1] + dy, -lim, lim)]; setT(); }
  });
  if (tm) tm.addEventListener("pointerup", e => {
    if (!st) return;
    const moved = st.moved; st = null; map.classList.remove("dragging");
    if (moved) return;
    const el = document.elementFromPoint(e.clientX, e.clientY), p = el && el.closest("[data-pin]");
    if (!p) { if (S.callout || S.focus) { S.callout = null; S.focus = null; renderCallout(); drawMap(); } return; }
    const [k2, id] = p.dataset.pin.split(":");
    S.focus = { k: k2, id }; S.callout = { k: k2, id };
    haptic(6); renderCallout(); drawMap();
  });
  if (tm) tm.addEventListener("wheel", e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
  const mg = $("mgrab"); let gs = null;
  if (mg) mg.addEventListener("pointerdown", e => { gs = { y: e.clientY }; mg.setPointerCapture(e.pointerId); });
  if (mg) mg.addEventListener("pointerup", e => { if (!gs) return; const dy = e.clientY - gs.y; gs = null; if (Math.abs(dy) > 20) { G.sup = Date.now() + 400; G.supEl = mg; if ((dy < 0) !== S.big) act("mapbig"); } });
})();

/* Accessoire : parcourir la chronologie 12 mois */
(() => {
  let on = false; const acc = $("acc");
  if (acc) acc.addEventListener("pointerdown", e => { if (!e.target.closest("#spk")) return; on = true; acc.setPointerCapture(e.pointerId); scrub(e.clientX); });
  if (acc) acc.addEventListener("pointermove", e => { if (on) scrub(e.clientX); });
  if (acc) acc.addEventListener("pointerup", () => on = false);
  if (acc) acc.addEventListener("pointercancel", () => on = false);
})();

/* Barre d'onglets (#tb) : glisser la lentille Liquid Glass */
(() => {
  const tb = $("tb"); let st = null;
  if (tb) tb.addEventListener("pointerdown", e => { if (S.tabMin) return; st = { r: tb.getBoundingClientRect(), x: e.clientX, moved: false }; });
  if (tb) tb.addEventListener("pointermove", e => {
    if (!st) return;
    if (!st.moved && Math.abs(e.clientX - st.x) > 6) { st.moved = true; tb.classList.add("drag"); tb.setPointerCapture(e.pointerId); }
    if (!st.moved) return;
    const w = (st.r.width - 6) / 5, x = clamp(e.clientX - st.r.left - 3 - w / 2, 0, w * 4), hi = Math.round(x / w);
    $("lens").style.transform = `translateX(${x / G.sc}px) scale(1.18,1)`;
    tb.querySelectorAll("button").forEach((b, j) => b.classList.toggle("hov", j === hi));
  });
  if (tb) tb.addEventListener("pointerup", e => {
    if (!st) return;
    const moved = st.moved, r = st.r; st = null; tb.classList.remove("drag");
    tb.querySelectorAll(".hov").forEach(b => b.classList.remove("hov"));
    if (!moved) return;
    G.sup = Date.now() + 450; G.supEl = tb;
    const w = (r.width - 6) / 5, i = clamp(Math.round((e.clientX - r.left - 3 - w / 2) / w), 0, 4);
    tabSelect(i);
  });
})();

/* Feuilles : tirer la poignée pour fermer la feuille (glissement inverse) */
(() => {
  const sh = $("sheet"), wrap = $("sw");
  const DRAG_RATIO = 0.30, DRAG_KNEE = 0.35, DRAG_RESIST = 0.35;
  let st = null;
  if (!sh || !wrap) return;
  sh.addEventListener("pointerdown", e => {
    const origin = e.target.closest("[data-drag]");
    if (!origin) return;
    if (e.target.closest("button") && !origin.classList.contains("sheet-nav")) return;
    if (!S.sh || S.sh.det === "closed" || G.closing) return;
    clearTimeout(G.dragT); G.dragT = null;
    st = { y: e.clientY, h: sh.getBoundingClientRect().height, t: performance.now(), dy: 0, pid: e.pointerId, cap: false };
    /* Un bouton de la nav ne capture pas dès l'appui : le clic serait retargeté
       vers #sheet et l'onglet ne s'activerait plus. La capture suit le geste. */
    if (!e.target.closest("button")) { sh.setPointerCapture(e.pointerId); st.cap = true; }
    wrap.classList.add("dragging");
    sh.style.setProperty("transition", "none", "important");
  });
  sh.addEventListener("pointermove", e => {
    if (!st) return;
    if (!st.cap && Math.abs(e.clientY - st.y) > 4) {
      st.cap = true;
      try { sh.setPointerCapture(st.pid); } catch (_) {}
    }
    const raw = Math.max(0, e.clientY - st.y);
    st.dy = raw <= st.h * DRAG_KNEE ? raw : st.h * DRAG_KNEE + (raw - st.h * DRAG_KNEE) * DRAG_RESIST;
    sh.style.transform = `translateY(${st.dy.toFixed(1)}px)`;
    if (st.dy > 4 && e.cancelable) e.preventDefault();
  });
  const end = () => {
    if (!st) return;
    const { dy, h, t } = st;
    if (dy > 8) { G.sup = Date.now() + 350; G.supEl = sh; }
    const wasCap = st.cap; st = null;
    wrap.classList.remove("dragging");
    if (!wasCap) {
      sh.style.removeProperty("transition");
      sh.style.removeProperty("transform");
      return;
    }
    const v = dy / Math.max(1, performance.now() - t);
    const close = dy > h * DRAG_RATIO || v > 0.55;
    sh.style.setProperty("transition", "transform .34s cubic-bezier(.32,.72,0,1)", "important");
    sh.style.transform = close ? `translateY(${h}px)` : "translateY(0)";
    if (close) {
      G.closing = true; sh.inert = true;
      closeVisMenu(true);
      clearTimeout(G.closeT);
      clearTimeout(G.dragT); G.dragT = null;
      G.closeT = setTimeout(finishClose, 360);
    } else {
      clearTimeout(G.dragT);
      G.dragT = setTimeout(() => { sh.style.removeProperty("transition"); sh.style.removeProperty("transform"); }, 360);
    }
    haptic(close ? 8 : 3);
  };
  sh.addEventListener("pointerup", end);
  sh.addEventListener("pointercancel", end);
})();

phone.addEventListener("input", e => {
  if (e.target.id === "glassr") { S.glass = e.target.value / 100; applyGlass(); }
});

document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
  if (e.key === "Escape") {
    if (G.ctx) closeCtx();
    else if (G.role) closeVisMenu();
    else if (S.popv) { S.popv = false; renderPopv(); }
    else if (S.mopts) { S.mopts = false; renderMopts(); }
    else if (S.sh) setDet("closed");
    return;
  }
  if (e.key === "Enter" && (e.target.id === "q" || e.target.id === "say")) {
    e.preventDefault();
    const v = e.target.value; e.target.value = ""; say(v);
  }
});

let fit = function() {
  const w = $("pwrap");
  if (!w) return;
  if (window.__LKDV_NEXT_PROD && window.innerWidth < 768) {
    G.sc = 1;
    $("phone").style.transform = "";
    w.style.width = "100%";
    w.style.height = "auto";
    return;
  }
  const avail = Math.max(420, window.innerHeight - 32), wa = Math.max(280, (w.parentElement ? w.parentElement.clientWidth : 390) || 390), sc = Math.min(1, avail / 844, wa / 390);
  G.sc = sc;
  $("phone").style.transform = sc < 1 ? `scale(${sc})` : "";
  w.style.width = 390 * sc + "px";
  w.style.height = 844 * sc + "px";
}
window.addEventListener("resize", () => { fit(); syncCardBounds(); }); fit();
let fitVB = function() {
  const tm = $("tm");
  if (!tm) return;
  const w = tm.clientWidth, h = tm.clientHeight;
  if (!w || !h) return;
  const vh = (370 * h) / w;
  tm.setAttribute("viewBox", `0 ${(150 - vh / 2).toFixed(1)} 370 ${vh.toFixed(1)}`);
}
const mapFitEl = $("map");
try { if (mapFitEl) new ResizeObserver(fitVB).observe(mapFitEl); else window.addEventListener("resize", fitVB); } catch (e) { window.addEventListener("resize", fitVB); }
try { fitVB(); } catch (e) { window.addEventListener("resize", fitVB); }
renderTop(); drawMap(); renderAcc(); renderTB(); renderMctl(); renderMopts(); renderCallout(); renderSheet(); renderPopv(); applyShell(); applyGlass();


window.__QR={"n":37,"rows":["1111111011101010010100110111001111111","1000001001000110010001100011101000001","1011101001011000110110010001001011101","1011101011000111010000010011001011101","1011101000110010101100110011101011101","1000001001001110111000101101101000001","1111111010101010101010101010101111111","0000000000011011110100111110100000000","0010111011111011010101000011110001001","1100100111011000111100000011100101011","1110001000110000001111111101101110011","1110110011010001000110011110110100011","1100111101101110011111001101111100010","0011110010001101100011101100101001111","1111011111010111110000001000110100111","0100100100110000100110111111101010010","0001111110110111100010000100111001011","0000010101111110001111110010101000011","1111111101000101001110101100011000111","0100110111100101001100001101000000001","0001001111110101111110010100101101001","1000110110101111110100010010011000001","0011001100111100111011111100110010011","1001010011101101001100100000011000011","0011111010011111110110101001010011011","0000110100010100010100111001010011011","1010011011101101110000011110001001001","0101010001011101001000001111001011011","1011111010001110111000011100111110101","0000000011100000101001101100100010001","1111111001111100000101000001101010111","1000001010010110101011001110100010000","1011101011000000101111010100111111000","1011101000100010110010110010110110011","1011101010101001010000000011010011101","1000001001001010101011010111111110010","1111111001100001001101000001111011011"]};


/* ================= Compte — 50 améliorations : couche d'extension (override des fonctions du générateur) ================= */
(() => {
const X = { filter: 'all', feed: false, visitor: false, ligSub: 0, cmp: null, prof: 'km', story: null, vault: 0, scan: 0, seen: {}, hov: false, mon: null, evt: null, acct: 'me', hold: 0 };
// Interaction state stays inside the owning runtime.
interactionState = X;
{
  const st = document.createElement('div'); st.className = 'story'; st.id = 'story'; st.setAttribute('role', 'dialog'); st.setAttribute('aria-label', 'Story à la une'); phone.appendChild(st);
  const sh = document.createElement('div'); sh.className = 'sunshade'; sh.setAttribute('aria-hidden', 'true'); $('map').insertBefore(sh, $('mgrab'));
}
const END12 = [];
const TEMP12 = [];
const SEASON = i => ['Automne', 'Automne', 'Hiver', 'Hiver', 'Hiver', 'Printemps', 'Printemps', 'Printemps', 'Été', 'Été', 'Été', 'Automne'][i];
let EVENTS = {};
const TRIBU_MASS = {};
/* Reconstruit la chronologie depuis les sorties réelles (jamais de valeurs inventées). */
function rebuildMonthlyStats() {
  const now = new Date();
  const labels = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
  const buckets = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: d.getFullYear() + '-' + d.getMonth(), label: labels[d.getMonth()], km: 0, dplus: 0, mass: null });
  }
  const byKey = new Map(buckets.map((b, i) => [b.key, i]));
  EVENTS = {};
  OUTINGS.forEach(o => {
    if (!o.startedAt) return;
    const d = new Date(o.startedAt);
    if (Number.isNaN(d.getTime())) return;
    const idx = byKey.get(d.getFullYear() + '-' + d.getMonth());
    if (idx == null) return;
    buckets[idx].km += Number(o.km) || 0;
    buckets[idx].dplus += Number(o.dplus) || 0;
    if (!buckets[idx].mass) buckets[idx].mass = o.mass || null;
    EVENTS[idx] = { t: o.title, o: o.id };
  });
  MONTHS_12 = buckets.map(b => [b.label, Math.round(b.km), Math.round(b.dplus), b.mass]);
}
const SCAN_DB = { id: 'p6', n: 'Réchaud Flash', b: 'Jetboil', c: 'Cuisine', w: 371, cond: 'neuf', lent: null, so: 1, paid: 129, maint: null, verdict: 'utile' };
const massId = o => (o.mass === 'Mont-Blanc' ? 'm2' : o.mass === 'Vercors' ? 'm3' : 'm1');
const totalW = () => S.invs.reduce((s, p) => s + p.w, 0);
const cps = p => fmtE(Math.round((p.paid / Math.max(1, p.so)) * 10) / 10);

/* ---------- Initialisation de l'état étendu ---------- */
S.pins = [];
S.note = null;
S.extraHl = [];
S.spPins = [];
S.traveller.nats = ['France'];
S.profile = {
  handle: '',
  name: '',
  followersLabel: '0',
  followersCount: 0,
  followingCount: 0,
  avatarUrl: null,
  bioLine: '',
  sigText: '',
  isGuest: false,
  storeCreditEur: 42.50,
  loyaltyPoints: 1450
};
S.vaultData = { ffcam: '', blood: '', doctor: '' };
S.invs.forEach(p => {
  if (p.id === 'p7') p.wear = { used: 318, max: 350, u: 'L', l: 'Cartouche filtre Katadyn' };
  if (p.id === 'p3') p.wear = { used: 38, max: 40, u: 'sorties', l: 'Avant lavage du duvet' };
});
const LAST = { m1: 2, m2: 1, m3: 2, m4: 7 };
S.massifs.forEach(m => { m.lastVisit = LAST[m.id]; if (m.id === 'm4') m.cached = true; });

/* ---------- Utilitaires graphiques ---------- */
const prof = (seed, n = 14) => { let s = 0; for (const c of seed) s = (s * 31 + c.charCodeAt(0)) % 997; const a = []; for (let i = 0; i < n; i++) { s = (s * 73 + 19) % 997; const t = i / (n - 1); a.push(.25 + .55 * Math.sin(Math.PI * t) * (.7 + .3 * (s % 100) / 100) + .08 * Math.sin(i * 1.7 + s)); } return a; };
const profSvg = (seed, w = 240, hh = 32) => {
  const a = prof(seed), mx = Math.max(...a), mn = Math.min(...a);
  const d = a.map((v, i) => (i ? 'L' : 'M') + (i * w / (a.length - 1)).toFixed(1) + ' ' + (hh - 3 - (v - mn) / (mx - mn || 1) * (hh - 8)).toFixed(1)).join('');
  return `<svg viewBox="0 0 ${w} ${hh}" width="100%" height="${hh}" preserveAspectRatio="none" aria-label="Profil altimétrique"><defs><linearGradient id="pg_${seed}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5B7F55" stop-opacity=".45"/><stop offset="1" stop-color="#5B7F55" stop-opacity="0"/></linearGradient></defs><path d="${d}L${w} ${hh}L0 ${hh}Z" fill="url(#pg_${seed})"/><path d="${d}" fill="none" stroke="#17402C" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
};
const cover = (seed, size = 34) => {
  let s = 0; for (const c of seed) s = (s * 37 + c.charCodeAt(0)) % 1000;
  let p = '';
  for (let r = 1; r <= 5; r++) {
    let d = '';
    for (let k = 0; k <= 24; k++) { const t = k / 24 * Math.PI * 2, rad = r * 3.1 * (1 + .14 * Math.sin(3 * t + s) + .08 * Math.cos(5 * t + s / 3)); d += (k ? 'L' : 'M') + (17 + rad * 1.15 * Math.cos(t)).toFixed(1) + ' ' + (17 + rad * Math.sin(t)).toFixed(1); }
    p += `<path d="${d}Z" fill="${r === 1 ? '#17402C' : 'none'}" stroke="#17402C" stroke-opacity="${(.9 - r * .13).toFixed(2)}" stroke-width="${r === 3 ? 1.3 : .9}"/>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 34 34" aria-hidden="true"><rect width="34" height="34" fill="#E4EDDF"/>${p}</svg>`;
};
const PINIC = 'M9 3h6l-1 6 3 3H7l3-3-1-6ZM12 12v8';

/* ---------- Highlights & stories ---------- */
hlList = function () {
  if (Array.isArray(HIGHLIGHTS) && HIGHLIGHTS.length > 1) return [...HIGHLIGHTS, { id: 'hl5', title: 'Nouveau', mass: 'm1', step: 0, sub: 'Ajouter un moment terrain à la une' }];
  const items = [];
  if (typeof totalW === 'function' && totalW() > 0) {
    items.push({
      id: 'hl4',
      title: 'Sac ' + (totalW() / 1000).toFixed(1).replace('.', ',') + ' kg',
      sub: 'Charge et inventaire du sac',
      mass: 'm1',
      step: 3
    });
  }
  if (Array.isArray(CARNETS) && CARNETS.length > 0) {
    CARNETS.slice(0, 4).forEach((c, i) => {
      items.push({
        id: 'hl_ca_' + c.id,
        title: c.short || (c.title ? c.title.slice(0, 15) : ('Carnet ' + (i + 1))),
        sub: (c.photos || 0) + ' photos · ' + (c.likes || 0) + ' mentions',
        mass: c.mass || 'Alpes',
        step: 2,
        carnet: c
      });
    });
  }
  items.push({ id: 'hl5', title: 'Nouveau', mass: 'm1', step: 0, sub: 'Ajouter un moment terrain à la une' });
  return items;
};

const hlCover = h => {
  if (h && h.coverImage) return `<img src="${esc(h.coverImage)}" alt="" loading="lazy" decoding="async" />`;
  return hlArt(h.id);
};

const unseen = () => 0;

const STORIES = {
  hl4: { title: 'Sac', slides: [{ k: 'gear' }] },
  hl5: { title: 'Nouveau', slides: [] }
};

const storyFor = id => {
  const real = Array.isArray(HIGHLIGHTS) ? HIGHLIGHTS.find((h) => h.id === id) : null;
  if (real) {
    const slides = Array.isArray(real.stories) && real.stories.length
      ? real.stories.map((story) => ({
          k: 'image',
          src: story.image,
          storyId: story.id,
          t: story.caption || real.title || 'Story',
          s: 'Story à la une',
        }))
      : [real.coverImage
          ? { k: 'image', src: real.coverImage, t: real.title || 'Story', s: 'Story à la une' }
          : { k: 'photo', art: real.id, t: real.title || 'Story', s: 'Story à la une' }];
    return { title: real.title || 'Story', slides };
  }
  if (STORIES[id]) return STORIES[id];
  if (id.startsWith('hl_ca_')) {
    const cId = id.slice(6);
    const c = CARNETS.find(q => q.id === cId);
    if (c) {
      return {
        title: c.title || 'Carnet de voyage',
        slides: [
          { k: 'photo', art: c.id, t: c.title, s: c.quote || "Carnet d'expédition" }
        ]
      };
    }
  }
  return { title: 'Story', slides: [] };
};
function slideView(sl) {
  if (!sl) return { body: '', foot: '' };
  if (sl.k === 'trace') {
    const a = prof(sl.seed, 16); const pts = a.map((v, i) => [24 + i * (252 / 15), 215 - v * 175 + (i % 3) * 5]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    return { body: `<div class="st-card"><div class="st-bg">${cover(sl.seed, 330)}</div><svg class="tr" viewBox="0 0 300 250" aria-label="Trace GPS animée"><path class="st-draw" pathLength="1" d="${d}"/><circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="6" fill="#96B391" stroke="#fff" stroke-width="2"/><circle cx="${pts[15][0]}" cy="${pts[15][1]}" r="7" fill="#fff" stroke="#17402C" stroke-width="2.5"/></svg><span class="st-chip a">${sl.wx}</span><span class="st-chip b">${sl.km} · GPS ✓</span></div>`, foot: `<b>${sl.t}</b><small>${sl.s}</small>` };
  }
  if (sl.k === 'image') return { body: `<div class="st-card photo"><img src="${esc(sl.src)}" alt="" loading="lazy" decoding="async" /></div>`, foot: `<b>${esc(sl.t)}</b><small>${esc(sl.s)}</small>` };
  if (sl.k === 'photo') return { body: `<div class="st-card photo">${tileArt(sl.art)}</div>`, foot: `<b>${sl.t}</b><small>${sl.s}</small>` };
  if (sl.k === 'stats') return { body: `<div class="st-card stats">${sl.items.map(i => `<div><b>${i[0]}</b><span>${i[1]}</span></div>`).join('')}</div>`, foot: `<b>${sl.t}</b><small>${sl.s}</small>` };
  if (sl.k === 'species') {
    const sp = SPECIES.find(q => q.id === sl.sp); const on = S.spPins.includes(sp.id);
    return { body: `<div class="st-card species"><div class="sp-card"><b>${sp.n}</b><i>${sp.lat}</i><span>Fiabilité ${sp.conf} · ${sp.date}</span></div><span class="st-chip" style="position:static">${on ? 'Épinglée dans la story ✓' : 'Non épinglée'}</span></div>`, foot: `<b>${sl.t}</b><small>${sl.s}</small><div class="st-act"><button class="st-btn p" data-a="sppin" data-v="${sp.id}">${on ? 'Retirer l\'épingle' : 'Épingler dans la story'}</button></div>` };
  }
  /* gear */
  const cats = {}; S.invs.forEach(p => { cats[p.c] = (cats[p.c] || 0) + p.w; }); const tot = totalW(), mx = Math.max(...Object.values(cats));
  const rows = Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, w]) => `<div class="gr"><span>${c}</span><i><u style="width:${Math.round(w / mx * 100)}%"></u></i><b>${kgs(w)}</b></div>`).join('');
  return { body: `<div class="st-card gear"><div class="tot">${(tot / 1000).toFixed(2).replace('.', ',')} kg</div>${rows}</div>`, foot: `<b>Sac du moment · ${S.invs.length} objets</b><small>${KITS_LINEAGE.length ? KITS_LINEAGE.length + ' kit(s) enregistré(s)' : 'Aucun kit enregistré'}</small><div class="st-act"><button class="st-btn p" data-a="stgear">Dupliquer ce kit dans mon Compas</button></div>` };
}
function renderStory() {
  if (!isCurrent()) return;
  const el = $('story'); if (!el) return; if (!X.story) { el.classList.remove('on'); return; }
  const st = storyFor(X.story.id), n = st.slides.length, i = X.story.i, v = slideView(st.slides[i]);
  const h = hlList().find(q => q.id === X.story.id) || { id: X.story.id, title: st.title };
  const storyId = st.slides[i] && st.slides[i].storyId;
  const eng = X.storyEng || null;
  const viewers = eng && Array.isArray(eng.viewers) ? eng.viewers : [];
  const engage = `<button type="button" class="st-viewcount" data-a="stviews" aria-label="Voir les personnes qui ont vu cette story">◉ ${eng ? eng.viewCount : 0}</button>`;
  const viewerList = viewers.length ? viewers.map((person) => {
    const profileKey = person.id || person.handle || '';
    const when = person.viewedAt ? new Date(person.viewedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'vu';
    return `<button type="button" class="st-viewer-row" data-a="openUserProfile" data-v="${esc(profileKey)}" aria-label="Voir le profil de ${esc(person.name || 'Voyageur')}"><span class="st-viewer-av">${person.avatarUrl ? `<img src="${esc(person.avatarUrl)}" alt="">` : esc((person.name || 'V').charAt(0).toUpperCase())}</span><span class="st-viewer-txt"><b>${esc(person.name || 'Voyageur')}</b><small>@${esc(person.handle || 'voyageur')}</small></span><span class="st-viewer-time">${when}</span><svg class="st-viewer-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>`;
  }).join('') : '<p class="st-viewer-empty">Aucune vue pour le moment.</p>';
  const viewersPanel = `<div class="st-viewers${X.viewersOpen ? ' on' : ''}" role="dialog" aria-modal="true" aria-label="Personnes ayant vu cette story"><button type="button" class="st-viewers-scrim" data-a="stviewclose" aria-label="Fermer"></button><div class="st-viewers-sheet"><div class="st-viewers-head"><span class="st-viewers-title"><b>Vues</b><small>${eng ? eng.viewCount : 0} personne${(eng ? eng.viewCount : 0) === 1 ? '' : 's'}</small></span><button type="button" class="st-viewers-close" data-a="stviewclose" aria-label="Fermer">×</button></div><div class="st-viewers-list" role="list">${viewerList}</div></div></div>`;
  const storyAvatar = (S.profile && S.profile.avatarUrl) || TONY_AVATAR;
  const storyName = (S.profile && S.profile.name) || 'Léa Fontaine';
  el.innerHTML = `<div class="st-bar">${st.slides.map((_, j) => `<i class="${j < i ? 'done' : j === i ? 'cur' : ''}"><b></b></i>`).join('')}</div>
  <div class="st-head">
    <div class="lkdv-post-author st-author"><img class="lkdv-post-author-av" src="${esc(storyAvatar)}" alt=""><span class="lkdv-post-author-txt"><span class="lkdv-post-author-line"><b>${esc(storyName)}</b></span><span class="lkdv-post-author-meta">il y a 2 j</span></span></div>
    <div class="lkdv-story-options st-options">
      <button type="button" class="st-options-btn" data-a="stoptions" aria-label="Options de la story" aria-expanded="false"><span class="st-dots" aria-hidden="true">•••</span><span class="st-close-x" aria-hidden="true">×</span></button>
      <div class="lkdv-story-options-rail st-options-rail" role="menu" aria-label="Options de la story">
        <button type="button" role="menuitem" data-a="stviews" aria-label="Voir les vues"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 12s4-7 10.5-7 10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z"/><circle cx="12" cy="12" r="3"/></svg></button>
        <button type="button" role="menuitem" data-a="stclose" aria-label="Fermer la story"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
    </div>
  </div>
  <div class="st-body">${v.body}</div>
  <button class="st-zone l" data-a="stprev" aria-label="Précédent"></button><button class="st-zone r" data-a="stnext" aria-label="Suivant"></button>
  ${engage}
  ${viewersPanel}`;
  el.classList.add('on'); el.classList.remove('hold');
}
async function loadStoryEngagement() {
  const s = X.story; if (!s) return;
  const st = storyFor(s.id); const slide = st.slides[s.i]; const storyId = slide && slide.storyId;
  if (!storyId) { X.storyEng = null; renderStory(); return; }
  try {
    await fetch(`/api/stories/${storyId}/engagement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'view' }) });
    const res = await fetch(`/api/stories/${storyId}/engagement`);
    X.storyEng = res.ok ? await res.json() : null;
  } catch (_) { X.storyEng = null; }
  renderStory();
}
function openStory(id) {
  if (!isCurrent()) return;
  X.viewersOpen = false; X.storyClosing = false; X.storyDragMoved = false;
  X.story = { id, i: 0 }; X.seen[id] = 1; closeVisMenu(true); S.popv = false;
  const el = $('story');
  if (el) { el.classList.remove('closing', 'dragging'); el.style.transform = ''; el.style.opacity = ''; }
  renderPopv(); renderStory(); renderTop(); lensSoon(); haptic(8); void loadStoryEngagement();
  requestAnimationFrame(() => { if (X.story) $('story')?.classList.add('on'); });
}
function dismissStory(distance = 0) {
  const el = $('story'); const storyRef = X.story;
  if (!el || !storyRef || X.storyClosing) return;
  X.storyClosing = true; X.viewersOpen = false;
  el.classList.remove('dragging'); el.classList.add('closing');
  el.style.transform = `translateY(${Math.max(distance, 932)}px)`;
  el.style.opacity = '0';
  haptic(8);
  setTimeout(() => {
    if (X.story !== storyRef) return;
    X.story = null; X.storyClosing = false;
    el.classList.remove('on', 'closing', 'dragging');
    el.style.transform = ''; el.style.opacity = '';
    renderStory();
  }, 300);
}
function closeStory() { dismissStory(0); }

/* ---------- Tuiles / grille (11-15, 21) ---------- */
const tileMedia = t => t.coverImage ? `<img class="art" src="${esc(t.coverImageSmall || t.coverImage)}" alt="" loading="lazy" decoding="async" />` : tileArt(t.art);
let TILES = function () {
  if (!Array.isArray(CARNETS) || CARNETS.length === 0) return [];
  return CARNETS.map((c, idx) => {
    const isDraft = c.status === 'draft' || c.vis === 'private' || c.visibility === 'private';
    return {
      id: c.id || ('ca_' + idx),
      realId: c.realId || c.id,
      art: c.coverImage || c.cover_image || (['ca2', 'ca1', 'ca3', 'ca0'][idx % 4]),
      customImg: c.coverImage || c.cover_image || null,
      coverImage: c.coverImage || c.cover_image || null,
      coverImageSmall: String(c.coverImage || c.cover_image || '').replace(/([?&])w=\d+/, '$1w=480') || null,
      top: c.mass || c.destination || c.location || 'Carnet',
      bot: c.title || 'Carnet de voyage',
      stat: '♥ ' + (c.likes ?? c.likes_count ?? 0),
      multi: 1,
      m: idx,
      season: 'ete',
      reg: 'alpes',
      focus: 'ca:' + (c.id || idx),
      act: isDraft ? 'pubdraft' : 'openCarnet',
      draft: isDraft,
      priv: isDraft,
      date: c.date || (c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Récent'),
      desc: c.desc || c.description || '',
      pinned: (S.pins || []).includes(c.id) ? 1 : 0
    };
  });
};
const tileById = id => TILES().find(t => t.id === id);
const FILTERS = [['all', 'Toutes'], ['ete', 'Été'], ['hiver', 'Hiver'], ['alpes', 'Alpes IT·FR'], ['pyr', 'Pyrénées']];
const filt = t => X.filter === 'all' || (X.filter === 'ete' && t.season === 'ete') || (X.filter === 'hiver' && t.season === 'hiver') || (X.filter === t.reg);
function visibleTiles() {
  let l = TILES().filter(filt); if (X.visitor) l = l.filter(t => !t.priv);
  const pinned = S.pins.map(id => l.find(t => t.id === id)).filter(Boolean);
  return [...pinned.map(t => ({ ...t, pinned: 1 })), ...l.filter(t => !S.pins.includes(t.id))];
}
const tileTypeMeta = t => t.draft
  ? { icon: IC.pencil, label: 'Brouillon' }
  : (t.act === 'openOuting' ? { icon: IC.route, label: 'Sortie GPS' }
    : (t.act === 'openSpecies' ? { icon: IC.leaf, label: 'Herbier' }
      : (t.multi ? { icon: IC.carousel, label: 'Album photo' } : { icon: IC.image, label: 'Photo' })));
const tileHTML = t => {
  const type = tileTypeMeta(t);
  return `<button class="ig-tile" data-a="${t.act === 'pubdraft' ? 'pubdraft' : 'openPostModal'}" data-v="${esc(t.id)}" data-focus="${esc(t.focus)}" data-m="${esc(t.m)}" data-id="${esc(t.id)}" ${t.act === 'pubdraft' ? 'data-sim="1"' : ''} aria-label="${esc(t.bot)} · ${esc(t.top)} · ${esc(type.label)}${t.pinned ? ' · épinglé' : ''}">
  ${tileMedia(t)}
  <span class="t-type" aria-hidden="true">${ic(type.icon, 'xs')}</span>
</button>`;
};
const feedHTML = t => `<button class="ig-feed-row" data-a="${t.act === 'pubdraft' ? 'pubdraft' : 'openPostModal'}" data-v="${esc(t.id)}" data-focus="${esc(t.focus)}" data-m="${esc(t.m)}" ${t.act === 'pubdraft' ? 'data-sim="1"' : ''}><span class="fa">${tileMedia(t)}</span><span style="min-width:0"><b>${esc(t.bot)} · ${esc(t.top)}</b><small>${esc(t.date)} — ${esc(t.desc)}</small></span><em>${esc(t.stat)}</em></button>`;

function lignees(D) {
  const ligIcons = [IC.gauge, IC.layers, IC.pack];
  const ligLabels = ['Épreuve', 'Filiation', 'Sac'];
  const sub = '<div class="ig-sub" role="tablist" style="--n:3" aria-label="Sections Lignées"><span class="sel-lens" aria-hidden="true" style="--i:' + (X.ligSub || 0) + '"></span>' + ligLabels.map((l, i) => '<button role="tab" data-a="ligsub" data-v="' + i + '" aria-selected="' + (X.ligSub === i) + '" aria-label="' + l + '" title="' + l + '">' + ic(ligIcons[i], 's') + '</button>').join('') + '</div>';
  if (X.ligSub === 0) {
    return '<div class="ig-alt" role="region" aria-label="Lignées de kits et Part créateur">' + sub +
      '<div class="axes2"><div class="axis-box"><div class="ah"><span>Propagation</span><b class="num">' + D.totalProp + '</b></div><div class="bar"><i style="width:' + Math.min(100, D.totalProp) + '%;background:#5B7F55"></i></div><small>Reprises de kits</small></div>' +
      '<div class="axis-box"><div class="ah"><span>Endurance</span><b class="num">' + D.avgEndur + ' %</b></div><div class="bar"><i style="width:' + D.avgEndur + '%;background:#3D7A52"></i></div><small>Preuve terrain</small></div></div>' +
      '<button class="credit-pill" data-a="openStep" data-v="3:1"><div><div class="hl" style="font-size:12.5px;color:var(--tint)">Part créateur · Crédit boutique</div><small>Compte certifié LKDV</small></div><div style="text-align:right"><b class="num">' + fmtE(D.totalCredit) + '</b><small>disponible</small></div></button>' +
      (!KITS_LINEAGE.length ?
        '<div class="ig-empty-native" style="margin-top:14px;padding:24px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:18px;">' +
        '<div style="width:44px;height:44px;border-radius:22px;background:rgba(23,64,44,0.08);display:flex;align-items:center;justify-content:center;margin-bottom:4px;font:700 11px var(--sf);color:#17402C">KIT</div>' +
        '<b style="font:600 14px var(--sf);color:var(--label)">Aucun kit dans votre lignée</b>' +
        '<span style="font:400 12px var(--sf);color:var(--label2)">Créez ou reprenez un kit pour suivre sa propagation et cumuler des royalties boutique.</span>' +
        '<a href="/compas" class="mbtn p" style="margin-top:8px;text-decoration:none">Créer un kit</a></div>' : '') +
      '</div>';
  }
  if (X.ligSub === 1) {
    if (!KITS_LINEAGE.length) {
      return '<div class="ig-alt" role="region" aria-label="Filiation des kits">' + sub +
        '<div class="ig-empty-native" style="padding:24px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:18px;">' +
        '<div style="width:44px;height:44px;border-radius:22px;background:rgba(23,64,44,0.08);display:flex;align-items:center;justify-content:center;margin-bottom:4px;font:700 11px var(--sf);color:#17402C">G1</div>' +
        '<b style="font:600 14px var(--sf);color:var(--label)">Aucune filiation de kit</b>' +
        '<span style="font:400 12px var(--sf);color:var(--label2)">Vos kits souches et reprises s\'afficheront ici dès leur partage.</span>' +
        '<a href="/compas" class="mbtn p" style="margin-top:8px;text-decoration:none">Créer un premier kit</a></div></div>';
    }
    return '<div class="ig-alt" role="region" aria-label="Filiation des kits">' + sub +
      '<svg class="tree" viewBox="0 0 300 70" aria-label="Arbre de filiation G1 G2 G3"><text x="46" y="7" text-anchor="middle">G1 · souche</text><text x="150" y="7" text-anchor="middle">G2</text><text x="254" y="7" text-anchor="middle">G3</text><path d="M58 38C90 38 110 24 138 24M58 38C90 38 110 52 138 52M162 24C200 24 214 18 246 18M162 24C200 24 214 34 246 34M162 52C200 52 214 52 246 52" fill="none" stroke="#5B7F55" stroke-width="1.6" stroke-linecap="round" opacity=".75"/><g data-a="kitsim" data-v="k1"><circle cx="46" cy="38" r="14" fill="#17402C" stroke="#fff" stroke-width="2"/><text x="46" y="41" text-anchor="middle" style="fill:#fff;font-size:9px">Toi</text></g><circle cx="254" cy="18" r="8" fill="#96B391" stroke="#fff" stroke-width="1.6"/></svg></div>';
  }
  const items = (S.invs || []).slice(0, 5);
  return '<div class="ig-alt" role="region" aria-label="Vestiaire matériel">' + sub +
    (items.length ? ('<div class="gc-grid">' + items.map(p => {
      const wr = p.wear ? Math.round(p.wear.used / p.wear.max * 100) : 0;
      return '<button class="gc-tile" data-a="openItem" data-v="' + p.id + '" aria-label="' + p.n + ' ' + kgs(p.w) + '"><b>' + p.n + '</b><small>' + kgs(p.w) + ' · ' + cps(p) + '/sortie</small>' + (p.lent ? '<span class="gb2">Prêté</span>' : '') + '</button>';
    }).join('') + '<button class="gc-tile add" data-a="openscan" aria-label="Ajouter un objet par scan"><span style="font-weight:700;font-size:16px">+</span><b>Objet</b></button></div>') :
    ('<div class="ig-empty-native" style="margin-top:14px;padding:24px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:18px;">' +
     '<div style="width:44px;height:44px;border-radius:22px;background:rgba(23,64,44,0.08);display:flex;align-items:center;justify-content:center;margin-bottom:4px;font:700 11px var(--sf);color:#17402C">SAC</div>' +
     '<b style="font:600 14px var(--sf);color:var(--label)">Votre vestiaire est vide</b>' +
     '<span style="font:400 12px var(--sf);color:var(--label2)">Scannez ou ajoutez vos équipements pour calculer l\'usure et le poids précis de vos sacs.</span>' +
     '<button class="mbtn p" style="margin-top:8px;" data-a="openscan">+ Scanner un équipement</button></div>')
    ) + '</div>';
}
renderIgTabContent = function (D) {
  if (X.acct !== 'me') {
    const c = CLUBS.find(q => q.id === X.acct);
    if (!c) {
      return '<div class="ig-alt"><div class="ig-empty"><span>Club non trouvé.</span><button class="mbtn p" data-a="acct" data-v="me">Revenir à mon profil</button></div></div>';
    }
    return '<div class="ig-alt"><div class="ig-empty"><b style="font:700 14px var(--sf);color:var(--label)">Page club · ' + c.n + '</b><span>' + c.role + ' · ' + (c.members || 0) + ' membres<br>Prochaine sortie : ' + (c.next || 'À venir') + '</span><button class="mbtn p" data-a="acct" data-v="me">Revenir à @' + (S.profile.handle || 'moi') + '</button></div></div>';
  }

  if (X.visitor && S.vis === 0) {
    return '<div class="ig-alt"><div class="ig-empty"><b style="font:700 14px var(--sf);color:var(--label)">Ce profil est privé</b><span>Les publications et sorties sont réservées à son propriétaire.</span></div></div>';
  }

  // TAB 0: Grille
  if (S.igTab === 0) {
    const l = visibleTiles();
    const bar = '';
    if (!l.length) {
      const emptyGrid = '<div class="ig-empty-native" style="padding:28px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;">' +
        '' +
        '<b style="font:600 15px var(--sf);color:var(--label);">Aucun carnet publié</b>' +
        '<p style="font:400 12.5px/1.4 var(--sf);color:var(--label2);max-width:270px;margin:0 auto;">Racontez vos aventures en montagne, partagez vos photos et vos traces GPS vérifiées.</p>' +
        '<button class="mbtn p" data-a="openStep" data-v="2:0" style="height:32px;padding:0 16px;font-size:13px;margin-top:2px;">+ Créer un carnet</button>' +
        '</div>';
      return '<div class="ig-grid-wrap">' + bar + emptyGrid + '</div>';
    }
    const body = X.feed
      ? '<div class="ig-feed" role="feed">' + l.map(feedHTML).join('') + '</div>'
      : '<div class="ig-grid" role="region" aria-label="Grille des publications">' + l.map(tileHTML).join('') + '</div>';
    return '<div class="ig-grid-wrap">' + bar + body + '</div>';
  }

  // TAB 1: Voyages (Sorties faites en défilement horizontal)
  if (S.igTab === 1) {
    const list = OUTINGS;
    if (!list.length) {
      return '<div class="ig-voyages-tab" role="region" aria-label="Sorties faites et voyages réalisés"><div style="padding:28px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;"><b style="font:600 14px var(--sf);color:var(--label);">Aucune sortie enregistrée</b><p style="font:400 12px/1.4 var(--sf);color:var(--label2);max-width:240px;margin:0 auto;">Vos traces GPS et vos sorties apparaîtront ici dès votre première randonnée enregistrée.</p><a href="/compas" class="mbtn p" style="text-decoration:none;height:30px;padding:0 14px;font-size:12px;">Planifier un voyage</a></div></div>';
    }
    return '<div class="ig-voyages-tab" role="region" aria-label="Sorties faites et voyages réalisés">' +
      '<div class="voyages-carousel">' +
        list.map((o, idx) => {
          const photo = o.coverImage || '';
          const compNames = Array.isArray(o.comp) ? o.comp.slice(0, 3).join(', ') : '';
          const label = o.title + ', ' + o.km + ' km, +' + o.dplus + ' m, ' + o.mass;
          return '<button type="button" class="voyage-card" data-a="openOutingDrawer" data-v="' + o.id + '" aria-label="' + label + '">' +
            '<span class="voyage-cover">' +
              (photo
                ? '<img src="' + photo + '" alt="' + o.title + '" class="voyage-img" loading="lazy" />'
                : '<span class="voyage-cover-fallback" aria-hidden="true">' + ic(IC.route, 's') + '</span>') +
              '<span class="voyage-cover-overlay"></span>' +
              '<span class="voyage-chip-gps">' + (o.proven ? 'Preuve GPS ✓' : 'Sortie enregistrée') + '</span>' +
              (o.maxAlt ? '<span class="voyage-alt-badge">' + o.maxAlt + ' m</span>' : '') +
              '<span class="voyage-info">' +
                '<b class="voyage-title">' + o.title + '</b>' +
                '<span class="voyage-sub">' + (o.date || 'Sortie') + (compNames ? ' · avec ' + compNames : '') + '</span>' +
                '<span class="voyage-metrics">' +
                  '<span class="vm-item"><b>' + o.km + ' km</b></span><span class="vm-sep">·</span>' +
                  '<span class="vm-item"><b>+' + Number(o.dplus || 0).toLocaleString('fr-FR') + ' m</b></span><span class="vm-sep">·</span>' +
                  '<span class="vm-item"><b>' + o.mass.split(' ')[0] + '</b></span>' +
                '</span>' +
              '</span>' +
            '</span>' +
          '</button>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  // TAB 2: Réseau (Abonnements & Abonnés réels)
  if (S.igTab === 2) {
    X.reseauMode = X.reseauMode || 'following';
    const isFollowers = X.reseauMode === 'followers';
    const fCount = FOLLOWERS.length;
    const ingCount = FOLLOWING.length;
    const currentList = (isFollowers ? FOLLOWERS : FOLLOWING).map(u => ({
      id: u.id,
      n: u.n,
      h: u.ps,
      i: u.i,
      sub: u.mass || 'Voyageur',
      img: u.avatar || '',
      followed: isFollowers ? FOLLOWING.some(f => f.id === u.id) : true
    }));
    return '<div class="ig-reseau-tab" role="region" aria-label="Communauté et Réseau">' +
      '<div class="reseau-toggle-wrap">' +
        '<div class="reseau-toggle segc" role="group" aria-label="Filtrer abonnements et abonnés" style="--n:2"><span class="sel-lens" aria-hidden="true" style="--i:' + (isFollowers ? 1 : 0) + '"></span>' +
          '<button class="' + (!isFollowers ? 'active' : '') + '" data-a="toggleReseau" data-v="following" aria-pressed="' + (!isFollowers) + '" aria-label="Abonnements (' + ingCount + ')" title="Abonnements">' + ic(IC.user, 's') + '</button>' +
          '<button class="' + (isFollowers ? 'active' : '') + '" data-a="toggleReseau" data-v="followers" aria-pressed="' + (isFollowers) + '" aria-label="Abonnés (' + fCount + ')" title="Abonnés">' + ic(IC.people, 's') + '</button>' +
        '</div>' +
      '</div>' +
      (currentList.length ? '<div class="reseau-list">' +
        currentList.map(u => {
          return '<div class="reseau-user-row">' +
            '<div class="reseau-av-wrap" data-a="openUserProfile" data-v="' + u.h + '" style="cursor:pointer">' +
              (u.img ? '<img src="' + u.img + '" alt="' + u.n + '" class="reseau-av" loading="lazy" />' : '<span class="reseau-av" style="display:grid;place-items:center;background:#DDEBD8;color:#17402C;font:700 12px var(--sf)">' + u.i + '</span>') +
              '<span class="reseau-seal-badge">✓</span>' +
            '</div>' +
            '<div class="reseau-meta" data-a="openUserProfile" data-v="' + u.h + '" style="cursor:pointer">' +
              '<div class="reseau-name-row"><b>' + u.n + '</b><span class="reseau-handle">@' + u.h + '</span></div>' +
              '<div class="reseau-sub">' + u.sub + '</div>' +
            '</div>' +
            '<button class="reseau-btn ' + (u.followed ? 'active' : 'primary') + '" data-a="toggleFollowUser" data-v="' + u.h + '">' +
              (u.followed ? 'Abonné(e)' : 'Suivre') +
            '</button>' +
          '</div>';
        }).join('') +
      '</div>' : '<div style="padding:28px 16px;text-align:center;color:var(--label2);font:400 12px/1.4 var(--sf);">' + (isFollowers ? 'Aucun abonné pour le moment.' : 'Aucun abonnement pour le moment.') + '</div>') +
    '</div>';
  }

  // TAB 3: Lignées (Matériel & Sac)
  if (S.igTab === 3) return lignees(D);
};
card = function () {
  const D = derive(), me = X.acct === 'me', club = CLUBS.find(q => q.id === X.acct);
  const P = S.profile || { handle: 'visiteur', name: 'Voyageur invité', followersCount: 0, followingCount: 0, isGuest: true };
  const aviSrc = P.avatarUrl;
  const initial = (P.name || 'V').charAt(0).toUpperCase();
  const aviImg = aviSrc ? '<img src="' + aviSrc.replace(/"/g, '&quot;') + '" alt="Photo de profil @' + P.handle + '">' : '<span style="font:700 22px var(--sf);color:#17402C">' + initial + '</span>';
  
  const stats = me
    ? [[D.pubCount, 'publications', 'igtab', '0'], [Number(P.followersCount || 0).toLocaleString('fr-FR'), 'abonnés', 'openFollowers', ''], [Number(D.followingCount || 0).toLocaleString('fr-FR'), 'abonnements', 'openFollowing', '']]
    : [[String(club?.members || 0), 'membres', 'openFollowers', ''], [1, 'sorties', 'igtab', '1'], [1, 'organisateur', 'openFollowers', '']];

  // ADR-012: Legacy profile meta template retained for preview synchronizers & schema contracts
  const _LEGACY_LEFT_META = '<div class="ig-left-meta"><div class="ig-handle-sub">@' + P.handle + '</div></div>';

  const igTabs = '<div class="ig-tabs" role="tablist" aria-label="Contenus du profil">' +
    '<span class="ig-th lens" style="transform:translateX(' + (S.igTab * 100) + '%)"></span>' +
    '<button role="tab" aria-selected="' + (S.igTab === 0) + '" data-a="igtab" data-v="0" aria-label="Grille des publications"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></button>' +
    '<button role="tab" aria-selected="' + (S.igTab === 1) + '" data-a="igtab" data-v="1" aria-label="Sorties et voyages faits"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg></button>' +
  '</div>';

  const cleanBio = String(P.bioLine || "")
    .replace(/^\s*·\s*/, "")
    .replace(/^IT\s*[·.]\s*FR\s*[·.]?\s*/i, "")
    .replace(/^IT\s*[·.]\s*/i, "")
    .replace(/^\s*·\s*/, "")
    .trim();
  const bioText = cleanBio || (P.isDemo || P.isGuest ? "Passion montagne, bivouac léger et sorties en altitude." : "");
  const dplusK = (Math.round((D.totalDplus || 0) / 100) / 10).toLocaleString("fr-FR");
  const bioHtml = me
    ? '<div class="ig-bio">' +
      '<div class="ig-bio-top">' +
        (P.isDemo ? '<b class="ig-bio-cc" aria-label="Italie, France">IT · FR</b>' +
        '<span class="ig-bio-dot" aria-hidden="true">·</span>' : '') +
        '<span class="ig-bio-stats">' + D.totalOutings + ' sorties · ' + D.totalKm + ' km · ' + dplusK + ' k m D+</span>' +
      '</div>' +
      (bioText ? '<p class="ig-bio-text">' + bioText + '</p>' : '') +
    '</div>'
    : '<div class="ig-bio">' +
      '<div class="ig-bio-top">' +
        '<b class="ig-bio-cc">' + (club?.n || 'Club') + '</b>' +
        '<span class="ig-bio-dot" aria-hidden="true">·</span>' +
        '<span class="ig-bio-stats">' + (club?.members ?? 0) + ' membres · Prochaine sortie · ' + (club?.next || 'À venir') + '</span>' +
      '</div>' +
      '<p class="ig-bio-text">' + (club?.role || 'Page club') + '</p>' +
    '</div>';

  return '<div class="card-scroll">' +
    '<div class="ig-header">' +
    '<div class="ig-left">' +
      '<button class="ig-avi-wrap ' + (unseen() ? 'live' : '') + '" data-a="openStep" data-v="0:2" aria-label="Avatar et Sceau d\'empreinte de @' + P.handle + '">' +
        '<span class="ig-avi-in">' + (me ? aviImg : cover(club?.id || 'cl', 62)) + '</span>' +
        '<span class="ig-seal-bdg" data-a="sealzoom" role="button" title="Agrandir le Sceau d\'empreinte (ADR-010)">' + renderSeal(16, 0.85) + '</span>' +
      '</button>' +
    '</div>' +
    '<div class="ig-right">' +
      '<div class="ig-stats" role="group" aria-label="Statistiques du profil">' + stats.map(s => '<button class="ig-stat" data-a="' + s[2] + '" data-v="' + s[3] + '" aria-label="' + s[0] + ' ' + s[1] + '"><b class="num ' + (s[1] === 'publications' && X.bump ? 'stat-bump' : '') + '">' + s[0] + '</b><span>' + s[1] + '</span></button>').join('') + '</div>' +
    '</div>' +
  '</div>' +
  bioHtml +
  '<div class="ig-hl-row" role="region" aria-label="Stories à la une">' + hlList().map(h => '<button class="ig-hl ' + (X.seen[h.id] ? 'seen' : '') + '" data-a="openHighlight" data-v="' + h.id + '" data-hl-id="' + h.id + '" aria-label="Story à la une ' + h.title + '"><span class="ig-hl-ring"><span class="ig-hl-in">' + hlCover(h) + '</span></span><span>' + h.title + '</span></button>').join('') + '</div>' +
  '<div class="ig-swipe-view" data-tab="' + S.igTab + '">' + (S.igTab === 1 ? '<div class="ig-swipe-back" aria-hidden="true"></div>' : '') + renderIgTabContent(D) + '</div>' +
  '</div>' +
  '<div class="ig-tabs-float">' + igTabs + '</div>';
};
renderTop = function () {
  const D = derive(), N = nextDecision(D), ns = N ? N.step : null; G.next = N;
  const cardHtml = card(); X.bump = false;
  const me = X.acct === 'me', club = CLUBS.find(q => q.id === X.acct);
  const P = S.profile || { handle: 'tony_frc', name: 'Тоny' };
  const focusScope = document.activeElement && document.activeElement.closest
    ? document.activeElement.closest('#top, #card')
    : null;
  const focused = focusScope
    ? { a: document.activeElement.dataset.a, v: document.activeElement.dataset.v, inCard: focusScope.id === 'card' }
    : null;
  $('phone').classList.toggle('hasnext', ns != null);
  $('top').innerHTML = `<div class="ig-top">
    <button class="lg ig-handle rp" id="rpvis" data-a="vismenu" aria-haspopup="menu" aria-label="Profil ${me ? '@' + P.handle : club.n} · Visibilité : ${VIS_LABELS[S.vis]}">
      <span>${me ? P.handle : club.id}</span></button>
    <div class="ig-top-r">
      <button class="lg gbtn ig-top-btn" data-a="openCreate" aria-label="Créer un carnet, voyage, kit ou club">${ic(IC.plus, "s")}</button>
      <button class="lg gbtn ig-top-btn" data-a="popv" aria-label="Affichage : mode extérieur et intensité du verre" aria-expanded="${S.popv}">${ic(IC.sun, "s")}</button>
      <button class="lg gbtn ig-top-btn" data-a="openAccountDrawer" aria-label="Commandes, notifications, paramètres, profil et partage">${ic(IC.sliders, "s")}</button>
    </div></div>
  <button class="cs mini" data-a="mapbig" aria-label="Réduire la carte et revenir au profil"><b>${P.name} · @${P.handle} ${P.isDemo ? '<span class="flag-badge">IT · FR</span>' : ''} ${AI}</b><span>${D.sigText}</span></button>
  <div class="card cs" id="card">${cardHtml}</div>`;
  requestAnimationFrame(() => {
    syncCardBounds();
    if (focused && focused.a) {
      const sel = '[data-a="' + focused.a + '"]' + (focused.v !== undefined ? '[data-v="' + focused.v + '"]' : '');
      const next = document.querySelector((focused.inCard ? '#card ' : '#top ') + sel) || document.querySelector(sel);
      if (next) { try { next.focus({ preventScroll: true }); } catch (_) {} }
    }
  });
};

/* ---------- Glissement grille ↔ sorties (v20) ---------- */
const SWIPE_MIN = 60, SWIPE_STRONG = 120, SWIPE_EDGE = 24, SWIPE_MAX_Y = 44;
let igSwipe = null;
let bindIgSwipe = function () {
  const top = $('top');
  if (!top || top._igSwipeBound) return;
  top._igSwipeBound = true;

  const settle = function (view) {
    view.classList.remove('swiping');
    view.classList.add('settle');
    view.style.transform = '';
    setTimeout(function () {
      view.classList.remove('settle');
      view.style.transform = '';
    }, 360);
  };

  const swipeTo = function (view, next, outClass, inClass) {
    view.classList.remove('swiping', 'settle');
    view.classList.add(outClass);
    view.style.transform = '';
    setTimeout(function () {
      if (!top.isConnected) return;
      S.igTab = next;
      renderTop();
      const fresh = top.querySelector('.ig-swipe-view');
      if (fresh) {
        fresh.classList.add(inClass);
        setTimeout(function () { fresh.classList.remove(inClass); }, 360);
      }
      G.sup = Date.now() + 350;
      G.supEl = top;
      haptic(6);
    }, 180);
    setTimeout(function () { view.classList.remove(outClass); }, 360);
  };

  top.addEventListener('pointerdown', function (e) {
    if (e.isPrimary === false || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (S.sh || (S.igTab !== 0 && S.igTab !== 1)) return;
    if (igSwipe && igSwipe.view) {
      igSwipe.view.classList.remove('swiping');
      igSwipe.view.style.transform = '';
    }
    igSwipe = null;
    const target = e.target;
    const view = target && target.closest ? target.closest('.ig-swipe-view') : null;
    if (!view || !top.contains(view)) return;
    const edge = !!(target.closest && target.closest('.ig-swipe-back'));
    igSwipe = { x: e.clientX, y: e.clientY, dx: 0, dy: 0, view: view, id: e.pointerId, tab: S.igTab, active: false, cap: false, edge: edge };
  });

  top.addEventListener('pointermove', function (e) {
    if (!igSwipe || e.pointerId !== igSwipe.id) return;
    const dx = e.clientX - igSwipe.x;
    const dy = e.clientY - igSwipe.y;
    igSwipe.dx = dx;
    igSwipe.dy = dy;
    if (!igSwipe.active) {
      if (Math.abs(dx) <= 10 || Math.abs(dx) <= Math.abs(dy)) return;
      igSwipe.active = true;
      igSwipe.view.classList.remove('settle');
      igSwipe.view.classList.add('swiping');
      G.sup = Date.now() + 350;
      G.supEl = igSwipe.view;
    }
    if (igSwipe.tab === 0 || igSwipe.edge) {
      if (!igSwipe.cap) {
        igSwipe.cap = true;
        try { igSwipe.view.setPointerCapture(igSwipe.id); } catch (_) {}
      }
      if (e.cancelable) e.preventDefault();
      if (igSwipe.tab === 0) igSwipe.view.style.transform = 'translateX(' + (dx * 0.45).toFixed(1) + 'px)';
    }
  }, { passive: false });

  const endSwipe = function (e) {
    if (!igSwipe || e.pointerId !== igSwipe.id) return;
    const st = igSwipe;
    igSwipe = null;
    if (!st.active) return;
    const canceled = e.type === 'pointercancel';
    const hasX = typeof e.clientX === 'number';
    const dx = (!canceled && hasX) ? e.clientX - st.x : st.dx;
    const dy = (!canceled && hasX) ? e.clientY - st.y : st.dy;
    G.sup = Date.now() + 350;
    G.supEl = st.view;
    if (st.tab === 0) {
      if (!canceled && dx < -SWIPE_MIN) swipeTo(st.view, 1, 'out-left', 'in-right');
      else settle(st.view);
      return;
    }
    if (!canceled && ((st.edge && dx < -SWIPE_MIN) || (dx < -SWIPE_STRONG && Math.abs(dy) < SWIPE_MAX_Y))) swipeTo(st.view, 0, 'out-right', 'in-left');
    else settle(st.view);
  };
  top.addEventListener('pointerup', endSwipe);
  top.addEventListener('pointercancel', endSwipe);
};

/* ---------- Menu de visibilité + vue visiteur (3) ---------- */
openVisMenu = function () {
  const pill = $('rpvis'); if (!pill) return;
  const m = $('rmenu'), R = relRect(pill), W = 180, H = 54;
  const GAP = 8;
  const phoneW = ($('phone') && $('phone').clientWidth) || 390;
  const phoneH = ($('phone') && $('phone').clientHeight) || 844;
  G.role = { R };
  m.style.transition = 'none';
  Object.assign(m.style, {
    left: R.x + 'px',
    top: (R.y + R.h + GAP) + 'px',
    width: R.w + 'px',
    height: R.h + 'px',
    transformOrigin: 'top left'
  });
  m.innerHTML = '<div class="ri" style="padding:4px"><button role="menuitem" data-a="signout" style="color:#d9480f;font-weight:600;display:flex;align-items:center;gap:8px;padding:10px 14px;width:100%;border-radius:12px;background:rgba(217,72,15,0.08);border:0;cursor:pointer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg><span>Se déconnecter</span></button></div>';
  void m.offsetWidth;
  m.style.transition = '';
  m.classList.add('on');
  const top = clamp(R.y + R.h + GAP, 48, phoneH - H - 20);
  const left = clamp(R.x, 12, phoneW - W - 12);
  Object.assign(m.style, { left: left + 'px', top: top + 'px', width: W + 'px', height: H + 'px' });
  pill.style.opacity = '1';
  haptic(8);
};

/* ---------- Accessoire : 3 modes, repères, scrubber filtrant (21-24) ---------- */
renderAcc = function () {
  if (!$("acc")) return;
  const D = derive();
  const vals = MONTHS_12.map(m => m[1]);
  const mn = Math.min(...vals), mx = Math.max(...vals), W = 200, H = 28;
  const x = i => i * W / (vals.length - 1), y = v => H - 2 - ((v - mn) / ((mx - mn) || 1)) * (H - 6);
  const p = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const marks = Object.keys(EVENTS).map(i => `<path d="M${x(+i).toFixed(1)} ${y(vals[+i]).toFixed(1)}h0" stroke="#5B7F55" stroke-width="7" stroke-linecap="round" vector-effect="non-scaling-stroke"/><path d="M${x(+i).toFixed(1)} ${y(vals[+i]).toFixed(1)}h0" stroke="#fff" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`).join('');
  $('acc').innerHTML = `<span class="ab" aria-hidden="true">${ic(IC.mount, 's')}</span>
  <div class="ro" data-a="roclick" role="button"><b id="ro1">${D.totalKm} km</b><span id="ro2">12 derniers mois · sorties GPS</span></div>
  <svg class="spk" id="spk" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="slider" aria-label="Chronologie des 12 derniers mois" tabindex="0"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5B7F55" stop-opacity=".4"/><stop offset="1" stop-color="#5B7F55" stop-opacity="0"/></linearGradient></defs><path d="${p}L${W} ${H}L0 ${H}Z" fill="url(#sg)"/><path d="${p}" fill="none" stroke="#17402C" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>${marks}<line id="sl" x1="-9" x2="-9" y1="0" y2="${H}" stroke="#17402C" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>
  <i class="j4" data-a="departure" role="button" aria-label="Départ J-4 : check-list"></i>`;
};
function filterMonth(i) { document.querySelectorAll('.ig-tile,.ig-feed-row').forEach(el => { const on = i != null && +el.dataset.m === i; el.classList.toggle('lit', on); el.classList.toggle('dim', i != null && !on); }); }
scrub = function (cx) {
  const el = $('spk'); if (!el) return;
  const r = el.getBoundingClientRect(), t = clamp((cx - r.left) / r.width, 0, 1), i = Math.round(t * 11);
  const m = MONTHS_12[i], mass = m[3] ? S.massifs.find(q => q.id === m[3]) : null, dot = $('dot');
  if (dot && mass) dot.setAttribute('transform', `translate(${mass.x},${mass.y})`);
  $('sl').setAttribute('x1', t * 200); $('sl').setAttribute('x2', t * 200);
  const ev = EVENTS[i]; X.evt = ev || null;
  $('ro1').textContent = m[1] + ' km · ' + m[2] + ' m';
  $('ro2').textContent = ev ? ev.t + ' ↗' : m[0];
  if (i !== X.mon) { X.mon = i; haptic(4); filterMonth(i); }
};
const accEl = $('acc'); if (accEl) accEl.addEventListener('pointerup', () => { clearTimeout(X.mt); X.mt = setTimeout(() => { X.mon = null; filterMonth(null); }, 1600); });

/* ---------- Carte : clusters k-anonymat, comparateur, halo (16, 17, 18, 20) ---------- */
const _drawMap = drawMap;
drawMap = function () {
  _drawMap();
  const g = document.getElementById('tmg'); if (!g) return; let h = '';
  const font = 'font-family="-apple-system,Inter,sans-serif"';
  if (!X.visitor && S.vis !== 0) S.massifs.filter(m => m.outings < 3).forEach(m => {
    h += `<g transform="translate(${m.x},${m.y})" data-pin="m:${m.id}" style="cursor:pointer"><circle r="${m.r * 1.1}" fill="rgba(255,255,255,.3)" stroke="#5B7F55" stroke-width="1.4" stroke-dasharray="2 3"/><circle r="10" fill="rgba(255,255,255,.88)" stroke="#5B7F55" stroke-width="1.5" stroke-dasharray="2 2"/><text y="3.4" text-anchor="middle" ${font} font-weight="700" font-size="8.5" fill="#17402C">${m.outings}/3</text></g>`;
  });
  if (X.cmp) { const common = (TRIBU_MASS[X.cmp] || []).map(id => S.massifs.find(m => m.id === id)).filter(Boolean); common.forEach(m => { h += `<g transform="translate(${m.x},${m.y})" style="pointer-events:none"><circle r="${m.r * 1.35}" fill="rgba(150,186,142,.35)" stroke="#3D7A52" stroke-width="2"/><text y="${m.r * 1.35 + 9}" text-anchor="middle" ${font} font-weight="700" font-size="7.5" fill="#17402C">EN COMMUN</text></g>`; }); }
  g.insertAdjacentHTML('beforeend', h);
};
const _renderCallout = renderCallout;
renderCallout = function () {
  if (!$("callout")) return;
  _renderCallout();
  const el = $('callout'), c = S.callout; if (!c || el.hidden || c.k !== 'm') return;
  const m = S.massifs.find(q => q.id === c.id); if (!m) return;
  el.insertAdjacentHTML('beforeend', `<div class="co-prof">${profSvg(m.id, 240, 22)}</div>${m.outings < 3 ? `<div class="co-hint">+${3 - m.outings} sortie pour apparaître sur ton empreinte publique</div>` : ''}`);
};

/* ---------- Mutations annulables supplémentaires ---------- */
MUT.pin = v => { const i = S.pins.indexOf(v), t = tileById(v); if (i >= 0) { S.pins.splice(i, 1); return 'Désépinglé : ' + (t ? t.bot : v); } if (S.pins.length >= 3) return 'Maximum 3 épingles : désépingle-en une'; S.pins.push(v); return 'Épinglé en tête de grille : ' + (t ? t.bot : v); };
MUT.note = v => { S.note = v ? { t: v, exp: 'expire dans 24 h' } : null; return v ? 'Note : « ' + v + ' » · 24 h' : 'Note retirée'; };
MUT.nat = v => { const a = S.traveller.nats, i = a.indexOf(v); if (i >= 0) { if (a.length === 1) return 'Garde au moins une nationalité'; a.splice(i, 1); } else a.push(v); S.traveller.nationality = a[0]; return 'Nationalités : ' + a.join(' + '); };
MUT.lendfree = v => { const p = S.invs.find(x => x.id === v); if (!p) return null; p.lendFree = !p.lendFree; return p.lendFree ? p.n + ' : prêt gratuit pour ta tribu' : p.n + ' : prêt désactivé'; };
MUT.additem = () => {
  if (S.invs.some(p => p.id === SCAN_DB.id)) return 'Déjà dans ton kit';
  S.invs.push({ ...SCAN_DB });
  try {
    localStorage.setItem(storageKey('lkdv_inventory_items_v1'), JSON.stringify(S.invs));
  } catch (_) {}
  notifyHostAction('additem', SCAN_DB);
  return SCAN_DB.b + ' ' + SCAN_DB.n + ' ajouté au kit actif';
};
MUT.purge = () => { const l = S.massifs.filter(m => m.cached && m.lastVisit >= 6); if (!l.length) return 'Rien à purger : tout a été visité récemment'; l.forEach(m => { m.cached = false; }); return 'Cache libéré : ' + l.map(m => m.name).join(', ') + ' (' + l.reduce((s, m) => s + m.cacheMb, 0) + ' Mo)'; };
MUT.addhl = v => { if (S.extraHl.some(e => e.o === v)) return 'Déjà à la une'; S.extraHl.push({ o: v }); const o = OUTINGS.find(q => q.id === v); return 'Story « ' + o.mass.split(' ')[0] + ' » ajoutée à la une'; };
MUT.sppin = v => { const i = S.spPins.indexOf(v); if (i >= 0) S.spPins.splice(i, 1); else S.spPins.push(v); const sp = SPECIES.find(q => q.id === v); return i >= 0 ? 'Épingle retirée : ' + sp.n : sp.n + ' épinglé dans la story'; };
MUT.usecredit = () => { S.creditUsed = !S.creditUsed; const c = fmtE(derive().totalCredit); return S.creditUsed ? c + ' appliqués · pré-remplis dans Budget et Kit du Compas' : 'Crédit boutique rétabli (' + c + ')'; };
const _pub = MUT.pubdraft; MUT.pubdraft = () => { X.bump = true; return _pub(); };

/* ---------- Voix et commandes composées (46) ---------- */
const _say = say;
say = function (txt) {
  const parts = norm(txt).split(/\s*(?:,|;|\bet\b|\bpuis\b|\bensuite\b)\s*/).filter(Boolean); let n = 0;
  const nats = { france: 'France', italie: 'Italie', suisse: 'Suisse', belgique: 'Belgique', canada: 'Canada', espagne: 'Espagne' };
  parts.forEach(p => {
    let m;
    if ((m = /(?:ajoute|ajouter)\s+(?:la |l'|le )?([a-z]+)/.exec(p)) && nats[m[1]]) { if (!S.traveller.nats.includes(nats[m[1]])) { doMut('nat', nats[m[1]]); n++; } return; }
    if (/epingl/.test(p)) { const t = TILES().find(q => p.includes(norm(q.bot).split(' ')[0])); if (t) { doMut('pin', t.id); n++; return; } }
    if (/visiteur/.test(p)) { EXA.visitor(); n++; return; }
    _say(p); n++;
  });
  if (n > 1) island(n + ' actions appliquées', 'Chacune est annulable une à une avec Annuler', true);
};

/* ---------- Feuilles supplémentaires ---------- */
const chip = (a, v, label, on) => `<button class="chip" data-a="${a}" data-v="${v}" aria-pressed="${on}">${label}</button>`;
function sealBadges() {
  const D = derive();
  return [
    ['Sorties', String(D.totalOutings)],
    ['Kilomètres', D.totalKm + ' km'],
    ['Dénivelé', D.totalDplus.toLocaleString('fr-FR') + ' m'],
    ['Matériel', S.invs.length + ' objets'],
    ['Kits', String(KITS_LINEAGE.length)],
    ['Espèces', String(SPECIES.length)],
    ['Tribu', String(TRIBU.length)],
  ];
}
const editProfileBody = (P) => `
  <div class="apple-grouped-card">
    <div class="apple-avatar-header">
      <div class="apple-av-wrap" data-a="changeAvatar" title="Changer la photo de profil">
        ${P.avatarUrl ? `<img id="ep_av_preview" src="${P.avatarUrl}" alt="Avatar" class="apple-av-img" />` : `<span id="ep_av_preview" class="apple-av-img" style="display:grid;place-items:center;background:#DDEBD8;color:#17402C;font:700 24px var(--sf)">${(P.name || 'V').charAt(0).toUpperCase()}</span>`}
        <span class="apple-av-cam">${ic(IC.plus, 'xs')}</span>
      </div>
      <button class="mbtn soft" style="height:28px;padding:0 14px" data-a="changeAvatar">Changer la photo</button>
    </div>
  </div>
  <div class="apple-grouped-card">
    <div class="apple-grouped-title">Identité</div>
    <div class="apple-input-row"><label class="ep-label">Nom complet</label><input id="ep_name" class="apple-input" value="${(P.name || '').replace(/"/g, '&quot;')}" /></div>
    <div class="apple-input-row"><label class="ep-label">Identifiant (@handle)</label><input id="ep_handle" class="apple-input" value="${(P.handle || '').replace(/"/g, '&quot;')}" /></div>
    <div class="apple-input-row"><label class="ep-label">Bio & Démarche de marche</label><input id="ep_bio" class="apple-input" value="${(P.bioLine || '').replace(/"/g, '&quot;')}" /></div>
  </div>
  <div class="apple-grouped-card">
    <div class="apple-grouped-title">Allure de marche & Randonnée</div>
    <div class="apple-input-row">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><label class="ep-label">Allure moyenne</label><b id="ep_pace_lbl" class="num" style="color:var(--tint);font-weight:700;font-size:14px">4,2 km/h</b></div>
      <input id="ep_pace" class="apple-pace-slider" type="range" min="30" max="60" value="42" oninput="document.getElementById('ep_pace_lbl').textContent=(this.value/10).toFixed(1).replace('.',',')+' km/h'" />
    </div>
    <div class="sumline" style="background:rgba(235,242,236,.7);border-radius:12px;padding:8px 10px;color:var(--tint);margin-top:6px"><b>Impact sur le Compas :</b> Le Compas privilégiera un sac &lt; 5 kg et modulera les étapes journalières.</div>
  </div>
  <div class="apple-grouped-card">
    <div class="apple-grouped-title">Pratique & Autonomie</div>
    <div class="apple-input-row"><label class="ep-label">Terrain de prédilection</label><div class="chips">${ORIENT_OPTS.terrain.map(([k, l]) => `<button class="chip" data-a="orient" data-v="terrain:${k}" data-sim="1" aria-pressed="${S.orient.terrain === k}">${l}</button>`).join('')}</div></div>
    <div class="apple-input-row"><label class="ep-label">Degré d'Autonomie</label><div class="chips">${ORIENT_OPTS.autonomy.map(([k, l]) => `<button class="chip" data-a="orient" data-v="autonomy:${k}" data-sim="1" aria-pressed="${S.orient.autonomy === k}">${l}</button>`).join('')}</div></div>
    <div class="apple-input-row"><label class="ep-label">Priorité sac & matériel</label><div class="chips">${ORIENT_OPTS.priority.map(([k, l]) => `<button class="chip" data-a="orient" data-v="priority:${k}" data-sim="1" aria-pressed="${S.orient.priority === k}">${l}</button>`).join('')}</div></div>
  </div>
  <div class="apple-grouped-card">
    <div class="apple-grouped-title">Localisation & Domicile</div>
    <div class="chips">${["Lyon", "Chamonix", "Grenoble", "Annecy", "Turin", "Paris"].map(h => `<button class="chip" data-a="home" data-v="${h}" data-sim="1" aria-pressed="${S.traveller.home === h}">${h}</button>`).join("")}</div>
    <small style="color:var(--label2);font-size:10.5px;margin-top:4px">Zone floutée à 1 km près sur la carte (RLS stricte).</small>
  </div>
  <button class="mbtn p" style="width:100%;height:42px;justify-content:center;border-radius:999px;font-size:14px;font-weight:700" data-a="save_full_profile">Enregistrer les modifications</button>
`;
const EXK = {
  edit_profile_full: () => {
    const P = S.profile || { handle: 'tony_frc', name: 'Тоny' };
    return {
      title: 'Modifier le profil',
      peek: 'Édition complète du profil LKDV',
      flow: [{
        l: 'Profil',
        r: () => ({
          per: [1, 1],
          title: '',
          rows: [
            `<div class="apple-edit-sheet">
              <div class="apple-nav-bar">
                <button class="apple-nav-btn" data-a="closeSheet">Annuler</button>
                <span class="apple-nav-title">Modifier le profil</span>
                <button class="apple-nav-btn save" data-a="save_full_profile">Enregistrer</button>
              </div>
              ${editProfileBody(P)}
            </div>`
          ]
        })
      }]
    };
  },
  outing_drawer: () => {
    const id = (S.sh && (S.sh.outingId || (S.sh.extra && S.sh.extra.outingId))) || '';
    const o = OUTINGS.find(x => x.id === id);
    if (!o) {
      return {
        title: 'Sortie',
        noFooter: true,
        flow: [{ l: 'Résumé', icon: 'route', r: () => ({ per: [8, 10], title: '', rows: [
          `<div style="padding:28px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;"><b style="font:600 14px var(--sf);color:var(--label);">Sortie introuvable</b><p style="font:400 12px/1.4 var(--sf);color:var(--label2);max-width:240px;margin:0 auto;">Cette sortie n'existe pas ou n'est plus accessible depuis votre compte.</p></div>`
        ] }) }]
      };
    }
    const cover = o.coverImage || '';
    const photos = Array.isArray(o.photos) ? o.photos.filter(Boolean) : [];
    const comp = Array.isArray(o.comp) ? o.comp.join(', ') : '';
    return {
      title: o.title,
      noFooter: true,
      flow: [
        { l: 'Résumé', icon: 'route', r: () => ({ per: [8, 10], title: '', rows: [
          cover ? `<div class="outing-hero" style="background-image:url('${cover}')"></div>` : '',
          `<div class="ttl" style="font-size:16px"><span>${o.title}</span>${o.proven ? '<span class="tg confirmed">GPS ✓</span>' : ''}</div>`,
          `<div class="s2">${o.date || 'Sortie'} · ${o.mass}${comp ? ' · avec ' + comp : ''}</div>`,
          `<div class="sgrid"><div><small>Distance</small><b>${Number(o.km || 0).toLocaleString('fr-FR')} km</b></div><div><small>Dénivelé</small><b>+${Number(o.dplus || 0).toLocaleString('fr-FR')} m</b></div><div><small>Alt. max</small><b>${o.maxAlt ? o.maxAlt + ' m' : '—'}</b></div><div><small>Statut</small><span class="sg-status ${o.status === 'upcoming' ? 'is-upcoming' : 'is-done'}">${o.status === 'upcoming' ? 'À venir' : 'Terminée'}</span></div></div>`,
          note('Les données de cette sortie proviennent de votre trace GPS enregistrée.')
        ] }) },
        { l: 'Photos', icon: 'camera', r: () => ({ per: [8, 10], title: '', rows: photos.length ? [
          `<div class="outing-photos">${photos.map((p, i) => `<img src="${p}" alt="${o.title} — photo ${i + 1}" loading="lazy" />`).join('')}</div>`,
          note('Photos rattachées à la sortie.')
        ] : [
          `<div style="padding:24px 14px;text-align:center;color:var(--label2);font:400 12px/1.4 var(--sf);">Aucune photo pour cette sortie.</div>`
        ] }) }
      ]
    };
  },
  followers_sheet: () => {
    X.reseauMode = X.reseauMode || (S.sh && S.sh.extra && S.sh.extra.mode) || 'followers';
    const isFollowers = X.reseauMode === 'followers';
    const fCount = FOLLOWERS.length;
    const ingCount = FOLLOWING.length;
    const currentList = (isFollowers ? FOLLOWERS : FOLLOWING).map(u => ({
      id: u.id,
      n: u.n,
      h: u.ps,
      i: u.i,
      sub: u.mass || 'Voyageur',
      img: u.avatar || '',
      followed: isFollowers ? FOLLOWING.some(f => f.id === u.id) : true
    }));

    return {
      title: isFollowers ? 'Abonnés' : 'Abonnements',
      peek: isFollowers ? fCount + ' randonneurs suivent ton empreinte' : ingCount + ' randonneurs suivis',
      flow: [{
        l: 'Réseau',
        r: () => ({
          per: [1, 1],
          title: '',
          rows: [
            `<div class="segc lg-tabs lens-on lkdv-followers-nav" style="--n:2;margin-bottom:8px" role="tablist" aria-label="Abonnés et abonnements">
              <span class="sel-lens" aria-hidden="true" style="--i:${isFollowers ? 1 : 0}"></span>
              <button class="${!isFollowers ? 'active' : ''}" data-a="toggleFollowersSheet" data-v="following" role="tab" aria-selected="${!isFollowers}" aria-label="Abonnements (${ingCount})" title="Abonnements (${ingCount})">${ic(IC.user, 's')}</button>
              <button class="${isFollowers ? 'active' : ''}" data-a="toggleFollowersSheet" data-v="followers" role="tab" aria-selected="${isFollowers}" aria-label="Abonnés (${fCount})" title="Abonnés (${fCount})">${ic(IC.people, 's')}</button>
            </div>`,
            currentList.length ? `<div class="reseau-list">
              ${currentList.map(u => `
                <div class="reseau-user-row">
                  <div class="reseau-av-wrap" data-a="openUserProfile" data-v="${u.h}" style="cursor:pointer">
                    ${u.img ? `<img src="${u.img}" alt="${u.n}" class="reseau-av" loading="lazy" />` : `<span class="reseau-av" style="display:grid;place-items:center;background:#DDEBD8;color:#17402C;font:700 12px var(--sf)">${u.i}</span>`}
                    <span class="reseau-seal-badge">✓</span>
                  </div>
                  <div class="reseau-meta" data-a="openUserProfile" data-v="${u.h}" style="cursor:pointer">
                    <div class="reseau-name-row">
                      <b>${u.n}</b>
                      <span class="reseau-handle">@${u.h}</span>
                    </div>
                    <div class="reseau-sub">${u.sub}</div>
                  </div>
                  <button class="reseau-btn ${u.followed ? 'active' : 'primary'}" data-a="toggleFollowUser" data-v="${u.h}">
                    ${u.followed ? 'Abonné(e)' : 'Suivre'}
                  </button>
                </div>
              `).join('')}
            </div>` : `<div style="padding:28px 16px;text-align:center;color:var(--label2);font:400 12px/1.4 var(--sf);">${isFollowers ? 'Aucun abonné pour le moment.' : 'Aucun abonnement pour le moment.'}</div>`
          ]
        })
      }]
    };
  },
  user_profile_preview: () => {
    const handle = (S.sh && S.sh.extra && S.sh.extra.handle) || '';
    const known = [...FOLLOWING, ...FOLLOWERS].find(x => x.ps === handle || x.id === handle);
    const user = known ? {
      name: known.n,
      handle: known.ps,
      avatar: known.avatar || '',
      bio: known.mass || '',
      massif: known.mass || '—',
      following: FOLLOWING.some(f => f.id === known.id),
      outings: null,
      km: null
    } : {
      name: handle ? handle.charAt(0).toUpperCase() + handle.slice(1).replace(/[._]/g, ' ') : 'Voyageur',
      handle: handle || 'voyageur',
      avatar: '',
      bio: '',
      massif: '—',
      following: false,
      outings: null,
      km: null
    };
    const isUserFollowed = (X.followedUsers && X.followedUsers[user.handle] !== undefined) ? X.followedUsers[user.handle] : user.following;

    return {
      title: '@' + user.handle,
      peek: user.name,
      flow: [{
        l: 'Profil',
        r: () => ({
          per: [1, 1],
          title: '',
          rows: [
            `<div class="apple-grouped-card" style="align-items:center;text-align:center;padding:16px 14px">
              <div class="apple-av-wrap" style="width:84px;height:84px;margin-bottom:8px">
                ${user.avatar ? `<img src="${user.avatar}" alt="${user.name}" class="apple-av-img" />` : `<span class="apple-av-img" style="display:grid;place-items:center;background:#DDEBD8;color:#17402C;font:700 26px var(--sf)">${user.name.charAt(0).toUpperCase()}</span>`}
                <span class="apple-av-cam" style="background:#17402C;border-color:#fff">✓</span>
              </div>
              <b style="font:700 17px var(--sf);color:var(--label)">${user.name}</b>
              <span style="font:500 13px var(--sf);color:var(--label2);margin-bottom:6px">@${user.handle}</span>
              ${user.bio ? `<p style="font:400 12.5px/1.35 var(--sf);color:var(--label);max-width:280px;margin:0 0 10px">${user.bio}</p>` : ''}
              <div class="sumline" style="width:100%;margin-bottom:12px;justify-content:center;gap:12px">
                <span>Massif : <b>${user.massif}</b></span>
              </div>
              <div style="display:flex;gap:8px;width:100%">
                <button class="mbtn ${isUserFollowed ? 'soft' : 'p'}" style="flex:1;height:36px;justify-content:center" data-a="toggleFollowUser" data-v="${user.handle}">
                  ${isUserFollowed ? 'Abonné(e)' : 'Suivre ce randonneur'}
                </button>
                <button class="mbtn soft" style="height:36px;padding:0 14px" data-a="openUserProfile" data-v="${user.handle}">
                  Profil complet
                </button>
              </div>
            </div>`,
            `<div class="apple-grouped-card">
              <div class="apple-grouped-title">Sorties & Terrains en commun</div>
              <div style="padding:16px 14px;text-align:center;color:var(--label2);font:400 12px/1.4 var(--sf);">Les sorties partagées apparaîtront ici lorsque vous aurez des traces GPS en commun.</div>
            </div>`
          ]
        })
      }]
    };
  },
  create_menu: () => ({
    title: "Créer dans l'application",
    peek: "Carnet, Sortie GPS, Kit de matériel ou Club",
    flow: [{
      l: "Créer",
      r: () => ({
        per: [5, 6],
        title: "Nouvelle création LKDV",
        rows: [
          `<div class="li nt" data-a="navtab" data-v="/carnets/nouveau" style="cursor:pointer"><div><div class="ttl"><span>Nouveau carnet de voyage</span></div><div class="s2">Raconte une expédition avec photos géolocalisées et tracé</div></div><span class="tg p">Carnet</span></div>`,
          `<div class="li nt" data-a="navtab" data-v="/voyages" style="cursor:pointer"><div><div class="ttl"><span>Nouveau voyage / sortie GPS</span></div><div class="s2">Importe un fichier GPX ou planifie un trek avec le Compas</div></div><span class="tg p">Tracé</span></div>`,
          `<div class="li nt" data-a="navtab" data-v="/materiel" style="cursor:pointer"><div><div class="ttl"><span>Nouveau kit de matériel</span></div><div class="s2">Compose un sac ultraléger personnalisé avec jauge d'endurance</div></div><span class="tg p">Kit</span></div>`,
          `<div class="li nt" data-a="navtab" data-v="/communaute" style="cursor:pointer"><div><div class="ttl"><span>Nouveau club ou tribu</span></div><div class="s2">Rassemble ta cordée, partage ton inventaire et lance des sorties</div></div><span class="tg p">Club</span></div>`,
          `<div class="li nt" data-a="openHighlight" data-v="hl5" style="cursor:pointer"><div><div class="ttl"><span>Nouvelle story à la une</span></div><div class="s2">Épingle un souvenir terrain marquant directement sur ton profil</div></div><span class="tg p">Story</span></div>`
        ]
      })
    }]
  }),
  account_drawer: () => {
    const tab = clamp(X.drawerTab || 0, 0, 4);
    const P = S.profile || { handle: 'tony_frc' };
    return {
      title: "Compte & Activité",
      peek: "Commandes, Notifications, Paramètres, Édition & Partage",
      flow: [{
        l: "Menu",
        r: () => {
          let rows = [];
          const tabHeader = `<div class="segc lg-tabs lens-on lkdv-account-nav" style="--n:5;margin-bottom:8px" role="tablist" aria-label="Sections du compte">
            <span class="sel-lens" aria-hidden="true" style="--i:${tab}"></span>
            <button class="${tab === 0 ? 'active' : ''}" data-a="drawerTab" data-v="0" role="tab" aria-selected="${tab === 0}" aria-label="Mes Commandes" title="Mes Commandes">${ic(IC.bag, 's')}</button>
            <button class="${tab === 1 ? 'active' : ''}" data-a="drawerTab" data-v="1" role="tab" aria-selected="${tab === 1}" aria-label="Notifications" title="Notifications">${ic(IC.bell, 's')}</button>
            <button class="${tab === 2 ? 'active' : ''}" data-a="drawerTab" data-v="2" role="tab" aria-selected="${tab === 2}" aria-label="Paramètres" title="Paramètres">${ic(IC.sliders, 's')}</button>
            <button class="${tab === 3 ? 'active' : ''}" data-a="drawerTab" data-v="3" role="tab" aria-selected="${tab === 3}" aria-label="Modifier le profil" title="Modifier le profil"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            <button class="${tab === 4 ? 'active' : ''}" data-a="drawerTab" data-v="4" role="tab" aria-selected="${tab === 4}" aria-label="Partager le profil" title="Partager le profil"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button>
          </div>`;
          if (tab === 0) {
            rows = [
              tabHeader,
              ...(ORDERS.length
                ? ORDERS.map(o => `<div class="li nt"><div><div class="ttl"><span>${esc(o.t)}</span><span class="tg ${o.st && /Livrée|Confirmée/.test(o.st) ? 'confirmed' : 'pending'}">${esc((o.st || '').split('·')[0].trim())}</span></div><div class="s2">Boutique LKDV · Commande ${esc(o.id)} · ${esc(o.d)}</div></div><span class="num">${fmtE(o.amt)}</span></div>`)
                : [`<div class="note">Aucune commande pour le moment.</div>`]),
              note("Toutes tes commandes de matériel et réservations en refuge sont centralisées ici.")
            ];
          } else if (tab === 1) {
            const notifs = Array.isArray(S.notifications) ? S.notifications : [];
            rows = [
              tabHeader,
              ...(notifs.length
                ? notifs.slice(0, 30).map(n => `<button class="li nt" data-a="openNotification" data-v="${esc(n.link || '')}" style="width:100%;text-align:left;border:0;background:none"><div><div class="ttl"><span>${esc(n.title || 'Notification')}</span><span class="tg ${n.read ? 'soft' : 'p'}">${n.read ? 'Lue' : 'Nouvelle'}</span></div><div class="s2">${esc(n.message || '')}</div></div><small>${esc(n.created_at ? new Date(n.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '')}</small></button>`)
                : [`<div class="note">Aucune notification pour le moment.</div>`])
            ];
          } else if (tab === 2) {
            rows = [
              tabHeader,
              `<div class="li nt"><div><div class="ttl"><span>Visibilité du profil</span></div><div class="s2">${VIS_LABELS[S.vis]} · ${S.vis === 0 ? 'toi seul·e' : S.vis === 1 ? 'membres de la communauté' : 'tout le monde'}</div></div><button class="mbtn soft" data-a="cyclevis">Modifier</button></div>`,
              `<div class="li nt"><div><div class="ttl"><span>Mode extérieur haute visibilité</span></div><div class="s2">Contraste renforcé et opacité pour grand soleil</div></div><button class="sw" role="switch" aria-checked="${S.outdoor}" data-a="outdoor"></button></div>`,
              `<div class="li nt"><div><div class="ttl"><span>Coffre biométrique Face ID</span></div><div class="s2">Licence FFCAM, groupe sanguin, contact ICE local</div></div><button class="mbtn soft" data-a="openvault">Gérer</button></div>`,
              `<div class="li nt"><div><div class="ttl"><span>Exporter toutes mes données (RGPD)</span></div><div class="s2">Archive JSON et traces GPX conformes art. 20</div></div><button class="mbtn p" data-a="export" data-v="full">Exporter</button></div>`,
              `<button class="mbtn bad" style="width:100%;height:36px;justify-content:center;margin-top:10px;color:#A8443A" data-a="signout">Se déconnecter de @${P.handle}</button>`
            ];
          } else if (tab === 3) {
            rows = [tabHeader, editProfileBody(P)];
          } else {
            const D = derive();
            const url = (typeof window !== "undefined" ? window.location.origin : "https://lekitduvoyageur.fr") + "/u/" + P.handle;
            rows = [
              tabHeader,
              `<div class="apple-grouped-card" style="padding:12px">
                <div class="ttl"><span>@${P.handle}</span><span class="tg confirmed">Public</span></div>
                <div class="s2" style="margin-top:4px">${P.name || "Tony"} · ${D.totalProp} reprises · +${fmtE(D.totalCredit)}</div>
                <div class="s2" style="margin-top:2px;word-break:break-all">${url}</div>
              </div>`,
              `<div class="menu2 one"><button class="mi" data-a="copyProfileLink"><span>Copier le lien du profil</span></button></div>`,
              `<button class="mbtn p" style="width:100%;height:40px;justify-content:center;margin-top:10px" data-a="shareProfile">Partager le profil…</button>`,
              note("Le partage et la copie restent dans ce drawer : aucun changement de page, aucun chargement.")
            ];
          }
          return { per: [6, 8], title: "Compte & Activité", rows };
        }
      }]
    };
  },
  post_comments: () => {
    const id = (S.sh && S.sh.postId) || X.activePostId;
    const comments = (X.postComments && X.postComments[id]) || [];
    const P = S.profile || { handle: 'tony_frc' };
    const me = (P.handle || 'T').charAt(0).toUpperCase();
    const composerAvatar = TONY_AVATAR
      ? `<img class="pmi-c-av" src="${TONY_AVATAR}" alt="" style="object-fit:cover">`
      : `<span class="pmi-c-av">${me}</span>`;
    const replyTo = X.replyTo || null;
    const commentRows = comments.map(cm => `<div class="pmi-comment-row" data-comment="${cm.id}">
  ${cm.avatar ? `<img class="pmi-c-av" src="${esc(cm.avatar)}" alt="" style="object-fit:cover">` : `<span class="pmi-c-av">${(cm.user || 'T').charAt(0).toUpperCase()}</span>`}
  <div class="pmi-c-body"><b>@${esc(cm.user)}</b>${esc(cm.text)}<small>${esc(cm.time || 'À l’instant')}${cm.parent_id ? ' · réponse' : ''}</small>
    <div class="pmi-c-actions"><button data-a="replyComment" data-v="${cm.id}">Répondre</button><button data-a="reportComment" data-v="${cm.id}">Signaler</button></div>
  </div>
  <button class="pmi-c-like ${cm.liked ? 'liked' : ''}" data-a="likeComment" data-v="${cm.id}" aria-label="J'aime ce commentaire">${ic(IC.heart || IC.star, 'xs')}<small>${cm.likes || ''}</small></button>
</div>`).join("");
    return {
      title: "Commentaires",
      peek: comments.length ? comments.length + " commentaire" + (comments.length > 1 ? "s" : "") : "Aucun commentaire",
      noFooter: true,
      footer: `<div class="pmi-comment-composer">${composerAvatar}<input id="pc_input" class="pmi-composer-input" placeholder="${replyTo ? "Répondre…" : "Ajouter un commentaire…"}" aria-label="Ajouter un commentaire" /><button class="pmi-composer-send" data-a="submitPostComment" data-v="${id}" aria-label="Publier">${ic(IC.send, 's')}</button></div>`,
      flow: [{
        l: "Commentaires",
        r: () => ({
          per: [999, 999],
          title: 'Commentaires',
          head: `<div class="pmi-comments-head"><b>Commentaires</b><span>${comments.length}</span></div>`,
          rows: comments.length
            ? [`<div class="pmi-comments-list">${commentRows}</div>`]
            : [`<div class="note">Sois le premier à commenter.</div>`]
        })
      }]
    };
  },
  share_post: () => {
    const postId = (S.sh && S.sh.postId) || X.activePostId;
    const targets = X.shareTargets || [];
    return {
      title: "Envoyer dans un message",
      peek: "Choisis une conversation",
      flow: [{ l: "Conversations", r: () => ({
        per: [6, 8], title: "Envoyer la publication",
        rows: targets.length
          ? targets.map(c => `<div class="li nt"><div><div class="ttl"><span>${esc(c.title || c.name || 'Conversation')}</span></div><div class="s2">${c.type === 'group' ? 'Groupe' : 'Message privé'}</div></div><button class="mbtn p" data-a="shareToConversation" data-v="${postId}|${c.id}">Envoyer</button></div>`)
          : [`<div class="note">Aucune conversation. Ouvre la messagerie pour en créer une.</div>`]
      }) }]
    };
  },
  note: () => ({ title: 'Note de profil', peek: S.note ? S.note.t : 'Aucune note', flow: [{ l: 'Note', r: () => ({ per: [3, 4], title: 'Visible 24 h au-dessus de ton avatar', rows: [
    `<div class="chips">${['J-4 Pyrénées', 'Au refuge Ledormeur ⛺', 'Dispo rando ce week-end', 'Cherche crampons'].map(t => chip('note', t, t, S.note && S.note.t === t)).join('')}</div>`,
    `<div class="menu2 one"><button class="mi" data-a="note" data-v="">${ic(IC.x, 's')}<span>Retirer ma note</span></button></div>`,
    note('Les statuts sont pré-remplis depuis ton Compas. Aucune coordonnée GPS n\'est publiée : seulement le massif.')] }) }] }),
  seal: () => ({ title: 'Sceau d\'empreinte', peek: '100 % dérivé de tes sorties GPS vérifiées', flow: [{ l: 'Sceau', r: () => ({ per: [3, 3], rows: [
    `<div style="display:grid;place-items:center;padding:4px 0">${renderSeal(132, .9)}</div>`,
    `<div class="vm" style="grid-template-columns:1fr 1fr;gap:0">${sealBadges().map((b, i) => `<div style="border-top:${i < 2 ? 0 : '.5px solid var(--sep)'}"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${i % 2 ? '#5B7F55' : '#17402C'};margin-right:6px"></span><b style="font-weight:600">${b[0]}</b></div><div style="border-top:${i < 2 ? 0 : '.5px solid var(--sep)'};color:var(--label2)">${b[1]}</div>`).join('')}</div>`,
    note('Chaque branche s\'allonge avec tes kilomètres réels. Aucun grade, aucun rang, aucun classement entre membres (ADR-010).')] }) }] }),
  profiles: () => ({ title: 'Changer de profil', peek: X.acct === 'me' ? '@' + ((S.profile && S.profile.handle) || 'moi') : (CLUBS.find(q => q.id === X.acct) || {}).n, flow: [{ l: 'Profils', r: () => ({ per: [4, 5], title: 'Ton profil et tes clubs', rows: [
    `<div class="li nt"><div><div class="ttl"><span>@${(S.profile && S.profile.handle) || 'moi'}</span><span class="tg confirmed">Personnel</span></div><div class="s2">${(S.profile && S.profile.name) || 'Mon profil'} · ${derive().pubCount} publications</div></div><button class="mbtn ${X.acct === 'me' ? 'soft' : 'p'}" data-a="acct" data-v="me">${X.acct === 'me' ? 'Actif' : 'Basculer'}</button></div>`,
    ...CLUBS.filter(c => c.joined).map(c => `<div class="li nt"><div><div class="ttl"><span>${c.n}</span></div><div class="s2">${c.role} · ${c.members} membres</div></div><button class="mbtn ${X.acct === c.id ? 'soft' : 'p'}" data-a="acct" data-v="${c.id}">${X.acct === c.id ? 'Actif' : 'Basculer'}</button></div>`)] }) }] }),
  newhl: () => ({
  title: 'Nouvelle story à la une',
  peek: 'Créée depuis les photos géolocalisées d\'une sortie',
  flow: [{
    l: 'Sortie',
    r: () => {
      const doneOutings = OUTINGS.filter(o => o.status === 'done');
      if (doneOutings.length === 0) {
        return {
          per: [3, 4],
          title: 'Choisis une sortie terminée',
          rows: [
            `<div style="padding:28px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px">
              <div style="width:48px;height:48px;border-radius:24px;background:rgba(23,64,44,0.08);display:grid;place-items:center;color:#17402C">
                ${ic(IC.mount, "s")}
              </div>
              <div style="font-weight:600;font-size:15px;color:var(--label)">Aucune sortie terminée</div>
              <div style="font-size:13px;color:var(--label2);max-width:260px;line-height:1.4">Enregistre ou synchronise une trace GPS pour générer automatiquement une story terrain à la une.</div>
              <button class="mbtn p" style="margin-top:6px;height:34px;padding:0 18px" data-a="navtab" data-v="/explorer">Explorer les traces GPS</button>
            </div>`
          ]
        };
      }
      return {
        per: [3, 4],
        title: 'Choisis une sortie terminée',
        rows: doneOutings.map(o => {
          const ph = Array.isArray(o.photos) ? o.photos.length : 0, done = S.extraHl.some(e => e.o === o.id);
          return `<div class="li nt"><div><div class="ttl"><span>${o.title}</span></div><div class="s2">${ph} photo${ph > 1 ? 's' : ''} · ${o.km} km</div></div><button class="mbtn ${done ? 'soft' : 'p'}" data-a="addhl" data-v="${o.id}" ${done ? 'disabled' : ''}>${done ? 'À la une' : 'Créer'}</button></div>`;
        })
      };
    }
  }]
}),
  vault: () => ({ title: 'Coffre biométrique', peek: X.vault ? 'Déverrouillé · stocké sur l\'iPhone' : 'Verrouillé · Face ID requis', flow: [{ l: 'Coffre', r: () => ({ per: [4, 5], rows: X.vault ? (X.vaultEdit ? [
    `<div class="li nt" style="display:block"><div class="ttl"><span>Licence FFCAM</span></div><input id="vf_ffcam" class="nt-in" style="margin-top:4px;width:100%" value="${(S.vaultData.ffcam || '').replace(/"/g, '&quot;')}"></div>`,
    `<div class="li nt" style="display:block"><div class="ttl"><span>Groupe sanguin &amp; allergies</span></div><input id="vf_blood" class="nt-in" style="margin-top:4px;width:100%" value="${(S.vaultData.blood || '').replace(/"/g, '&quot;')}"></div>`,
    `<div class="li nt" style="display:block"><div class="ttl"><span>Contact médical ICE</span></div><input id="vf_doc" class="nt-in" style="margin-top:4px;width:100%" value="${(S.vaultData.doctor || '').replace(/"/g, '&quot;')}"></div>`,
    `<div class="row-btns"><button class="mbtn p" style="flex:1;justify-content:center;height:34px" data-a="vaultsave">Enregistrer sur l'appareil</button><button class="mbtn soft" style="height:34px" data-a="vaultlock">Fermer</button></div>`
  ] : [
    `<div class="li nt"><div><div class="ttl"><span>Licence FFCAM</span></div><div class="s2">${S.vaultData.ffcam}</div></div><button class="mbtn soft" data-a="vaultedit">Éditer</button></div>`,
    `<div class="li nt"><div><div class="ttl"><span>Groupe sanguin</span></div><div class="s2">${S.vaultData.blood}</div></div></div>`,
    `<div class="li nt"><div><div class="ttl"><span>Contact médical</span></div><div class="s2">${S.vaultData.doctor}</div></div></div>`,
    `<button class="mbtn soft" style="width:100%;justify-content:center;height:34px" data-a="vaultlock">Verrouiller le coffre</button>`,
    note('Keychain de l\'iPhone uniquement : jamais synchronisé, jamais envoyé à l\'IA ni exporté.')]) : [
    `<div class="vault-lock"><span class="fid">${ic(IC.lock, '')}</span><b style="font:600 15px var(--sf)">Coffre verrouillé</b><span style="font:400 12px var(--sf);color:var(--label2)">Licence, groupe sanguin et contact médical</span><button class="mbtn p" data-a="vaultopen" style="height:34px;padding:0 16px">Déverrouiller avec Face ID</button></div>`] }) }] }),
  scan: () => ({ title: 'Ajouter un objet', peek: 'Scan code-barres ou facture', flow: [{ l: 'Scan', r: () => ({ per: [3, 4],
    head: `<div style="display:flex;gap:6px;margin-bottom:6px"><input id="scanq" class="nt-in" style="flex:1;height:32px" placeholder="Rechercher marque, modèle ou EAN…"><button class="mbtn soft" data-a="scansearch">Catalogue</button></div>`,
    rows: X.scan ? [
    `<div class="li nt"><div><div class="ttl"><span>${SCAN_DB.b} ${SCAN_DB.n}</span><span class="tg confirmed">Reconnu</span></div><div class="s2">${SCAN_DB.c} · poids constructeur ${kgs(SCAN_DB.w)} · ${fmtE(SCAN_DB.paid)}</div></div></div>`,
    `<button class="mbtn ${S.invs.some(p => p.id === SCAN_DB.id) ? 'soft' : 'p'}" style="width:100%;justify-content:center;height:34px" data-a="additem" data-sim="1" ${S.invs.some(p => p.id === SCAN_DB.id) ? 'disabled' : ''}>${S.invs.some(p => p.id === SCAN_DB.id) ? 'Ajouté au kit actif' : 'Ajouter au kit Trek 3 saisons'}</button>`,
    note('Le poids est repris de la base constructeur et rattaché au kit actif du Compas.')] : [
    `<div class="scanbox"><span>Scanner un code-barres ou une facture</span></div>`,
    `<button class="mbtn p" style="width:100%;justify-content:center;height:34px" data-a="navtab" data-v="/materiel">Ouvrir le scanner matériel</button>`] }) }] })
};
const _defs = defs;
const wrapFlow = (f, fn) => { const r = f.r; f.r = () => fn(r()); };
defs = function () {
  const sh = S.sh;
  if (EXK[sh.k]) return EXK[sh.k]();
  const d = _defs();
  if (sh.k === 'step') d.noFooter = true;
  if (sh.k === 'share') wrapFlow(d.flow[0], t => { const q = qrSvg(); t.rows.splice(1, 0, `<div class="qrbox"><div class="qr">${q}<span class="qc">${renderSeal(22, .85)}</span></div><div><b>QR Code @${(S.profile && S.profile.handle) || 'tony_frc'}</b><small>Le Sceau au centre atteste ton profil vérifié GPS. Scannable depuis l'appareil photo iOS.</small><button class="mbtn p" data-a="namedrop">NameDrop / AirDrop</button></div></div>`); t.per = [3, 4]; return t; });
  if (sh.k === 'item') {
    wrapFlow(d.flow[0], t => { const p = S.invs.find(x => x.id === sh.id) || S.invs[0]; if (p.wear) { const pc = Math.round(p.wear.used / p.wear.max * 100); t.rows.splice(2, 0, `<div class="gauge"><div class="gh"><span>${p.wear.l}</span><b>${p.wear.used} / ${p.wear.max} ${p.wear.u}</b></div><div class="gb"><i style="width:${pc}%;${pc >= 85 ? 'background:#B98A2E' : ''}"></i></div>${pc >= 85 ? '<small style="font:500 11px var(--sf);color:var(--warn)">Remplacement conseillé avant ta prochaine sortie</small>' : ''}</div>`); } return t; });
    wrapFlow(d.flow[1], t => { const p = S.invs.find(x => x.id === sh.id) || S.invs[0]; t.rows.push(`<div class="menu2 one"><div class="mi">${ic(IC.people, 's')}<span>Prêt gratuit pour ma tribu</span><button class="sw" role="switch" aria-checked="${!!p.lendFree}" data-a="lendfree" data-v="${p.id}" data-sim="1"></button></div></div>`); if (p.lent) t.rows.push(`<div class="menu2 one"><button class="mi" data-a="remind" data-v="${p.id}">${ic(IC.bell, 's')}<span>Envoyer un rappel à ${p.lent} dans le Hub</span></button></div>`); return t; });
  }
  if (sh.k === 'step' && S.step === 4) {
    wrapFlow(d.flow[1], t => { const D = derive(), stale = S.massifs.filter(m => m.cached && m.lastVisit >= 6); t.rows.unshift(`<div class="stor"><div class="sh"><span>Cartes hors-ligne</span><span>${D.cacheMb} Mo</span></div><div class="bar"><i style="width:${Math.min(100, D.cacheMb)}%;background:#5B7F55"></i></div><button class="mbtn ${stale.length ? 'p' : 'soft'}" data-a="purge" data-sim="1" style="margin-top:3px;align-self:flex-start" ${stale.length ? '' : 'disabled'}>${stale.length ? 'Purger les massifs non visités depuis 6 mois (' + stale.map(m => m.name).join(', ') + ')' : 'Aucun massif à purger'}</button></div>`); t.per = [2, 4]; return t; });
    wrapFlow(d.flow[2], t => { t.per = [3, 4]; t.rows.unshift(`<div class="cap" style="margin:2px 0 3px">Aperçu du SMS envoyé hors réseau</div><div class="sms">SOS 112 · @${(S.profile && S.profile.handle) || 'voyageur'} · besoin de secours<br>Position GPS et contacts d'urgence ajoutés au moment de l'envoi réel.</div>`); return t; });
  }
  return d;
};
function qrSvg() {
  const q = window.__QR; if (!q) return '';
  let r = ''; q.rows.forEach((row, y) => { let x = 0; while (x < row.length) { if (row[x] === '1') { let e = x; while (e < row.length && row[e] === '1') e++; r += `<rect x="${x}" y="${y}" width="${e - x}" height="1"/>`; x = e; } else x++; } });
  return `<svg class="q" viewBox="0 0 ${q.n} ${q.n}" shape-rendering="crispEdges" aria-label="QR Code du profil @tony_frc"><g fill="#17402C">${r}</g></svg>`;
}

function applyAccountBootstrap(data) {
  if (!data || data.authenticated !== true) return false;
  if (Array.isArray(data.carnets)) CARNETS = data.carnets;
  if (Array.isArray(data.outings)) OUTINGS = data.outings;
  if (Array.isArray(data.orders)) ORDERS = data.orders;
  if (Array.isArray(data.bookings)) ORDERS_BOOKINGS = data.bookings;
  if (Array.isArray(data.tribu)) TRIBU = data.tribu;
    if (Array.isArray(data.notifications)) S.notifications = data.notifications;
  if (Array.isArray(data.clubs)) { CLUBS = data.clubs; S.clubs = data.clubs; }
  if (data.profile && typeof data.profile === "object") Object.assign(S.profile, data.profile);
  try {
    renderTop();
    if (S.sh) renderSheet();
    renderAcc();
  } catch (err) {
    console.warn("[CompteLiquidGlassV8] hydrate render failed:", err);
  }
  return true;
}

const notifyHostAction = (a, v) => {
  if (!isCurrent()) return;
  if (typeof window.__lkdvOnAction === 'function') {
    try { window.__lkdvOnAction(a, v, S); } catch (_) {}
  }
};
/* ---------- Point 3 : Modal Post Instagram (100 % Réplique Native Liquid Glass) ---------- */
function renderPostModal(postId) {
  if (!isCurrent()) return;
  let modalEl = $("post_modal_instagram");
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.id = "post_modal_instagram";
    modalEl.className = "post-modal-instagram";
    modalEl.setAttribute("role", "dialog");
    modalEl.setAttribute("aria-label", "Publication Instagram");
    const phoneEl = $("phone") || document.body;
    phoneEl.appendChild(modalEl);
  }
  if (!modalEl._bound) {
    modalEl._bound = true;
    modalEl.addEventListener("click", e => {
      if (G.sup && Date.now() < G.sup && G.supEl === modalEl) {
        e.preventDefault();
        e.stopPropagation();
        G.sup = 0;
        return;
      }
      const menu = modalEl.querySelector('#pmi_options_menu');
      if (menu && !menu.hidden && !e.target.closest('#pmi_options_menu') && !e.target.closest('[data-a="openPostOptions"]')) {
        menu.hidden = true;
        const trigger = modalEl.querySelector('[data-a="openPostOptions"]');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
        if (e.target === modalEl) { e.preventDefault(); e.stopPropagation(); return; }
      }
      if (e.target === modalEl || (e.target.closest && e.target.closest('[data-a="closePostModal"]'))) {
        e.preventDefault();
        e.stopPropagation();
        if (exportedActions?.closePostModal) exportedActions.closePostModal();
      }
    });
  }
  if (!modalEl._swipeBound) {
    modalEl._swipeBound = true;
    let sy = null, sx = null, drag = false;
    const dialog = () => modalEl.querySelector('.pmi-dialog');
    const reset = () => { const d = dialog(); if (d) { d.style.transition = ''; d.style.transform = ''; } sy = sx = null; drag = false; };
    modalEl.addEventListener('pointerdown', e => {
      if (e.target.closest('button,input,.pmi-options-menu')) return;
      const sc = modalEl.querySelector('.pmi-scroll-area');
      if (sc && sc.scrollTop > 2) return;
      sy = e.clientY; sx = e.clientX; drag = false;
    });
    modalEl.addEventListener('pointermove', e => {
      if (sy == null) return;
      const dy = e.clientY - sy, dx = e.clientX - sx;
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) && dy > 0) {
        if (!drag) {
          G.sup = Date.now() + 600;
          G.supEl = modalEl;
          try { modalEl.setPointerCapture(e.pointerId); } catch (_) {}
        }
        drag = true;
        const d = dialog();
        if (d) { d.style.transition = 'none'; d.style.transform = `translateY(${dy}px)`; }
      }
    });
    const finish = e => {
      if (sy == null) return;
      const dy = (e.clientY || 0) - sy;
      const wasDrag = drag;
      reset();
      if (wasDrag) {
        G.sup = Date.now() + 600;
        G.supEl = dy > 80 ? ($("phone") || modalEl) : modalEl;
        if (dy > 80 && typeof EXA !== 'undefined' && EXA.closePostModal) EXA.closePostModal();
      }
    };
    modalEl.addEventListener('pointerup', finish);
    modalEl.addEventListener('pointercancel', finish);
  }

  const P = S.profile || { handle: "tony_frc", name: "Tony" };
  const t = tileById(postId) || {
    id: postId,
    bot: "Reflet du Mont-Blanc au Lac Blanc",
    top: "Mont-Blanc",
    desc: "Montée avant 7 h pour le miroir parfait sans vent.",
    date: "19 sept.",
    art: "ca2"
  };
  const c = (Array.isArray(CARNETS) ? CARNETS.find(x => x.id === postId || ('ca_' + postId) === x.id) : null) || {};

  X.postLikes = X.postLikes || {};
  if (!X.postLikes[postId]) {
    const initLikes = Number(c.likes_count ?? c.likes ?? 64);
    X.postLikes[postId] = { count: initLikes, userLiked: false };
  }
  const likeData = X.postLikes[postId];

  X.postSaves = X.postSaves || {};
  const isSaved = !!X.postSaves[postId];

  X.postComments = X.postComments || {};
  if (!X.postComments[postId]) {
    const defaultComments = {
      ca2: [
        { user: "montagne_lea", text: "Incroyable cette lumière au lever du soleil ! 🏔️", time: "2 j", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80" },
        { user: "marc.trail", text: "Tu avais pris la tente 2P ou juste le tarp ?", time: "1 j", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80" }
      ],
      ca1: [
        { user: "ines.trek", text: "Le Néouvielle reste magique en août. Bivouac à Aubert ?", time: "3 j", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80" }
      ],
      ca3: [
        { user: "yanis.alpi", text: "Superbe secteur du Glacier Blanc !", time: "5 j", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80" }
      ]
    };
    X.postComments[postId] = defaultComments[postId] ? [...defaultComments[postId]] : [
      { user: "montagne_lea", text: "Superbe moment terrain partagé ! 🏔️", time: "2 j", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80" }
    ];
  }
  const commentsList = X.postComments[postId];

  let mediaHtml = "";
  if (t.customImg) {
    mediaHtml = `<img src="${t.customImg}" alt="${esc(t.bot)}" class="pmi-img" onerror="this.style.display='none'" />`;
  } else if (c.coverImage || c.cover_image) {
    mediaHtml = `<img src="${c.coverImage || c.cover_image}" alt="${esc(t.bot)}" class="pmi-img" onerror="this.style.display='none'" />`;
  } else if (t.art && (String(t.art).startsWith("http") || String(t.art).startsWith("data:image"))) {
    mediaHtml = `<img src="${t.art}" alt="${esc(t.bot)}" class="pmi-img" onerror="this.style.display='none'" />`;
  } else if (t.art === "ca2" || t.art === "ca1" || t.art === "ca3") {
    mediaHtml = tileArt(t.art);
  } else {
    mediaHtml = tileArt(t.art);
  }

  const heartIcon = likeData.userLiked
    ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="#E0245E" stroke="#E0245E" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`
    : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

  const commentIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
  const shareIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

  const saveIcon = isSaved
    ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="#17402C" stroke="#17402C" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
    : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;

  const likesText = likeData.userLiked
    ? `Aimé par <b data-a="openUserProfile" data-v="montagne_lea" style="cursor:pointer">montagne_lea</b>, <b>toi</b> et <b>${Math.max(1, likeData.count - 2)} autres personnes</b>`
    : `Aimé par <b data-a="openUserProfile" data-v="montagne_lea" style="cursor:pointer">montagne_lea</b> et <b>${Math.max(1, likeData.count - 1)} autres personnes</b>`;

  const userAvatar = (P && P.avatarUrl) || TONY_AVATAR;

  const prevScroll = modalEl.querySelector('.pmi-scroll-area')?.scrollTop || 0;
  modalEl.innerHTML = `
    <div class="pmi-dialog" id="pmi_dialog">
      <div class="pmi-grabber" aria-hidden="true"><span></span></div>

      <div class="pmi-header pmi-topbar">
        <button class="pmi-author" data-a="closePostModal" aria-label="Fermer la publication">
          <img src="${userAvatar}" alt="${P.name || 'Tony'}" class="pmi-author-av" />
          <b>@${P.handle || 'tony_frc'}</b>
        </button>
        <button class="pmi-more-pill" data-a="openPostOptions" data-v="${postId}" aria-label="Options de la publication" aria-expanded="false" aria-controls="pmi_options_menu">···</button>
      </div>

      <div class="pmi-options-menu" id="pmi_options_menu" role="group" aria-label="Options de la publication" hidden>
        <button data-a="toggleSavePost" data-v="${postId}">${saveIcon}<span>${isSaved ? 'Retirer des enregistrements' : 'Enregistrer'}</span></button>
        <button data-a="sharePost" data-v="${postId}">${shareIcon}<span>Republier</span></button>
        <button data-a="copyPostLink" data-v="${postId}">${ic(IC.link, 's')}<span>Copier le lien</span></button>
        <button data-a="reportPost" data-v="${postId}" class="pmi-report">${ic(IC.shield, 's')}<span>Signaler</span></button>
      </div>

      <div class="pmi-scroll-area">
        <div class="pmi-media" data-a="toggleLikePost" data-v="${postId}">
          ${mediaHtml.startsWith('<img')
            ? `<div class="pmi-media-fallback" role="img" aria-label="${esc(t.bot || c.title || 'Carnet LKDV')}">${tileArt(t.art)}</div>`
            : `<div class="pmi-media-art" role="img" aria-label="${esc(t.bot || c.title || 'Carnet LKDV')}">${mediaHtml}</div>`}
          <div class="pmi-post-actions" role="group" aria-label="Actions de la publication">
            <button class="pmi-post-btn ${likeData.userLiked ? 'liked' : ''}" data-a="toggleLikePost" data-v="${postId}" aria-label="J'aime" aria-pressed="${likeData.userLiked}">${heartIcon}</button>
            <button class="pmi-post-btn" data-a="openPostComments" data-v="${postId}" aria-label="Commenter">${commentIcon}</button>
            <button class="pmi-post-btn" data-a="sharePost" data-v="${postId}" aria-label="Partager">${shareIcon}</button>
          </div>
        </div>

      </div>
    </div>
  `;

  const scrollEl = modalEl.querySelector('.pmi-scroll-area');
  if (scrollEl && prevScroll) scrollEl.scrollTop = prevScroll;
}

/* ---------- Actions ---------- */

/* Vol de la carte 3D vers le massif d'une sortie (partagé carte / drawer) */
let flyToOuting = function(o) {
  if (!o || !window.__lkdvCompteMap3D) return;
  const coords = (o.mass && o.mass.includes('Pyrén')) ? [0.1, 42.8]
    : (o.mass && o.mass.includes('Vercors')) ? [5.5, 44.9]
    : (o.mass && o.mass.includes('Corse')) ? [9.2, 41.8]
    : [6.82, 45.88];
  window.__lkdvCompteMap3D.flyTo({ center: coords, zoom: 12.4, pitch: 62, bearing: -35, duration: 2200, essential: true });
};

var EXA = {
  openPostModal: (id) => {
    const realId = (tileById(id) || {}).realId || id;
    if (typeof window !== 'undefined' && typeof window.__lkdvOpenPost === 'function') {
      window.__lkdvOpenPost(realId);
      haptic(8);
      return;
    }
    X.activePostId = id;
    X.postOpener = document.activeElement;
    syncCardBounds();
    renderPostModal(id);
    const modalEl = $('post_modal_instagram');
    if (modalEl) {
      modalEl.classList.add('open');
      modalEl.setAttribute('tabindex', '-1');
      requestAnimationFrame(() => {
        const target = modalEl.querySelector('.pmi-author') || modalEl;
        try { target.focus({ preventScroll: true }); } catch (_) {}
      });
    }
    haptic(8);

    // Map post ID to real terrain coordinates and teleport 3D camera
    const postGeoMap = {
      ca2: { id: 'ca2', name: 'Lac Blanc', coords: [6.8894, 45.9812], alt: '2 352 m', massif: 'Aiguilles Rouges / Mont-Blanc' },
      ca1: { id: 'ca1', name: 'Massif du Néouvielle', coords: [-0.0112, 42.7324], alt: '2 192 m', massif: 'Pyrénées' },
      ca3: { id: 'ca3', name: 'Glacier Blanc', coords: [6.415, 44.925], alt: '2 542 m', massif: 'Écrins' },
      ca0: { id: 'ca0', name: 'Traversée du Vercors', coords: [5.524, 44.954], alt: '1 650 m', massif: 'Vercors' },
    };
    const geo = postGeoMap[id] || postGeoMap['ca_' + id] || { id: id, name: 'Lac Blanc', coords: [6.8894, 45.9812], alt: '2 352 m', massif: 'Mont-Blanc' };

    if (window.__lkdvCompteMap3D && typeof window.__lkdvCompteMap3D.flyTo === 'function') {
      try {
        window.__lkdvCompteMap3D.flyTo({
          center: geo.coords,
          zoom: 14.2,
          pitch: 65,
          bearing: -20,
          duration: 2000,
          essential: true,
        });
      } catch (_) {}
    } else {
      X.pendingTeleport = geo;
    }

    if (typeof island === 'function') {
      island(geo.name, `Altitude ${geo.alt} · ${geo.massif}`, false);
    }

    // Highlight marker on 3D map with glowing badge
    if (typeof EXA !== 'undefined' && EXA.highlightMapMarker) {
      EXA.highlightMapMarker(id, geo.name);
    }

    notifyHostAction('openPostModal', id);
  },
  highlightMapMarker: (postId, postName) => {
    const markers = document.querySelectorAll('.photo-marker-3d');
    markers.forEach(el => {
      const elId = el.getAttribute('data-post-id');
      const elName = el.getAttribute('data-photo-name');
      const match = (postId && (elId === String(postId) || ('ca_' + postId) === elId || elId === ('ca_' + postId))) ||
                    (postName && elName && elName.toLowerCase() === postName.toLowerCase());
      if (match) {
        el.classList.add('highlight', 'active');
      } else {
        el.classList.remove('highlight', 'active');
      }
    });
  },
  unhighlightMapMarkers: () => {
    const markers = document.querySelectorAll('.photo-marker-3d');
    markers.forEach(el => el.classList.remove('highlight', 'active'));
  },
  closePostModal: () => {
    X.activePostId = null;
    const modalEl = $('post_modal_instagram');
    if (modalEl) modalEl.classList.remove('open');
    if (typeof EXA !== 'undefined' && EXA.unhighlightMapMarkers) {
      EXA.unhighlightMapMarkers();
    }
    if (X.postOpener && X.postOpener.isConnected) {
      const opener = X.postOpener;
      X.postOpener = null;
      requestAnimationFrame(() => { try { opener.focus({ preventScroll: true }); } catch (_) {} });
    }
    haptic(6);
    notifyHostAction('closePostModal');
  },
  toggleLikePost: (id) => {
    X.postLikes = X.postLikes || {};
    if (!X.postLikes[id]) {
      const c = (Array.isArray(CARNETS) ? CARNETS.find(x => x.id === id || ('ca_' + id) === x.id) : null) || {};
      X.postLikes[id] = { count: Number(c.likes_count ?? c.likes ?? 64), userLiked: false };
    }
    const cur = X.postLikes[id];
    cur.userLiked = !cur.userLiked;
    cur.count += cur.userLiked ? 1 : -1;
    haptic(cur.userLiked ? [12, 25] : 8);
    if (X.activePostId === id) {
      renderPostModal(id);
      const m = $('post_modal_instagram');
      if (m) {
        m.classList.add('open');
        requestAnimationFrame(() => { const b = m.querySelector('[data-a="toggleLikePost"]'); if (b) { try { b.focus({ preventScroll: true }); } catch (_) {} } });
      }
    }
    island(cur.userLiked ? "Mention J'aime ajoutée" : "Mention J'aime retirée", cur.userLiked ? "Visible par la communauté LKDV" : "", false);
    notifyHostAction('toggleLikePost', { id, ...cur });
  },
  toggleSavePost: (id) => {
    X.postSaves = X.postSaves || {};
    X.postSaves[id] = !X.postSaves[id];
    const isSaved = X.postSaves[id];
    haptic(10);
    if (X.activePostId === id) {
      renderPostModal(id);
      const m = $('post_modal_instagram');
      if (m) {
        m.classList.add('open');
        requestAnimationFrame(() => { const b = m.querySelector('[data-a="openPostOptions"]'); if (b) { try { b.focus({ preventScroll: true }); } catch (_) {} } });
      }
    }
    island(isSaved ? "Enregistré" : "Retiré des éléments enregistrés", isSaved ? "Retrouve ce carnet dans tes favoris" : "", false);
    notifyHostAction('toggleSavePost', { id, saved: isSaved });
  },
  openPostComments: async (id) => {
    X.activePostId = id;
    X.replyTo = null;
    if (typeof EXA !== 'undefined' && EXA.closePostModal) EXA.closePostModal();
    try {
      const res = await fetch(`/api/compte/posts/${encodeURIComponent(id)}/comments`, { cache: 'no-store' });
      const data = res.ok ? await res.json() : { comments: [] };
      X.postComments = X.postComments || {};
      X.postComments[id] = Array.isArray(data.comments) ? data.comments : [];
    } catch (_) {
      X.postComments = X.postComments || {};
      X.postComments[id] = [];
    }
    openSheet('post_comments', 0, 'card', { postId: id });
    haptic(6);
  },
  submitPostComment: async (id) => {
    const input = $('pc_input');
    const val = input ? input.value.trim() : '';
    if (!val) {
      island('Commentaire vide', 'Saisis un message avant de publier', false);
      if (input) input.focus();
      return;
    }
    try {
      const res = await fetch(`/api/compte/posts/${encodeURIComponent(id)}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: val, parentId: X.replyTo || null }),
      });
      if (!res.ok) throw new Error('refus');
      const data = await fetch(`/api/compte/posts/${encodeURIComponent(id)}/comments`, { cache: 'no-store' }).then(r => r.json());
      X.postComments = X.postComments || {};
      X.postComments[id] = data.comments || [];
      X.replyTo = null;
      renderSheet();
      island('Commentaire publié', 'Visible par la communauté', false);
      haptic(10);
    } catch (_) {
      island('Publication impossible', 'Réessaie dans un instant', false);
    }
  },
  likeComment: async (commentId) => {
    const postId = X.activePostId;
    if (!postId || !commentId) return;
    try {
      await fetch(`/api/compte/posts/${encodeURIComponent(postId)}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like', commentId }),
      });
      const data = await fetch(`/api/compte/posts/${encodeURIComponent(postId)}/comments`, { cache: 'no-store' }).then(r => r.json());
      X.postComments[postId] = data.comments || [];
      renderSheet();
    } catch (_) {}
  },
  replyComment: (commentId) => {
    const postId = X.activePostId;
    if (!postId || !commentId) return;
    X.replyTo = commentId;
    renderSheet();
    const input = $('pc_input'); if (input) input.focus();
  },
  reportComment: async (commentId) => {
    const postId = X.activePostId;
    if (!postId || !commentId) return;
    try {
      await fetch(`/api/compte/posts/${encodeURIComponent(postId)}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'report', commentId }),
      });
      island('Signalement envoyé', 'La modération va examiner ce commentaire', false);
    } catch (_) {}
  },
  sharePost: async (id) => {
    try {
      const res = await fetch('/api/compte/share-post', { cache: 'no-store' });
      const data = res.ok ? await res.json() : { conversations: [] };
      X.shareTargets = Array.isArray(data.conversations) ? data.conversations : [];
    } catch (_) { X.shareTargets = []; }
    openSheet('share_post', 0, 'card', { postId: id });
    haptic(6);
    const menu = $('pmi_options_menu'); if (menu) menu.hidden = true;
  },
  shareToConversation: async (v) => {
    const [postId, conversationId] = String(v || '').split('|');
    if (!postId || !conversationId) return;
    try {
      const res = await fetch('/api/compte/share-post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, conversationId }),
      });
      if (!res.ok) throw new Error('refus');
      closeSheet();
      island('Publication envoyée', 'Retrouve-la dans tes messages', false);
    } catch (_) {
      island('Envoi impossible', 'Vérifie la conversation et réessaie', false);
    }
  },
  openPostOptions: (id) => {
    const menu = $('pmi_options_menu');
    const trigger = menu && menu.parentElement.querySelector('[data-a="openPostOptions"]');
    if (!menu) return;
    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
    if (trigger) trigger.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) menu.querySelector('button')?.focus({ preventScroll: true });
    else if (trigger) trigger.focus({ preventScroll: true });
    haptic(6);
  },
  copyPostLink: (id) => {
    const t = tileById(id) || {};
    const origin = (typeof window !== 'undefined' && /^https?:/.test(window.location.origin)) ? window.location.origin : 'https://lekitduvoyageur.fr';
    const url = `${origin}/carnets/${encodeURIComponent(t.realId || id)}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => island('Lien copié', url, false)).catch(() => island('Lien du carnet', url, false));
    } else {
      island('Lien du carnet', url, false);
    }
    const menu = $('pmi_options_menu');
    if (menu) menu.hidden = true;
    const trigger = menu && menu.parentElement.querySelector('[data-a="openPostOptions"]');
    if (trigger) { trigger.setAttribute('aria-expanded', 'false'); trigger.focus({ preventScroll: true }); }
    haptic(6);
  },
  reportPost: (id) => {
    island('Signalement envoyé', 'Merci, la modération LKDV vérifie cette publication', false);
    const menu = $('pmi_options_menu');
    if (menu) menu.hidden = true;
    const trigger = menu && menu.parentElement.querySelector('[data-a="openPostOptions"]');
    if (trigger) { trigger.setAttribute('aria-expanded', 'false'); trigger.focus({ preventScroll: true }); }
    notifyHostAction('reportPost', { id });
    haptic(8);
  },
  copyReferral: () => {
    const handle = (S.profile && S.profile.handle) || 'voyageur';
    const code = handle.toUpperCase().replace(/[^A-Z0-9]/g, '-');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        island("Code parrainage copié", code, false);
      }).catch(() => {
        island("Code de parrainage", code, false);
      });
    } else {
      island("Code de parrainage", code, false);
    }
    haptic(12);
  },
  payoutReferral: () => {
    island("Demande de virement SEPA", fmtE(derive().totalCredit) + " en cours de transfert vers ton compte IBAN", false);
    haptic([12, 30]);
  },
  editHighlightTitle: (v) => {
    const hl = hlList().find(x => x.id === v) || HIGHLIGHTS.find(x => x.id === v);
    const titles = ["Tour du Mont-Blanc", "Bivouac Sauvage", "Crêtes & Sommets", "Expédition Alpinisme"];
    const current = hl ? hl.title : "Story";
    const next = titles[(titles.indexOf(current) + 1) % titles.length] || "Sélection terrain";
    if (hl) hl.title = next;
    island("Titre modifié", `« ${next} » mis à jour`, false);
    haptic(10);
    setDet("closed");
    refresh(true);
    notifyHostAction('editHighlightTitle', { id: v, title: next });
  },
  changeHighlightCover: (v) => {
    island("Photo de couverture", "Sélectionne une photo parmi tes sorties", false);
    haptic(10);
    setDet("closed");
    notifyHostAction('changeHighlightCover', { id: v });
  },
  removeHighlight: (v) => {
    const idx = HIGHLIGHTS.findIndex(x => x.id === v);
    if (idx >= 0) {
      const removed = HIGHLIGHTS.splice(idx, 1)[0];
      island("Story retirée", `« ${removed.title} » retirée des stories à la une`, false);
    } else {
      island("Story retirée", "Retirée des stories à la une", false);
    }
    haptic([12, 30]);
    setDet("closed");
    refresh(true);
    notifyHostAction('removeHighlight', { id: v });
  },
  igtab: v => {
    S.igTab = +v;
    S.step = [2, 1, 3, 0][+v] ?? 0;
    refresh(true);
    haptic(6);
  },
  closeSheet: () => {
    setDet('closed');
    haptic(6);
  },
  openFollowers: () => {
    drawerHintMode = 'followers';
    X.reseauMode = 'followers';
    openSheet('followers_sheet', 0, 'large');
    haptic(8);
  },
  openFollowing: () => {
    drawerHintMode = 'following';
    X.reseauMode = 'following';
    openSheet('followers_sheet', 0, 'large');
    haptic(8);
  },
  toggleFollowersSheet: v => {
    drawerHintMode = v;
    sheetSlideDir = v === 'followers' ? 1 : -1;
    X.reseauMode = v;
    renderSheet();
    haptic(6);
  },
  toggleFollowUser: v => {
    X.followedUsers = X.followedUsers || {};
    let current;
    if (X.followedUsers[v] !== undefined) {
      current = X.followedUsers[v];
    } else {
      const btn = document.querySelector(`[data-a="toggleFollowUser"][data-v="${v}"]`);
      current = btn ? btn.classList.contains('active') : true;
    }
    X.followedUsers[v] = !current;
    const isNowFollowed = X.followedUsers[v];
    island(
      isNowFollowed ? `Abonné(e) à @${v}` : `Désabonné(e) de @${v}`,
      isNowFollowed ? 'Tu verras ses sorties et carnets alpins' : 'Mise à jour immédiate',
      false
    );
    haptic(10);
    renderSheet();
    notifyHostAction('toggleFollowUser', { handle: v, followed: isNowFollowed });
  },
  openUserProfile: v => {
    const cleanHandle = String(v || '').replace(/^@/, '').trim();
    if (!cleanHandle) return;
    haptic(8);
    if (typeof EXA !== 'undefined' && typeof EXA.closePostModal === 'function') {
      try { EXA.closePostModal(); } catch (_) {}
    }
    if (typeof setDet === 'function') {
      try { setDet('closed'); } catch (_) {}
    }
    notifyHostAction('openUserProfile', cleanHandle);
    if (typeof window !== 'undefined') {
      if (typeof window.__lkdvNavigateProfile === 'function') {
        window.__lkdvNavigateProfile(cleanHandle);
      } else {
        window.location.href = '/profil/' + encodeURIComponent(cleanHandle);
      }
    }
  },
  shareProfile: () => {
    const handle = (S.profile && S.profile.handle) || 'tony_frc';
    const url = typeof window !== 'undefined' ? `${window.location.origin}/u/${handle}` : `https://lekitduvoyageur.fr/u/${handle}`;
    const shareData = {
      title: `Profil de ${S.profile?.name || 'Tony'} sur Le Kit du Voyageur`,
      text: `Rejoins @${handle} sur Le Kit du Voyageur - Carnets & équipement alpin`,
      url: url
    };
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      navigator.share(shareData).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        island('Lien copié dans le presse-papier', `Partage le lien de ton profil @${handle}`, false);
      }).catch(() => {
        island('Lien de partage', url, false);
      });
    } else {
      island('Lien de partage', url, false);
    }
    haptic(10);
    notifyHostAction('shareProfile', url);
  },
  mapscale: v => {
    const preset = (v || 'ORBITE').toUpperCase();
    const btnOrbite = $('btnCompteOrbite');
    const btnMassif = $('btnCompteMassif');
    const btnSentier = $('btnCompteSentier');
    if (btnOrbite) { btnOrbite.classList.toggle('active', preset === 'ORBITE'); btnOrbite.setAttribute('aria-pressed', String(preset === 'ORBITE')); }
    if (btnMassif) { btnMassif.classList.toggle('active', preset === 'MASSIF'); btnMassif.setAttribute('aria-pressed', String(preset === 'MASSIF')); }
    if (btnSentier) { btnSentier.classList.toggle('active', preset === 'SENTIER'); btnSentier.setAttribute('aria-pressed', String(preset === 'SENTIER')); }

    const map = window.__lkdvCompteMap3D;
    if (preset === 'ORBITE') {
      if (map && typeof map.flyTo === 'function') {
        map.flyTo({ center: [2.5, 46.5], zoom: 1.6, pitch: 0, bearing: 0, duration: 2000, essential: true });
      }
      island('Globe Terrestre', 'Empreinte mondiale @tony_frc · 5 massifs foulés', false);
    } else if (preset === 'MASSIF') {
      if (map && typeof map.flyTo === 'function') {
        map.flyTo({ center: [6.82, 45.88], zoom: 8.5, pitch: 48, bearing: -25, duration: 2200, essential: true });
      }
      island('Massif du Mont-Blanc', '5 sorties vérifiées · 94 km · D+ 4 920 m', false);
    } else if (preset === 'SENTIER') {
      if (map && typeof map.flyTo === 'function') {
        map.flyTo({ center: [6.82, 45.88], zoom: 12.8, pitch: 64, bearing: -40, duration: 2200, essential: true });
      }
      island('Sentier Tour du Mont-Blanc', 'Immersion relief 3D 20cm · Tracé GPS certifié', false);
    }
    haptic([10, 25]);
    notifyHostAction('mapscale', preset);
  },
  changeAvatar: () => {
    const AVATAR_PRESETS = [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150'
    ];
    const current = (S.profile && S.profile.avatarUrl) || AVATAR_PRESETS[0];
    const idx = AVATAR_PRESETS.indexOf(current);
    const next = AVATAR_PRESETS[(idx + 1) % AVATAR_PRESETS.length];
    if (!S.profile) S.profile = { handle: 'tony_frc', name: 'Tony' };
    S.profile.avatarUrl = next;
    const prevEl = $('ep_av_preview');
    if (prevEl) prevEl.src = next;
    island('Nouvelle photo sélectionnée', 'Enregistre pour synchroniser ton profil', false);
    haptic(10);
    notifyHostAction('changeAvatar', next);
  },
  editProfile: () => { openSheet('edit_profile_full', 0, 'large'); haptic(8); },
  openCreate: () => {
    if (typeof window !== 'undefined' && typeof window.__lkdvOpenCreate === 'function') {
      window.__lkdvOpenCreate();
      haptic(8);
      return;
    }
    openSheet('create_menu', 0, 'large');
    haptic(8);
  },
  openSaved: () => {
    if (typeof window !== 'undefined' && typeof window.__lkdvOpenSaved === 'function') {
      window.__lkdvOpenSaved();
      haptic(6);
    }
  },
  openAccountDrawer: tab => { const next = Number.isFinite(Number(tab)) ? Math.max(0, Math.min(4, Number(tab))) : 0; drawerHintTab = next; X.drawerTab = next; openSheet('account_drawer', 0, 'large'); haptic(8); },
  signout: () => {
    closeVisMenu(true);
    island('Déconnexion…', 'Fermeture de ta session', false);
    haptic([10, 30]);
    notifyHostAction('signout');
    // The React auth host redirects only once sign-out is confirmed.
  },
  openDrawer: () => { X.drawerTab = 0; openSheet('account_drawer', 0, 'large'); haptic(8); },
  drawerTab: v => { const next = clamp(+v, 0, 4); drawerHintTab = next; sheetSlideDir = next >= (X.drawerTab || 0) ? 1 : -1; X.drawerTab = next; renderSheet(); haptic(6); },
  toggleReseau: v => { X.reseauMode = v; refresh(false); haptic(8); },
  togglefollow: v => {
    island('Abonnement mis à jour', 'Statut synchronisé dans ta cordée', false);
    haptic(10);
  },
  focusOuting: v => {
    const o = OUTINGS.find(x => x.id === v);
    if (o) {
      flyToOuting(o);
      island(o.title, o.km + ' km · D+ ' + Number(o.dplus || 0).toLocaleString('fr-FR') + ' m' + (o.proven ? ' · Preuve GPS ✓' : ''), false);
      haptic(12);
    }
  },
  openOutingDrawer: v => {
    const o = OUTINGS.find(x => x.id === v || x.realId === v);
    if (!o) { island('Sortie introuvable', 'Cette sortie n’est plus accessible.', false); return; }
    openSheet('outing_drawer', 0, 'card', { outingId: o.realId || o.id });
    requestAnimationFrame(() => flyToOuting(o));
    haptic(10);
  },
  save_full_profile: () => {
    const nameEl = $('ep_name'), handleEl = $('ep_handle'), bioEl = $('ep_bio');
    if (nameEl && nameEl.value) S.profile.name = nameEl.value.trim();
    if (handleEl && handleEl.value) S.profile.handle = handleEl.value.trim().replace(/^@/, '');
    if (bioEl && bioEl.value) S.profile.bioLine = bioEl.value.trim();
    const inline = !!(S.sh && S.sh.k === "account_drawer");
    if (inline) {
      X.drawerTab = 3;
      renderTop();
      renderSheet();
      island("Profil mis à jour ✓", "Modifications enregistrées sans quitter le drawer", false);
    } else {
      setDet("closed");
      refresh(true);
      island("Profil mis à jour ✓", "Modifications enregistrées sur ton compte", false);
    }
    haptic([10, 25]);
    notifyHostAction('save_full_profile', S.profile);
  },
  copyProfileLink: () => {
    const handle = (S.profile && S.profile.handle) || "tony_frc";
    const url = `${window.location.origin}/u/${handle}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
        .then(() => island("Lien copié", `@${handle} · ${url}`, false))
        .catch(() => island("Lien du profil", url, false));
    } else {
      island("Lien du profil", url, false);
    }
    haptic(8);
  },

  navtab: v => notifyHostAction('navtab', v),
  opennote: () => openSheet('note', 0, 'large'),
  sealzoom: () => {
    if (typeof window !== 'undefined' && typeof window.__lkdvOpenSeal === 'function') {
      window.__lkdvOpenSeal();
      haptic(6);
      return;
    }
    openSheet('seal', 0, 'large');
  },
  openvault: () => { X.vaultEdit = 0; pushSheet({ k: 'vault' }); },
  vaultopen: () => { X.vault = 1; X.vaultEdit = 0; island('Face ID reconnu', 'Coffre ouvert · se reverrouille à la fermeture', false); renderSheet(); haptic([8, 30, 8]); notifyHostAction('vaultopen'); },
  vaultlock: () => { X.vault = 0; X.vaultEdit = 0; renderSheet(); },
  vaultedit: () => { X.vaultEdit = 1; renderSheet(); },
  vaultsave: () => {
    const f = $('vf_ffcam'), b = $('vf_blood'), d = $('vf_doc');
    if (f && f.value.trim()) S.vaultData.ffcam = f.value.trim();
    if (b && b.value.trim()) S.vaultData.blood = b.value.trim();
    if (d && d.value.trim()) S.vaultData.doctor = d.value.trim();
    X.vaultEdit = 0;
    try { localStorage.setItem(storageKey('lkdv_device_medical_vault_v1'), JSON.stringify(S.vaultData)); } catch (_) {}
    renderSheet();
    island('Coffre médical mis à jour', 'Stocké uniquement dans le Keychain local de cet appareil', false);
    notifyHostAction('vaultsave', S.vaultData);
  },
  openscan: () => { X.scan = 0; openSheet('scan', 0, 'large'); },
  doscan: () => {
    X.scan = 1;
    haptic([10, 30, 10]);
    try {
      localStorage.setItem(storageKey('lkdv_inventory_items_v1'), JSON.stringify(S.invs));
    } catch (_) {}
    renderSheet();
    notifyHostAction('doscan', SCAN_DB);
  },
  scansearch: () => {
    const qEl = $('scanq');
    const q = qEl && qEl.value ? qEl.value.trim() : '';
    if (q && typeof window.__lkdvScanLookup === 'function') {
      window.__lkdvScanLookup(q, item => {
        if (!isCurrent()) return;
        if (item) {
          Object.assign(SCAN_DB, item);
          X.scan = 1;
          haptic(10);
          renderSheet();
        }
      });
    } else {
      if (q) {
        SCAN_DB.n = q;
        SCAN_DB.id = 'p_' + q.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
      }
      X.scan = 1;
      haptic(10);
      renderSheet();
    }
  },
  acct: v => { X.acct = v; S.sh = null; S.stk = []; renderSheet(); closeVisMenu(true); refresh(true); island(v === 'me' ? 'Profil @' + ((S.profile && S.profile.handle) || 'tony_frc') : 'Page club · ' + CLUBS.find(q => q.id === v).n, '', false); haptic(8); },
  visitor: () => { X.visitor = !X.visitor; closeVisMenu(true); S.sh = null; renderSheet(); refresh(true); island(X.visitor ? 'Vue visiteur public' : 'Vue propriétaire', X.visitor ? 'Massifs < 3 sorties, brouillons et préparations masqués' : 'Tu retrouves tes outils d\'édition', false); },
  cyclevis: () => { doMut('vis', (S.vis + 1) % 3); },
  visfollow: () => { island('Maquette visiteur', 'Le bouton Suivre est inactif dans la prévisualisation', false); notifyHostAction('visfollow'); },
  vismsg: () => { island('Maquette visiteur', 'La messagerie du Hub est inactive dans la prévisualisation', false); notifyHostAction('vismsg'); },
  openHighlight: v => { if (v === 'hl5') openSheet('newhl', 0, 'large'); else openStory(v); },
  stclose: () => closeStory(),
  stoptions: () => { const box = document.querySelector('.st-options'); const btn = document.querySelector('.st-options-btn'); const on = box ? box.classList.toggle('on') : false; if (btn) btn.setAttribute('aria-expanded', on ? 'true' : 'false'); haptic(6); },
  stviews: () => { X.viewersOpen = true; const panel = document.querySelector('.st-viewers'); if (panel) panel.classList.add('on'); haptic(6); },
  stviewclose: () => { X.viewersOpen = false; const panel = document.querySelector('.st-viewers'); if (panel) panel.classList.remove('on'); },
  stlike: async () => { const s = X.story; if (!s) return; const st = storyFor(s.id); const slide = st.slides[s.i]; const storyId = slide && slide.storyId; if (!storyId) return; const liked = Boolean(X.storyEng && X.storyEng.liked); try { const res = await fetch(`/api/stories/${storyId}/engagement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: liked ? 'unlike' : 'like' }) }); if (res.ok) { const data = await res.json(); X.storyEng = { ...(X.storyEng || {}), liked: data.liked, likeCount: data.likeCount }; haptic(10); renderStory(); } } catch (_) {} },
  stcomment: async () => { const s = X.story; if (!s) return; const st = storyFor(s.id); const slide = st.slides[s.i]; const storyId = slide && slide.storyId; const input = $('st-comment-input'); const content = input ? input.value.trim() : ''; if (!storyId || !content) return; try { const res = await fetch(`/api/stories/${storyId}/engagement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'comment', content }) }); if (res.ok) { if (input) input.value = ''; haptic(8); void loadStoryEngagement(); } } catch (_) {} },
  stprev: () => { if (X.storyDragMoved) { X.storyDragMoved = false; return; } if (X.hold > 250) return; const s = X.story; if (!s) return; if (s.i > 0) { s.i--; renderStory(); void loadStoryEngagement(); } else { s.i = 0; renderStory(); void loadStoryEngagement(); } },
  stnext: () => { if (X.storyDragMoved) { X.storyDragMoved = false; return; } if (X.hold > 250) return; const s = X.story; if (!s) return; if (s.i >= storyFor(s.id).slides.length - 1) { closeStory(); return; } s.i++; renderStory(); void loadStoryEngagement(); },
  stgear: () => { island('Kit dupliqué dans ton Compas', 'Auto-fork neutre : aucune propagation ni part créateur', false); notifyHostAction('stgear', S.invs); },
  sppin: v => { doMut('sppin', v); renderStory(); },
  viewtoggle: () => { X.feed = !X.feed; refresh(false); },
  filt: v => { X.filter = v; refresh(false); },
  ligsub: v => { X.ligSub = +v; refresh(false); },
  cmp: v => { X.cmp = X.cmp === v ? null : v; const t = TRIBU.find(q => q.id === v); refresh(true); if (X.cmp) { const n = (TRIBU_MASS[v] || []).length; island('Empreintes comparées · ' + t.n, n + ' massif' + (n > 1 ? 's' : '') + ' en commun surligné' + (n > 1 ? 's' : '') + ' sur la carte', false); } },
  profmode: () => { X.prof = X.prof === 'km' ? 'endur' : X.prof === 'endur' ? 'meteo' : 'km'; renderAcc(); },
  roclick: () => { const e = X.evt; if (e) { if (e.o.startsWith('o')) _act('openOuting', e.o); else _act('openCarnet', e.o); } else island('Glisse sur la courbe', 'Les points verts sont des sorties : touche le libellé pour l\'ouvrir', false); },
  departure: () => { const lent = S.invs.find(p => p.lent), m1 = S.massifs.find(m => m.id === 'm1'); island('Check-list de départ', `Cartes ${m1 && m1.cached ? '✓' : '—'} · SOS ${S.sosShare ? '✓' : 'en pause'} · Matériel prêté ${lent ? 'chez ' + lent.lent : 'aucun'} · Entretien ${S.invs.some(p => p.maint && !p.mplan) ? 'à planifier' : '✓'}`, false); haptic(8); },
  remind: v => { const p = S.invs.find(x => x.id === v); island('Rappel envoyé', (p && p.lent ? p.lent : 'Ton proche') + ' reçoit une relance douce dans le Hub', false); notifyHostAction('remind', p); },
  namedrop: () => { island('NameDrop prêt', 'Rapproche les deux iPhone : nom, @tony_frc et lien LKDV', false); notifyHostAction('namedrop'); },
  export: v => { island({ full: 'Archive RGPD prête', gpx: 'Traces GPX prêtes', photos: 'Photos prêtes' }[v], { full: 'Profil, sorties, carnets et kits · art. 20 RGPD (14,2 Mo)', gpx: '14 traces de la saison 2026 pour Strava, Garmin ou Suunto', photos: '126 photos géolocalisées · ZIP 214 Mo' }[v], false); notifyHostAction('export', v); },
  mapfocus: v => { const [k, id] = v.split(':'); S.focus = { k, id }; drawMap(); const p = focusPos(S.focus); if (p) centerOn(p); },
  kitsim: v => { const k = KITS_LINEAGE.find(q => q.id === v); const gain = Math.round(10 * 85 * .03 * .7 * (k.endur / 100) * 100) / 100;
    $('ctx').innerHTML = `<div class="box"><div class="lg pv"><b>${k.n}</b><div class="ef"><span>Endurance actuelle</span><span>${k.endur} %</span></div><div class="ef"><span>Reprises actuelles</span><span>${k.prop}</span></div><div class="ef"><span>Si +10 reprises commandées</span><span style="color:var(--good)">≈ +${fmtE(gain)}</span></div><div class="s2" style="margin-top:6px">Estimation indicative : panier moyen 85 €, 3 % dont 70 % à la souche, pondéré par l'endurance. Aucun crédit n'est généré avant preuve terrain.</div></div><div class="lg menu"><button class="p" data-a="stgear">Partager ce kit (G+1)</button><button data-a="ctxno">Fermer</button></div></div>`; $('ctx').classList.add('on'); haptic(12); }
};
// Guard the complete exported action surface, including captured references.
for (const name of Object.keys(EXA)) {
  const action = EXA[name];
  if (typeof action !== 'function') continue;
  EXA[name] = function (...args) {
    if (!isCurrent()) return;
    return action.apply(this, args);
  };
}
exportedActions = EXA;
try { window.EXA = EXA; } catch (_) {}
const _act = act;
act = function (a, v, meta) {
  if (!isCurrent()) return;
  if ($('ctx').classList.contains('on') && a !== 'ctxok' && a !== 'ctxno') closeCtx();
  if (['stab', 'fnext', 'fprev', 'pg', 'det', 'cycle'].includes(a) && !S.sh) return;
  if (EXA[a]) return EXA[a](v);
  if (a === 'exportrgpd') return EXA.export('full');
  if (a === 'copylink' || a === 'signout' || a === 'ttab') notifyHostAction(a, v);
  return _act(a, v, meta);
};

/* ---------- Gestes : appui long (Peek & Pop, profils), survol carte, repli de la barre ---------- */
phone.addEventListener('pointerdown', e => {
  const tl = e.target.closest('.ig-tile');
  if (tl) { X.lt = { x: e.clientX, y: e.clientY, el: tl, t: setTimeout(() => { X.lt.fired = true; G.sup = Date.now() + 480; G.supEl = tl; peek(tl.dataset.id); }, 460) }; }
  const hd = e.target.closest('#rpvis');
  if (hd) { X.lh = { x: e.clientX, y: e.clientY, t: setTimeout(() => { X.lh.fired = true; G.sup = Date.now() + 480; G.supEl = hd; closeVisMenu(true); openSheet('profiles', 0, 'large'); haptic(14); }, 520) }; }
  if (e.target.closest('.st-zone,.st-body')) { X.holdAt = Date.now(); X.hold = 0; clearTimeout(X.ht); X.ht = setTimeout(() => $('story').classList.add('hold'), 220); }
});
phone.addEventListener('pointermove', e => { [['lt', 'lt'], ['lh', 'lh']].forEach(([k]) => { const s = X[k]; if (s && !s.fired && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) { clearTimeout(s.t); X[k] = null; } }); });
['pointerup', 'pointercancel'].forEach(t => phone.addEventListener(t, () => {
  ['lt', 'lh'].forEach(k => { const s = X[k]; if (s) { if (!s.fired) clearTimeout(s.t); X[k] = null; } });
  if (X.holdAt) { X.hold = Date.now() - X.holdAt; X.holdAt = 0; clearTimeout(X.ht); $('story').classList.remove('hold'); setTimeout(() => { X.hold = 0; }, 60); }
}));
function peek(id) {
  const t = tileById(id); if (!t) return; const pinned = S.pins.includes(id);
  $('ctx').innerHTML = `<div class="box"><div class="lg pv"><div class="pk-art">${tileArt(t.art)}</div><b>${esc(t.bot)} · ${esc(t.top)}</b><div class="s2">${esc(t.date)}</div><div class="s2">${esc(t.desc)}</div>${profSvg(t.id)}${t.prog ? `<div class="bar"><i style="width:${t.prog}%;background:#B98A2E"></i></div><div class="s2">Complétion ${t.prog} % : 12 photos triées · 2 espèces</div>` : ''}</div>
  <div class="lg menu"><button class="p" data-a="${t.act === 'pubdraft' ? 'openCarnet' : t.act}" data-v="${t.id}">Lire / Ouvrir</button><button data-a="mapfocus" data-v="${t.focus}">Voir sur la carte</button><button class="${pinned ? 'sel' : ''}" data-a="pin" data-v="${t.id}">${pinned ? 'Désépingler' : 'Épingler en tête'}</button><button data-a="ctxno">Fermer</button></div></div>`;
  $('ctx').classList.add('on'); haptic(14);
}
phone.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse') return; const t = e.target.closest('.ig-tile[data-focus]'); if (!t || S.sh || S.callout) return;
  const [k, id] = t.dataset.focus.split(':'); if (S.focus && S.focus.k === k && S.focus.id === id) return; X.hov = true; S.focus = { k, id }; drawMap();
});
phone.addEventListener('pointerout', e => { if (!X.hov) return; const t = e.target.closest && e.target.closest('.ig-tile[data-focus]'); if (!t || (e.relatedTarget && t.contains(e.relatedTarget))) return; X.hov = false; if (!S.sh && !S.callout) { S.focus = null; drawMap(); } });
phone.addEventListener('scroll', e => { const t = e.target; if (!t.classList || !t.classList.contains('ig-feed')) return; if (t.scrollTop > 10 && !S.tabMin) { S.tabMin = true; applyShell(); } else if (t.scrollTop < 2 && S.tabMin) { S.tabMin = false; applyShell(); } }, true);
const storyEl = $('story'); if (storyEl) {
  storyEl.addEventListener('animationend', e => { if (e.animationName === 'stfill' && X.story) EXA.stnext(); }, true);
  storyEl.addEventListener('focusin', e => { if (e.target.closest('#st-comment-input')) storyEl.classList.add('hold'); });
  storyEl.addEventListener('focusout', e => { if (e.target.closest('#st-comment-input')) storyEl.classList.remove('hold'); });

  let pointerStart = null;
  storyEl.addEventListener('pointerdown', e => {
    if (!X.story || X.storyClosing) return;
    if (e.target.closest('.st-head, .st-options, .st-options-rail, .st-viewers, .st-viewcount, .st-x, input, button:not(.st-zone)')) return;
    pointerStart = { x: e.clientX, y: e.clientY, dy: 0, id: e.pointerId };
    storyEl.classList.add('dragging');
    try { storyEl.setPointerCapture(e.pointerId); } catch (_) {}
  });
  storyEl.addEventListener('pointermove', e => {
    if (!pointerStart || e.pointerId !== pointerStart.id) return;
    const dx = Math.abs(e.clientX - pointerStart.x);
    const dy = Math.max(0, e.clientY - pointerStart.y);
    pointerStart.dy = dy;
    if (dy > 8 && dy > dx) {
      X.storyDragMoved = true;
      if (e.cancelable) e.preventDefault();
      storyEl.style.transform = `translateY(${dy}px)`;
      storyEl.style.opacity = String(Math.max(0.35, 1 - dy / 700));
    }
  }, { passive: false });
  const endPointer = e => {
    if (!pointerStart) return;
    const dy = pointerStart.dy;
    pointerStart = null;
    storyEl.classList.remove('dragging');
    if (dy > 110) { dismissStory(dy); return; }
    storyEl.style.transform = ''; storyEl.style.opacity = '';
    setTimeout(() => { X.storyDragMoved = false; }, 40);
  };
  storyEl.addEventListener('pointerup', endPointer);
  storyEl.addEventListener('pointercancel', endPointer);
}
if (window.DeviceOrientationEvent) window.addEventListener('deviceorientation', e => { if (e.gamma != null) phone.style.setProperty('--la', (140 + e.gamma * 1.6).toFixed(0) + 'deg'); });

document.addEventListener('keydown', e => { if (e.key === 'Escape' && X.story) { e.stopImmediatePropagation(); closeStory(); } }, true);

function persistLocalState() {
  if (!window.__LKDV_NEXT_PROD) return;
  try {
    localStorage.setItem(storageKey('lkdv_compte_v8_state_v1'), JSON.stringify({
      vis: S.vis,
      pins: S.pins,
      note: S.note,
      orient: S.orient,
      traveller: S.traveller,
      draftPublished: S.draftPublished,
      creditUsed: S.creditUsed,
      sosShare: S.sosShare,
      extraHl: S.extraHl,
      spPins: S.spPins,
      invs: S.invs
    }));
  } catch (_) {}
}

if (window.__LKDV_NEXT_PROD) {
  try {
    const savedVault = localStorage.getItem(storageKey('lkdv_device_medical_vault_v1'));
    if (savedVault) Object.assign(S.vaultData, JSON.parse(savedVault));
    const savedState = localStorage.getItem(storageKey('lkdv_compte_v8_state_v1'));
    if (savedState) {
      const st = JSON.parse(savedState);
      if (typeof st.vis === 'number') S.vis = st.vis;
      if (Array.isArray(st.pins)) S.pins = st.pins;
      if (st.note !== undefined) S.note = st.note;
      if (st.orient && typeof st.orient === 'object') Object.assign(S.orient, st.orient);
      if (st.traveller && typeof st.traveller === 'object') Object.assign(S.traveller, st.traveller);
      if (typeof st.draftPublished === 'boolean') S.draftPublished = st.draftPublished;
      if (typeof st.creditUsed === 'boolean') S.creditUsed = st.creditUsed;
      if (typeof st.sosShare === 'boolean') S.sosShare = st.sosShare;
      if (Array.isArray(st.extraHl)) S.extraHl = st.extraHl;
      if (Array.isArray(st.spPins)) S.spPins = st.spPins;
      if (Array.isArray(st.invs) && st.invs.length >= 5) S.invs = st.invs;
    }
  } catch (_) {}
}

const _doMut = doMut;
doMut = function (k, v, meta) {
  if (!isCurrent()) return;
  /* Le pont a besoin de l'état d'avant mutation pour rétablir une
     confidentialité ou une visibilité d'empreinte dont l'écriture échoue
     (ou sans compte connecté). */
  const previousProfileVisibility = S.profileVisibility;
  const previousSignatureVisibility = S.vis;
  const mutationMeta = meta && typeof meta === "object" ? meta : {};
  _doMut(k, v, meta);
  persistLocalState();
  if (typeof window.__lkdvOnMutate === "function") {
    try {
      window.__lkdvOnMutate(k, v, S, {
        ...mutationMeta,
        previousProfileVisibility,
        previousSignatureVisibility,
      });
    } catch (_) {}
  }
};
window.__lkdvCompteAct = act;
/* Rétablissement exact après un échec de persistance : ne repasse pas par le
   pont de mutation (sinon la tentative échouée se rejouerait en boucle). Le
   drawer React n'est jamais démonté : son état d'attente peut se résoudre. */
window.__lkdvSetProfileVisibility = function(value) {
  if (!isCurrent()) return;
  const target = resolveProfileVis(value);
  if (target == null || S.profileVisibility === target) return;
  setProfileVisibility(target);
  refreshWithoutSheet(true);
};
window.__lkdvSetSignatureVisibility = function(value) {
  if (!isCurrent()) return;
  const target = applySetVis(S.vis, value);
  if (target == null || S.vis === target) return;
  S.vis = target;
  persistLocalState();
  refreshWithoutSheet(true);
};
window.__lkdvGetState = () => isCurrent() ? ({ S, CARNETS, OUTINGS, CLUBS, KITS_LINEAGE, ORDERS, SPECIES }) : null;

/* Highlights are hydrated by the host bootstrap; no duplicate account request. */
window.__lkdvHydrateCompte = function (data) {
  if (!isCurrent()) return;
  if (!data) return;
  if (data.replace === true) {
    if (Array.isArray(data.carnets)) CARNETS = data.carnets;
    if (Array.isArray(data.outings)) OUTINGS = data.outings;
    if (Array.isArray(data.orders)) ORDERS = data.orders;
    if (Array.isArray(data.bookings)) ORDERS_BOOKINGS = data.bookings;
    if (Array.isArray(data.tribu)) TRIBU = data.tribu;
    if (Array.isArray(data.notifications)) S.notifications = data.notifications;
    if (Array.isArray(data.clubs)) { CLUBS = data.clubs; S.clubs = data.clubs; }
    if (Array.isArray(data.followers)) FOLLOWERS = data.followers;
    if (Array.isArray(data.following)) { FOLLOWING = data.following; TRIBU = data.following; }
    if (Array.isArray(data.kits)) KITS_LINEAGE = data.kits;
    if (Array.isArray(data.species)) SPECIES = data.species;
    if (Array.isArray(data.stories)) STORY_HIGHLIGHTS = data.stories;
    if (Array.isArray(data.highlights)) {
      HIGHLIGHTS = data.highlights.map((h) => ({
        id: h.id,
        title: h.title || 'Story',
        sub: `${h.items || 0} story${(h.items || 0) === 1 ? '' : 's'}`,
        mass: '',
        step: 2,
        coverImage: h.coverImage || null,
        stories: h.stories || [],
      }));
    }
    if (Array.isArray(data.massifs)) {
      MASSIFS = data.massifs;
      S.massifs = data.massifs;
    }
    if (data.handle) S.profile.handle = String(data.handle).replace(/^@/, '');
    if (data.name) S.profile.name = data.name;
    if (typeof data.isGuest === 'boolean') S.profile.isGuest = data.isGuest;
    if (typeof data.isDemo === 'boolean') S.profile.isDemo = data.isDemo;
    if (data.avatarUrl !== undefined) S.profile.avatarUrl = data.avatarUrl || null;
    if (data.bioLine !== undefined) S.profile.bioLine = data.bioLine || '';
    if (data.home !== undefined) S.traveller.home = data.home || '';
    if (data.sigText !== undefined) S.profile.sigText = data.sigText || '';
    if (typeof data.vis === 'number') S.vis = data.vis;
    if (data.profileVisibility === 'public' || data.profileVisibility === 'prive') {
      setProfileVisibility(data.profileVisibility);
    }
    if (typeof data.followersCount === 'number') {
      S.profile.followersCount = data.followersCount;
      S.profile.followersLabel = data.followersLabel || data.followersCount.toLocaleString('fr-FR');
    }
    if (typeof data.followingCount === 'number') S.profile.followingCount = data.followingCount;
    if (typeof data.storeCreditEur === 'number') S.profile.storeCreditEur = data.storeCreditEur;
    if (typeof data.loyaltyPoints === 'number') S.profile.loyaltyPoints = data.loyaltyPoints;
    rebuildMonthlyStats();
    refresh(true);
    return;
  }
  if (data.handle && typeof data.handle === 'string') S.profile.handle = data.handle.replace(/^@/, '');
  if (data.name && typeof data.name === 'string') S.profile.name = data.name;
  if (data.avatarUrl && typeof data.avatarUrl === 'string') S.profile.avatarUrl = data.avatarUrl;
  if (data.bioLine && typeof data.bioLine === 'string') S.profile.bioLine = data.bioLine;
  if (data.sigText && typeof data.sigText === 'string') S.profile.sigText = data.sigText;
  if (typeof data.followers === 'number' && data.followers > 0) {
    S.profile.followersLabel = data.followers.toLocaleString('fr-FR');
  }
  if (typeof data.vis === 'number') S.vis = data.vis;
  if (data.profileVisibility === 'public' || data.profileVisibility === 'prive') {
    setProfileVisibility(data.profileVisibility);
  }
  if (data.home && typeof data.home === 'string') S.traveller.home = data.home;

  if (Array.isArray(data.carnets) && data.carnets.length) {
    data.carnets.forEach((c, idx) => {
      const isDraft = c.visibility === 'private';
      if (isDraft) {
        const d0 = CARNETS.find(x => x.id === 'ca0');
        if (d0) {
          d0.realId = c.id;
          if (c.title) d0.title = c.title;
        }
      } else if (!CARNETS.some(x => x.realId === c.id || x.title === c.title)) {
        CARNETS.push({
          id: 'ca_supa_' + idx,
          realId: c.id,
          title: c.title || 'Carnet de montagne',
          mass: 'Alpes',
          x: 220 + (idx * 15) % 60,
          y: 130 + (idx * 12) % 45,
          status: 'published',
          views: c.views_count || 120,
          likes: c.likes_count || 18,
          sp: 2
        });
      }
    });
  }

  if (Array.isArray(data.outings) && data.outings.length) {
    data.outings.forEach((o, idx) => {
      if (!OUTINGS.some(x => x.realId === o.id || x.title === o.title)) {
        OUTINGS.push({
          id: 'o_supa_' + idx,
          realId: o.id,
          title: o.title || 'Sortie montagne',
          mass: o.mass || 'Alpes',
          date: o.date || '2026',
          km: Number(o.km) || 24,
          dplus: Number(o.dplus) || 1200,
          maxAlt: 2400,
          status: o.status === 'planned' ? 'planned' : 'done',
          x: 200,
          y: 140
        });
      }
    });
  }

  if (Array.isArray(data.clubs) && data.clubs.length) {
    data.clubs.forEach((c, idx) => {
      const id = c.slug || ('club_' + idx);
      if (!CLUBS.some(x => x.id === id || x.n === c.name)) {
        CLUBS.push({
          id,
          n: c.name || 'Club LKDV',
          role: c.role === 'admin' ? 'Admin' : 'Membre',
          members: Number(c.membersCount) || 120,
          next: c.nextEvent || 'Sortie collective dimanche 08h30',
          joined: true
        });
      }
    });
  }

  if (Array.isArray(data.gearItems) && data.gearItems.length) {
    data.gearItems.forEach((g, idx) => {
      const id = 'supa_' + (g.id || idx);
      const name = g.product_name || g.name || 'Équipement';
      if (!S.invs.some(p => p.id === id || p.n === name)) {
        S.invs.push({
          id,
          realId: g.id,
          n: name,
          b: g.brand || 'LKDV',
          c: g.category || 'Sac',
          w: Number(g.weight_g || g.weight_grams) || 320,
          paid: Number(g.purchase_price_eur || g.price) || 110,
          so: Number(g.outings_count) || 8,
          cond: g.condition || 'bon',
          lent: g.loaned_to || null,
          maint: null,
          verdict: 'utile'
        });
      }
    });
  }

  if (Array.isArray(data.orders) && data.orders.length) {
    data.orders.forEach((o, idx) => {
      const num = o.order_number || ('#' + (4900 + idx));
      if (!ORDERS.some(x => x.id === num)) {
        const firstItem = Array.isArray(o.items) && o.items[0] ? o.items[0].name : 'Commande LKDV';
        ORDERS.unshift({
          id: num,
          realId: o.id,
          d: o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Récent',
          t: firstItem,
          st: o.status === 'delivered' ? 'Livrée · preuve terrain active' : 'Confirmée · suivi actif',
          amt: Number(o.total_eur) || 89
        });
      }
    });
  }

  refresh(true);
};
/* ---------- Montage ---------- */
bindIgSwipe();
refresh(true);
})();



// Global state accessor for debugging and test suites
window.__lkdvGetState = () => isCurrent() ? ({
  S,
  G,
  CARNETS,
  OUTINGS,
  CLUBS,
  ORDERS,
  ORDERS_BOOKINGS,
  KITS_LINEAGE,
}) : null;

window.__lkdvCompteAct = (actionName, val, meta) => {
  if (!isCurrent()) return;
  try {
    if (typeof act === 'function') {
      act(actionName, val, meta);
    }
  } catch (err) {
    console.warn('[CompteLiquidGlassV8] __lkdvCompteAct error:', err);
  }
};

// Supabase Live Data Hydration Bridge (Strictly Pure Genuine Data)
// Le hydrate « replace » ci-dessus reste la source de vérité pour les payloads
// complets ; cette variante ne sert qu'aux patches partiels du profil.
const hydrateAccountReplace = window.__lkdvHydrateCompte;
window.__lkdvHydrateCompte = (data) => {
  if (!isCurrent()) return;
  if (!data || typeof data !== 'object') return;
  if (data.replace === true) {
    hydrateAccountReplace(data);
    return;
  }

  if (data.handle) {
    S.profile.handle = String(data.handle).replace(/^@/, '');
    const hEl = document.querySelector('.ig-handle-text');
    if (hEl) hEl.textContent = '@' + S.profile.handle;
  }
  if (data.name) {
    S.profile.name = data.name;
    const nEl = document.querySelector('.ig-name');
    if (nEl) nEl.textContent = data.name;
  }
  if (data.bioLine !== undefined) {
    S.profile.bioLine = data.bioLine;
    const bEl = document.querySelector('.ig-bio-line');
    if (bEl) bEl.textContent = data.bioLine;
  }
  if (data.avatarUrl !== undefined) {
    S.profile.avatarUrl = data.avatarUrl;
    const imgEl = document.querySelector('.ig-avi-img');
    if (imgEl && data.avatarUrl) imgEl.src = data.avatarUrl;
  }
  if (data.home !== undefined) {
    S.traveller.home = data.home;
  }
  if (data.followersCount !== undefined) {
    S.profile.followersCount = Number(data.followersCount) || 0;
    S.profile.followersLabel = String(S.profile.followersCount);
  }
  if (data.followingCount !== undefined) {
    S.profile.followingCount = Number(data.followingCount) || 0;
  }
  if (data.storeCreditEur !== undefined) {
    S.profile.storeCreditEur = Number(data.storeCreditEur) || 0;
  }
  if (data.loyaltyPoints !== undefined) {
    S.profile.loyaltyPoints = Number(data.loyaltyPoints) || 0;
  }
  S.profile.isGuest = !!data.isGuest;

  // Carnets : remplacement complet, même vide. Un compte connecté ne garde
  // jamais les carnets de démonstration pendant le chargement du bootstrap.
  if (Array.isArray(data.carnets)) {
    CARNETS.length = 0;
    data.carnets.forEach((c, idx) => {
      CARNETS.push({
        id: 'ca_' + (c.id || idx),
        realId: c.id,
        title: c.title || 'Carnet de voyage',
        mass: c.destination || c.location || 'Alpes',
        year: c.start_date ? new Date(c.start_date).getFullYear() : 2026,
        vis: c.visibility === 'public' ? 'world' : 'friends',
        likes: c.likes_count || 0,
        views: c.views_count || 0,
        comments: c.comments_count || 0,
        coverImage: c.cover_image || null,
        hasGpx: true,
        badge: c.verified ? 'Terrain vérifié' : undefined,
        x: 210 + (idx * 18) % 70,
        y: 135 + (idx * 14) % 50
      });
    });
  }

  // Outings : remplacement complet, même vide.
  if (Array.isArray(data.outings)) {
    OUTINGS.length = 0;
    data.outings.forEach((o, idx) => {
      OUTINGS.push({
        id: 'out_' + (o.id || idx),
        realId: o.id,
        slug: o.slug,
        title: o.title || o.name || 'Sortie alpine',
        mass: o.destination_name || o.destination || o.massif || 'Montagne',
        date: o.start_date ? new Date(o.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '2026',
        km: Number(o.km || o.distance_km) || 0,
        dplus: Number(o.dplus || o.elevation_gain_m) || 0,
        maxAlt: o.max_altitude || 2000,
        status: o.status === 'completed' || o.status === 'done' ? 'done' : 'planned',
        x: 200,
        y: 140
      });
    });
  }

  // Clubs : remplacement complet, même vide.
  if (Array.isArray(data.clubs)) {
    CLUBS.length = 0;
    data.clubs.forEach((c, idx) => {
      CLUBS.push({
        id: c.slug || ('club_' + idx),
        n: c.name || 'Club LKDV',
        role: c.role === 'admin' ? 'Admin' : 'Membre',
        members: Number(c.membersCount) || 0,
        next: c.nextEvent || 'Prochainement',
        joined: true
      });
    });
  }

  // Gear items: remplacement même vide (un compte réel sans matériel n'hérite
  // jamais de l'inventaire de démonstration).
  if (Array.isArray(data.gearItems)) {
    S.invs.length = 0;
    data.gearItems.forEach((g, idx) => {
      S.invs.push({
        id: 'supa_' + (g.id || idx),
        realId: g.id,
        n: g.name || g.product_name || 'Équipement',
        b: g.brand || 'LKDV',
        c: g.category || 'Sac',
        w: Number(g.weight_g) || 300,
        paid: g.price_cents ? g.price_cents / 100 : (Number(g.purchase_price_eur) || 0),
        so: Number(g.outings_count) || 0,
        cond: g.condition || 'bon',
        lent: g.is_lent ? (g.loaned_to || 'En prêt') : null,
        maint: null,
        verdict: 'utile'
      });
    });
  }

  // Kits, espèces, massifs, réseau : remplacement immédiat même vide pour
  // qu'aucune valeur de démonstration n'apparaisse avant le bootstrap complet.
  if (Array.isArray(data.kits)) KITS_LINEAGE = data.kits;
  if (Array.isArray(data.species)) SPECIES = data.species;
  if (Array.isArray(data.massifs)) { MASSIFS = data.massifs; S.massifs = data.massifs; }
  if (Array.isArray(data.followers)) FOLLOWERS = data.followers;
  if (Array.isArray(data.following)) { FOLLOWING = data.following; TRIBU = data.following; }

  // Orders : remplacement complet, même vide.
  if (Array.isArray(data.orders)) {
    ORDERS.length = 0;
    ORDERS_BOOKINGS.length = 0;
    data.orders.forEach((o, idx) => {
      const num = o.order_number || ('#' + (4900 + idx));
      const firstItem = Array.isArray(o.items) && o.items[0] ? (o.items[0].name || o.items[0].product_name) : 'Commande LKDV';
      const orderDate = o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Récent';
      
      ORDERS.push({
        id: num,
        realId: o.id,
        d: orderDate,
        t: firstItem,
        st: o.status === 'delivered' ? 'Livrée · preuve terrain active' : 'Confirmée · suivi actif',
        amt: Number(o.total_eur) || 0
      });

      ORDERS_BOOKINGS.push({
        id: 'or_' + idx,
        kind: 'order',
        n: firstItem,
        sub: 'Boutique LKDV · ' + num + ' · ' + orderDate,
        price: Number(o.total_eur) || 0,
        status: o.status === 'delivered' ? 'confirmed' : 'pending',
        prov: 'Boutique LKDV'
      });
    });
  }

  // Active Loans: Full replacement
  if (Array.isArray(data.activeLoans)) {
    data.activeLoans.forEach((loan) => {
      const inv = S.invs.find(i => i.realId === loan.product_ownership_id);
      if (inv) inv.lent = loan.borrower_contact || 'Proche';
    });
  }

  // Massifs map data: derived from real outings
  if (Array.isArray(S.massifs)) {
    S.massifs.forEach(m => {
      const mName = m.name.toLowerCase();
      const mReg = (m.reg || '').toLowerCase();
      const matchingOutings = OUTINGS.filter(o => {
        if (!o.mass) return false;
        const oMass = o.mass.toLowerCase();
        return oMass.includes(mName) || mName.includes(oMass) ||
               (mReg && (oMass.includes(mReg) || mReg.includes(oMass))) ||
               (m.id === 'm1' && (oMass.includes('pyrén') || oMass.includes('néouvielle') || oMass.includes('gavarnie'))) ||
               (m.id === 'm2' && (oMass.includes('blanc') || oMass.includes('chamonix') || oMass.includes('alpes'))) ||
               (m.id === 'm3' && (oMass.includes('vercors') || oMass.includes('plateaux'))) ||
               (m.id === 'm4' && oMass.includes('écrins')) ||
               (m.id === 'm5' && (oMass.includes('corse') || oMass.includes('bavella')));
      });
      m.outings = Math.max(m.outings || 0, matchingOutings.length);
      if (matchingOutings.length > 0) {
        m.km = matchingOutings.reduce((sum, o) => sum + (o.km || 0), 0);
        m.dplus = matchingOutings.reduce((sum, o) => sum + (o.dplus || 0), 0);
      }
    });
  }

  if (typeof refresh === 'function') refresh(true);
};


/* ---------- Moteur Carte Vivante 3D (MapLibre GL + Projection Globe + AWS Terrarium DEM Relief + Satellite Esri) ---------- */

// Initial render
if (typeof refresh === 'function') refresh(true);
/* La carte est un îlot React monté dans #lkdv-map-root (ou #maplibre-compte-canvas). */
})();
  } catch (err) {
    console.error('[CompteLiquidGlassV8] Runtime init error:', err);
  } finally {
    window.addEventListener = origWinAdd;
    document.addEventListener = origDocAdd;
  }

  return () => {
    disposed = true;
    if (window.EXA === exportedActions) delete window.EXA;
    for (const id of timers) window.clearTimeout(id);
    timers.clear();
    for (const id of frames) {
      if (window.cancelAnimationFrame) window.cancelAnimationFrame(id);
      else window.clearTimeout(id);
    }
    frames.clear();
    /* Cycle de vie : le snapshot de contexte ne doit pas survivre au montage. */
    mapContextLayerSnapshot = null;
    /* Un démontage avec drawer ouvert ne doit pas laisser `#phone` inerte. */
    applySheetModalState(accountRoot.querySelector("#sheet"), false);
    if (window.__lkdvCompteMapRO) {
      try { window.__lkdvCompteMapRO.disconnect(); } catch (_) {}
      window.__lkdvCompteMapRO = null;
    }
    if (window.__lkdvCompteMap3D) {
      try { window.__lkdvCompteMap3D.remove(); } catch (_) {}
      window.__lkdvCompteMap3D = null;
    }
    for (const { type, listener, options } of trackedWindowListeners) {
      window.removeEventListener(type, listener, options);
    }
    for (const { type, listener, options } of trackedDocListeners) {
      document.removeEventListener(type, listener, options);
    }
  };
}