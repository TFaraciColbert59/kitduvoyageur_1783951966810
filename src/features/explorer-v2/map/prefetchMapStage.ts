/**
 * Démarre le téléchargement de MapLibre (chunk de `MapStage`) dès l'évaluation
 * du module de l'Explorer, en parallèle de l'hydratation, au lieu d'attendre le
 * premier rendu du `next/dynamic` de `ExplorerV2`. L'import dynamique de
 * `ExplorerV2` réutilise le même chunk (même module webpack) : aucun
 * téléchargement en double et le squelette de chargement reste identique.
 *
 * Module importé en premier par `ExplorerV2.tsx` : son corps s'exécute avant
 * l'évaluation du reste de l'arbre de l'Explorer. Rien n'est exécuté côté
 * serveur (`typeof window`), et un échec réseau est silencieux : le
 * `next/dynamic` retentera l'import lui-même.
 */
if (typeof window !== 'undefined') {
  void import('./MapStage').catch(() => undefined);
}

export {};
