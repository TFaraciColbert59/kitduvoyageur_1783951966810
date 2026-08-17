---
title: Système — Notifications Multi-Canaux & WebPush
aliases:
  - Notifications
  - WebPush
  - Centre d'Alertes
tags:
  - system
  - notifications
  - webpush
  - resend
updated: 2026-08-17
---

# 🔔 SYSTÈME — NOTIFICATIONS MULTI-CANAUX & WEBPUSH

> [!abstract] **Diffusion d'alertes in-app, notifications push et digests email**
> LKDV intègre une file de messages asynchrone sécurisée par RLS, un Service Worker local (`/public/sw.js`) pour les alertes push navigateur, et un moteur de regroupement pour prévenir la sur-sollicitation.

---

## ⚡ Canaux de Diffusion & Priorités

```mermaid
graph TD
    EVENT["Événement Métier<br>(Like, Message Groupe, Alerte SOS)"] --> DISPATCH["Fonction `public.notify()`"]
    
    DISPATCH --> CHECK["Vérification Préférences (`user_preferences`)"]
    
    CHECK --> INAPP["1. In-App Bell (`notification_deliveries`)"]
    CHECK --> PUSH["2. WebPush VAPID (sw.js)"]
    CHECK --> EMAIL["3. Email Digest (Resend API)"]
    
    subgraph SOS_BYPASS ["Bypass d'Urgence"]
        SOS["Alerte SOS Randonnée"] -.->|Ignore le mode silencieux| PUSH
        SOS -.->|Envoi SMS/Email Immédiat| EMAIL
    end
```

---

## ⚙️ Regroupement Intelligent (Clustering)

Pour éviter de spammer l'utilisateur lors de discussions animées dans un groupe d'expédition :
- Les messages de chat d'un même groupe sont agrégés par tranche de **15 minutes**.
- L'utilisateur ne reçoit qu'une seule notification : *"Sarah et 3 autres personnes ont envoyé 8 messages dans [Trek Écosse 2026]"*.

---

> [!tip] **Notes complémentaires :**
> - Découvrir le moteur de recherche : [[Recherche]]
> - Découvrir les récompenses : [[Récompenses]]
