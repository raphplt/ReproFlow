# Architecture

## Périmètre actuel

Trois workspaces sont fonctionnels : `event-schema` (contrat de trace v1),
`demo-shop` (serveur HTTP local, checkout buggé/corrigé) et `recorder` (Chromium,
contrôles injectés et export). Le recorder orchestre sa fixture demo-shop pour
fournir une commande locale unique. Il ne constitue pas un runner de code généré.

Reconstruction, génération, IA, API, dashboard et runner restent **prévus**.
Le contrat de capture et ses limites sont décrits dans [capture.md](capture.md).

## Pipeline cible du MVP

```text
demo-shop → recorder → événements expurgés → session normalisée
→ reconstruction → génération Playwright → runner isolé → rapport
```

| Emplacement prévu | Responsabilité |
| --- | --- |
| `examples/demo-shop` | Scénario déterministe adresse/panier/checkout, mode buggé puis corrigé |
| `apps/recorder` | Premier outil local pilotant Chromium, enregistrement explicite |
| `packages/event-schema` | Contrats versionnés, validation runtime, types partagés |
| `packages/recorder-core` | Capture, métadonnées des cibles, masquage avant transmission |
| `packages/reconstruction` | Normalisation déterministe puis simplification sémantique |
| `packages/ai` | Interface du fournisseur, sorties structurées validées, limites d'essais |
| `packages/playwright-generator` | Scénario normalisé vers fichier lisible et éditable |
| `workers/runner` | Exécution isolée, preuves, limites et classification des échecs |
| `apps/api` | Orchestration et persistance quand nécessaires |
| `apps/web` | Rapport et navigation projets/recordings/reproductions |

Le premier recorder est local et piloté par Playwright pour limiter les contraintes
d'une extension. Revoir ce choix si la première capture exige une session navigateur
existante ; noter alors la décision avant d'introduire un second mécanisme.

Les packages de contrats et de normalisation doivent rester utilisables sans
framework web, base de données ni fournisseur LLM. Les dépendances vont des
applications vers les packages, jamais l'inverse.

L'injection et le collecteur restent dans `apps/recorder` pour cette première
verticale. Extraire `recorder-core` lorsque la réutilisation par un second point
d'entrée le justifiera. Les assets de demo-shop sont servis depuis `public/`.

## Validation et oracle

Conserver séparément le comportement attendu confirmé, les observations du bug et
les résultats d'exécution. Un code de sortie non nul n'est pas un verdict métier.

- **Reproduced** : scénario rejoué, assertion attendue en échec et preuves compatibles
  avec le bug enregistré.
- **Not reproduced** : scénario et assertion attendue réussissent.
- **Generation failure** : syntaxe invalide, sélecteur inexploitable, étapes impossibles.
- **Infrastructure failure** : cible inaccessible, navigateur ou runner indisponible.
- **Flaky** : résultats métier variables entre exécutions comparables ; des erreurs
  d'infrastructure seules ne prouvent pas la flakiness du bug.

Ces catégories détaillées ne sont pas encore un contrat implémenté. Le compteur
affiché doit refléter les runs observés, en séparant ceux qui sont inexploitables.
La boucle de réparation aura une limite explicite (par exemple deux réparations)
et ne devra pas changer l'oracle pour rendre le test vert.

## Données et exécution

Le masquage se fait au plus près de la capture, avant logs, disque, upload ou LLM.
Les schémas stricts ne remplacent pas le masquage des champs autorisés. Prévoir
notamment URL/query strings, DOM, champs saisis, headers et messages d'erreur.
Pas de corps réseau ou état d'authentification collecté implicitement.

Le code généré est non fiable : le futur runner devra utiliser une frontière
d'isolation système, limiter ressources/durée/réseau et recevoir uniquement les
identifiants de test nécessaires. Le contexte Playwright n'isole pas le processus
Node qui exécute le code généré.

## Infrastructure différée

Next.js/React, PostgreSQL, Redis/BullMQ et stockage S3 restent les options proposées
dans le brief. Les ajouter lorsque le pipeline local justifie leur usage. Le choix
du fournisseur LLM et du backend précis reste ouvert. Aucun service n'est provisionné.
