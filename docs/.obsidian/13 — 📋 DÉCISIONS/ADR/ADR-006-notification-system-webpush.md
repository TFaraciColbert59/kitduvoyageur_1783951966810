---
title: ADR-006 — Système Multi-Canal Notifications & WebPush Local
aliases:
  - ADR-006
tags:
  - adr
  - notifications
  - webpush
date: 2026-08-16
status: Accepté
---

# ADR-006 — SYSTÈME MULTI-CANAL NOTIFICATIONS & WEBPUSH LOCAL

### Contexte
LKDV doit notifier les randonneurs en cas d'urgence (SOS), d'invitation dans un groupe ou de réponse à un carnet, sans dépendre d'un service SaaS propriétaire coûteux comme OneSignal.

### Décision
Mettre en place une file de dispatch interne `public.notify()` avec Service Worker standard `/public/sw.js` sous clés VAPID, couplée à Resend pour les digests email et une messagerie in-app `notification_deliveries`.

### Conséquences
- **Positives :** Souveraineté totale sur les données, coût récurrent nul, regroupement automatique des alertes de chat sur 15 min.
