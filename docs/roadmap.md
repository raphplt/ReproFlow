# Roadmap

## État actuel

- [x] Workspace pnpm / Turborepo, TypeScript strict et Biome.
- [x] Contrats initiaux d'environnement et de statut avec tests unitaires.
- [x] Instructions et skills communs pour Codex et Claude Code.
- [x] Workflow CI pour Node 24 / 26, contrôles et capture Chromium headless.
- [x] Brief original, architecture et décision de socle.

## M1 — Première verticale de capture (livrée pour la démo)

- [x] Construire `examples/demo-shop` : panier, édition d'adresse, checkout.
- [x] Fournir un état initial reproductible et un bug volontaire déterministe après
  modification du code postal ; conserver un mode corrigé pour la validation.
- [x] Définir la trace versionnée : identifiants, horodatages avec unité explicite,
  ordre des événements, environnement et test IDs connus des cibles de démo.
- [x] Créer le recorder local Chromium avec start/stop, navigation, clics, saisies,
  soumissions, console et métadonnées réseau pertinentes.
- [x] Tester le masquage avant tout stockage/export, y compris les URL et logs.
- [x] Permettre de marquer l'état cassé et de confirmer explicitement `/checkout`.

**Acceptation :** enregistrer le scénario checkout, exporter une trace structurée
validée, ordonnée et expurgée, puis la relire sans avoir accès au navigateur initial.

Les tests Chromium couvrent cette acceptation, le mode corrigé, le masquage et
l'annulation. La capture reste limitée à demo-shop : politique configurable,
oracles libres, sélecteurs sémantiques génériques et autres applications ne sont
pas encore pris en charge. Voir `docs/capture.md`.

## M2 — Reconstruction (prochain chantier)

Transformer une trace en étapes significatives sans perdre les changements d'état.
Tester plusieurs saisies successives, navigation, rerender et cible ambiguë.
Le noyau déterministe fonctionne sans fournisseur LLM.

## M3 — Génération

Produire un test Playwright lisible à partir d'un scénario et d'un oracle confirmé.
Valider les sorties du fournisseur et expliciter les préconditions/fixtures.

## M4 — Exécution

Exécuter le test dans un runner isolé, collecter assertions, console, échecs réseau
et artefacts expurgés. Limiter durée et tentatives.

## M5 — Validation

Distinguer bug reproduit, absence de reproduction, génération et infrastructure.
Présenter les résultats observés sur plusieurs runs comparables.

**Critère de réussite central :** enregistrer le bug de demo-shop, générer un test,
observer son échec pertinent, corriger l'application, puis faire passer **exactement
le même test**. Ce critère n'est pas encore atteint.

## M6 — Interface produit

Projets, recordings, reproductions et rapport détaillé ; intégrer la persistance
et l'orchestration nécessaires au workflow déjà prouvé.

## Après MVP

GitHub (M7 / V1.5), import de sessions existantes, autres frameworks et correction
automatique restent hors périmètre initial. Aucun chantier de billing, SSO ou
session replay vidéo complet avant la preuve du workflow principal.
