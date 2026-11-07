# Maquettes de référence du Kit Studio

Ces deux pages sont les maquettes d'origine dont le Studio est le portage. Elles ne sont pas de la
documentation : `catalog.test.ts`, `glyphs.test.tsx`, `scripts/port-catalog.mjs` et
`scripts/port-glyphs.mjs` les **lisent** pour vérifier que le catalogue et les glyphes de
l'application correspondent encore à la maquette, au texte près.

Elles vivaient dans `kit-studio-bundle/`, le dossier de briefing des agents, commité par erreur
dans le dépôt avec ses 80 fichiers et 12 Mo de captures. Le dossier est sorti ; ces deux fichiers
sont restés, à leur place, parce qu'eux seuls servent au code.

Ne les modifiez pas à la main : ce sont des témoins. Si la maquette évolue, remplacez le fichier
entier et laissez les tests dire ce qui a bougé.
