# Kit sub-drawer & post actions — design

## Scope
Refine the Profil → Kit sub-drawer and the post action pill/menu on `/compte`.

## Kit card states
1. **Base (190 px)** — name, real weight, real quantity, simple wear bar; left product-image rail (52 px images, vertical scroll); selector bottom-right.
2. **Composition** — vertical list of real kit products: image left, name/category/weight/quantity right. Tapping a row opens product detail.
3. **Product** — real product image, name, brand/category, weight, quantity, condition, French priority label, description if present. Vertical scroll.

## Expansion
- Base stays 190 px.
- Composition/product expands smoothly to the available drawer height (measured from the nearest drawer viewport, minus card gaps), then returns to 190 px.
- Height transition: 420 ms `cubic-bezier(.22,1,.36,1)`.
- No layout jump: the list item animates height; content fades/slides.

## Geometry
- Product rail moves from right to left.
- Base grid: `72px minmax(0,1fr)`.
- Selector moves to bottom-right (`right:10px`, `bottom:9px`).
- Selector height 30 px, three 32 px segments, same glass as other drawer selectors.
- Content bottom padding = 48 px: 9 px gap above selector + 30 px selector + 9 px edge.
- Content scroll areas get 14 px bottom radius and a top/bottom fade mask; no hard cut.

## Kit actions menu
- Top-right trigger `•••`; becomes `X` when open.
- Opens **below** the trigger as icon-only glass bubbles, same recipe as post options.
- Six actions: Récupérer, Partager, Fiche, Royalties, Historique, Découvrir.
- Icons only, `aria-label`/`title`; existing API functions unchanged.
- Cascade animation 38 ms per bubble; reduced-motion respected.

## Post action pill
- Position bottom-right.
- Icons: like/comment/share all exactly 16×16.
- Counters to the right of each icon, tabular numbers.
- Existing animations/haptics and double-tap like preserved.

## Constraints
- Real data only: `materiel_kits`, `materiel_kit_items`, `product_ownership`, `hike_sessions.kit_id`.
- No fake product photos: real photo → catalog image → existing generated visual.
- No new dependency.
- Mobile 430×932; reduced motion; keyboard/ARIA.
