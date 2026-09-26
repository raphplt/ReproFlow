# Contribuer à ReproFlow

Suivre le démarrage du README. La même commande `pnpm check` s'exécute localement
et dans GitHub Actions, sans identifiants de services externes.
Pour le pipeline, construire l'image avec `pnpm runner:build` puis exécuter
`pnpm test:pipeline`. La capture reste couverte par `pnpm test:e2e`.

## Une modification

Partir d'un comportement concret et d'un critère observable. Garder les changements
centrés sur le milestone actif dans `docs/roadmap.md`. Décrire dans la PR le problème,
le comportement obtenu, les vérifications exécutées et les limites restantes.

Pour le code métier, ajouter des tests couvrant le comportement et les cas d'échec
pertinents. Les fixtures doivent être synthétiques. Un snapshot ou un mock LLM ne
remplace pas une exécution réelle lorsqu'on affirme qu'un bug est reproduit.

Utiliser TypeScript strict, ESM et les exports publics des packages. Les schémas
Zod constituent la frontière de validation des données externes ; ne pas maintenir
une seconde définition manuelle des mêmes types. Biome contrôle le style.

Les nouvelles dépendances s'ajoutent avec pnpm dans le package concerné. Versionner
le lockfile. Documenter une modification de frontière technique ou un choix durable
dans `docs/decisions/`. Créer chaque nouveau workspace avec ses scripts de build,
typecheck et test lorsqu'ils sont applicables.

## Données et artefacts

Ne pas versionner les fichiers `.env`, états d'authentification Playwright,
enregistrements réels, screenshots ou logs contenant des données personnelles.
Stocker les artefacts locaux sous `artifacts/`, ignoré par Git. Toute future variable
de configuration doit avoir un exemple sans secret et une explication de son usage.

## Travail avec un agent

Lire `AGENTS.md` ; Claude Code le charge via `CLAUDE.md`. Les prompts réutilisables
restent dans `.agents/skills/`, avec liens dans `.claude/skills/`. Maintenir les
consignes courtes et les commandes vérifiables. Ne pas dupliquer le brief complet
dans le contexte chargé à chaque session.
