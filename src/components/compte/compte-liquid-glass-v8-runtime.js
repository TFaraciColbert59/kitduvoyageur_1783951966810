/* eslint-disable */
export function initCompteLiquidGlassRuntime(rootContainer) {
  if (!rootContainer) return () => {};
  window.__LKDV_NEXT_PROD = true;

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

  try {
    (function() {

const $ = id => document.getElementById(id);
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
  pack: "M9 6.5V5a3 3 0 0 1 6 0v1.5M6 10.5a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8.5ZM9.5 14h5v4h-5z",
  sliders: "M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4",
  list: "M4 7h16M4 12h16M4 17h16",
  grid: "M4 4h6.5v6.5H4V4ZM13.5 4H20v6.5h-6.5V4ZM4 13.5h6.5V20H4v-6.5ZM13.5 13.5H20V20h-6.5v-6.5Z",
  carousel: "M5 5h11v11H5V5ZM9 19h10V9",
  x: "M6.5 6.5l11 11M17.5 6.5l-11 11",
  expand: "M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5",
  shrink: "M20 10h-6V4M4 14h6v6M14 10l6.5-6.5M10 14l-6.5 6.5",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  chevL: "M15 6l-6 6 6 6",
  chevR: "M9 6l6 6-6 6",
  chevD: "M7 10l5 5 5-5",
  share: "M12 3v12M8 7l4-4 4 4M6 11v9h12v-9",
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
  ["explorer", "Explorer", IC.globe],
  ["compas", "Compas", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z"],
  ["materiel", "Matériel", IC.bag],
  ["hub", "Hub", IC.hub],
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
let HIGHLIGHTS = [{ id: "hl5", title: "Nouveau", mass: "m1", step: 0, sub: "Ajouter un moment terrain à la une" }]; let _MOCK_HIGHLIGHTS = [
  { id: "hl1", title: "Alpes IT·FR", mass: "m2", step: 1, sub: "5 sorties · Mont-Blanc & Grand Paradis · 94 km" },
  { id: "hl2", title: "Néouvielle", mass: "m1", step: 2, sub: "Bivouac 3 jours · 2 450 m · 18 photos" },
  { id: "hl3", title: "Vercors", mass: "m3", step: 2, sub: "Traversée Hauts Plateaux · 34 km · Gypaète" },
  { id: "hl4", title: "Sac 4,8kg", mass: "m1", step: 3, sub: "Kit souche G1 · 91 % d'endurance terrain" },
  { id: "hl5", title: "Nouveau", mass: "m1", step: 0, sub: "Ajouter un moment terrain à la une" }
];

let MASSIFS = [
  { id: "m1", name: "Hautes-Pyrénées", reg: "PYRÉNÉES", outings: 0, km: 0, dplus: 0, x: 96, y: 174, r: 28, cacheMb: 0, cached: false },
  { id: "m2", name: "Mont-Blanc & Alpes IT·FR", reg: "ALPES · IT/FR", outings: 0, km: 0, dplus: 0, x: 266, y: 118, r: 32, cacheMb: 0, cached: false },
  { id: "m3", name: "Hauts Plateaux du Vercors", reg: "VERCORS", outings: 0, km: 0, dplus: 0, x: 232, y: 158, r: 24, cacheMb: 0, cached: false },
  { id: "m4", name: "Écrins", reg: "HAUTES-ALPES", outings: 0, km: 0, dplus: 0, x: 258, y: 174, r: 18, cacheMb: 0, cached: false }
]; let _MOCK_MASSIFS = [
  { id: "m1", name: "Hautes-Pyrénées", reg: "PYRÉNÉES", outings: 4, km: 112, dplus: 5840, x: 96, y: 174, r: 28, cacheMb: 22, cached: true },
  { id: "m2", name: "Mont-Blanc & Alpes IT·FR", reg: "ALPES · IT/FR", outings: 5, km: 94, dplus: 4920, x: 266, y: 118, r: 32, cacheMb: 14, cached: true },
  { id: "m3", name: "Hauts Plateaux du Vercors", reg: "VERCORS", outings: 3, km: 68, dplus: 2420, x: 232, y: 158, r: 24, cacheMb: 12, cached: true },
  { id: "m4", name: "Écrins", reg: "HAUTES-ALPES", outings: 2, km: 44, dplus: 2240, x: 258, y: 174, r: 18, cacheMb: 19, cached: false }
];

let OUTINGS = []; let _MOCK_OUTINGS = [
  { id: "o1", title: "Trek des 3 Vallées, Pyrénées", mass: "Hautes-Pyrénées", date: "12–15 oct. · J-4", km: 58, dplus: 3420, maxAlt: 2640, status: "upcoming", ready: 82, comp: ["Тоny", "Léa", "Marc", "Sarah"], kit: "k1", x: 96, y: 174 },
  { id: "o2", title: "Boucle du Lac Blanc", mass: "Mont-Blanc", date: "18 sept. 2026", km: 12, dplus: 950, maxAlt: 2352, status: "done", proven: true, comp: ["Тоny", "Léa"], kit: "k4", x: 266, y: 118 },
  { id: "o3", title: "Traversée des Hauts Plateaux", mass: "Vercors", date: "29–30 août 2026", km: 34, dplus: 1600, maxAlt: 2020, status: "done", proven: true, comp: ["Тоny", "Marc", "Yanis"], kit: "k2", x: 232, y: 158 },
  { id: "o4", title: "Tour du Néouvielle", mass: "Hautes-Pyrénées", date: "11–13 août 2026", km: 41, dplus: 2380, maxAlt: 2450, status: "done", proven: true, comp: ["Тоny", "Léa", "Inès"], kit: "k1", x: 114, y: 184 }
];

let CARNETS = []; let _MOCK_CARNETS = [
  { id: "ca2", title: "Reflet du Mont-Blanc au Lac Blanc", short: "Mont-Blanc 🇮🇹🇫🇷", mass: "Haute-Savoie", massId: "m2", date: "Publié · 19 sept.", status: "pub", photos: 9, species: ["Bouquetin des Alpes"], likes: 64, views: 420, quote: "Montée avant 7 h pour le miroir parfait sans vent.", x: 292, y: 104, h: 200 },
  { id: "ca1", title: "Trois jours autour du Néouvielle", short: "Néouvielle", mass: "Hautes-Pyrénées", massId: "m1", date: "Publié · 15 août", status: "pub", photos: 18, species: ["Gentiane de Koch", "Marmotte"], likes: 48, views: 312, quote: "Lacs glacés à l'aube et granit doré au camp d'Aubert.", x: 70, y: 158, h: 165 },
  { id: "ca3", title: "Glacier Blanc & Pré de Mme Carle", short: "Écrins", mass: "Écrins", massId: "m4", date: "Publié · 14 juil.", status: "pub", photos: 15, species: ["Aigle royal", "Edelweiss"], likes: 39, views: 255, quote: "Traces de crampons sur le névé matinal.", x: 282, y: 184, h: 32 },
  { id: "ca0", title: "Traversée du Vercors, bivouac", short: "Vercors", mass: "Vercors", massId: "m3", date: "Brouillon prêt · 30 août", status: "draft", photos: 12, species: ["Gypaète barbu", "Chamois"], likes: 27, views: 180, quote: "Bivouac sous les étoiles au pas de l'Aiguille, source du km 14 à sec.", x: 204, y: 146, h: 145 }
];

let SPECIES = []; let _MOCK_SPECIES = [
  { id: "sp1", n: "Gypaète barbu", lat: "Gypaetus barbatus", mass: "Vercors", date: "30 août", conf: "98 %", x: 228, y: 152 },
  { id: "sp2", n: "Gentiane de Koch", lat: "Gentiana acaulis", mass: "Hautes-Pyrénées", date: "12 août", conf: "96 %", x: 102, y: 179 },
  { id: "sp3", n: "Bouquetin des Alpes", lat: "Capra ibex", mass: "Haute-Savoie", date: "18 sept.", conf: "99 %", x: 270, y: 122 },
  { id: "sp4", n: "Aigle royal", lat: "Aquila chrysaetos", mass: "Écrins", date: "14 juil.", conf: "94 %", x: 262, y: 170 }
];

let KITS_LINEAGE = []; let _MOCK_KITS_LINEAGE = [
  { id: "k1", n: "Trek 3 saisons · Pyrénées", gen: "Kit souche (G1)", proven: 14, prop: 118, endur: 91, credit: 28.5, w: 6150, items: 10, desc: "Gardé par 9 voyageurs sur 10 après ≥ 1 km sur le terrain", x: 106, y: 170 },
  { id: "k2", n: "Bivouac léger · Vercors", gen: "Lignée G2 (depuis @marc.trail)", proven: 6, prop: 52, endur: 88, credit: 9.8, w: 4820, items: 7, desc: "Gardé par 9 voyageurs sur 10 · 2 forks actifs", x: 236, y: 162 },
  { id: "k4", n: "Journée montagne · Alpes 🇮🇹🇫🇷", gen: "Kit souche (G1)", proven: 5, prop: 24, endur: 94, credit: 4.2, w: 2760, items: 5, desc: "Plancher de 5 sessions atteint · éligible part créateur", x: 262, y: 114 }
];

const INV_ITEMS = [
  { id: "p11", n: "Frontale 200 lm", b: "Petzl", c: "Sécurité", w: 80, cond: "bon", lent: "Noah", since: "2 sept.", so: 30, paid: 35, maint: null },
  { id: "p3", n: "Sac de couchage −2 °C", b: "Mammut", c: "Couchage", w: 980, cond: "usé", lent: null, so: 38, paid: 240, maint: "Gonflant réduit, lavage duvet conseillé", verdict: "essentiel" },
  { id: "p7", n: "Gourde 2 L + filtre", b: "Katadyn", c: "Eau", w: 640, cond: "bon", lent: null, so: 12, paid: 69, maint: "Cartouche à remplacer avant le trek", verdict: "essentiel" },
  { id: "p2", n: "Tente 2P Hubba", b: "MSR", c: "Couchage", w: 1720, cond: "bon", lent: null, so: 17, paid: 499, maint: null, rentOut: true, verdict: "essentiel" },
  { id: "p4", n: "Matelas R 4,2", b: "Therm-a-Rest", c: "Couchage", w: 540, cond: "bon", lent: null, so: 17, paid: 189, maint: null, verdict: "essentiel" },
  { id: "p5", n: "Veste imperméable 3L", b: "Arc'teryx", c: "Vêtements", w: 390, cond: "bon", lent: null, so: 44, paid: 320, maint: null, verdict: "essentiel" }
];

let ORDERS = []; let ORDERS_BOOKINGS = []; let _MOCK_ORDERS_BOOKINGS = [
  { id: "b1", kind: "booking", n: "Garden & City Cauterets Balneo", sub: "RouteStack · nuit du 11 oct. · 2 chambres", price: 188.7, status: "confirmed", prov: "RouteStack" },
  { id: "b2", kind: "booking", n: "Refuge Ledormeur", sub: "Direct refuge · nuit du 13 oct. · 4 pers.", price: 184, status: "pending", prov: "Refuge (direct)" },
  { id: "or1", kind: "order", n: "Duvet Trek 900 −11 °C + Cartouche Katadyn", sub: "Boutique LKDV · Commande #LK-4829 · crédit déduit", price: 249, status: "confirmed", prov: "Boutique LKDV" }
];

let TRIBU = []; let _MOCK_TRIBU = [
  { id: "t1", n: "Léa", i: "L", ps: "montagne_lea", rel: "Abonnés mutuels", tr: 91, mass: "Pyrénées & Mont-Blanc", online: 1 },
  { id: "t2", n: "Marc", i: "M", ps: "marc.trail", rel: "Abonnés mutuels", tr: 86, mass: "Vercors & Écrins", online: 1 },
  { id: "t3", n: "Noah", i: "N", ps: "noah.run", rel: "Emprunte ta frontale", tr: 77, mass: "Lille & Flandres", online: 0, borrow: "p11" },
  { id: "t4", n: "Yanis", i: "Y", ps: "yanis.alpi", rel: "Abonnés mutuels", tr: 93, mass: "Mont-Blanc", online: 1 }
];

let CLUBS = []; let _MOCK_CLUBS = [
  { id: "cl1", n: "Club Alpin Pyrénées", role: "Membre actif", members: 142, next: "Sortie Néouvielle · 24 oct.", joined: true },
  { id: "cl2", n: "Torino & Chamonix Alpi 🇮🇹🇫🇷", role: "Co-organisateur", members: 89, next: " Grand Paradis · 2 nov.", joined: true },
  { id: "cl3", n: "Bivouac 4 Saisons", role: "Découvrir", members: 310, next: "Traversée Vercors hiver", joined: false }
];

const MONTHS_12 = [
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
const COUNTRIES = ["France", "Italie", "Suisse", "Belgique", "Canada", "Espagne"];
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
  prof: "km",
  vis: 1, // 0: Privée, 1: Communauté, 2: Publique
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
      : totalOutings + " sortie" + (totalOutings > 1 ? "s" : "") + " vérifiée" + (totalOutings > 1 ? "s" : "") + " · " + totalKm + " km · " + totalDplus + " m D+";

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

const MUT = {
  vis: v => { S.vis = +v; return "Empreinte @tony_frc : " + VIS_LABELS[+v]; },
  orient: v => { const [k, val] = v.split(":"); S.orient[k] = val; const lbl = (ORIENT_OPTS[k].find(x => x[0] === val) || [0, val])[1]; return "Pratique : " + lbl; },
  home: v => { S.traveller.home = v; return "Domicile : " + v + " (gardé à 1 km près)"; },
  nat: v => { S.traveller.nationality = v; return "Nationalité : " + v; },
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

let doMut = function(a, v) {
  if (!MUT[a]) return;
  const b0 = derive(), snap = clone(S);
  const lab = MUT[a](v);
  if (!lab) return;
  const changed = JSON.stringify(snap) !== JSON.stringify(S);
  if (changed) { U.push(snap); if (U.length > 40) U.shift(); }
  const b1 = derive();
  island(lab, changed ? diffAccount(b0, b1) : "", changed);
  haptic(changed ? 10 : [8, 40, 8]);
  refresh(true);
}

let undo = function() {
  if (!U.length) { island("Rien à annuler", "", false); return; }
  const b0 = derive();
  const keep = { step: S.step, igTab: S.igTab, sh: S.sh, stk: S.stk, big: S.big, mopts: S.mopts, popv: S.popv, outdoor: S.outdoor, glass: S.glass, z: S.z, pan: S.pan };
  restore(U.pop());
  Object.assign(S, keep);
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
    ["Visibilité @tony_frc", VIS_LABELS[snap.vis], VIS_LABELS[a === "vis" ? +v : snap.vis]],
    ["Publications", String(b0.pubCount), String(b1.pubCount)],
    ["Objets disponibles", (INV_ITEMS.length - (b0.lentItem ? 1 : 0)) + " / " + INV_ITEMS.length, (INV_ITEMS.length - (b1.lentItem ? 1 : 0)) + " / " + INV_ITEMS.length],
    ["Crédit part créateur", fmtE(b0.totalCredit), fmtE(b1.totalCredit)],
    ["Stockage hors-ligne", b0.cacheMb + " Mo", b1.cacheMb + " Mo"]
  ];
  $("ctx").innerHTML = `<div class="box"><div class="lg pv"><b>${same ? "État actuel" : "Si tu valides"} · ${lab || "—"}</b>${rows.map(r => {
    const ch = r[1] !== r[2];
    return `<div class="ef" style="${ch ? "" : "opacity:.48"}"><span>${r[0]}</span><span style="color:${ch ? "var(--good)" : "inherit"}">${ch ? r[1] + " → " + r[2] : r[1]}</span></div>`;
  }).join("")}</div>
  <div class="lg menu">${same ? "" : `<button class="p" data-a="ctxok">Valider ${ic(IC.check, "s")}</button>`}<button data-a="ctxno">Fermer ${ic(IC.x, "s")}</button></div></div>`;
  G.ctx = { a, v };
  $("ctx").classList.add("on");
  haptic(15);
}

/* ---------- Dynamic Island ---------- */
let isT = null;
let island = function(t, sub, undoable) {
  $("isn").innerHTML = `<div class="t"><b>${t}</b>${sub ? `<span>${sub}</span>` : ""}</div>${undoable ? `<button data-a="undo" aria-label="Annuler">Annuler</button>` : ""}`;
  $("island").dataset.s = "note";
  clearTimeout(isT);
  isT = setTimeout(islandRest, 3800);
}
let islandRest = function() { $("island").dataset.s = G.live ? "live" : "idle"; }
let islandNext = function() {
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
    S.massifs.filter(m => m.cached).forEach(m => {
      g += `<g transform="translate(${m.x},${m.y})" data-pin="m:${m.id}" style="cursor:pointer">
        <rect x="${-m.r - 8}" y="${-m.r + 2}" width="${(m.r + 8) * 2}" height="${(m.r - 2) * 2}" rx="10" fill="none" stroke="#3D7A52" stroke-width="1.3" stroke-dasharray="3 3" opacity=".75"/>
      </g>`;
    });
  }

  if (M.empreinte) {
    S.massifs.forEach(m => {
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
      g += `<text x="${m.x}" y="${m.y - m.r - 4}" text-anchor="middle" font-family="-apple-system,Inter,sans-serif" font-size="8" font-weight="700" fill="${st.lab}" letter-spacing=".5">${m.reg}</text>`;
    });
  }

  if (M.carnets) {
    CARNETS.forEach(c => {
      const isDraft = c.status === "draft" && !(c.id === "ca0" && S.draftPublished);
      g += `<g transform="translate(${c.x},${c.y})" data-pin="ca:${c.id}" style="cursor:pointer">
        <circle r="14" fill="transparent"/>
        <rect x="-8.5" y="-8.5" width="17" height="17" rx="5" fill="${isDraft ? "#FBF1DC" : "#fff"}" stroke="${isDraft ? "#B98A2E" : "#17402C"}" stroke-width="1.5"/>
        <text y="3.5" text-anchor="middle" font-family="-apple-system,Inter,sans-serif" font-weight="800" font-size="9" fill="${isDraft ? "#8a6418" : "#17402C"}">C</text>
      </g>`;
    });
  }

  if (M.lignees && (S.igTab === 2 || S.step === 3 || S.sh?.k === "kit")) {
    KITS_LINEAGE.forEach(k => {
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
  $("tm").innerHTML = g;
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
  $("mctl").innerHTML = `<button data-a="mopts" aria-label="Personnaliser la carte d'empreinte" aria-expanded="${S.mopts}">${ic(IC.layers, "s")}</button><button data-a="recenter" aria-label="Recentrer">${ic(IC.pin, "s")}</button>${S.map.zoomBtns ? `<button data-a="zoom" data-v="1" aria-label="Zoom avant">${ic(IC.plus, "s")}</button><button data-a="zoom" data-v="-1" aria-label="Zoom arrière">${ic(IC.minus, "s")}</button>` : ""}`;
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
  document.querySelectorAll("#phone .tb,#phone .ig-handle,#phone .acc,#phone .gbtn,#phone .mctl,#phone .callout").forEach(el => {
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h || w > 420) return;
    const r = Math.round(Math.min(h / 2, parseFloat(getComputedStyle(el).borderTopLeftRadius) || h / 2));
    const id = lensFilter(w, h, r, Math.max(6, Math.min(16, Math.round(h * .34))), Math.round(Math.min(30, h * .55)));
    el.style.backdropFilter = `url(#${id}) blur(${(parseFloat(getComputedStyle($("phone")).getPropertyValue("--gb")) * .55 || 3).toFixed(1)}px) saturate(1.9) brightness(1.07)`;
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
    return `<div class="ig-grid" role="region" aria-label="Grille des publications de @tony_frc">${tiles.map(t => `
      <button class="ig-tile" data-a="${t.act || "openCarnet"}" data-v="${t.id}" data-focus="${t.focus}" ${t.act === "pubdraft" ? 'data-sim="1"' : ""} aria-label="${t.bot} · ${t.top}">
        ${tileArt(t.id)}
        <div class="t-top">
          <span class="t-pill ${t.draft ? "draft" : ""}">${t.top}</span>
          ${t.multi ? `<span class="t-ic">${ic(IC.carousel, "xs")}</span>` : ""}
        </div>
        <div class="t-bot">
          <b>${t.bot}</b>
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
  const aviImg = TONY_AVATAR
    ? `<img src="${TONY_AVATAR}" alt="Photo de profil @tony_frc">`
    : `<span style="font:700 22px var(--sf);color:#17402C">T</span>`;

  return `
  <!-- En-tête Instagram @tony_frc -->
  <div class="ig-header">
    <button class="ig-avi-wrap" data-a="openStep" data-v="0:2" aria-label="Avatar et Sceau d'empreinte de @tony_frc">
      <span class="ig-note">J-4 Pyrénées</span>
      <span class="ig-avi-in">${aviImg}</span>
      <span class="ig-seal-bdg" title="Sceau d'empreinte déterministe (ADR-010)">${renderSeal(16, 0.85)}</span>
    </button>
    <div class="ig-right">
      <div class="ig-name-row">
        <span class="ig-name">Тоny</span>
        <span class="ig-sub-pill">Empreinte vérifiée ${AI}</span>
      </div>
      <div class="ig-stats" role="group" aria-label="Statistiques du profil @tony_frc">
        <button class="ig-stat" data-a="igtab" data-v="0" aria-label="${D.pubCount} publications">
          <b class="num">${D.pubCount}</b>
          <span>publications</span>
        </button>
        <button class="ig-stat" data-a="openFollowers" aria-label="1 080 followers">
          <b class="num">1 080</b>
          <span>followers</span>
        </button>
        <button class="ig-stat" data-a="openFollowing" aria-label="${D.followingCount} suivi(e)s">
          <b class="num">${D.followingCount}</b>
          <span>suivi(e)s</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Bio Instagram @tony_frc : 🇮🇹🇫🇷 + Empreinte GPS + Lignée -->
  <div class="ig-bio">
    <div class="ig-bio-flags">${FLAGS_IT_FR} <span>· Alpes & Pyrénées · Bivouac léger</span></div>
    <div class="ig-bio-emp" title="Calculée uniquement depuis tes sorties GPS vérifiées"><i></i><span>${shortSig}</span></div>
    <button class="ig-bio-link" data-a="openStep" data-v="3:0"><span>kitduvoyageur.fr/tony_frc · ${D.totalProp} reprises · +${fmtE(D.totalCredit)}</span></button>
  </div>

  <!-- Boutons d'action Instagram en verre Liquid Glass (--pg et .soft) -->
  <div class="ig-actions">
    <button class="ig-btn p" data-a="editProfile" aria-label="Modifier le profil">Modifier le profil</button>
    <button class="ig-btn soft" data-a="shareProfile" aria-label="Partager le profil">Partager le profil</button>
    <button class="ig-btn soft" data-a="openFollowers" aria-label="Découvrir des membres de la tribu">Tribu</button>
  </div>

  <!-- Stories À la une (Highlights Instagram) -->
  <div class="ig-hl-row" role="region" aria-label="Stories à la une">
    ${HIGHLIGHTS.map(h => `<button class="ig-hl" data-a="openHighlight" data-v="${h.id}" aria-label="Story à la une ${h.title}">
      <span class="ig-hl-ring"><span class="ig-hl-in">${hlArt(h.id)}</span></span>
      <span>${h.title}</span>
    </button>`).join("")}
  </div>

  <!-- Barre des 4 onglets Instagram (Grille | Carte | Lignées | Tribu) -->
  <div class="ig-tabs" role="tablist" aria-label="Contenus du profil @tony_frc">
    <span class="ig-th" style="transform:translateX(${S.igTab * 100}%)"></span>
    <button role="tab" aria-selected="${S.igTab === 0}" data-a="igtab" data-v="0" aria-label="Grille des publications">${ic(IC.grid, "s")}<span>Grille</span></button>
    <button role="tab" aria-selected="${S.igTab === 1}" data-a="igtab" data-v="1" aria-label="Carte et sorties GPS">${ic(IC.mount, "s")}<span>Sorties</span></button>
    <button role="tab" aria-selected="${S.igTab === 2}" data-a="igtab" data-v="2" aria-label="Lignées de kits et sac">${ic(IC.pack, "s")}<span>Lignées</span></button>
    <button role="tab" aria-selected="${S.igTab === 3}" data-a="igtab" data-v="3" aria-label="Tribu et identifications">${ic(IC.people, "s")}<span>Tribu</span></button>
  </div>

  <!-- Contenu de l'onglet actif (Grille 3x2 par défaut) -->
  ${renderIgTabContent(D)}
  `;
}

let renderTop = function() {
  const D = derive(), N = nextDecision(D), ns = N ? N.step : null;
  G.next = N;
  $("phone").classList.toggle("hasnext", ns != null);
  $("top").innerHTML = `<div class="ig-top">
    <button class="lg ig-handle rp" id="rpvis" data-a="vismenu" aria-haspopup="menu" aria-label="Profil @tony_frc · Visibilité : ${VIS_LABELS[S.vis]}">
      ${ic(S.vis === 0 ? IC.lock : S.vis === 1 ? IC.people : IC.globe, "xs")}
      <span>tony_frc</span>
      <span class="vis-tag">${VIS_LABELS[S.vis]}</span>
    </button>
    <div class="ig-top-r">
      <button class="lg gbtn" data-a="openStep" data-v="2:0" aria-label="Créer une publication ou un carnet">${ic(IC.plus, "s")}</button>
      <button class="lg gbtn" data-a="popv" aria-label="Affichage : mode extérieur et intensité du verre" aria-expanded="${S.popv}">${ic(IC.sun, "s")}</button>
      <button class="lg gbtn" data-a="openSettings" aria-label="Menu Réglages, Commandes et RGPD">${ic(IC.sliders, "s")}</button>
    </div>
  </div>
  <button class="cs mini" data-a="mapbig" aria-label="Réduire la carte et revenir au profil @tony_frc">
    <b>Тоny · @tony_frc <span class="flag-badge">IT · FR</span> ${AI}</b>
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
          p.lent ? `<div class="menu2 one"><button class="mi" data-a="recover" data-v="${p.id}" data-sim="1">${ic(IC.check, "s")}<span>Marquer comme récupéré auprès de ${p.lent}</span></button></div>` : "",
          p.maint ? `<div class="menu2 one"><div class="mi">${ic(IC.bell, "s")}<span>Rappel d'entretien (${p.maint})</span><button class="sw" role="switch" aria-checked="${!!p.mplan}" data-a="maint" data-v="${p.id}" data-sim="1"></button></div></div>` : "",
          `<div class="menu2 one"><div class="mi">${ic(IC.ticket, "s")}<span>Proposer en location à la tribu</span><button class="sw" role="switch" aria-checked="${!!p.rentOut}" data-a="rentout" data-v="${p.id}" data-sim="1"></button></div></div>`,
          `<div class="menu2 one"><div class="mi col"><div class="row">${ic(IC.gauge, "s")}<span>État de l'objet</span></div><div class="chips">${["neuf", "bon", "usé", "à remplacer"].map(c => `<button class="chip" data-a="cond" data-v="${p.id}|${c}" data-sim="1" aria-pressed="${p.cond === c}">${c}</button>`).join("")}</div></div></div>`
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
          rows: (S.massifs.filter(m => m.outings > 0).length ? S.massifs.filter(m => m.outings > 0) : S.massifs).map(m => `<div class="li nt" data-focus="m:${m.id}"><div><div class="ttl"><span>${m.name}</span>${m.outings >= 3 ? '<span class="tg confirmed">Public ≥ 3</span>' : '<span class="tg">Sous plancher (privé)</span>'}</div><div class="s2">${m.outings} sorties · ${m.km} km · D+ ${m.dplus.toLocaleString("fr-FR")} m</div></div><b class="num">${m.outings}</b></div>`).concat([
            note("Aucun grade, aucun rang, aucun classement entre membres. Le sceau se densifie uniquement avec tes kilomètres réels.")
          ])
        })},
        { l: "Tribu", r: () => ({
          per: [3, 6],
          head: `<div class="sumline" style="margin-bottom:8px"><span><b>Cordée</b> · ${(P.followersCount || 0)} abonnés</span><span class="tg confirmed">${(P.followingCount || 0)} suivis</span></div>`,
          title: (P.followersCount || 0) + " followers · " + (P.followingCount || 0) + " suivi(e)s · Clubs actifs",
          rows: (TRIBU.length ? TRIBU.map(t => `<div class="li"><span class="avi">${t.i}${t.online ? '<i class="on"></i>' : ""}</span><div style="min-width:0"><div class="ttl"><span>${t.n}</span><span class="sub">@${t.ps}</span></div><div class="s2">${t.rel} · confiance ${t.tr} · ${t.mass}</div></div>${t.borrow ? `<button class="mbtn p" data-a="recover" data-v="${t.borrow}" data-sim="1">Récupérer</button>` : `<span class="tg p">Suivi</span>`}</div>`) : [`<div style="padding:22px 14px;text-align:center"><b style="font:600 14px var(--sf);color:var(--label);display:block;margin-bottom:4px;">Aucun compagnon dans votre tribu</b><p style="font:400 12px/1.4 var(--sf);color:var(--label2);max-width:240px;margin:0 auto 10px;">Rejoignez des clubs ou invitez d'autres randonneurs pour partager vos sorties et votre matériel.</p><a href="/communaute" class="mbtn p" style="text-decoration:none;display:inline-block;height:30px;padding:0 14px;font-size:12px;">Découvrir la communauté</a></div>`]).concat(
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
            `<div style="padding:28px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;"><div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.7);display:grid;place-items:center;color:#17402C">${ic(IC.route, "s")}</div><b style="font:600 14px var(--sf);color:var(--label);">Aucune sortie enregistrée</b><p style="font:400 12px/1.4 var(--sf);color:var(--label2);max-width:240px;margin:0 auto;">Vos traces GPX, dénivelés et statistiques de saison apparaîtront dès votre premier voyage validé.</p><a href="/compas" class="mbtn p" style="text-decoration:none;height:30px;padding:0 14px;font-size:12px;">Planifier un voyage</a></div>`
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
                <div class="oc-t"><b>${c.title}</b></div>
                <div class="oc-s">« ${c.quote || 'Carnet de voyage'} »</div>
                <div class="oc-c"><span class="st ${isDraft ? "pending" : "confirmed"}">${isDraft ? "Brouillon IA" : "Publié"}</span><span>${c.photos || 0} photos</span><span>${c.mass || ''}</span></div>
              </div>
              <div class="oc-r">${isDraft ? `<button class="mbtn p" data-a="pubdraft" data-v="${c.id}">Publier</button>` : `<b>♥ ${c.likes || 0}</b><small>${c.views || 0} vues</small>`}</div>
            </div>`;
          }) : [
            `<div style="padding:28px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;"><div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.7);display:grid;place-items:center;color:#17402C">${ic(IC.book, "s")}</div><b style="font:600 14px var(--sf);color:var(--label);">Aucun carnet publié</b><p style="font:400 12px/1.4 var(--sf);color:var(--label2);max-width:240px;margin:0 auto;">Racontez vos aventures en montagne, partagez vos photos et vos traces GPS vérifiées.</p><a href="/carnets/nouveau" class="mbtn p" style="text-decoration:none;height:30px;padding:0 14px;font-size:12px;">+ Rédiger un carnet</a></div>`
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

  // 3. Tiroir LIGNÉES : Kits → Part créateur → Inventaire
  if (S.step === 3) {
    return {
      title: "Lignées & Inventaire",
      peek: `${KITS_LINEAGE.length} kits · endurance ${D.avgEndur} % · +${fmtE(D.totalCredit)}`,
      flow: [
        { l: "Kit", r: () => ({
          per: [3, 5],
          title: "Tes kits souches & lignées actives (ADR-008)",
          rows: KITS_LINEAGE.length ? KITS_LINEAGE.map(k => `<div class="oc" data-focus="k:${k.id}">
            <div class="oc-img" style="--h:150">${ic(IC.pack)}</div>
            <div style="min-width:0">
              <div class="oc-t"><b>${k.n}</b></div>
              <div class="oc-s">${k.gen} · ${k.desc}</div>
              <div class="oc-c"><span class="st confirmed">Endurance ${k.endur} %</span><span>${k.prop} reprises</span><span>${k.proven} sorties GPS</span></div>
            </div>
            <div class="oc-r"><b>+${fmtE(k.credit)}</b><small>${kgs(k.w)}</small></div>
          </div>`).concat([note("Auto-fork neutre : dupliquer ton propre kit ne gonfle ni la propagation ni la part créateur.")]) : [
            `<div style="padding:28px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;"><div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.7);display:grid;place-items:center;color:#17402C">${ic(IC.pack, "s")}</div><b style="font:600 14px var(--sf);color:var(--label);">Aucun kit publié</b><p style="font:400 12px/1.4 var(--sf);color:var(--label2);max-width:240px;margin:0 auto;">Créez votre premier kit dans le Compas pour partager votre liste de matériel et cumuler votre part créateur.</p><a href="/compas" class="mbtn p" style="text-decoration:none;height:30px;padding:0 14px;font-size:12px;">Créer un kit</a></div>`
          ]
        })},
        { l: "Budget", r: () => ({
          per: [3, 5],
          title: "Part créateur · Crédit boutique (Lot 6)",
          rows: [
            `<div class="sumline"><span>Disponible <b class="num">${fmtE(D.totalCredit)}</b></span><span>Taux <b>300 bps</b></span><span>Générations <b>70/20/10</b></span></div>`,
            D.totalCredit > 0
              ? `<div class="li nt"><div><div class="ttl"><span>Crédit boutique disponible</span></div><div class="s2">Généré par les reprises et fiches de tes kits</div></div><b class="num" style="color:var(--good)">+${fmtE(D.totalCredit)}</b></div>`
              : `<div style="padding:16px 12px;text-align:center;color:var(--label2);font:400 12px/1.4 var(--sf);">Aucun crédit accumulé pour le moment. Votre solde s'incrémente lorsque d'autres membres adoptent vos kits.</div>`,
            D.totalCredit > 0 ? `<button class="mbtn ${S.creditUsed ? "soft" : "p"}" style="width:100%;justify-content:center;height:34px;margin-top:4px" data-a="usecredit" data-sim="1">${S.creditUsed ? "Crédit appliqué au panier (annuler)" : "Appliquer mes " + fmtE(D.totalCredit) + " sur ma prochaine commande"}</button>` : ''
          ].filter(Boolean)
        })},
        { l: "Inventaire", r: () => ({
          per: [3, 6],
          title: `${S.invs.length} objet${S.invs.length > 1 ? 's' : ''} synchronisé${S.invs.length > 1 ? 's' : ''} avec le Compas`,
          rows: S.invs.length ? S.invs.map(p => `<div class="pc inv" data-prod="${p.id}">
            <span class="pth" style="--h:150;--bgc:#DDEBD8">${ic(IC.pack)}</span>
            <div class="pb">
              <div class="pbr"><span>${p.b}</span><span class="cd ${p.cond === "bon" ? "g" : "o"}">${p.cond}</span></div>
              <div class="pn">${p.n}</div>
              <div class="psp"><span>${p.c}</span><span>${kgs(p.w)}</span><span>${p.so} sorties</span></div>
              <div class="pm">${p.lent ? `<span class="pbad o">Prêté à ${p.lent}</span>` : p.maint && !p.mplan ? `<span class="pbad o">${p.maint}</span>` : p.rentOut ? `<span class="pbad s">En location tribu</span>` : `Coût/sortie ${p.so ? fmtE(Math.round((p.paid / p.so) * 10) / 10) : '—'}`}</div>
            </div>
            <div class="prr">${p.lent ? `<button class="mbtn p" data-a="recover" data-v="${p.id}" data-sim="1">Récupérer</button>` : `<button class="ib2" data-a="openItem" data-v="${p.id}" aria-label="Fiche ${p.n}">${ic(IC.chevR, "xs")}</button>`}</div>
          </div>`) : [
            `<div style="padding:28px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;"><div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.7);display:grid;place-items:center;color:#17402C">${ic(IC.bag, "s")}</div><b style="font:600 14px var(--sf);color:var(--label);">Inventaire vide</b><p style="font:400 12.5px/1.4 var(--sf);color:var(--label2);max-width:240px;margin:0 auto;">Scannez votre matériel ou ajoutez vos équipements pour calculer automatiquement le poids de votre sac.</p><button class="mbtn p" data-a="openscan" style="height:30px;padding:0 14px;font-size:12px;">Scanner du matériel</button></div>`
          ]
        })}
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
            `<div class="cap" style="margin-bottom:5px">Système d'unités</div>${seg("units", ["Métrique (km, m, °C)", "Impérial (mi, ft, °F)"], S.unitsMetric ? 0 : 1, 'data-simseg="1"')}`,
            swRow("Mode plein soleil (contraste renforcé)", "Augmente l'opacité du verre Liquid Glass en extérieur", S.outdoor, "outdoor", "1"),
            `<div class="menu2 one" style="margin-top:6px"><button class="mi" data-a="rgpdexport">${ic(IC.share, "s")}<span>Exporter mes données (RGPD / JSON)</span></button></div>`,
            `<div class="menu2 one" style="margin-top:6px"><button class="mi bad" data-a="signout">${ic(IC.x, "s")}<span>Se déconnecter de @${S.profile ? (S.profile.handle || 'moi') : 'moi'}</span></button></div>`
          ]
        })}
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
  const H = 844, top = det === "large" ? 46 : 48, bot = det === "large" ? 8 : .30 * H + 49 + 8, sh = $("sheet"), cs = getComputedStyle(sh);
  let used = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom), n = 0;
  [...sh.children].forEach(e => { if (e.classList.contains("sh-b") || getComputedStyle(e).display === "none") return; used += e.offsetHeight; n++; });
  return H - top - bot - used - n * (parseFloat(cs.rowGap) || 6);
}

let renderSheet = function() {
  const w = $("sw");
  if (!S.sh) { w.dataset.det = "closed"; renderCallout(); return; }
  const Dd = defs(), sh = S.sh;
  if (!Dd.flow || !Dd.flow.length) {
    Dd.flow = [{ l: Dd.title || "Détails", r: () => ({ per: [3, 5], title: Dd.title || "", rows: [] }) }];
  }
  if (sh.tab >= Dd.flow.length) sh.tab = 0;
  const F = Dd.flow[sh.tab], T = F.r(), fk = [sh.k, sh.id, sh.tab, sh.det, S.step].join("|");
  const per = Math.max(1, Math.min(T.per[sh.det === "large" ? 1 : 0], G.fit[fk] || 99));
  const pages = Math.max(1, Math.ceil(T.rows.length / per));
  if (sh.page >= pages) sh.page = pages - 1;
  const lab = T.title || "", last = sh.tab >= Dd.flow.length - 1, nF = Dd.flow.length;
  const flow = nF > 1 ? `<div class="lg flow" role="tablist" style="--n:${nF}"><span class="lens" id="flens" style="transform:translateX(${(G.flowFrom ?? sh.tab) * 100}%)"></span>${Dd.flow.map((f, i) => `<button data-a="stab" data-v="${i}" role="tab" aria-selected="${i === sh.tab}" class="${i === sh.tab ? "cur" : i < sh.tab ? "done" : ""}">${flIc(f.l) ? ic(flIc(f.l), "xs") : ""}<span class="flb">${f.l}</span></button>`).join("")}</div>` : "";
  const x_ = `<button class="lg gbtn sm" data-a="close" aria-label="${S.stk.length ? "Retour" : "Fermer"}">${ic(S.stk.length ? IC.chevL : IC.x, "s")}</button>`;
  const d_ = `<button class="lg gbtn sm" data-a="det" aria-label="${sh.det === "large" ? "Réduire" : "Agrandir"}">${ic(sh.det === "large" ? IC.chevD : IC.expand, "xs")}</button>`;
  const isWorkflow = nF > 1 || (sh.k === "step");
  const footerHtml = isWorkflow
    ? `<button class="bk" data-a="fprev" ${sh.tab === 0 ? "disabled" : ""} aria-label="Étape précédente" style="font-weight:700;font-size:15px">‹</button><label class="say"><input id="say" placeholder="Dis-le : « récupère frontale », « domicile Turin »…" enterkeyhint="send"></label><button class="nx" data-a="fnext">${last ? "Terminer" : "Suivant"}</button>`
    : `<div style="flex:1"></div><button class="mbtn soft" style="height:34px;padding:0 20px" data-a="close">Fermer</button>`;
  $("sheet").innerHTML = `<div class="grab${nF > 1 ? " tt" : ""}" data-drag role="button" tabindex="0" data-a="cycle"><span></span>${nF > 1 ? `<b class="sht">${Dd.title}</b>` : ""}</div>
  <div class="sh-h${nF > 1 ? " hf" : ""}" data-drag>${x_}${nF > 1 ? flow : `<h3>${Dd.title}</h3>`}${d_}</div>
  <div class="peekline">${Dd.peek}</div>
  <div class="sh-b">${T.head || ""}${(lab || pages > 1) ? listHead(lab, sh.page, pages) : ""}${T.rows.slice(sh.page * per, sh.page * per + per).join("")}</div>
  <div class="sh-f">${footerHtml}</div>`;
  w.dataset.det = sh.det;
  const phoneEl = $("phone");
  if (phoneEl) phoneEl.classList.toggle("sheet-open", sh.det !== "closed");
  if (sh.det !== "peek" && per > 1) {
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
}

let openSheet = function(k = "step", tab = 0, det = "medium", extra = {}) {
  if (S.big) { S.big = false; applyShell(); }
  S.sh = { k, tab, page: 0, det, ...extra };
  S.callout = null; S.popv = false; S.mopts = false;
  renderPopv(); renderMopts(); renderMctl(); closeVisMenu(true); renderSheet();
}
let pushSheet = function(o) {
  if (S.sh) S.stk.push({ ...S.sh });
  S.sh = { tab: 0, page: 0, det: "large", ...o };
  S.callout = null; closeVisMenu(true); renderSheet(); haptic(8);
}
let popSheet = function() {
  if (S.stk.length) { S.sh = S.stk.pop(); renderSheet(); return true; }
  return false;
}
let setDet = function(det) {
  if (!S.sh) return;
  if (det === "closed") { S.sh = null; S.stk = []; S.focus = null; drawMap(); }
  else S.sh.det = det;
  const phoneEl = $("phone");
  if (phoneEl) phoneEl.classList.toggle("sheet-open", det !== "closed");
  closeVisMenu(true); renderSheet();
}
const DETS = ["closed", "peek", "medium", "large"];

/* ---------- Menu morphing iOS 27 pour la pilule @tony_frc ---------- */
let relRect = function(el) {
  const p = $("phone").getBoundingClientRect(), r = el.getBoundingClientRect(), s = G.sc || 1;
  return { x: (r.left - p.left) / s, y: (r.top - p.top) / s, w: r.width / s, h: r.height / s };
}
let openVisMenu = function() {
  const pill = $("rpvis"); if (!pill) return;
  const m = $("rmenu"), R = relRect(pill), W = 205, H = 3 * 36 + 10;
  G.role = { R };
  m.style.transition = "none";
  Object.assign(m.style, { left: R.x + "px", top: R.y + "px", width: R.w + "px", height: R.h + "px" });
  const opts = [[0, "Privée (toi seul·e)", IC.lock], [1, "Communauté LKDV", IC.people], [2, "Publique (≥ 3 sorties)", IC.globe]];
  m.innerHTML = `<div class="ri">${opts.map(x => `<button role="menuitemradio" aria-checked="${S.vis === x[0]}" data-a="setvis" data-v="${x[0]}">${ic(x[2], "s")}${x[1]}</button>`).join("")}</div>`;
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
  Object.assign(m.style, { left: R2.x + "px", top: R2.y + "px", width: R2.w + "px", height: R2.h + "px" });
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
}
let applyShell = function() {
  const p = $("phone");
  p.classList.toggle("tabmin", !!S.tabMin);
  p.classList.toggle("mapbig", !!S.big);
  p.classList.toggle("noacc", !S.map.acc);
  lensSoon();
  clearTimeout(G.lt);
  G.lt = setTimeout(lensAll, 620);
}

let refresh = function(map) {
  renderTop();
  if (map) drawMap();
  renderAcc();
  renderSheet();
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

let act = function(a, v) {
  if (a === "setvis") { closeVisMenu(); setTimeout(() => doMut("vis", v), 260); return; }
  if (a === "igtab") { S.igTab = +v; S.step = [2, 1, 3, 0][+v] ?? 0; refresh(true); haptic(6); return; }
  if (a === "outdoor") { S.outdoor = !S.outdoor; applyGlass(); renderPopv(); if (S.sh) renderSheet(); island(S.outdoor ? "Mode extérieur activé" : "Mode extérieur coupé", "", false); return; }
  if (MUT[a]) { doMut(a, v); return; }
  switch (a) {
    case "goto": go(+v); break;
    case "editProfile": S.step = 0; openSheet("step", 0, "medium"); break;
    case "shareProfile": openSheet("share", 0, "medium"); break;
    case "copylink": island("Lien copié", "https://kitduvoyageur.fr/u/tony_frc", false); break;
    case "openFollowers": S.step = 0; openSheet("step", 3, "medium"); break;
    case "openFollowing": S.step = 0; openSheet("step", 3, "medium"); break;
    case "openSettings": S.step = 4; openSheet("step", 0, "medium"); break;
    case "openStep": { const [st, tb] = (v || "0:0").split(":"); S.step = +st; openSheet("step", +tb || 0, "medium"); break; }
    case "openHighlight": {
      const hl = HIGHLIGHTS.find(x => x.id === v) || HIGHLIGHTS[0];
      S.focus = { k: "m", id: hl.mass };
      const p = focusPos(S.focus);
      drawMap();
      if (p) centerOn(p);
      S.step = hl.step;
      openSheet("step", 0, "medium");
      island(hl.title, hl.sub, false);
      break;
    }
    case "open": openSheet("step", 0, "medium"); break;
    case "openf": openSheet("step", +v, "medium"); break;
    case "openItem": pushSheet({ k: "item", id: v }); break;
    case "openOuting": S.step = 1; openSheet("step", 0, "medium"); break;
    case "openCarnet": S.step = 2; openSheet("step", 0, "medium"); break;
    case "openSpecies": S.step = 2; openSheet("step", 1, "medium"); break;
    case "openKit": S.step = 3; openSheet("step", 0, "medium"); break;
    case "close": if (!popSheet()) setDet("closed"); break;
    case "det": setDet(S.sh.det === "large" ? "medium" : "large"); break;
    case "cycle": setDet(S.sh.det === "peek" ? "medium" : S.sh.det === "medium" ? "large" : "medium"); break;
    case "stab": G.flowFrom = S.sh.tab; S.sh.tab = +v; S.sh.page = 0; renderSheet(); haptic(5); break;
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
            center: [6.82, 45.88],
            zoom: 12.4,
            pitch: 62,
            bearing: -45,
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
phone.addEventListener("contextmenu", e => e.preventDefault());
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

phone.addEventListener("click", e => {
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
  if (b) { if (b.disabled) return; e.preventDefault(); act(b.dataset.a, b.dataset.v); return; }
});

/* Carte : épingles, pan, zoom, poignée */
(() => {
  const map = $("map"), tm = $("tm"); let st = null;
  tm.addEventListener("pointerdown", e => { st = { x: e.clientX, y: e.clientY, p: S.pan.slice(), moved: false }; map.classList.add("dragging"); tm.setPointerCapture(e.pointerId); });
  tm.addEventListener("pointermove", e => {
    if (!st) return;
    const dx = (e.clientX - st.x) / G.sc, dy = (e.clientY - st.y) / G.sc;
    if (!st.moved && Math.hypot(dx, dy) > 6) { st.moved = true; if (!S.tabMin) { S.tabMin = true; applyShell(); } }
    if (st.moved) { const lim = 60 + 130 * (S.z - 1); S.pan = [clamp(st.p[0] + dx, -lim, lim), clamp(st.p[1] + dy, -lim, lim)]; setT(); }
  });
  tm.addEventListener("pointerup", e => {
    if (!st) return;
    const moved = st.moved; st = null; map.classList.remove("dragging");
    if (moved) return;
    const el = document.elementFromPoint(e.clientX, e.clientY), p = el && el.closest("[data-pin]");
    if (!p) { if (S.callout || S.focus) { S.callout = null; S.focus = null; renderCallout(); drawMap(); } return; }
    const [k2, id] = p.dataset.pin.split(":");
    S.focus = { k: k2, id }; S.callout = { k: k2, id };
    haptic(6); renderCallout(); drawMap();
  });
  tm.addEventListener("wheel", e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
  const mg = $("mgrab"); let gs = null;
  mg.addEventListener("pointerdown", e => { gs = { y: e.clientY }; mg.setPointerCapture(e.pointerId); });
  mg.addEventListener("pointerup", e => { if (!gs) return; const dy = e.clientY - gs.y; gs = null; if (Math.abs(dy) > 20) { G.sup = Date.now() + 400; G.supEl = mg; if ((dy < 0) !== S.big) act("mapbig"); } });
})();

/* Accessoire : parcourir la chronologie 12 mois */
(() => {
  let on = false; const acc = $("acc");
  acc.addEventListener("pointerdown", e => { if (!e.target.closest("#spk")) return; on = true; acc.setPointerCapture(e.pointerId); scrub(e.clientX); });
  acc.addEventListener("pointermove", e => { if (on) scrub(e.clientX); });
  acc.addEventListener("pointerup", () => on = false);
  acc.addEventListener("pointercancel", () => on = false);
})();

/* Barre d'onglets (#tb) : glisser la lentille Liquid Glass */
(() => {
  const tb = $("tb"); let st = null;
  tb.addEventListener("pointerdown", e => { if (S.tabMin) return; st = { r: tb.getBoundingClientRect(), x: e.clientX, moved: false }; });
  tb.addEventListener("pointermove", e => {
    if (!st) return;
    if (!st.moved && Math.abs(e.clientX - st.x) > 6) { st.moved = true; tb.classList.add("drag"); tb.setPointerCapture(e.pointerId); }
    if (!st.moved) return;
    const w = (st.r.width - 6) / 5, x = clamp(e.clientX - st.r.left - 3 - w / 2, 0, w * 4), hi = Math.round(x / w);
    $("lens").style.transform = `translateX(${x / G.sc}px) scale(1.18,1)`;
    tb.querySelectorAll("button").forEach((b, j) => b.classList.toggle("hov", j === hi));
  });
  tb.addEventListener("pointerup", e => {
    if (!st) return;
    const moved = st.moved, r = st.r; st = null; tb.classList.remove("drag");
    tb.querySelectorAll(".hov").forEach(b => b.classList.remove("hov"));
    if (!moved) return;
    G.sup = Date.now() + 450; G.supEl = tb;
    const w = (r.width - 6) / 5, i = clamp(Math.round((e.clientX - r.left - 3 - w / 2) / w), 0, 4);
    tabSelect(i);
  });
})();

/* Feuilles : tirer la poignée pour changer entre peek, medium et large */
(() => {
  const sh = $("sheet"); let st = null;
  sh.addEventListener("pointerdown", e => { if (!e.target.closest("[data-drag]") || (e.target.closest("button:not(.grab)") && !e.target.closest(".grab"))) return; st = { y: e.clientY, moved: false }; });
  sh.addEventListener("pointermove", e => { if (st && Math.abs(e.clientY - st.y) > 10) st.moved = true; });
  sh.addEventListener("pointerup", e => {
    if (!st) return;
    const dy = e.clientY - st.y, moved = st.moved; st = null;
    if (!moved) return;
    G.sup = Date.now() + 450; G.supEl = sh;
    if (dy > 70 && (S.sh?.det === 'peek' || S.sh?.det === 'medium')) {
      setDet('closed');
      haptic(8);
      return;
    }
    const i = DETS.indexOf(S.sh.det);
    setDet(DETS[clamp(i + (dy < 0 ? 1 : -1), 0, 3)]);
    haptic(6);
  });
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
window.addEventListener("resize", fit); fit();
let fitVB = function() {
  const tm = $("tm"), w = tm.clientWidth, h = tm.clientHeight;
  if (!w || !h) return;
  const vh = (370 * h) / w;
  tm.setAttribute("viewBox", `0 ${(150 - vh / 2).toFixed(1)} 370 ${vh.toFixed(1)}`);
}
try { new ResizeObserver(fitVB).observe($("map")); } catch (e) { window.addEventListener("resize", fitVB); }
fitVB();
renderTop(); drawMap(); renderAcc(); renderTB(); renderMctl(); renderMopts(); renderCallout(); renderSheet(); renderPopv(); applyShell(); applyGlass();


window.__QR={"n":37,"rows":["1111111011101010010100110111001111111","1000001001000110010001100011101000001","1011101001011000110110010001001011101","1011101011000111010000010011001011101","1011101000110010101100110011101011101","1000001001001110111000101101101000001","1111111010101010101010101010101111111","0000000000011011110100111110100000000","0010111011111011010101000011110001001","1100100111011000111100000011100101011","1110001000110000001111111101101110011","1110110011010001000110011110110100011","1100111101101110011111001101111100010","0011110010001101100011101100101001111","1111011111010111110000001000110100111","0100100100110000100110111111101010010","0001111110110111100010000100111001011","0000010101111110001111110010101000011","1111111101000101001110101100011000111","0100110111100101001100001101000000001","0001001111110101111110010100101101001","1000110110101111110100010010011000001","0011001100111100111011111100110010011","1001010011101101001100100000011000011","0011111010011111110110101001010011011","0000110100010100010100111001010011011","1010011011101101110000011110001001001","0101010001011101001000001111001011011","1011111010001110111000011100111110101","0000000011100000101001101100100010001","1111111001111100000101000001101010111","1000001010010110101011001110100010000","1011101011000000101111010100111111000","1011101000100010110010110010110110011","1011101010101001010000000011010011101","1000001001001010101011010111111110010","1111111001100001001101000001111011011"]};


/* ================= Compte — 50 améliorations : couche d'extension (override des fonctions du générateur) ================= */
(() => {
const X = { filter: 'all', feed: false, visitor: false, ligSub: 0, cmp: null, prof: 'km', story: null, vault: 0, scan: 0, seen: {}, hov: false, mon: null, evt: null, acct: 'me', hold: 0 };
window.__X = X;
{
  const st = document.createElement('div'); st.className = 'story'; st.id = 'story'; st.setAttribute('role', 'dialog'); st.setAttribute('aria-label', 'Story à la une'); phone.appendChild(st);
  const sh = document.createElement('div'); sh.className = 'sunshade'; sh.setAttribute('aria-hidden', 'true'); $('map').insertBefore(sh, $('mgrab'));
}
const END12 = [82, 84, 85, 86, 88, 87, 89, 90, 91, 90, 92, 91];
const TEMP12 = [8, 2, -3, -5, -4, 0, 6, 12, 18, 24, 28, 16];
const SEASON = i => ['Automne', 'Automne', 'Hiver', 'Hiver', 'Hiver', 'Printemps', 'Printemps', 'Printemps', 'Été', 'Été', 'Été', 'Automne'][i];
const EVENTS = { 9: { t: 'Glacier Blanc', o: 'ca3' }, 10: { t: 'Tour du Néouvielle', o: 'o4' }, 11: { t: 'Boucle du Lac Blanc', o: 'o2' } };
const TRIBU_MASS = { t1: ['m1', 'm2'], t2: ['m3', 'm4'], t3: [], t4: ['m2'] };
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
  handle: 'tony_frc',
  name: 'Тоny',
  followersLabel: '1 080',
  followersCount: 1080,
  followingCount: 339,
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  bioLine: 'IT·FR · Haute montagne · Minimalisme',
  sigText: '14 sorties · 182 km · 13,4 k m D+',
  isGuest: false,
  storeCreditEur: 42.50
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
let hlList = function () {
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

const hlCover = h => hlArt(h.id);
const unseen = () => 0;

const STORIES = {
  hl4: { title: 'Sac', slides: [{ k: 'gear' }] },
  hl5: { title: 'Nouveau', slides: [] }
};

const storyFor = id => {
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
  if (sl.k === 'trace') {
    const a = prof(sl.seed, 16); const pts = a.map((v, i) => [24 + i * (252 / 15), 215 - v * 175 + (i % 3) * 5]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    return { body: `<div class="st-card"><div class="st-bg">${cover(sl.seed, 330)}</div><svg class="tr" viewBox="0 0 300 250" aria-label="Trace GPS animée"><path class="st-draw" pathLength="1" d="${d}"/><circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="6" fill="#96B391" stroke="#fff" stroke-width="2"/><circle cx="${pts[15][0]}" cy="${pts[15][1]}" r="7" fill="#fff" stroke="#17402C" stroke-width="2.5"/></svg><span class="st-chip a">${sl.wx}</span><span class="st-chip b">${sl.km} · GPS ✓</span></div>`, foot: `<b>${sl.t}</b><small>${sl.s}</small>` };
  }
  if (sl.k === 'photo') return { body: `<div class="st-card photo">${tileArt(sl.art)}</div>`, foot: `<b>${sl.t}</b><small>${sl.s}</small>` };
  if (sl.k === 'stats') return { body: `<div class="st-card stats">${sl.items.map(i => `<div><b>${i[0]}</b><span>${i[1]}</span></div>`).join('')}</div>`, foot: `<b>${sl.t}</b><small>${sl.s}</small>` };
  if (sl.k === 'species') {
    const sp = SPECIES.find(q => q.id === sl.sp); const on = S.spPins.includes(sp.id);
    return { body: `<div class="st-card species"><div class="sp-card"><b>${sp.n}</b><i>${sp.lat}</i><span>Fiabilité ${sp.conf} · ${sp.date}</span></div><span class="st-chip" style="position:static">${on ? 'Épinglée dans la story ✓' : 'Non épinglée'}</span></div>`, foot: `<b>${sl.t}</b><small>${sl.s}</small><div class="st-act"><button class="st-btn p" data-a="sppin" data-v="${sp.id}">${on ? 'Retirer l\'épingle' : 'Épingler dans la story'}</button></div>` };
  }
  /* gear */
  const cats = {}; S.invs.forEach(p => { cats[p.c] = (cats[p.c] || 0) + p.w; }); const tot = totalW(), mx = Math.max(...Object.values(cats));
  const rows = Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, w]) => `<div class="gr"><span>${c}</span><i><u style="width:${Math.round(w / mx * 100)}%"></u></i><b>${kgs(w)}</b></div>`).join('');
  return { body: `<div class="st-card gear"><div class="tot">${(tot / 1000).toFixed(2).replace('.', ',')} kg</div>${rows}</div>`, foot: `<b>Sac du moment · ${S.invs.length} objets</b><small>Kit souche G1 · endurance 91 % après ≥ 1 km GPS.</small><div class="st-act"><button class="st-btn p" data-a="stgear">Dupliquer ce kit dans mon Compas</button></div>` };
}
function renderStory() {
  const el = $('story'); if (!X.story) { el.classList.remove('on'); return; }
  const st = storyFor(X.story.id), n = st.slides.length, i = X.story.i, v = slideView(st.slides[i]);
  const h = hlList().find(q => q.id === X.story.id) || { id: X.story.id, title: st.title };
  el.innerHTML = `<div class="st-bar">${st.slides.map((_, j) => `<i class="${j < i ? 'done' : j === i ? 'cur' : ''}"><b></b></i>`).join('')}</div>
  <div class="st-head"><span class="st-av">${hlCover(h)}</span><b>${h.title}</b><small>@tony_frc · il y a 2 j</small><button class="st-x" data-a="stclose" aria-label="Fermer la story" style="font-weight:700;font-size:16px">×</button></div>
  <div class="st-body">${v.body}</div>
  <button class="st-zone l" data-a="stprev" aria-label="Précédent"></button><button class="st-zone r" data-a="stnext" aria-label="Suivant"></button>
  <div class="st-foot">${v.foot}</div>`;
  el.classList.add('on'); el.classList.remove('hold');
}
function openStory(id) { X.story = { id, i: 0 }; X.seen[id] = 1; closeVisMenu(true); S.popv = false; renderPopv(); renderStory(); renderTop(); lensSoon(); haptic(8); }
function closeStory() { X.story = null; renderStory(); }

/* ---------- Tuiles / grille (11-15, 21) ---------- */
let TILES = function () {
  if (!Array.isArray(CARNETS) || CARNETS.length === 0) return [];
  return CARNETS.map((c, idx) => {
    const isDraft = c.status === 'draft' || c.vis === 'private' || c.visibility === 'private';
    return {
      id: c.id || ('ca_' + idx),
      realId: c.realId || c.id,
      art: c.coverImage || c.cover_image || (['ca2', 'ca1', 'ca3', 'ca0'][idx % 4]),
      customImg: c.coverImage || c.cover_image || null,
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
const tileHTML = t => `<button class="ig-tile" data-a="${t.act}" data-v="${t.id}" data-focus="${t.focus}" data-m="${t.m}" data-id="${t.id}" ${t.act === 'pubdraft' ? 'data-sim="1"' : ''} aria-label="${t.bot} · ${t.top}${t.pinned ? ' · épinglé' : ''}">
  ${tileArt(t.art)}
  <div class="t-top"><span class="t-pill ${t.draft ? 'draft' : ''}">${t.top}</span><span style="display:inline-flex">${t.pinned ? `<span class="t-pin">${ic(PINIC, 'xs')}</span>` : ''}${t.multi ? `<span class="t-ic">${ic(IC.carousel, 'xs')}</span>` : ''}</span></div>
  <div class="t-bot"><b>${t.bot}</b><small>${t.stat}</small></div>${t.prog ? `<div class="t-prog" title="Complétion du brouillon"><i style="width:${t.prog}%"></i></div>` : ''}</button>`;
const feedHTML = t => `<button class="ig-feed-row" data-a="${t.act}" data-v="${t.id}" data-focus="${t.focus}" data-m="${t.m}" ${t.act === 'pubdraft' ? 'data-sim="1"' : ''}><span class="fa">${tileArt(t.art)}</span><span style="min-width:0"><b>${t.bot} · ${t.top}</b><small>${t.date} — ${t.desc}</small></span><em>${t.stat}</em></button>`;

function lignees(D) {
  const sub = '<div class="ig-sub" role="tablist">' + ['Épreuve', 'Filiation', 'Sac'].map((l, i) => '<button role="tab" data-a="ligsub" data-v="' + i + '" aria-pressed="' + (X.ligSub === i) + '">' + l + '</button>').join('') + '</div>';
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
    const bar = '<div class="ig-filt"><button class="ig-vt" data-a="viewtoggle" aria-label="' + (X.feed ? 'Afficher en grille' : 'Afficher en fil') + '" style="font-weight:700;font-size:10.5px">' + (X.feed ? 'GRILLE' : 'FIL') + '</button><div class="ig-pills" role="group" aria-label="Filtres">' + FILTERS.map(f => '<button class="ig-pill" data-a="filt" data-v="' + f[0] + '" aria-pressed="' + (X.filter === f[0]) + '">' + f[1] + '</button>').join('') + '</div></div>';
    if (!l.length) {
      const emptyGrid = '<div class="ig-empty-native" style="padding:28px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;">' +
        '<div style="width:54px;height:54px;border-radius:50%;background:rgba(23,64,44,0.08);display:grid;place-items:center;color:#17402C;font:700 12px var(--sf)">CARNET</div>' +
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

  // TAB 1: Sorties
  if (S.igTab === 1) {
    if (!OUTINGS.length) {
      return '<div class="ig-alt" role="region" aria-label="Sorties GPS et Empreinte terrain">' +
        '<div class="kpis">' +
        '<div class="kpi"><b class="num">0</b><small>Sorties GPS</small></div>' +
        '<div class="kpi"><b class="num">0 km</b><small>Cette année</small></div>' +
        '<div class="kpi"><b class="num">0 m</b><small>D+ cumulé</small></div>' +
        '<div class="kpi"><b class="num">0</b><small>Massifs</small></div>' +
        '</div>' +
        '<div class="ig-empty-native" style="padding:24px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;">' +
        '<div style="width:52px;height:52px;border-radius:50%;background:rgba(23,64,44,0.08);display:grid;place-items:center;color:#17402C;font:700 12px var(--sf);">TRACE</div>' +
        '<b style="font:600 15px var(--sf);color:var(--label);">Aucune sortie enregistrée</b>' +
        '<p style="font:400 12.5px/1.4 var(--sf);color:var(--label2);max-width:270px;margin:0 auto;">Vos traces GPX, dénivelés et statistiques de saison apparaîtront dès votre premier voyage validé.</p>' +
        '<a href="/voyages" class="mbtn p" style="text-decoration:none;height:32px;padding:0 16px;font-size:13px;display:inline-flex;align-items:center;gap:6px;">Planifier un voyage</a>' +
        '</div>' +
        '</div>';
    }
    const up = OUTINGS[0];
    return '<div class="ig-alt" role="region" aria-label="Sorties GPS et Empreinte terrain">' +
      '<div class="kpis">' +
      '<button class="kpi" data-a="openStep" data-v="1:0"><b class="num">' + D.totalOutings + '</b><small>Sorties GPS</small></button>' +
      '<button class="kpi" data-a="openStep" data-v="1:0"><b class="num">' + D.totalKm + ' km</b><small>Cette année</small></button>' +
      '<button class="kpi" data-a="openStep" data-v="1:0"><b class="num">' + (D.totalDplus >= 1000 ? (D.totalDplus / 1000).toFixed(1).replace('.', ',') + ' k' : D.totalDplus) + ' m</b><small>D+ cumulé</small></button>' +
      '<button class="kpi" data-a="openStep" data-v="0:2"><b class="num">' + D.pubMassifs.length + '</b><small>Massifs ≥ 3</small></button>' +
      '</div>' +
      '<div class="oc" style="margin-bottom:0;padding:7px 9px">' +
      '<div class="oc-img" style="--h:145;width:36px;height:36px;font:700 10.5px var(--sf);color:#fff">GPX</div>' +
      '<div style="min-width:0"><div class="oc-t"><b>' + up.title + '</b></div><div class="oc-s">' + (up.date || '2026') + ' · ' + (up.km || 0) + ' km · D+ ' + (up.dplus || 0) + ' m</div></div>' +
      '<div class="oc-r"><a href="/voyages" class="mbtn p" style="text-decoration:none">Voir</a></div>' +
      '</div>' +
      '<div class="sumline" style="padding:5px 9px"><a href="/voyages" class="lnk" style="padding:0;text-decoration:none">Tous mes voyages →</a><button class="lnk" data-a="mapbig" style="padding:0">Plein écran →</button></div>' +
      '</div>';
  }

  // TAB 2: Lignées
  if (S.igTab === 2) return lignees(D);

  // TAB 3: Tribu
  const lent = D.lentItem;
  if (!TRIBU.length) {
    return '<div class="ig-alt" role="region" aria-label="Tribu, Clubs et Matériel prêté">' +
      '<div class="ig-empty-native" style="padding:24px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;">' +
      '<div style="width:52px;height:52px;border-radius:50%;background:rgba(23,64,44,0.08);display:grid;place-items:center;color:#17402C;font:700 12px var(--sf)">TRIBU</div>' +
      '<b style="font:600 15px var(--sf);color:var(--label);">Aucun compagnon dans votre tribu</b>' +
      '<p style="font:400 12.5px/1.4 var(--sf);color:var(--label2);max-width:270px;margin:0 auto;">Rejoignez un club ou connectez-vous avec d\'autres montagnards pour partager vos kits et sorties.</p>' +
      '<div class="sumline" style="width:100%;padding:6px 10px;margin-top:4px;">' +
      '<span><b>Prêts</b> · Tout votre matériel est disponible</span>' +
      '<button class="lnk" data-a="openStep" data-v="0:3" style="padding:0">Explorer les clubs →</button>' +
      '</div>' +
      '</div>' +
      '</div>';
  }

  return '<div class="ig-alt" role="region" aria-label="Tribu, Clubs et Matériel prêté">' +
    TRIBU.slice(0, 2).map(t => '<div class="tr-row"><span class="tr-av">' + (t.i || 'T') + '</span><div class="tr-t"><b>@' + (t.ps || t.name) + '</b><small>' + (t.mass || 'Compagnon de route') + '</small></div><button class="mbtn ' + (X.cmp === t.id ? 'p' : 'soft') + '" data-a="cmp" data-v="' + t.id + '">' + (X.cmp === t.id ? 'Comparé ✓' : 'Comparer') + '</button></div>').join('') +
    '<div class="sumline" style="padding:5px 9px;gap:6px"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (lent ? '<b>Prêt</b> · ' + lent.n + ' → ' + lent.lent : '<b>Inventaire complet</b>') + '</span>' + (lent ? '<span class="row-btns"><button class="mbtn p" data-a="recover" data-v="' + lent.id + '" data-sim="1">Récupérer</button><button class="mbtn soft" data-a="remind" data-v="' + lent.id + '">Rappel</button></span>' : '<button class="lnk" data-a="openFollowers" style="padding:0">Voir la tribu →</button>') + '</div>' +
    '</div>';
};
card = function () {
  const D = derive(), me = X.acct === 'me', club = CLUBS.find(q => q.id === X.acct);
  const P = S.profile || { handle: 'visiteur', name: 'Voyageur invité', followersCount: 0, followingCount: 0, isGuest: true };
  const shortSig = S.vis === 0 ? 'Empreinte privée (toi seul·e)' : (P.sigText || D.sigText);
  const aviSrc = P.avatarUrl;
  const initial = (P.name || 'V').charAt(0).toUpperCase();
  const aviImg = aviSrc ? '<img src="' + aviSrc.replace(/"/g, '&quot;') + '" alt="Photo de profil @' + P.handle + '">' : '<span style="font:700 22px var(--sf);color:#17402C">' + initial + '</span>';
  
  const stats = me
    ? [[D.pubCount, 'publications', 'igtab', '0'], [String(P.followersCount ?? 0), 'followers', 'openFollowers', ''], [String(D.followingCount ?? 0), 'suivi(e)s', 'openFollowing', '']]
    : [[String(club?.members || 0), 'membres', 'openFollowers', ''], [1, 'sorties', 'igtab', '1'], [1, 'organisateur', 'openFollowers', '']];

  const noteHTML = me ? (S.note ? '<span class="ig-note" data-a="opennote" role="button" title="' + S.note.exp + '">' + S.note.t + '</span>' : '<span class="ig-note empty" data-a="opennote" role="button" aria-label="Ajouter une note">+ Note</span>') : '';
  
  const actions = P.isGuest
    ? '<div class="ig-actions"><a href="/connexion?redirect=/compte" class="ig-btn p" style="text-decoration:none">Se connecter</a><a href="/inscription?redirect=/compte" class="ig-btn soft" style="text-decoration:none">Créer un compte</a></div>'
    : '<div class="ig-actions"><a href="/compte/modifier" class="ig-btn p" data-a="editProfile" aria-label="Modifier le profil" style="text-decoration:none">Modifier le profil</a><button class="ig-btn soft" data-a="shareProfile" aria-label="Partager le profil">Partager le profil</button><button class="ig-btn soft" data-a="openFollowers" aria-label="Découvrir des membres de la tribu">Tribu</button></div>';

  return '<div class="ig-header">' +
    '<button class="ig-avi-wrap ' + (unseen() ? 'live' : '') + '" data-a="openStep" data-v="0:2" aria-label="Avatar et Sceau d\'empreinte de @' + P.handle + '">' +
      noteHTML + '<span class="ig-avi-in">' + (me ? aviImg : cover(club?.id || 'cl', 62)) + '</span>' +
      '<span class="ig-seal-bdg" data-a="sealzoom" role="button" title="Agrandir le Sceau d\'empreinte (ADR-010)">' + renderSeal(16, 0.85) + '</span>' +
    '</button>' +
    '<div class="ig-right">' +
      '<div class="ig-name-row"><span class="ig-name">' + (me ? P.name : (club?.n || 'Club')) + '</span><span class="ig-sub-pill">' + (me ? (P.isGuest ? 'Session invité' : 'Empreinte certifiée ' + AI) : (club?.role || 'Membre')) + '</span></div>' +
      '<div class="ig-stats" role="group" aria-label="Statistiques du profil">' + stats.map(s => '<button class="ig-stat" data-a="' + s[2] + '" data-v="' + s[3] + '" aria-label="' + s[0] + ' ' + s[1] + '"><b class="num ' + (s[1] === 'publications' && X.bump ? 'stat-bump' : '') + '">' + s[0] + '</b><span>' + s[1] + '</span></button>').join('') + '</div>' +
    '</div>' +
  '</div>' +
  '<div class="ig-bio">' +
    '<div class="ig-bio-flags">' + FLAGS_IT_FR + ' <span>' + (me ? (P.bioLine || '· Passion Montagne & Randonnée') : '· Page club') + '</span></div>' +
    '<div class="ig-bio-emp" title="Calculée uniquement depuis tes sorties GPS vérifiées"><i></i><span>' + (me ? shortSig : ('Prochaine sortie · ' + (club?.next || 'À venir'))) + '</span></div>' +
    '<button class="ig-bio-link" data-a="openStep" data-v="3:0"><span>kitduvoyageur.fr/' + (me ? P.handle : (club?.id || 'club')) + ' · ' + D.totalProp + ' reprises · +' + fmtE(D.totalCredit) + '</span></button>' +
  '</div>' +
  actions +
  '<div class="ig-hl-row" role="region" aria-label="Stories à la une">' + hlList().map(h => '<button class="ig-hl ' + (X.seen[h.id] ? 'seen' : '') + '" data-a="openHighlight" data-v="' + h.id + '" aria-label="Story à la une ' + h.title + '"><span class="ig-hl-ring"><span class="ig-hl-in">' + hlCover(h) + '</span></span><span>' + h.title + '</span></button>').join('') + '</div>' +
  '<div class="ig-tabs" role="tablist" aria-label="Contenus du profil">' +
    '<span class="ig-th" style="transform:translateX(' + (S.igTab * 100) + '%)"></span>' +
    '<button role="tab" aria-selected="' + (S.igTab === 0) + '" data-a="igtab" data-v="0" aria-label="Grille des publications">' + ic(IC.grid, "s") + '<span>Grille</span></button>' +
    '<button role="tab" aria-selected="' + (S.igTab === 1) + '" data-a="igtab" data-v="1" aria-label="Carte et sorties GPS">' + ic(IC.mount, "s") + '<span>Sorties</span></button>' +
    '<button role="tab" aria-selected="' + (S.igTab === 2) + '" data-a="igtab" data-v="2" aria-label="Lignées de kits et sac">' + ic(IC.pack, "s") + '<span>Lignées</span></button>' +
    '<button role="tab" aria-selected="' + (S.igTab === 3) + '" data-a="igtab" data-v="3" aria-label="Tribu et identifications">' + ic(IC.people, "s") + '<span>Tribu</span></button>' +
  '</div>' +
  renderIgTabContent(D);
};
renderTop = function () {
  const D = derive(), N = nextDecision(D), ns = N ? N.step : null; G.next = N;
  const cardHtml = card(); X.bump = false;
  const me = X.acct === 'me', club = CLUBS.find(q => q.id === X.acct);
  const P = S.profile || { handle: 'tony_frc', name: 'Тоny' };
  $('phone').classList.toggle('hasnext', ns != null);
  $('top').innerHTML = `<div class="ig-top">
    <button class="lg ig-handle rp" id="rpvis" data-a="vismenu" aria-haspopup="menu" aria-label="Profil ${me ? '@' + P.handle : club.n} · Visibilité : ${VIS_LABELS[S.vis]}">
      ${ic(S.vis === 0 ? IC.lock : S.vis === 1 ? IC.people : IC.globe, "xs")}<span>${me ? P.handle : club.id}</span>
      <span class="vis-tag">${X.visitor ? 'Vue visiteur' : VIS_LABELS[S.vis]}</span></button>
    <div class="ig-top-r">
      <button class="lg gbtn" data-a="openStep" data-v="2:0" aria-label="Créer une publication ou un carnet">${ic(IC.plus, "s")}</button>
      <button class="lg gbtn" data-a="popv" aria-label="Affichage : mode extérieur et intensité du verre" aria-expanded="${S.popv}">${ic(IC.sun, "s")}</button>
      <button class="lg gbtn" data-a="openSettings" aria-label="Menu Réglages, Commandes et RGPD">${ic(IC.sliders, "s")}</button>
    </div></div>
  <button class="cs mini" data-a="mapbig" aria-label="Réduire la carte et revenir au profil"><b>${P.name} · @${P.handle} <span class="flag-badge">IT · FR</span> ${AI}</b><span>${D.sigText}</span></button>
  <div class="card cs" id="card">${cardHtml}</div>`;
};

/* ---------- Menu de visibilité + vue visiteur (3) ---------- */
openVisMenu = function () {
  const pill = $('rpvis'); if (!pill) return;
  const m = $('rmenu'), R = relRect(pill), W = 226, H = 4 * 36 + 18;
  G.role = { R }; m.style.transition = 'none';
  Object.assign(m.style, { left: R.x + 'px', top: R.y + 'px', width: R.w + 'px', height: R.h + 'px' });
  const opts = [[0, 'Privée (toi seul·e)', IC.lock], [1, 'Communauté LKDV', IC.people], [2, 'Publique (≥ 3 sorties)', IC.globe]];
  m.innerHTML = `<div class="ri">${opts.map(x => `<button role="menuitemradio" aria-checked="${S.vis === x[0]}" data-a="setvis" data-v="${x[0]}">${ic(x[2], 's')}${x[1]}</button>`).join('')}<button role="menuitem" data-a="visitor" style="box-shadow:0 -.5px 0 var(--sep)">${ic(IC.user, 's')}${X.visitor ? 'Quitter la vue visiteur' : 'Voir comme un visiteur'}</button></div>`;
  void m.offsetWidth; m.style.transition = ''; m.classList.add('on');
  const top = clamp(R.y + R.h + 6, 48, 844 - H - 20), left = clamp(R.x, 12, 390 - W - 12);
  Object.assign(m.style, { left: left + 'px', top: top + 'px', width: W + 'px', height: H + 'px' });
  pill.style.opacity = '0'; haptic(8);
};

/* ---------- Accessoire : 3 modes, repères, scrubber filtrant (21-24) ---------- */
renderAcc = function () {
  const mode = X.prof, D = derive();
  const vals = mode === 'km' ? MONTHS_12.map(m => m[1]) : mode === 'endur' ? END12 : TEMP12;
  const mn = Math.min(...vals), mx = Math.max(...vals), W = 200, H = 28;
  const x = i => i * W / (vals.length - 1), y = v => H - 2 - ((v - mn) / ((mx - mn) || 1)) * (H - 6);
  const p = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const marks = mode === 'km' ? Object.keys(EVENTS).map(i => `<path d="M${x(+i).toFixed(1)} ${y(vals[+i]).toFixed(1)}h0" stroke="#5B7F55" stroke-width="7" stroke-linecap="round" vector-effect="non-scaling-stroke"/><path d="M${x(+i).toFixed(1)} ${y(vals[+i]).toFixed(1)}h0" stroke="#fff" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`).join('') : '';
  const lab = { km: [D.totalKm + ' km', '12 derniers mois', 'Voir l\'endurance des kits', IC.mount], endur: [D.avgEndur + ' %', 'endurance kits', 'Voir météo et saisons', IC.pack], meteo: ['−5 à +28 °C', '4 saisons vécues', 'Voir les km par mois', IC.sun] }[mode];
  $('acc').innerHTML = `<button class="ab" data-a="profmode" aria-label="${lab[2]}">${ic(lab[3], 's')}</button>
  <div class="ro" data-a="roclick" role="button"><b id="ro1">${lab[0]}</b><span id="ro2">${lab[1]}</span></div>
  <svg class="spk" id="spk" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="slider" aria-label="Chronologie des 12 derniers mois" tabindex="0"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5B7F55" stop-opacity=".4"/><stop offset="1" stop-color="#5B7F55" stop-opacity="0"/></linearGradient></defs><path d="${p}L${W} ${H}L0 ${H}Z" fill="url(#sg)"/><path d="${p}" fill="none" stroke="#17402C" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>${marks}<line id="sl" x1="-9" x2="-9" y1="0" y2="${H}" stroke="#17402C" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>
  <i class="j4" data-a="departure" role="button" aria-label="Départ J-4 : check-list"></i>`;
};
function filterMonth(i) { document.querySelectorAll('.ig-tile,.ig-feed-row').forEach(el => { const on = i != null && +el.dataset.m === i; el.classList.toggle('lit', on); el.classList.toggle('dim', i != null && !on); }); }
scrub = function (cx) {
  const el = $('spk'); if (!el) return;
  const r = el.getBoundingClientRect(), t = clamp((cx - r.left) / r.width, 0, 1), i = Math.round(t * 11);
  const m = MONTHS_12[i], mass = S.massifs.find(q => q.id === m[3]), dot = $('dot');
  if (dot && mass) dot.setAttribute('transform', `translate(${mass.x},${mass.y})`);
  $('sl').setAttribute('x1', t * 200); $('sl').setAttribute('x2', t * 200);
  const ev = EVENTS[i]; X.evt = X.prof === 'km' ? (ev || null) : null;
  if (X.prof === 'km') { $('ro1').textContent = m[1] + ' km · ' + m[2] + ' m'; $('ro2').textContent = ev ? ev.t + ' ↗' : m[0] + ' · ' + (mass ? mass.name.split(' ')[0] : ''); }
  else if (X.prof === 'endur') { $('ro1').textContent = END12[i] + ' % gardés'; $('ro2').textContent = m[0] + ' · preuve terrain'; }
  else { $('ro1').textContent = TEMP12[i] + ' °C max'; $('ro2').textContent = m[0] + ' · ' + SEASON(i); }
  if (i !== X.mon) { X.mon = i; haptic(4); filterMonth(i); }
};
$('acc').addEventListener('pointerup', () => { clearTimeout(X.mt); X.mt = setTimeout(() => { X.mon = null; filterMonth(null); }, 1600); });

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
    localStorage.setItem('lkdv_inventory_items_v1', JSON.stringify(S.invs));
  } catch (_) {}
  notifyHostAction('additem', SCAN_DB);
  return SCAN_DB.b + ' ' + SCAN_DB.n + ' ajouté au kit actif';
};
MUT.purge = () => { const l = S.massifs.filter(m => m.cached && m.lastVisit >= 6); if (!l.length) return 'Rien à purger : tout a été visité récemment'; l.forEach(m => { m.cached = false; }); return 'Cache libéré : ' + l.map(m => m.name).join(', ') + ' (' + l.reduce((s, m) => s + m.cacheMb, 0) + ' Mo)'; };
MUT.addhl = v => { if (S.extraHl.some(e => e.o === v)) return 'Déjà à la une'; S.extraHl.push({ o: v }); const o = OUTINGS.find(q => q.id === v); return 'Story « ' + o.mass.split(' ')[0] + ' » ajoutée à la une'; };
MUT.sppin = v => { const i = S.spPins.indexOf(v); if (i >= 0) S.spPins.splice(i, 1); else S.spPins.push(v); const sp = SPECIES.find(q => q.id === v); return i >= 0 ? 'Épingle retirée : ' + sp.n : sp.n + ' épinglé dans la story'; };
MUT.usecredit = () => { S.creditUsed = !S.creditUsed; return S.creditUsed ? '42,50 € appliqués · pré-remplis dans Budget et Kit du Compas' : 'Crédit boutique rétabli (42,50 €)'; };
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
const SEALB = [['Régularité', 'sorties par mois'], ['Saisons', '4 saisons vécues'], ['Massifs', '3 massifs ≥ 3 sorties'], ['Endurance du matériel', '91 % gardé'], ['Dénivelé', '13,4 k m D+'], ['Nuits dehors', '17 bivouacs'], ['Tribu', 'sorties en équipage']];
const EXK = {
  note: () => ({ title: 'Note de profil', peek: S.note ? S.note.t : 'Aucune note', flow: [{ l: 'Note', r: () => ({ per: [3, 4], title: 'Visible 24 h au-dessus de ton avatar', rows: [
    `<div class="chips">${['J-4 Pyrénées', 'Au refuge Ledormeur ⛺', 'Dispo rando ce week-end', 'Cherche crampons'].map(t => chip('note', t, t, S.note && S.note.t === t)).join('')}</div>`,
    `<div class="menu2 one"><button class="mi" data-a="note" data-v="">${ic(IC.x, 's')}<span>Retirer ma note</span></button></div>`,
    note('Les statuts sont pré-remplis depuis ton Compas. Aucune coordonnée GPS n\'est publiée : seulement le massif.')] }) }] }),
  seal: () => ({ title: 'Sceau d\'empreinte', peek: '100 % dérivé de tes sorties GPS vérifiées', flow: [{ l: 'Sceau', r: () => ({ per: [3, 3], rows: [
    `<div style="display:grid;place-items:center;padding:4px 0">${renderSeal(132, .9)}</div>`,
    `<div class="vm" style="grid-template-columns:1fr 1fr;gap:0">${SEALB.map((b, i) => `<div style="border-top:${i < 2 ? 0 : '.5px solid var(--sep)'}"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${i % 2 ? '#5B7F55' : '#17402C'};margin-right:6px"></span><b style="font-weight:600">${b[0]}</b></div><div style="border-top:${i < 2 ? 0 : '.5px solid var(--sep)'};color:var(--label2)">${b[1]}</div>`).join('')}</div>`,
    note('Chaque branche s\'allonge avec tes kilomètres réels. Aucun grade, aucun rang, aucun classement entre membres (ADR-010).')] }) }] }),
  profiles: () => ({ title: 'Changer de profil', peek: X.acct === 'me' ? '@tony_frc' : CLUBS.find(q => q.id === X.acct).n, flow: [{ l: 'Profils', r: () => ({ per: [4, 5], title: 'Ton profil et tes clubs', rows: [
    `<div class="li nt"><div><div class="ttl"><span>@tony_frc</span><span class="tg confirmed">Personnel</span></div><div class="s2">Тоny · ${derive().pubCount} publications</div></div><button class="mbtn ${X.acct === 'me' ? 'soft' : 'p'}" data-a="acct" data-v="me">${X.acct === 'me' ? 'Actif' : 'Basculer'}</button></div>`,
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
          const ph = { o2: 9, o3: 12, o4: 18 }[o.id] || 6, done = S.extraHl.some(e => e.o === o.id);
          return `<div class="li nt"><div><div class="ttl"><span>${o.title}</span></div><div class="s2">${ph} photos géolocalisées regroupées · ${o.km} km</div></div><button class="mbtn ${done ? 'soft' : 'p'}" data-a="addhl" data-v="${o.id}" ${done ? 'disabled' : ''}>${done ? 'À la une' : 'Créer'}</button></div>`;
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
    `<div class="scanbox"><span>Vise un code-barres ou une facture</span></div>`,
    `<button class="mbtn p" style="width:100%;justify-content:center;height:34px" data-a="doscan">Simuler un scan (EAN 0854…)</button>`] }) }] })
};
const _defs = defs;
const wrapFlow = (f, fn) => { const r = f.r; f.r = () => fn(r()); };
const IMPACT = { legerete: 'Le Compas privilégiera un sac < 5 kg, des matelas ≤ 450 g et des tentes < 1,3 kg.', confort: 'Le Compas privilégiera des matelas R ≥ 4, des refuges gardés et une 2ᵉ couche chaude.', budget: 'Le Compas proposera d\'abord des lignées G2/G3, des occasions et la location tribu.', securite: 'Le Compas exigera une frontale de secours, la trace GPX hors-ligne et un contact SOS actif.' };
const vmark = on => `<span class="c"><i class="${on ? 'y' : 'n'}"></i></span>`;
defs = function () {
  const sh = S.sh;
  if (EXK[sh.k]) return EXK[sh.k]();
  const d = _defs();
  if (sh.k === 'share') wrapFlow(d.flow[0], t => { const q = qrSvg(); t.rows.splice(1, 0, `<div class="qrbox"><div class="qr">${q}<span class="qc">${renderSeal(22, .85)}</span></div><div><b>QR Code @${(S.profile && S.profile.handle) || 'tony_frc'}</b><small>Le Sceau au centre atteste ton profil vérifié GPS. Scannable depuis l'appareil photo iOS.</small><button class="mbtn p" data-a="namedrop">NameDrop / AirDrop</button></div></div>`); t.per = [3, 4]; return t; });
  if (sh.k === 'item') {
    wrapFlow(d.flow[0], t => { const p = S.invs.find(x => x.id === sh.id) || S.invs[0]; if (p.wear) { const pc = Math.round(p.wear.used / p.wear.max * 100); t.rows.splice(2, 0, `<div class="gauge"><div class="gh"><span>${p.wear.l}</span><b>${p.wear.used} / ${p.wear.max} ${p.wear.u}</b></div><div class="gb"><i style="width:${pc}%;${pc >= 85 ? 'background:#B98A2E' : ''}"></i></div>${pc >= 85 ? '<small style="font:500 11px var(--sf);color:var(--warn)">Remplacement conseillé avant ta prochaine sortie</small>' : ''}</div>`); } return t; });
    wrapFlow(d.flow[1], t => { const p = S.invs.find(x => x.id === sh.id) || S.invs[0]; t.rows.push(`<div class="menu2 one"><div class="mi">${ic(IC.people, 's')}<span>Prêt gratuit pour ma tribu</span><button class="sw" role="switch" aria-checked="${!!p.lendFree}" data-a="lendfree" data-v="${p.id}" data-sim="1"></button></div></div>`); if (p.lent) t.rows.push(`<div class="menu2 one"><button class="mi" data-a="remind" data-v="${p.id}">${ic(IC.bell, 's')}<span>Envoyer un rappel à ${p.lent} dans le Hub</span></button></div>`); return t; });
  }
  if (sh.k === 'step' && S.step === 0) {
    wrapFlow(d.flow[0], t => { t.head = (t.head || '') + `<div class="note" style="background:rgba(235,242,236,.7);border-radius:12px;padding:6px 10px;margin-bottom:6px;color:var(--tint)"><b>Impact sur le Compas :</b> ${IMPACT[S.orient.priority]}</div>`; return t; });
    d.flow[1].r = () => ({ per: [3, 4], title: 'Ce que le Compas sait de toi (privé, RLS stricte)', rows: [
      `<div class="cap" style="margin-bottom:4px">Nationalités (le Compas retient l'exemption la plus favorable)</div><div class="chips">${COUNTRIES.map(c => `<button class="chip" data-a="nat" data-v="${c}" data-sim="1" aria-pressed="${S.traveller.nats.includes(c)}">${c}</button>`).join('')}</div>`,
      `<div class="cap" style="margin-bottom:4px">Ville de départ habituelle</div><div class="chips">${['Lyon', 'Paris', 'Annecy', 'Turin', 'Lille', 'Chamonix'].map(h => `<button class="chip" data-a="home" data-v="${h}" data-sim="1" aria-pressed="${S.traveller.home === h}">${h}</button>`).join('')}</div>
        <div class="blur" style="margin-top:7px"><svg width="46" height="46" viewBox="0 0 62 62" aria-hidden="true"><circle cx="31" cy="31" r="29" fill="#EBF2EC" stroke="#5B7F55" stroke-width="1.5" stroke-dasharray="3 3"/><circle cx="31" cy="31" r="9" fill="#17402C" fill-opacity=".28"/><circle cx="31" cy="31" r="2.6" fill="#17402C"/></svg><div><b>${S.traveller.home} · zone de 1 km</b><small>Seules des coordonnées tronquées au kilomètre sont stockées (Lot Z1).</small></div></div>`,
      `<div class="cap" style="margin-bottom:4px">Devise d'affichage du budget</div><div class="chips">${CURRENCIES.map(c => `<button class="chip" data-a="curr" data-v="${c}" data-sim="1" aria-pressed="${S.traveller.currency === c}">${c}</button>`).join('')}</div>`,
      note('Lot Z1 : ni tes nationalités ni ton domicile ne sont jamais envoyés à l\'IA ni révélés aux autres membres.')] });
    wrapFlow(d.flow[4], t => {
      const v = S.vis, mat = [['Empreinte (massifs ≥ 3)', 1, v >= 1, v === 2], ['Carnets publiés', 1, v >= 1, v === 2], ['Traces GPS brutes', 1, 0, 0], ['Matériel & prêts', 1, S.invs.some(p => p.lendFree), 0], ['Pratique & voyageur', 1, 0, 0]];
      t.per = [2, 3]; t.title = 'Qui voit quoi ? · Contrôles RGPD';
      t.head = `<div class="vm" style="margin-bottom:6px"><div class="h">Donnée</div><div class="h">Moi</div><div class="h">Tribu</div><div class="h">Public</div>${mat.map(r => `<div>${r[0]}</div>${vmark(r[1])}${vmark(r[2])}${vmark(r[3])}`).join('')}</div>`;
      t.rows = [
        `<div class="li nt"><div><div class="ttl"><span>Coffre biométrique</span></div><div class="s2">Licence FFCAM, groupe sanguin : Face ID, sur l'iPhone uniquement</div></div><button class="mbtn p" data-a="openvault">Ouvrir</button></div>
         <div class="cap" style="margin:6px 0 4px">Exporter mes données</div><div class="row-btns"><button class="mbtn p" data-a="export" data-v="full">Archive RGPD complète</button><button class="mbtn soft" data-a="export" data-v="gpx">GPX → Strava / Garmin</button><button class="mbtn soft" data-a="export" data-v="photos">Photos</button></div>`,
        ...t.rows.slice(0, 2)];
      return t;
    });
  }
  if (sh.k === 'step' && S.step === 3) d.flow[1].r = () => { const D = derive(); return { per: [3, 5], title: 'Journal des crédits · 300 bps (70 / 20 / 10)',
    head: `<div class="sumline" style="margin-bottom:6px"><span>Disponible <b class="num">${fmtE(D.totalCredit)}</b></span><span>En attente <b>6,10 €</b></span></div><button class="mbtn ${S.creditUsed ? 'soft' : 'p'}" style="width:100%;justify-content:center;height:32px;margin-bottom:6px" data-a="usecredit" data-sim="1">${S.creditUsed ? 'Crédit appliqué au Compas (annuler)' : 'Payer avec ma part créateur · 42,50 €'}</button>`,
    rows: [['Duvet Trek 900 conservé après sortie GPS', 'G1 · 70 % de 3 %', '+14,20 €', 1], ['Tente 2P conservée (≥ 1 km)', 'G1 · 70 % de 3 %', '+14,30 €', 1], ['Matelas R 4,2 via lignée G2', 'G2 · 20 % de 3 % · Vercors', '+9,80 €', 1], ['Gourde 2 L via lignée G3', 'G3 · 10 % de 3 %', '+4,20 €', 1], ['Veste 3L commandée il y a 4 j', 'En attente de preuve terrain ≥ 1 km', '+6,10 €', 0]].map(r => `<div class="li nt"><div><div class="ttl"><span>${r[0]}</span><span class="tg ${r[3] ? 'confirmed' : ''}">${r[3] ? 'Disponible' : 'En attente'}</span></div><div class="s2">${r[1]}</div></div><b class="num" style="color:${r[3] ? 'var(--good)' : 'var(--label2)'}">${r[2]}</b></div>`) }; };
  if (sh.k === 'step' && S.step === 4) {
    wrapFlow(d.flow[1], t => { const D = derive(), stale = S.massifs.filter(m => m.cached && m.lastVisit >= 6); t.rows.unshift(`<div class="stor"><div class="sh"><span>Hors-ligne sur l'iPhone</span><span>${D.cacheMb} Mo · 41 Go libres</span></div><div class="bar"><i style="width:${Math.min(100, D.cacheMb)}%;background:#5B7F55"></i></div><button class="mbtn ${stale.length ? 'p' : 'soft'}" data-a="purge" data-sim="1" style="margin-top:3px;align-self:flex-start" ${stale.length ? '' : 'disabled'}>${stale.length ? 'Purger les massifs non visités depuis 6 mois (' + stale.map(m => m.reg.split(' ')[0]).join(', ') + ')' : 'Aucun massif à purger'}</button></div>`); t.per = [2, 4]; return t; });
    wrapFlow(d.flow[2], t => { t.per = [3, 4]; t.rows.unshift(`<div class="cap" style="margin:2px 0 3px">Aperçu du SMS envoyé hors réseau</div><div class="sms">SOS 112 · Тоny (@tony_frc) · besoin de secours<br>45.0230 N 6.9945 E · UTM 32T 345234 4989011<br>Alt 2 340 m · batterie 62 % · tente verte MSR Hubba<br>Trace : lkdv.fr/s/ab12 · contacts : Léa, Marc</div>`); return t; });
    wrapFlow(d.flow[3], t => { t.rows.unshift(`<div class="li nt"><div><div class="ttl"><span>Passage de frontière détecté</span></div><div class="s2">France → Suisse : basculer l'affichage en CHF avec Annuler</div></div><button class="mbtn p" data-a="curr" data-v="CHF (CHF)">Basculer</button></div>`); return t; });
  }
  return d;
};
function qrSvg() {
  const q = window.__QR; if (!q) return '';
  let r = ''; q.rows.forEach((row, y) => { let x = 0; while (x < row.length) { if (row[x] === '1') { let e = x; while (e < row.length && row[e] === '1') e++; r += `<rect x="${x}" y="${y}" width="${e - x}" height="1"/>`; x = e; } else x++; } });
  return `<svg class="q" viewBox="0 0 ${q.n} ${q.n}" shape-rendering="crispEdges" aria-label="QR Code du profil @tony_frc"><g fill="#17402C">${r}</g></svg>`;
}

const notifyHostAction = (a, v) => {
  if (typeof window.__lkdvOnAction === 'function') {
    try { window.__lkdvOnAction(a, v, S); } catch (_) {}
  }
};

/* ---------- Actions ---------- */
const EXA = {
  navtab: v => notifyHostAction('navtab', v),
  opennote: () => openSheet('note', 0, 'medium'),
  sealzoom: () => openSheet('seal', 0, 'medium'),
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
    try { localStorage.setItem('lkdv_device_medical_vault_v1', JSON.stringify(S.vaultData)); } catch (_) {}
    renderSheet();
    island('Coffre médical mis à jour', 'Stocké uniquement dans le Keychain local de cet appareil', false);
    notifyHostAction('vaultsave', S.vaultData);
  },
  openscan: () => { X.scan = 0; openSheet('scan', 0, 'medium'); },
  doscan: () => {
    X.scan = 1;
    haptic([10, 30, 10]);
    try {
      localStorage.setItem('lkdv_inventory_items_v1', JSON.stringify(S.invs));
    } catch (_) {}
    renderSheet();
    notifyHostAction('doscan', SCAN_DB);
  },
  scansearch: () => {
    const qEl = $('scanq');
    const q = qEl && qEl.value ? qEl.value.trim() : '';
    if (q && typeof window.__lkdvScanLookup === 'function') {
      window.__lkdvScanLookup(q, item => {
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
  visfollow: () => { island('Maquette visiteur', 'Le bouton Suivre est inactif dans la prévisualisation', false); notifyHostAction('visfollow'); },
  vismsg: () => { island('Maquette visiteur', 'La messagerie du Hub est inactive dans la prévisualisation', false); notifyHostAction('vismsg'); },
  openHighlight: v => { if (v === 'hl5') openSheet('newhl', 0, 'medium'); else openStory(v); },
  stclose: () => closeStory(),
  stprev: () => { if (X.hold > 250) return; const s = X.story; if (!s) return; if (s.i > 0) { s.i--; renderStory(); } else { s.i = 0; renderStory(); } },
  stnext: () => { if (X.hold > 250) return; const s = X.story; if (!s) return; if (s.i >= storyFor(s.id).slides.length - 1) { closeStory(); return; } s.i++; renderStory(); },
  stgear: () => { island('Kit dupliqué dans ton Compas', 'Auto-fork neutre : aucune propagation ni part créateur', false); notifyHostAction('stgear', S.invs); },
  sppin: v => { doMut('sppin', v); renderStory(); },
  viewtoggle: () => { X.feed = !X.feed; refresh(false); },
  filt: v => { X.filter = v; refresh(false); },
  ligsub: v => { X.ligSub = +v; refresh(false); },
  cmp: v => { X.cmp = X.cmp === v ? null : v; const t = TRIBU.find(q => q.id === v); refresh(true); if (X.cmp) { const n = (TRIBU_MASS[v] || []).length; island('Empreintes comparées · ' + t.n, n + ' massif' + (n > 1 ? 's' : '') + ' en commun surligné' + (n > 1 ? 's' : '') + ' sur la carte', false); } },
  profmode: () => { X.prof = X.prof === 'km' ? 'endur' : X.prof === 'endur' ? 'meteo' : 'km'; renderAcc(); },
  roclick: () => { const e = X.evt; if (e) { if (e.o.startsWith('o')) _act('openOuting', e.o); else _act('openCarnet', e.o); } else island('Glisse sur la courbe', 'Les points verts sont des sorties : touche le libellé pour l\'ouvrir', false); },
  departure: () => { const lent = S.invs.find(p => p.lent), m1 = S.massifs.find(m => m.id === 'm1'); island('Départ dans 4 j · Pyrénées', `Cartes ${m1.cached ? '✓' : '✗'} · SOS ${S.sosShare ? '✓' : 'en pause'} · Frontale ${lent ? 'chez ' + lent.lent : '✓'} · Entretien ${S.invs.some(p => p.maint && !p.mplan) ? 'à planifier' : '✓'}`, false); haptic(8); },
  remind: v => { const p = S.invs.find(x => x.id === v); island('Rappel envoyé', (p && p.lent ? p.lent : 'Ton proche') + ' reçoit une relance douce dans le Hub', false); notifyHostAction('remind', p); },
  namedrop: () => { island('NameDrop prêt', 'Rapproche les deux iPhone : nom, @tony_frc et lien LKDV', false); notifyHostAction('namedrop'); },
  export: v => { island({ full: 'Archive RGPD prête', gpx: 'Traces GPX prêtes', photos: 'Photos prêtes' }[v], { full: 'Profil, sorties, carnets et kits · art. 20 RGPD (14,2 Mo)', gpx: '14 traces de la saison 2026 pour Strava, Garmin ou Suunto', photos: '126 photos géolocalisées · ZIP 214 Mo' }[v], false); notifyHostAction('export', v); },
  mapfocus: v => { const [k, id] = v.split(':'); S.focus = { k, id }; drawMap(); const p = focusPos(S.focus); if (p) centerOn(p); },
  kitsim: v => { const k = KITS_LINEAGE.find(q => q.id === v); const gain = Math.round(10 * 85 * .03 * .7 * (k.endur / 100) * 100) / 100;
    $('ctx').innerHTML = `<div class="box"><div class="lg pv"><b>${k.n}</b><div class="ef"><span>Endurance actuelle</span><span>${k.endur} %</span></div><div class="ef"><span>Reprises actuelles</span><span>${k.prop}</span></div><div class="ef"><span>Si +10 reprises commandées</span><span style="color:var(--good)">≈ +${fmtE(gain)}</span></div><div class="s2" style="margin-top:6px">Estimation indicative : panier moyen 85 €, 3 % dont 70 % à la souche, pondéré par l'endurance. Aucun crédit n'est généré avant preuve terrain.</div></div><div class="lg menu"><button class="p" data-a="stgear">Partager ce kit (G+1)</button><button data-a="ctxno">Fermer</button></div></div>`; $('ctx').classList.add('on'); haptic(12); }
};
const _act = act;
act = function (a, v) {
  if ($('ctx').classList.contains('on') && a !== 'ctxok' && a !== 'ctxno') closeCtx();
  if (['stab', 'fnext', 'fprev', 'pg', 'det', 'cycle'].includes(a) && !S.sh) return;
  if (EXA[a]) return EXA[a](v);
  if (a === 'exportrgpd') return EXA.export('full');
  if (a === 'copylink' || a === 'signout' || a === 'ttab') notifyHostAction(a, v);
  return _act(a, v);
};

/* ---------- Gestes : appui long (Peek & Pop, profils), survol carte, repli de la barre ---------- */
phone.addEventListener('pointerdown', e => {
  const tl = e.target.closest('.ig-tile');
  if (tl) { X.lt = { x: e.clientX, y: e.clientY, el: tl, t: setTimeout(() => { X.lt.fired = true; G.sup = Date.now() + 480; G.supEl = tl; peek(tl.dataset.id); }, 460) }; }
  const hd = e.target.closest('#rpvis');
  if (hd) { X.lh = { x: e.clientX, y: e.clientY, t: setTimeout(() => { X.lh.fired = true; G.sup = Date.now() + 480; G.supEl = hd; closeVisMenu(true); openSheet('profiles', 0, 'medium'); haptic(14); }, 520) }; }
  if (e.target.closest('.st-zone,.st-body')) { X.holdAt = Date.now(); X.hold = 0; clearTimeout(X.ht); X.ht = setTimeout(() => $('story').classList.add('hold'), 220); }
});
phone.addEventListener('pointermove', e => { [['lt', 'lt'], ['lh', 'lh']].forEach(([k]) => { const s = X[k]; if (s && !s.fired && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) { clearTimeout(s.t); X[k] = null; } }); });
['pointerup', 'pointercancel'].forEach(t => phone.addEventListener(t, () => {
  ['lt', 'lh'].forEach(k => { const s = X[k]; if (s) { if (!s.fired) clearTimeout(s.t); X[k] = null; } });
  if (X.holdAt) { X.hold = Date.now() - X.holdAt; X.holdAt = 0; clearTimeout(X.ht); $('story').classList.remove('hold'); setTimeout(() => { X.hold = 0; }, 60); }
}));
function peek(id) {
  const t = tileById(id); if (!t) return; const pinned = S.pins.includes(id);
  $('ctx').innerHTML = `<div class="box"><div class="lg pv"><div class="pk-art">${tileArt(t.art)}</div><b>${t.bot} · ${t.top}</b><div class="s2">${t.date}</div><div class="s2">${t.desc}</div>${profSvg(t.id)}${t.prog ? `<div class="bar"><i style="width:${t.prog}%;background:#B98A2E"></i></div><div class="s2">Complétion ${t.prog} % : 12 photos triées · 2 espèces</div>` : ''}</div>
  <div class="lg menu"><button class="p" data-a="${t.act === 'pubdraft' ? 'openCarnet' : t.act}" data-v="${t.id}">Lire / Ouvrir</button><button data-a="mapfocus" data-v="${t.focus}">Voir sur la carte</button><button class="${pinned ? 'sel' : ''}" data-a="pin" data-v="${t.id}">${pinned ? 'Désépingler' : 'Épingler en tête'}</button><button data-a="ctxno">Fermer</button></div></div>`;
  $('ctx').classList.add('on'); haptic(14);
}
phone.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse') return; const t = e.target.closest('.ig-tile[data-focus]'); if (!t || S.sh || S.callout) return;
  const [k, id] = t.dataset.focus.split(':'); if (S.focus && S.focus.k === k && S.focus.id === id) return; X.hov = true; S.focus = { k, id }; drawMap();
});
phone.addEventListener('pointerout', e => { if (!X.hov) return; const t = e.target.closest && e.target.closest('.ig-tile[data-focus]'); if (!t || (e.relatedTarget && t.contains(e.relatedTarget))) return; X.hov = false; if (!S.sh && !S.callout) { S.focus = null; drawMap(); } });
phone.addEventListener('scroll', e => { const t = e.target; if (!t.classList || !(t.id === 'card' || t.classList.contains('ig-feed'))) return; if (t.scrollTop > 10 && !S.tabMin) { S.tabMin = true; applyShell(); } else if (t.scrollTop < 2 && S.tabMin) { S.tabMin = false; applyShell(); } }, true);
$('story').addEventListener('animationend', e => { if (e.animationName === 'stfill' && X.story) EXA.stnext(); }, true);
if (window.DeviceOrientationEvent) window.addEventListener('deviceorientation', e => { if (e.gamma != null) phone.style.setProperty('--la', (140 + e.gamma * 1.6).toFixed(0) + 'deg'); });

document.addEventListener('keydown', e => { if (e.key === 'Escape' && X.story) { e.stopImmediatePropagation(); closeStory(); } }, true);

function persistLocalState() {
  if (!window.__LKDV_NEXT_PROD) return;
  try {
    localStorage.setItem('lkdv_compte_v8_state_v1', JSON.stringify({
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
    const savedVault = localStorage.getItem('lkdv_device_medical_vault_v1');
    if (savedVault) Object.assign(S.vaultData, JSON.parse(savedVault));
    const savedState = localStorage.getItem('lkdv_compte_v8_state_v1');
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
doMut = function (k, v) {
  _doMut(k, v);
  persistLocalState();
  if (typeof window.__lkdvOnMutate === 'function') {
    try { window.__lkdvOnMutate(k, v, S); } catch (_) {}
  }
};
window.__lkdvCompteAct = act;
window.__lkdvGetState = () => ({ S, CARNETS, OUTINGS, CLUBS, KITS_LINEAGE, ORDERS, SPECIES });
window.__lkdvHydrateCompte = function (data) {
  if (!data) return;
  if (data.handle && typeof data.handle === 'string') S.profile.handle = data.handle.replace(/^@/, '');
  if (data.name && typeof data.name === 'string') S.profile.name = data.name;
  if (data.avatarUrl && typeof data.avatarUrl === 'string') S.profile.avatarUrl = data.avatarUrl;
  if (data.bioLine && typeof data.bioLine === 'string') S.profile.bioLine = data.bioLine;
  if (data.sigText && typeof data.sigText === 'string') S.profile.sigText = data.sigText;
  if (typeof data.followers === 'number' && data.followers > 0) {
    S.profile.followersLabel = data.followers.toLocaleString('fr-FR');
  }
  if (typeof data.vis === 'number') S.vis = data.vis;
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
refresh(true);
})();



// Global state accessor for debugging and test suites
window.__lkdvGetState = () => ({
  S,
  G,
  CARNETS,
  OUTINGS,
  CLUBS,
  ORDERS,
  ORDERS_BOOKINGS,
  KITS_LINEAGE,
});

window.__lkdvCompteAct = (actionName, val) => {
  try {
    if (typeof act === 'function') {
      act(actionName, val);
    }
  } catch (err) {
    console.warn('[CompteLiquidGlassV8] __lkdvCompteAct error:', err);
  }
};

// Supabase Live Data Hydration Bridge (Strictly Pure Genuine Data)
window.__lkdvHydrateCompte = (data) => {
  if (!data || typeof data !== 'object') return;

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
  S.profile.isGuest = !!data.isGuest;

  // Carnets: Full replacement with real database rows
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
        badge: c.verified ? 'Terrain vérifié' : undefined
      });
    });
  }

  // Outings: Full replacement with real user trips / activities
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

  // Clubs: Full replacement
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

  // Gear items: Full replacement
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

  // Orders: Full replacement
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
      const matchingOutings = OUTINGS.filter(o => o.mass && o.mass.toLowerCase().includes(m.name.slice(0, 5).toLowerCase()));
      m.outings = matchingOutings.length;
      m.km = matchingOutings.reduce((sum, o) => sum + (o.km || 0), 0);
      m.dplus = matchingOutings.reduce((sum, o) => sum + (o.dplus || 0), 0);
    });
  }

  if (typeof refresh === 'function') refresh(true);
};


/* ---------- Moteur Carte Vivante 3D (MapLibre GL + AWS Terrarium DEM Relief + Satellite Esri) ---------- */
function setup3DMap() {
  const container = document.getElementById('maplibre-compte-canvas');
  const loadingBar = document.getElementById('map-loading-bar');
  const loadingFill = document.getElementById('map-loading-fill');

  let dismissed = false;
  const dismissLoading = () => {
    if (dismissed) return;
    dismissed = true;
    if (loadingFill) loadingFill.style.width = '100%';
    if (loadingBar) {
      loadingBar.classList.add('loaded');
      setTimeout(() => {
        loadingBar.style.display = 'none';
      }, 180);
    }
  };

  // Failsafe watchdog: NEVER allow loading screen to stay beyond 800ms
  const watchdogTimer = setTimeout(dismissLoading, 800);

  if (!container || !window.maplibregl) {
    dismissLoading();
    return;
  }

  const maplibregl = window.maplibregl;

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      dismissLoading();
      return;
    }
  } catch (e) {
    dismissLoading();
    return;
  }

  try {
    const svgMap = document.getElementById('tm');
    if (svgMap) svgMap.style.opacity = '0';

    const map = new maplibregl.Map({
      container: container,
      center: [6.82, 45.88],
      zoom: 12.4,
      pitch: 62,
      bearing: -45,
      maxPitch: 85,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          satellite: {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            maxzoom: 19,
          },
          topo: {
            type: 'raster',
            tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 17,
          },
          terrainSource: {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 15,
          },
          hillshadeSource: {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 15,
          },
        },
        layers: [
          {
            id: 'satellite-layer',
            type: 'raster',
            source: 'satellite',
            paint: {
              'raster-contrast': 0.15,
              'raster-saturation': 0.05,
              'raster-brightness-max': 0.95,
            },
          },
          {
            id: 'topo-layer',
            type: 'raster',
            source: 'topo',
            layout: { visibility: 'none' },
            paint: { 'raster-opacity': 0.9 },
          },
          {
            id: 'hillshade-layer',
            type: 'hillshade',
            source: 'hillshadeSource',
            paint: {
              'hillshade-exaggeration': 0.7,
              'hillshade-shadow-color': '#05070a',
              'hillshade-highlight-color': '#ff9e5e',
              'hillshade-accent-color': '#ff5500',
              'hillshade-illumination-direction': 210,
            },
          },
        ],
        terrain: {
          source: 'terrainSource',
          exaggeration: 1.6,
        },
      },
    });

    window.__lkdvCompteMap3D = map;

    if (loadingFill) loadingFill.style.width = '45%';

    map.on('style.load', () => {
      if (loadingFill) loadingFill.style.width = '80%';
    });

    map.on('idle', () => {
      dismissLoading();
    });

    map.on('load', () => {
      if (loadingFill) loadingFill.style.width = '95%';
      setTimeout(dismissLoading, 80);
      // 1. Dynamic User GPS route or Tour du Mont-Blanc fallback
      const customCoords = window.__LKDV_USER_COORDS__;
      const activeCoordinates = (Array.isArray(customCoords) && customCoords.length >= 2)
        ? customCoords
        : [
            [6.8694, 45.9237],
            [6.8520, 45.9150],
            [6.8310, 45.9080],
            [6.7980, 45.8910],
            [6.7840, 45.8810],
            [6.7750, 45.8730],
            [6.7664, 45.8647],
            [6.7715, 45.8565],
            [6.7690, 45.8430],
            [6.7520, 45.8340],
            [6.7400, 45.8220],
            [6.7260, 45.8190],
          ];

      map.addSource('compte-tmb-track', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: { name: (Array.isArray(customCoords) && customCoords.length >= 2) ? 'Trace GPS Personnelle' : 'Tour du Mont-Blanc' },
          geometry: {
            type: 'LineString',
            coordinates: activeCoordinates,
          },
        },
      });

      // Glow layer
      map.addLayer({
        id: 'compte-tmb-glow',
        type: 'line',
        source: 'compte-tmb-track',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#5B7F55',
          'line-width': 8,
          'line-opacity': 0.45,
          'line-blur': 3,
        },
      });

      // Main line layer
      map.addLayer({
        id: 'compte-tmb-main',
        type: 'line',
        source: 'compte-tmb-track',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#3D7A52',
          'line-width': 3.5,
        },
      });

      // 2. Summit & refuge POI markers with Apple HIG Liquid Glass styling (zero icons)
      const pois = [
        { name: 'Mont-Blanc', ele: '4 809 m', coords: [6.8643, 45.8326] },
        { name: 'Aiguille du Midi', ele: '3 842 m', coords: [6.8872, 45.8794] },
        { name: 'Col de Voza', ele: '1 657 m', coords: [6.7664, 45.8647] },
        { name: 'Refuge de Miage', ele: '1 560 m', coords: [6.7400, 45.8220] },
      ];

      pois.forEach(poi => {
        const el = document.createElement('div');
        el.className = 'poi-marker-3d';
        el.innerHTML = `<div class="poi-marker-badge">${poi.name} <span>${poi.ele}</span></div><div class="poi-marker-pin"></div>`;
        el.addEventListener('click', () => {
          map.flyTo({
            center: poi.coords,
            zoom: 13.8,
            pitch: 68,
            bearing: -30,
            essential: true,
          });
          haptic([12, 40, 18]);
          if (typeof island === 'function') {
            island(poi.name, `Altitude ${poi.ele} · Empreinte vérifiée`, false);
          }
        });
        new maplibregl.Marker({ element: el }).setLngLat(poi.coords).addTo(map);
      });

      // 3. Wired launch transition for Mission Control 3D link
      const btn3d = document.querySelector('.btn-3d-fullscreen');
      if (btn3d && !btn3d.__wired) {
        btn3d.__wired = true;
        btn3d.addEventListener('click', () => {
          btn3d.classList.add('launching');
          haptic([15, 30, 20]);
        });
      }
    });

    map.on('error', () => {
      dismissLoading();
      if (svgMap) svgMap.style.opacity = '1';
    });
  } catch (err) {
    dismissLoading();
    const svgMap = document.getElementById('tm');
    if (svgMap) svgMap.style.opacity = '1';
  }
}

// Initial render
if (typeof refresh === 'function') refresh(true);
setup3DMap();
})();
  } catch (err) {
    console.error('[CompteLiquidGlassV8] Runtime init error:', err);
  } finally {
    window.addEventListener = origWinAdd;
    document.addEventListener = origDocAdd;
  }

  return () => {
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
