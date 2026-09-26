# ADR 0004 — Premier pilote réel à l'échelle d'un composant

Date : 2026-09-26. Statut : accepté.

## Contexte

Le POC Demo Shop utilise exclusivement des cibles et un oracle de navigation
connus. TCG Nexus est le premier candidat réel. Son composant
`MarketplaceSearch` confond une borne de prix `0` avec une valeur absente
(`value={filters.priceMin || ""}`, même défaut pour `priceMax`).

La base locale, les identifiants, les paiements et les services externes TCG
ne doivent pas être utilisés pour prouver un défaut de rendu autonome.
Tout push sur le dépôt TCG Nexus est explicitement interdit par l'utilisateur.

## Décision

1. Monter le vrai composant et ses dépendances UI dans un parent React synthétique.
   Le parent gère les props et les callbacks ; il ne réimplémente pas les champs.
   `next-intl` et les traductions du dépôt sont conservés. Aucun backend n'est simulé.
2. Compiler deux bundles : composant du commit de référence et composant corrigé
   du checkout. Les autres entrées sont identiques, vérifiées par leurs hashes.
   Le commit de référence ne prétend donc pas identifier tout l'environnement.
3. Observer le défaut avec Chromium via un parcours scripté explicitement déclaré.
   Ce n'est pas encore une capture manuelle générique.
4. Ajouter un contrat distinct `schemaVersion: 2, kind: component-value`, avec cibles
   configurées, valeurs numériques synthétiques autorisées et oracle confirmé.
   Le recorder manuel, la reconstruction et le workbench v1 restent inchangés.
5. Générer un unique test Playwright canonique avec `toHaveValue("0")`.
   Le rejouer dans six conteneurs neufs : trois par variante, sans réseau ni
   volume hôte. Seul le bundle de fixture change, jamais l'oracle ni le test.
6. Garder les preuves dans `artifacts/pilots/`, hors Git : scénario, test, bundles,
   hashes de provenance, observations expurgées et statut de chaque exécution.

## Frontières de confiance

Le bundler exécute une dépendance du dépôt TCG sur le poste : ce pilote exige
donc un checkout local de confiance, avec dépendances déjà installées. Il ne
constitue pas un service de compilation pour dépôts inconnus. Il ne charge aucun
`.env` et ne démarre aucun script de l'application.

Les noms de cibles sont une configuration de confiance, pas des textes extraits
automatiquement du DOM. Les observations sont limitées aux valeurs déclarées.
Les mots de passe et autres types d'input sont refusés avant lecture de leur valeur.
Ni DOM brut, logs, corps réseau, screenshot ni trace Playwright ne sont conservés.
La capture n'accepte qu'une URL loopback et bloque les requêtes d'autres origines.
Le serveur de fixture fournit une CSP sans accès réseau applicatif.

L'observation d'un champ absent, ambigu ou de type inattendu n'est pas un bug
reproduit. Une erreur JavaScript est une erreur d'infrastructure. Une valeur
masquée ou un échec d'oracle différent de l'observation capturée est non concluant.

## Conséquences

Nous disposons d'un oracle supplémentaire et d'une preuve sur du code produit réel,
sans prétendre avoir validé le marketplace de bout en bout. Le pilote n'utilise ni
le routeur Next, ni la synchronisation des query params, ni l'API, ni PostgreSQL.
Il ne vérifie pas le filtrage métier des résultats. Le fallback placeholder est
nécessaire car ces champs n'ont ni test ID ni label HTML associé ; sa résolution
doit être unique. Les modes test ID, rôle/nom et label sont aussi disponibles.

La prochaine étape est un environnement jetable du marketplace complet, puis une
capture manuelle configurable intégrée au workbench. Ne pas faire accepter les
scénarios v2 par l'import de traces v1 tant que leur cycle produit n'est pas conçu.
