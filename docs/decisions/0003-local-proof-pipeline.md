# 0003 — POC local déterministe et exécution Docker

## Décision

Compléter la verticale `demo-shop-v1` avant d'ajouter un fournisseur LLM ou des
services distants. Un workbench HTTP local orchestre la capture, la reconstruction,
la génération, six exécutions et la persistance de rapports sur disque.

Le générateur produit un test Playwright JavaScript ESM lisible. Les actions et
l'oracle proviennent exclusivement des contrats stricts. Le runner accepte
uniquement le résultat canonique du générateur : un test édité est exportable,
mais son exécution arbitraire n'est pas une capacité de ce POC.

Chaque exécution utilise un conteneur neuf contenant Chromium et la fixture.
Le conteneur ne reçoit aucun volume du poste, aucun secret et aucun accès réseau
externe. La boutique écoute sur le loopback interne. L'image Playwright est
épinglée par version et digest ; les dépendances utilisent le lockfile pnpm.

Limites : utilisateur non root, toutes les capabilities supprimées,
`no-new-privileges`, filesystem en lecture seule, tmpfs bornés, 1 Gio de RAM,
2 CPU, 256 processus, 20 s par test, 25 s global Playwright et 45 s côté hôte.
Annulation et dépassement déclenchent la suppression du conteneur nommé.
Le sandbox navigateur seul n'est pas la frontière d'isolation : Docker l'est.
Ce profil est réservé à la fixture synthétique et au code canonique, pas à un
service multitenant exécutant du JavaScript arbitraire ou des sites hostiles.

## Preuve

Le reporter collecte l'étape en échec, le nombre d'actions terminées, la route
observée, le code console autorisé, les statuts HTTP checkout et la version
Chromium. Les messages d'erreur bruts, headers, corps, screenshots et traces
Playwright ne sortent pas du conteneur. Le reporter valide le contrat avant
écriture ; l'hôte valide à nouveau avant persistance.

Un bug est reproduit seulement si toutes les actions sont terminées, l'oracle
confirmé échoue, la route correspond à l'observation et les deux signatures
enregistrées (erreur postale et POST 500) sont présentes. Une assertion seule
donne `inconclusive`. Un sélecteur inexploitable donne `generation_failure`.

Trois runs buggés puis trois corrigés partagent le même fichier et le même hash.
Chaque variante est résumée séparément. Seuls des résultats métier opposés sous
la même variante, le même hash et la même version Chromium donnent `flaky`.
Il n'existe aucune réparation automatique de l'oracle ou du test.

## Conséquences

Docker est requis pour le pipeline, mais pas pour la capture seule. Le rapport
HTML est autonome et le workbench garde un historique local sans base de données.
Une erreur Docker produit un rapport d'infrastructure, jamais un verdict de bug.
Les autres applications, sélecteurs génériques, authentification et LLM restent
des extensions à concevoir, pas des capacités livrées.

Références : [Playwright Docker](https://playwright.dev/docs/docker),
[Docker run](https://docs.docker.com/reference/cli/docker/container/run/).
