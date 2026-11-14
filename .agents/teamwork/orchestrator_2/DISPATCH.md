## 2026-11-14T11:29:21Z

L'équipe utilisera des sous-agents selon la difficulté de la tâche avec ajustement de leur taux d'effort, pour réaliser le chantier en autonomie complète. Extraire et implémenter les composants et tokens officiels exacts fournis par Apple (Swift natif via le bridge iOS Capacitor et primitives CSS/WebKit officielles du design system Apple), adaptés dans la palette verte LKDV sans aucun noir pur. Appliquer ces composants à la page Messagerie (`/messagerie`) et ses tiroirs en corrigeant toutes les anomalies identifiées dans l'audit iPhone, puis valider sur l'iPhone 16 Pro physique avec captures réelles avant de poursuivre sur le reste de l'application.

Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
Integrity mode: development

## Verification Resources
- Physical device: Connected iPhone 16 Pro via USB / XCUITest / Appium (UDID `00008140-000E7D081A0B001C`, Bundle ID `com.lekitduvoyageur.app`).
- Complete iPhone Audit Report: `/Users/fr168256/.gemini/antigravity/brain/25ed2e40-8086-4101-9dbd-3687f6e94b76/audit_complet_iphone.md` (Section 5: `/messagerie`).
- Existing baseline screenshots: `/Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa/audit-shots/05-messagerie/` (`01-messagerie-main.png` à `13-*.png`).
- Appium / QA scripts: `/Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa/`.
- External Skills resource: `https://github.com/vercel-labs/skills/blob/main/skills/find-skills/SKILL.md` (via `npx skills`).

## Requirements
- R1. Banque de variables et composants exacts Apple (teintes vertes LKDV, sans noir pur)
- R2. Installation et intégration proactive de compétences externes (skills)
- R3. Correction et refonte intégrale de la Page Messagerie (`/messagerie`)
- R4. Validation physique sur iPhone 16 Pro avant déploiement global
