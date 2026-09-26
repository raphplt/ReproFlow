# Pilote TCG Nexus : zéro dans les filtres de prix

## Ce que prouve ce pilote

Le vrai composant `MarketplaceSearch` perd le zéro dans les champs prix minimum
et maximum : `|| ""` remplace la valeur `0` par une chaîne vide. Le correctif local
utilise `?? ""`, qui ne remplace que `null` et `undefined`.

Le parent React est synthétique : listes de séries et de sets vides, état local,
aucun utilisateur. Le composant, les composants UI et les traductions proviennent
du checkout TCG. Le pilote valide le rendu et les callbacks, pas le marketplace
Next.js/API complet. Il ne modifie pas la base existante et n'utilise aucun `.env`.

Un [second pilote application complète](tcg-nexus-stack-pilot.md) couvre désormais
le parcours Next.js/API avec PostgreSQL jetable. Le présent guide décrit toujours
le pilote composant, plus léger.

**Aucun push vers TCG Nexus n'est autorisé.** Le script n'exécute que des lectures
Git. Il ne corrige ni ne committe automatiquement le dépôt cible.

## Prérequis

- ReproFlow : Node 24 ou 26, pnpm 10, `pnpm install --frozen-lockfile`.
- Dépôt TCG local de confiance, avec ses dépendances npm déjà installées, dont
  esbuild. Le pilote utilise leur version et l'enregistre dans le rapport.
- Chromium : `pnpm browser:install`.
- Docker actif et image à jour : `pnpm runner:build`.
- Le composant corrigé doit être présent dans le checkout pour la comparaison.

## Lancer

Depuis la racine de ReproFlow :

```sh
pnpm pilot:tcg \
  --repo /Users/raph/Documents/Travail/ETNA/Repositories/tcg-nexus \
  --before-ref c42457715826f90d844f5481adf814d56554bf3c \
  --confirm-zero
```

`--confirm-zero` confirme explicitement l'attendu : saisir zéro doit conserver
la valeur visible `0`. Il ne faut pas utiliser cette option pour un attendu qui
n'a pas été validé. Ajouter `--field max` pour tester la borne maximum.

Pour observer uniquement la version initiale avant de la corriger, ajouter
`--capture-only`. Aucun rejeu ni verdict rouge/vert n'est produit dans ce mode.

La référence historique ne remplace que le composant ; toutes les autres
dépendances proviennent du même checkout courant. Le script refuse la comparaison
si ces entrées changent entre les deux builds. Ce n'est pas un build historique
intégral du dépôt.

## Lire les résultats

Chaque exécution écrit un dossier UUID sous `artifacts/pilots/` :

| Fichier | Contenu |
| --- | --- |
| `scenario.json` | Actions scriptées, cibles, politique, attendu confirmé et observation réelle |
| `reproduction.spec.js` | Test Playwright inchangé entre variantes |
| `buggy.js`, `fixed.js` | Bundles autonomes du composant, exclusivement locaux |
| `report.json` | Provenance, état, hash du test et preuves par run |
| `summary.md` | Résumé lisible de la comparaison |

Les bundles et rapports restent hors Git. Ils contiennent du code de TCG Nexus ;
ne pas les publier sans autorisation. Une interruption conserve un rapport en
échec avec les runs terminés ; un arrêt brutal du processus peut laisser l'état
`running`. Il n'y a pas encore de reprise automatique de ces pilotes.

L'acceptation exige trois `reproduced` sur la variante initiale puis trois
`not_reproduced` sur la correction, le même hash du test et la même version de
navigateur de rejeu. Une erreur de sélecteur, d'infrastructure, un résultat masqué
ou un autre échec d'oracle fait échouer l'acceptation. Aucun score n'est calculé.

## Vérification et limites connues

Exécution locale du 26 septembre 2026 : les deux bornes donnent chacune trois
reproductions sur le composant initial puis trois réussites sur la correction,
avec Chromium `153.0.8010.12`. Le test reste identique à l'intérieur de chaque
comparaison. Le correctif TCG est le commit **local uniquement** `030a03e9`, sur
`codex/fix-marketplace-zero-price` ; le dépôt cible est propre après commit.

Les preuves locales sont dans `artifacts/pilots/48897c80-eb13-4dcc-bc46-3e807a6fa5a5`
(minimum) et `artifacts/pilots/88433655-df54-4047-98b9-f6e2952935af` (maximum).
Ces répertoires ne sont pas distribués avec le dépôt.

- Les huit tests ciblés TCG couvrent minimum/maximum, zéro, absence, valeur positive
  et effacement. Avant correction : quatre échecs sur zéro ; après : huit réussites.
- `npm run check-types --workspace=web` échoue dans l'environnement local sur dix
  diagnostics préexistants : types `.next` d'une page supprimée et dépendance
  `driver.js` indisponible, avec erreurs de typage consécutives. Une compilation
  comparative en mémoire avec le composant du commit initial donne les mêmes diagnostics.
  Le build hôte n'est donc pas vert. Les builds propres du second pilote en
  conteneur passent, sans corriger ces problèmes de l'environnement hôte.
- Le test voisin `MarketplaceComponents.test.tsx` a un échec indépendant dans
  `ShippingPolicyNotice` : attendu `2,50`, rendu `€2.50`. Il n'a pas été modifié.
- Le workbench reste celui du POC Demo Shop. Les rapports de pilote se consultent
  en fichiers ; ils ne sont pas importables comme traces v1.
- Le montage ne charge pas le CSS complet du site et ne valide pas sa présentation.
  Le second pilote couvre le vrai parcours Next.js/API sur une base jetable
  et synthétique, sans ajouter une validation visuelle exhaustive.
