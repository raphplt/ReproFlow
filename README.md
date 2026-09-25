# ReproFlow

> Turn recorded bug reproductions into executable regression tests.

ReproFlow transforme une reproduction manuelle de bug web en test Playwright,
puis l'exécute pour vérifier que le bug est réellement reproduit.

```text
Reproduction enregistrée → Trace structurée → Reconstruction
→ Test Playwright → Exécution isolée → Résultat observé
```

**État : initialisation du dépôt.** Le socle TypeScript, les premiers contrats
Zod, les tests unitaires, la CI et les workflows agents sont disponibles.
Le recorder, la génération IA, le runner et l'interface ne sont pas encore implémentés.

## Démarrage

Prérequis : Node **24.x ou 26.x** (référence 24.14.0 dans `.nvmrc` / `.node-version`) et
pnpm **10.34.5** (`packageManager`). Avec nvm :

```sh
nvm install
nvm use
npm install --global pnpm@10.34.5
pnpm install --frozen-lockfile
pnpm check
```

Aucun service externe, Docker ou secret n'est requis pour ce socle.
Il n'y a pas encore de serveur de développement à lancer.

## Commandes

| Commande | Usage |
| --- | --- |
| `pnpm check` | Vérification des agents, lint, types, tests et build |
| `pnpm test` | Tests unitaires des packages |
| `pnpm typecheck` | Vérification TypeScript |
| `pnpm build` | Compilation des packages |
| `pnpm lint` | Lint et contrôle de formatage Biome |
| `pnpm format` | Formatage automatique |
| `pnpm agents:check` | Cohérence des instructions et skills partagés |

## Organisation

```text
apps/                     Applications futures : web, API, recorder
packages/event-schema/    Contrats Zod + types TypeScript, déjà présents
workers/                  Futur runner isolé
examples/                 Future application demo-shop
docs/                     Brief produit, architecture, décisions et roadmap
.agents/skills/           Workflows communs aux agents
.claude/skills/           Liens vers les mêmes workflows pour Claude Code
```

Les dossiers futurs contiennent uniquement leur périmètre ; aucun service fictif
n'est exposé. Le prochain objectif est **demo-shop + capture Chromium + trace**.

## Codex et Claude Code

Les règles communes sont dans [AGENTS.md](AGENTS.md).
[CLAUDE.md](CLAUDE.md) les importe pour Claude Code.

- Codex : `$reproflow-verify` et `$reproflow-review`.
- Claude Code : `/reproflow-verify` et `/reproflow-review`.

Voir le [guide agents](docs/agent-workflow.md) pour le fonctionnement, RTK et la
reprise de travail. Aucun modèle, secret, serveur MCP ou hook global n'est imposé.

## Références projet

- [Brief produit original](docs/product-brief.md)
- [Architecture et limites actuelles](docs/architecture.md)
- [Roadmap et critère de réussite](docs/roadmap.md)
- [Choix du socle](docs/decisions/0001-repository-foundation.md)
- [Contribuer](CONTRIBUTING.md)

Le choix d'une licence open source reste à décider ; les packages sont privés et
marqués `UNLICENSED` en attendant.
