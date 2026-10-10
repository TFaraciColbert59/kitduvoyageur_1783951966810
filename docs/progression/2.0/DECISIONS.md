# Décisions et écarts

- D01 — État actuel : branche work, HEAD 373689c6a, arbre initial propre. La référence de conception 08498ef5 est historique ; aucun retour à ce commit. Les corrections I2/I4/I5 présentes sont conservées et vérifiées avant de compléter P0.
- D02 — Les pièces originales ne contiennent ni registre JSON, ni simulations, ni relevés privés annexes. Rechercher les équivalents dans le dépôt ; produire les spécifications reproductibles depuis l’économie. Ne pas fabriquer un relevé prod ni une preuve de restauration.
- D03 — Le journal de stabilisation propose des descentes qui réouvrent certains droits clients. Le mandat impose de conserver les protections : rollback applicatif prioritaire ; aucune descente retirant ces protections n’est exécutée.
- D04 — Préparation de contrats/preview possible pendant une porte P0 fermée, conformément au plan §P0. Aucune activation du barème v2 avant la sortie P0 prouvée. Les dépendances ne sont pas déclarées satisfaites pour accélérer l’exécution.
