# Pilote TCG Nexus : marketplace complet isolé

Ce pilote charge le vrai parcours `/fr/marketplace/cards`, son API Nest et un
PostgreSQL neuf. Il vérifie que saisir zéro conserve `0` dans le champ prix.
Les deux builds ne diffèrent que par le composant `MarketplaceSearch` ; le
correctif est déjà présent dans le commit local TCG `030a03e9`.

**Aucun push vers TCG Nexus.** Les commandes suivantes ne modifient pas le dépôt
cible et n'utilisent ni son `.env`, ni sa base, ni ses services en cours.

## Construire et lancer

Prérequis : Node 24 ou 26, pnpm 10, Docker actif, checkout TCG de confiance propre
et committé. Depuis ReproFlow :

```sh
pnpm install --frozen-lockfile
pnpm runner:build
pnpm pilot:tcg:build \
  --repo /Users/raph/Documents/Travail/ETNA/Repositories/tcg-nexus \
  --before-ref c42457715826f90d844f5481adf814d56554bf3c
pnpm pilot:tcg:stack --confirm-zero
pnpm pilot:tcg:stack --confirm-zero --field max
```

`--confirm-zero` confirme l'attendu métier, pas le résultat. Le premier build
installe les dépendances npm avec le lockfile et compile l'API et les deux
versions Next ; il nécessite Internet et plusieurs Go de stockage Docker.
Il faut reconstruire l'image du pilote après modification du moteur ReproFlow,
de l'adaptateur ou du checkout TCG. Les exécutions épinglent l'image obtenue par
son ID SHA-256, et non par son tag mutable.

## Preuves et protections

Une capture scriptée est suivie de trois runs sur le bug et trois sur le
correctif. Chacun démarre une nouvelle base avec une carte synthétique et ses
traductions. Aucun utilisateur réel ni annonce commerciale n'est importé.

Avant l'oracle, capture et test vérifient une réponse initiale de l'API à 200,
la carte visible, puis une réponse filtrée à 200 et le paramètre `priceMin=0`
ou `priceMax=0` dans l'URL. Une API défaillante ne peut pas produire le verdict
« reproduit ». Le fichier de test reste identique entre les six runs.

Les services ne communiquent que sur loopback dans un conteneur `--network=none`.
Pas de port publié ni de montage hôte. PostgreSQL et logs sont temporaires,
sur tmpfs. Limites par capture/run : 120 secondes, 2 CPU, 2 Go de mémoire,
512 processus et 512 Mo pour `/work`. Une interruption demande la suppression
du conteneur ; un arrêt brutal du processus peut laisser un rapport incomplet.

`artifacts/application-pilots/<uuid>/` contient scénario, test Playwright,
`report.json` et `summary.md`. L'acceptation exige 3 `reproduced` puis 3
`not_reproduced`, avec même source, image et version de navigateur. Un écart
fait échouer la commande. Les preuves ne stockent ni corps réseau, ni captures
d'écran, ni logs bruts des services.

## Acceptation observée

Le 26 septembre 2026, les bornes minimum et maximum produisent chacune trois
`reproduced` sur le composant initial puis trois `not_reproduced` sur le correctif.
`applicationReady` vaut `true` pour les douze runs, sous Chromium `153.0.8010.12`.
Le champ observé est vide sur le bug et vaut `0` après correction. Chaque
comparaison conserve son test et la même image :
`sha256:dae7e1cf39ce2dd293a0da35801818a037a5a114d152f70a1664ef22610f6609`.

Preuves locales, non distribuées avec le dépôt :

- Minimum : `artifacts/application-pilots/ced9875d-529f-42f6-9267-cdc1790d137c/`.
- Maximum : `artifacts/application-pilots/521a8848-b3b5-4dce-b3ca-a22aed7fc3be/`.

Les contrôles ReproFlow sont `pnpm check`, `pnpm test:e2e` et
`pnpm test:pipeline`. Leurs fixtures synthétiques testent notamment le refus des
chemins invalides, l'échec de disponibilité API, le masquage, les sélecteurs
inexploitables et l'isolation. La comparaison TCG complète reste une acceptation
locale séparée : la CI standard n'a pas besoin du dépôt privé TCG.

## Limites

- Le parcours est scripté ; la capture manuelle configurable et l'intégration
  des rapports dans le workbench restent à construire.
- Ce test prouve le maintien de la valeur zéro et l'exécution du parcours,
  pas l'exactitude de tous les résultats commerciaux, l'authentification ou le paiement.
- La base est créée via la synchronisation TypeORM de test ; ce pilote ne valide
  pas une migration de production ni la qualité d'une base existante.
- Le snapshot est filtré pour exclure dotenv et sorties connues, pas audité par
  un détecteur universel de secrets. Le checkout doit rester de confiance.
- L'image et les contextes `artifacts/tcg-builds/` contiennent du code TCG privé.
  Ils restent locaux, hors Git, et ne doivent pas être publiés sans autorisation.
- L'installation npm signale 31 vulnérabilités, dont une critique et treize
  élevées. Elles ne sont pas corrigées ici ; ce pilote isolé ne vaut pas une
  validation de sécurité ni une image distribuable en production.
- Les builds propres en conteneur ne corrigent pas les problèmes de dépendances
  et de types générés constatés dans l'environnement de développement TCG hôte.
