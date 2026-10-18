# Constats ouverts — boucle d'amélioration du Compas

Un constat = un défaut observé en test (jamais une impression). Colonnes : **id**, **où** (demande, écran ou contrôle), **observé**, **attendu**, **cause racine** (une fois trouvée), **correction** (commit), **rejeu** (passage où il a disparu).

Règle : un constat se ferme seulement quand le **même** test, rejoué, ne le reproduit plus. Corriger à la racine, jamais en contournant le test.

| id | où | observé | attendu | cause racine | correction | rejeu |
|----|----|---------|---------|--------------|------------|-------|
