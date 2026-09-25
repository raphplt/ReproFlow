# Travailler avec Codex et Claude Code

## Instructions partagées

`AGENTS.md` contient les invariants du produit et les commandes de travail.
Codex le charge comme instructions du dépôt. `CLAUDE.md` importe ce même fichier
et `RTK.md` pour Claude Code. Le brief complet reste une référence à consulter
selon le besoin, pas un import systématique.

## Workflows disponibles

| Workflow | Codex | Claude Code |
| --- | --- | --- |
| Vérification avant livraison | `$reproflow-verify` | `/reproflow-verify` |
| Revue des risques propres au pipeline | `$reproflow-review` | `/reproflow-review` |

Les sources sont dans `.agents/skills/<nom>/SKILL.md`. Chaque dossier correspondant
de `.claude/skills/` est un lien symbolique vers cette source. Modifier uniquement
la source commune. Lancer `pnpm agents:check` après une modification de configuration.
Redémarrer la session si les nouveaux skills n'apparaissent pas ; dans Claude Code,
`/memory` permet d'inspecter les instructions chargées.

Exemple pour commencer le chantier suivant :

> Lis AGENTS.md et docs/roadmap.md. Commence M1 par demo-shop et le contrat de trace,
> avec un scénario checkout déterministe et des données synthétiques. Vérifie le
> comportement réalisé et mets à jour la roadmap avec les limites restantes.

## Contexte durable

- Vision originale : `docs/product-brief.md`.
- Capacités livrées et prochain travail : `docs/roadmap.md`.
- Frontières techniques : `docs/architecture.md`.
- Raisons des choix structurants : `docs/decisions/`.

Conserver les préférences privées dans `CLAUDE.local.md` ou
`.claude/settings.local.json`, ignorés par Git. Ne pas committer des historiques de
conversation, des secrets, des chemins personnels ou des états d'authentification.

## RTK et outillage

RTK est optionnel ; voir `RTK.md`. Les éventuels hooks personnels Claude restent
gérés hors du projet. Aucun hook ne lance ici un LLM, un commit ou des commandes
sur les fichiers à chaque édition. Les contrôles sont regroupés dans `pnpm check`.

Les comptes, modèles et permissions des agents restent configurés localement.
Le dépôt ne demande pas de désactiver leurs protections. Un MCP navigateur ou
documentation pourra être ajouté quand un workflow réel le justifiera.

## Références officielles

- [Instructions Codex AGENTS.md](https://developers.openai.com/codex/guides/agents-md)
- [Skills locaux Codex](https://developers.openai.com/codex/skills)
- [Imports de mémoire Claude Code](https://code.claude.com/docs/en/memory)
- [Skills et liens symboliques Claude Code](https://code.claude.com/docs/en/skills)
