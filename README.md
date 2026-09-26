# ReproFlow

> Turn recorded bug reproductions into executable regression tests.

**POC/MVP local fonctionnel pour Demo Shop.** Enregistrer le bug, générer un test
Playwright, l'exécuter dans Docker et consulter les preuves. Le même fichier
échoue sur la boutique buggée puis passe sur sa variante corrigée.

## Démarrage

Prérequis : Node **24 ou 26**, pnpm **10.34.5**, Docker démarré. `.nvmrc`
conserve la référence Node 24. Aucun compte, secret ou appel LLM n'est nécessaire.

```sh
pnpm install --frozen-lockfile
pnpm browser:install
pnpm runner:build
pnpm dev
```

Ouvrir l'URL locale indiquée dans le terminal. **Exécuter la démo** enregistre le
scénario synthétique avec Chromium headless puis lance trois runs buggés et trois
runs corrigés. Le rapport indique les résultats réels et le SHA-256 du test.

Pour produire directement cette preuve sans serveur d'interface :

```sh
pnpm poc
```

Le terminal indique le fichier `artifacts/reproductions/<id>/report.html`,
consultable directement dans un navigateur. Un échec du critère rouge/vert
produit un code de sortie non nul. Docker/image indisponible donne un rapport
d'infrastructure, jamais un faux succès.

## Enregistrer manuellement

Depuis l'interface : **Enregistrer un bug**, ou utiliser `pnpm demo`.

1. Dans Chromium, **Démarrer la capture** : le panier est réinitialisé.
2. Modifier l'adresse, saisir **69001**, puis enregistrer.
3. Cliquer **Passer commande** : erreur, URL `/cart`.
4. Confirmer l'attendu `/checkout`, puis **Marquer cet état comme cassé**.
5. **Arrêter et exporter** : génération et exécutions démarrent automatiquement.

Fermer Chromium annule la capture. L'interface permet aussi d'annuler le workflow
et de relancer une reproduction conservée. La capture manuelle nécessite une
session graphique ; la démo automatique et les tests sont headless.

`pnpm capture` conserve l'ancien parcours d'export seul, sans Docker.
`pnpm capture --fixed` ouvre la variante corrigée. Une trace exportée peut être
importée dans l'interface ou avec `pnpm reproduce chemin/trace.json`.

## Résultats et limites

Le rapport sépare échec de l'oracle, sélecteur inexploitable, infrastructure et
preuve non concluante. « Bug reproduit » exige les étapes terminées, l'URL
enregistrée, le POST 500 et le code console connu. Les variantes buggée et corrigée
ne sont jamais mélangées pour déduire une variabilité.

Le périmètre est **demo-shop-v1**, avec test IDs connus, codes postaux fictifs
`75001` / `69001` et oracle `/checkout` confirmé. Pas de capture de site arbitraire,
de compte utilisateur ou de fournisseur IA. Une valeur finale masquée, une cible
inconnue ou une capture incomplète bloque la reconstruction.

Le test exporté utilise `@playwright/test` **1.63.0** et un `baseURL` pointant sur
une fixture Demo Shop fraîche. Il est éditable dans un projet Playwright, mais le
runner du POC accepte exclusivement le test canonique du générateur. Son
isolation et ses limites sont documentées dans
[la décision runner](docs/decisions/0003-local-proof-pipeline.md).

## Vérifier

```sh
pnpm check
pnpm test:e2e
pnpm test:pipeline
```

`check` couvre agents, lint, types, tests unitaires et build. `test:e2e` vérifie la
capture Chromium. `test:pipeline` nécessite l'image construite et vérifie
l'isolation, les classifications négatives et la preuve rouge/vert avec le même
test, puis l'interface sur ordinateur et mobile. Après un changement du runner,
des contrats, du générateur ou de la fixture, relancer `pnpm runner:build`.

## Organisation

| Emplacement | Rôle |
| --- | --- |
| `apps/recorder` | Capture, contrôles et masquage |
| `apps/workbench` | Interface locale, CLI, orchestration et historique |
| `packages/event-schema` | Contrats versionnés |
| `packages/reconstruction` | Trace vers scénario |
| `packages/playwright-generator` | Scénario vers test et hash |
| `workers/runner` | Docker, preuves et classification |
| `examples/demo-shop` | Fixture buggée/corrigée |

Les données locales sont dans `artifacts/`, ignoré par Git. Aucun service distant
n'est provisionné. La licence open source reste à décider ; packages privés et
`UNLICENSED`.

[Architecture](docs/architecture.md) · [Roadmap](docs/roadmap.md) ·
[Brief original](docs/product-brief.md) · [Capture](docs/capture.md) ·
[Instructions agents](AGENTS.md) · [Guide agents](docs/agent-workflow.md)
