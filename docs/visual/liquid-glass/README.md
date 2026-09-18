# Captures et mesures Liquid Glass

`scripts/visual/liquid-glass-audit.mjs` produit des captures autonomes sans modifier les snapshots de référence des tests existants ni les données métier. Chaque exécution crée un dossier nommé par sa phase, contenant `audit.json` et les PNG.

```powershell
node scripts/visual/liquid-glass-audit.mjs before
node scripts/visual/liquid-glass-audit.mjs after
# Route de prototype, facultative :
$env:GLASS_AUDIT_ROUTES = '/design/glass'
node scripts/visual/liquid-glass-audit.mjs prototype
Remove-Item Env:GLASS_AUDIT_ROUTES
```

L'URL par défaut est `http://localhost:4000`; `GLASS_AUDIT_URL` permet un serveur de production local. Les routes par défaut sont `/materiel`, `/communaute`, `/profil`. Les six tailles sont 320×568, 390×844, 430×932, 834×1194, 1194×834 et 1440×900. Chromium et WebKit sont utilisés uniquement s'ils sont déjà installés.

## Protocole

- Contexte navigateur neuf par route et taille, sans compte préconfiguré et sans modification des consentements cookies.
- Navigation jusqu'à `DOMContentLoaded`, délai de stabilisation de 2,2 secondes, puis attente des polices.
- Capture pleine page, sans désactiver les animations.
- Axe avec règles WCAG 2/2.1 A et AA, détails des éléments concernés et vérifications incomplètes.
- Comptage des backdrops visibles dans le layout, dont descendants d'un autre backdrop. Le comptage inclut les surfaces hors écran dans les longues listes, mais exclut les éléments sans dimensions.
- Débordement horizontal du document et inventaire indicatif des cibles de moins de 44×44 pixels. Cet inventaire inclut les liens de contournement masqués et exige une revue humaine.
- Défilement synthétique de 1,8 seconde dans le conteneur le plus long, intervalles `requestAnimationFrame`, percentile 95, nombre de frames au-delà de 32 ms, FPS estimés.
- Tas JavaScript via `performance.memory` lorsque disponible, LCP/CLS/long tasks via `PerformanceObserver` lorsque supportés.

## Limites des preuves

Les rapports indiquent URL finale et redirection d'authentification éventuelle. Les contenus publics peuvent changer entre exécutions. Le consentement cookies de premier accès peut recouvrir du contenu; il n'est pas neutralisé artificiellement.

Ce protocole émule la taille d'écran sur un ordinateur de bureau. Il ne constitue pas un test Chrome Android, Safari iOS ou Capacitor sur appareil réel. Les timings du serveur de développement et les FPS `rAF` ne sont ni des Core Web Vitals terrain ni une mesure directe des frames présentées par le GPU. Aucune mesure de batterie, consommation, température ou mémoire GPU n'est produite. Axe ne remplace ni le lecteur d'écran, ni l'évaluation visuelle du contraste sur chaque image/carte géographique, ni les gestes tactiles réels.

Un résultat sans violation Axe ne vaut pas certification WCAG. Une amélioration des comptages de blur n'établit pas seule une amélioration de fluidité réelle. Les résultats en mode développement restent indicatifs et doivent être suivis de mesures sur build de production et appareils physiques.
