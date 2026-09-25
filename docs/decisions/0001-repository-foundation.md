# ADR 0001 — Socle de développement

Statut : accepté pour l'initialisation, révisable avec les besoins du premier scénario.

## Contexte

Le brief propose un monorepo TypeScript et plusieurs services. Le premier objectif
reste la preuve enregistrer → générer → exécuter. Le dépôt doit être utilisable
par des humains, Codex et Claude Code sans coût de service ni secret au démarrage.

## Décision

- Node 24 ou 26, pnpm 10 avec version précise, lockfile et installation stricte en CI.
  Node 24 reste la référence nvm ; Node 26 est aussi accepté et vérifié en CI.
- Turborepo orchestre les scripts des workspaces et leurs dépendances.
- TypeScript 5.9 en ESM strict : baseline explicite, mises à jour séparées du bootstrap.
- Zod pour les contrats runtime ; types dérivés des schémas.
- Biome pour lint/formatage et Vitest pour les tests unitaires.
- Un premier workspace réel, `event-schema` ; les services futurs sont documentés
  et seront créés avec leur première fonctionnalité.
- Chromium et recorder local Playwright pour la première capture.
- `AGENTS.md` est la source des instructions communes ; `CLAUDE.md` l'importe.
  Les skills résident dans `.agents/skills` et sont reliés depuis `.claude/skills`.
- Aucun modèle, serveur MCP, hook automatique ou permission globale n'est imposé.
  Les vérifications restent des commandes ordinaires utilisables en CI.

## Conséquences

Le socle fonctionne sans API LLM, Docker ou base de données. Il ne constitue pas
un MVP démontrable. La création de Next.js, de la file de jobs et du stockage est
reportée aux jalons qui en ont besoin. Les liens symboliques des skills doivent
être préservés lors du clone (Linux/macOS ; Windows avec support des symlinks).
`pnpm agents:check` détecte une rupture de ces liens.

La licence et la publication de packages restent indécises ; le monorepo est privé
au sens du gestionnaire de paquets et aucun droit open source n'est présumé.
