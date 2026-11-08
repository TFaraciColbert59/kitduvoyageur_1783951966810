# Recherche documentaire — fondations du skill UGC Creative Studio

**Date de vérification : 8 novembre 2026.** Ce document privilégie les **sources officielles**. Il décrit ce qui étaye les procédures, ne prétend pas prouver leur performance future. Les lois et policies évoluent : effectuer une nouvelle vérification avant chaque diffusion.

## Méthode

- Questions : comment écrire un skill durable de Claude Code ; comment construire une vidéo publicitaire mobile/UGC ; comment rechercher et comparer les créateurs ; quels points juridiques et techniques doivent bloquer une publication ?
- Priorité : docs Anthropic/Claude Code, TikTok for Business, Google Ads, DGCCRF/Légifrance/ARPP, Commission UE et FTC. Sources commerciales (Influee) utilisées **uniquement** comme inspiration d'architecture 5+5+5+5, sans reprise de contenus propriétaires.
- Distinction : **norme / recommandation plateforme / convention interne heuristique**. Les scores 100 points, gates et politiques internes du présent skill sont une création originale ; ne pas les attribuer à TikTok ou à une loi.

## 1. Structure de skill, qualité et chargement

**Claude Code officiel** : https://code.claude.com/docs/en/skills

Constats : un répertoire `.claude/skills/<name>/SKILL.md` ou `~/.claude/skills/<name>/SKILL.md` est découvrable ; invocable par `/name` ; description déclencheur ; fichiers annexes sur demande ; frontmatter avec `name` et `description`. Le chargement progressif conserve la fenêtre de contexte. Éviter des champs frontmatter propriétaires pour conserver une meilleure portabilité.

**Anthropic, bonnes pratiques** : https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

Constats : skill concis, instructions spécifiques, références à la demande, exemples et tests ; éviter le gonflement du corps SKILL.md (guide : moins de 500 lignes). Exiger des évaluations sur différents scénarios. Les tests d'exécution de modèle ne sont pas réalisables depuis ce dossier sans accès à Claude Code et à ses différents modèles : ils sont fournis comme scénarios, **pas présentés comme exécutés**.

**Agent Skills** : https://agentskills.io/ et https://www.anthropic.com/research/equipping-agents-for-the-real-world-with-agent-skills

Constats : skill = dossier de ressources et de processus ; ne pas multiplier artificiellement les skills lorsque le besoin est une chaîne de travail unique. Le présent package contient un seul `SKILL.md` et quatre playbooks métiers, et non 20 skills distincts.

## 2. Écriture et tests publicitaires

**TikTok Product Advertising Guide** : https://ads.tiktok.com/business/fr/guides/product-advertising

Principe : définir audience et USP, étudier alternatives, accrocher immédiatement, montrer l'utilisation plutôt que détailler abstraitement les caractéristiques, conclure par CTA, mesurer et réviser. Application : B1–B4, P1–P3, Q5.

**TikTok Creative Best Practices** : https://ads.tiktok.com/business/fr/blog/creative-best-practices-top-performing-ads

Principe : séquence Hook / Body / Close ; intérêt des mouvements, changements visuels et voix ; nécessité d'un CTA. Application : banque de hooks, scripts minutés, montage. Ne pas recopier ses chiffres statistiques comme garanties individuelles.

**TikTok Video Advertising Guide** : https://ads.tiktok.com/business/en/guides/video-advertising-guide

Principe : vidéo pensée pour le mobile, vertical 9:16, texte dans les zones sûres, export pratique 1080×1920, intrigue dans les premières secondes ; valeur concrète. Application : P2, P4, Q4.

**YouTube Shorts Ads official guide** : https://support.google.com/google-ads/answer/16041697?hl=fr

Principe : vertical 9:16, ton natif au flux, son, formats courts adaptés à l'objectif ; paramètres de CTA/titre et contraintes propres au placement. Application : variantes de format et contrôles de plateforme.

## 3. Casting et droits de diffusion

**TikTok One — recherche de créateurs** : https://ads.tiktok.com/resources/help/article/how-to-find-creators-who-work-with-tiktok-one?lang=fr

Les filtres et éléments disponibles peuvent couvrir pays, langue, sujets, âge de l'audience sous forme de tranches, vues médianes, engagement, vidéos précédentes. Application : C2–C4 ; ce sont des **critères de comparaison** et non une autorisation de collecte de données personnelles ou une preuve de disponibilité.

**TikTok Spark Ads** : https://ads.tiktok.com/resources/help/article/spark-ads?lang=fr

Pour promouvoir un post organique tiers via Spark Ads, autorisation du créateur. Application : C5 et Q3. Ne pas considérer « post public » comme « droit de réutilisation commerciale ».

**TikTok Commercial Music Library** : https://ads.tiktok.com/help/article/commercial-music-library?lang=fr

La bibliothèque musicale générale de TikTok n'est pas destinée à l'usage commercial par défaut ; CML / licences spécifiques à vérifier. Application : P5 et Q3.

**CNIL (principes liés aux données de candidats)** : https://www.cnil.fr/fr/le-guide-du-recrutement

Les traitements de données de candidats doivent être nécessaires, transparents et conformes aux règles applicables. Application par analogie prudentielle : minimisation des données de casting. Le cadre juridique exact d'une collaboration freelance reste à examiner.

## 4. France, UE, USA

**Légifrance, loi influence et article 5-2** : https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000050457275

La transparence de l'intention commerciale est centrale ; les mentions explicites peuvent être « publicité » ou « collaboration commerciale », selon le contexte. Application : Q3 ; contrôler la version applicable à la diffusion.

**Légifrance, loi n° 2023-451 consolidée** : https://www.legifrance.gouv.fr/loda/id/JORFTEXT000047663185/

Une disposition spécifique concerne notamment l'indication d'images représentant visage/silhouette générés par IA dans l'influence commerciale, avec mention d'images virtuelles ou équivalente. Ne pas affirmer que **toute** création IA doit recevoir cette mention précise, quel que soit le contexte.

**ARPP, communication publicitaire numérique** : https://www.arpp.org/nous-consulter/regles/regles-de-deontologie/recommandation-communication-publicitaire-numerique/

Identification explicite, immédiate, lisible de la communication commerciale ; éviter disclosure retardée ou cachée. Application : Q3/Q4.

**DGCCRF, fiche influenceurs et achats** : https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/promotion-faite-par-les-influenceurs-et-achat-les-reseaux-sociaux

Affirmations vérifiables et publicité identifiable. Application : registre de preuve B1 et contrôle Q3.

**Commission européenne, Article 50 du règlement IA** : https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act

Les exigences de transparence vis-à-vis de certains médias synthétiques et deepfakes s'appliquent depuis le 2 août 2026 avec dispositions transitoires particulières. Application : Q3. Distinguer responsabilités fournisseurs/déployeurs et médias réellement visés.

**FTC — endorsements et testimonials** : https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking

Un outil de divulgation de plateforme ne garantit pas à lui seul qu'un lien matériel est suffisamment visible aux États-Unis ; mêmes précautions pour témoignages. Application : publicités US uniquement, si pertinentes.

## 5. Provenance de l'idée 20 rôles

**Influee, page commerciale** : https://influee.co/fr/content-hub/claude-ugc-team

Influee décrit quatre familles de cinq compétences — brief, recrutement, production et QA — sans publier sur sa page le texte détaillé de ses 20 skills. **Ce package n'est ni le pack officiel Influee, ni une copie, ni une intégration à son service.** Les vingt procédures de ce dossier sont une implémentation originale recherchée et rédigée pour un seul skill Claude Code.

## 6. Limites et risques résiduels

- Les standards de durée, safe zones, licences média et critères d'approbation des plateformes évoluent. Ne pas les graver comme absolus.
- Les profils créateurs peuvent changer, les données d'audience peuvent être privées et les tarifs ne sont fiables qu'avec devis.
- Les claims et contrats ne deviennent pas vrais par présence d'un champ `verified` : contrôler la pièce de preuve sous-jacente.
- Le score créatif du playbook est une **grille heuristique interne**. Il ne prédit CTR, conversions ou valeur d'entreprise.
- Aucune exécution réelle de génération vidéo, publication de campagne, casting ou test sur le modèle Claude n'a été réalisée par l'élaboration de ce dossier. Des scénarios reproductibles sont fournis pour cette dernière étape.