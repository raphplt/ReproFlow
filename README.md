# ReproFlow

> Turn recorded bug reproductions into executable regression tests.

ReproFlow transforme une reproduction manuelle de bug web en test Playwright,
puis l'exécute pour vérifier que le bug est réellement reproduit.

```text
Reproduction enregistrée → Trace structurée → Reconstruction
→ Test Playwright → Exécution isolée → Résultat observé
```

**État : première verticale de capture utilisable.** Une boutique locale avec bug
volontaire, un recorder Chromium et un export JSON versionné sont disponibles.
La génération de tests, l'IA et le runner de validation restent à construire.

## Démarrage

Prérequis : Node **24.x ou 26.x** (référence 24.14.0 dans `.nvmrc` / `.node-version`) et
pnpm **10.34.5** (`packageManager`). Ton Node 26 existant convient ; avec nvm,
`nvm install && nvm use` sélectionne la référence Node 24.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm browser:install
pnpm demo
```

Aucun service externe, Docker ou secret n'est requis. `pnpm demo` démarre la
boutique sur un port local libre et ouvre Chromium ; une session graphique est
nécessaire. Les tests navigateur fonctionnent aussi sans affichage.

## Première capture

1. Cliquer **Démarrer la capture** : le panier est réinitialisé.
2. Modifier l’adresse, saisir **69001**, puis enregistrer.
3. Cliquer **Passer commande** : le bug apparaît, l’URL reste `/cart`.
4. Confirmer que le comportement attendu est `/checkout`, puis **Marquer cet état
   comme cassé**.
5. Cliquer **Arrêter et exporter**. Le terminal indique le fichier
   `artifacts/recordings/<id>.json` ; le navigateur et le serveur sont fermés.

`pnpm demo --fixed` lance la variante corrigée : les mêmes actions atteignent
`/checkout`. Fermer Chromium ou faire Ctrl+C annule sans export.

Cette politique de capture est **spécifique à la démo synthétique**. Elle conserve
les test IDs connus et seulement les valeurs `75001` / `69001`. Les URL sont réduites
à des chemins autorisés ; textes libres, headers et corps réseau ne sont pas
exportés. Un arrêt sans marqueur ou après dépassement de 2 000 événements produit
une trace `incomplete`. `captured` signifie capture complète, **pas bug reproduit**.
Voir [le contrat et les limites](docs/capture.md).

## Commandes

| Commande | Usage |
| --- | --- |
| `pnpm check` | Vérification des agents, lint, types, tests et build |
| `pnpm browser:install` | Installer Chromium pour la démo et les tests |
| `pnpm demo` | Boutique buggée + recorder interactif |
| `pnpm demo --fixed` | Même boutique avec checkout corrigé |
| `pnpm test:e2e` | Tests réels Chromium, sans affichage |
| `pnpm test` | Tests unitaires des packages |
| `pnpm typecheck` | Vérification TypeScript |
| `pnpm build` | Compilation des packages |
| `pnpm lint` | Lint et contrôle de formatage Biome |
| `pnpm format` | Formatage automatique |
| `pnpm agents:check` | Cohérence des instructions et skills partagés |

## Organisation

```text
apps/recorder/            Capture Chromium, contrôles et export JSON
packages/event-schema/    Environnement, états et contrat de trace v1
workers/                  Futur runner isolé
examples/demo-shop/       Boutique locale, modes buggé et corrigé
docs/                     Brief produit, architecture, décisions et roadmap
.agents/skills/           Workflows communs aux agents
.claude/skills/           Liens vers les mêmes workflows pour Claude Code
```

Le prochain objectif est la **reconstruction déterministe des étapes à partir de
la trace**, puis la génération d'un test Playwright.

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
