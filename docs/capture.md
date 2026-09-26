# Capture locale — verticale 1

## Workflow

`pnpm capture` compile le workspace, démarre demo-shop sur `127.0.0.1` avec un port
libre, et ouvre un Chromium non persistant. Le panneau ReproFlow est injecté dans
un Shadow DOM. Démarrer réinitialise la page `/cart` ; les interactions antérieures
ne sont pas conservées. L'export ferme le navigateur et le serveur.

Le bug de démo est déclenché par l'enregistrement de l'adresse avant checkout.
Le serveur renvoie alors HTTP 500 et le frontend affiche une erreur. Avec
`pnpm capture --fixed`, la même requête réussit et le navigateur atteint `/checkout`.
L'oracle n'est enregistré qu'après confirmation explicite et clic sur le marqueur.

## Contrat v1

Le contrat Zod `RecordingTraceSchema` est dans `@reproflow/event-schema`.

| Champ | Sémantique |
| --- | --- |
| `schemaVersion` | `1`, autres versions refusées |
| `recordingId` | UUID généré par le collecteur |
| `policy` | `demo-shop-v1`, politique fermée sur les données synthétiques |
| `startedAtMs` / `endedAtMs` | Temps Unix en millisecondes |
| `environment` | Chromium, viewport et user-agent configuré dans le navigateur |
| `events` | Au plus 2 000 événements, ordre de réception par le collecteur |
| `sequence` | Index contigu à partir de zéro, généré côté Node |
| `timestampMs` | Horloge du collecteur, rendue non décroissante |
| `payload` | Navigation, clic, saisie, soumission, erreur console ou réseau |
| `brokenState` | Position du marqueur, chemins observé/attendu et confirmation |
| `droppedEvents` | Nombre d'événements écartés après atteinte de la limite |
| `status` | `captured` avec marqueur et sans troncature, sinon `incomplete` |

Les timestamps ne prétendent pas reconstituer un ordre causal entre les signaux
DOM et réseau. Les événements bruts, notamment clic + soumission et notifications
de navigation, sont traités par `packages/reconstruction` selon la politique
décrite dans [l'architecture](architecture.md).

Les fichiers sont validés avant écriture, créés sans écrasement (`wx`) avec droits
`0600`, sous `artifacts/recordings/`, ignoré par Git. Fermer le navigateur avant
l'export annule la session. Une valeur finale masquée bloque la reconstruction ;
elle n'est jamais transformée en saisie littérale. Le pipeline complet (`pnpm demo`)
conserve aussi la trace dans `artifacts/reproductions/<id>/recording.json`.

## Politique de données

- Les cibles sont les test IDs connus de demo-shop ; aucun texte DOM, label libre,
  CSS, screenshot ou snapshot n'est capturé.
- Toute saisie est masquée dans la page, sauf `75001` / `69001` sur le champ
  `postal-code` non sensible et non password. Les formes intermédiaires sont masquées.
- Le collecteur revalide les messages de la page et refuse les champs inattendus.
- Les URL sont réduites à `/cart`, `/checkout`, `/api/checkout` ou `[REDACTED]`.
  Origine, credentials, query et fragment ne sont pas stockés.
- Les erreurs texte sont remplacées par `[REDACTED]`, sauf le code fixe
  `ADDRESS_POSTAL_CODE_MISSING`. Les stacks et arguments console ne sont pas copiés.
- Réseau : méthode, chemin autorisé et statut du checkout uniquement. `null`
  représente une requête échouée sans réponse. Aucun header, cookie ou corps.

Les tests de masquage injectent des secrets synthétiques puis inspectent le JSON.
Cette politique ne constitue pas un système de capture générique configurable.
Pas d'authentification, de multi-onglets, d'iframes, de sélecteurs arbitraires ou
de collecte depuis un environnement de production. Les pages et bindings restent
non fiables : une trace seule ne prouve pas qu'un bug a été reproduit.

## Validation disponible

`pnpm check` couvre les contrats, le cycle de session, le serveur, le lint, les types
et la compilation. `pnpm test:e2e` exerce le vrai Chromium sans affichage : parcours
buggé/corrigé, export/relecture, masquage, réinitialisation et annulation.

`pnpm test:pipeline` complète ces tests : capture réelle, génération d'un seul
test, trois échecs pertinents sur la fixture buggée puis trois réussites sur la
fixture corrigée, sous Docker. Le hash du test et l'oracle restent identiques.
