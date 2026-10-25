---
title: Registre des Bugs & Anomalies LKDV
aliases:
  - Bugs
  - Anomalies
  - Bug Tracker
tags:
  - qa
  - bugs
  - quality
updated: 2026-08-17
---

# 🐛 REGISTRE DES BUGS & ANOMALIES LKDV

> [!abstract] **Suivi en temps réel des défauts identifiés et de leur résolution**

---

## 🚦 Tableau des Anomalies par Priorité

| ID | Sévérité | Description de l'Anomalie | Système Concerné | Solution Prévue / Statut |
| :---: | :---: | :--- | :--- | :--- |
| **BUG-01** | 🟠 IMPORTANT | LCP élevé sur mobile (~3.8s) dû à des images hero non préchargées | [[04 — 🏗️ ARCHITECTURE/Performance\|Performance]] | Remplacer par `<Image priority />` en WebP. 🟡 En cours. |
| **BUG-02** | 🟡 MINEUR | Le fichier mort `TopBar.tsx` subsiste physiquement dans `src/components/` | [[03 — 🎨 UX & UI/Mobile\|Mobile]] | Suppression physique du fichier. 🟡 En attente. |
| **BUG-03** | 🟡 MINEUR | Les hooks `useInfiniteScroll` et `usePullToRefresh` ne sont pas appelés sur `/communaute` | [[02 — 🧩 ÉCOSYSTÈME/Communauté\|Communauté]] | Brancher les hooks dans `page.tsx`. 🟡 En cours. |
| **BUG-04** | 🟢 CORRIGÉ | Absence de la table `kit_reports` causant des erreurs 500 silencieuses | [[02 — 🧩 ÉCOSYSTÈME/Configurateur\|Configurateur]] | Table créée par migration `20260810210500`. ✅ Résolu. |
| **BUG-05** | 🟢 CORRIGÉ | Prix envoyé par le client utilisé au checkout Stripe | [[04 — 🏗️ ARCHITECTURE/API\|API Checkout]] | Recalcul serveur obligatoire dans `/api/checkout`. ✅ Résolu. |
| **BUG-06** | 🟢 CORRIGÉ | Écriture anonyme possible sur 7 tables de sentiers | [[05 — 🗄️ SUPABASE/RLS\|RLS]] | RLS strict déployé et validé par test d'intrusion. ✅ Résolu. |

---

> [!tip] **Pour continuer la lecture :**
> - Découvrir les blocages prioritaires : [[Problèmes critiques]]
> - Explorer la dette technique : [[Dette technique]]
> - Découvrir les audits de sécurité : [[Sécurité]]
