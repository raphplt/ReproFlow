# ADR 0002 — Première verticale de capture locale

Statut : accepté pour la démo initiale.

## Décision

Livrer une tranche exécutable de M1 : boutique déterministe, commandes de capture
dans Chromium et trace JSON relisible. Utiliser un serveur HTTP Node et des assets
HTML/CSS/JS pour la fixture. Cette fixture ne préjuge pas du choix Next.js du futur
dashboard produit.

Le recorder dépend directement de demo-shop pour la commande de démonstration.
Le collecteur et le script d'injection restent dans une seule application ; le
contrat partagé reste indépendant de Playwright et de Node. Une extraction vers
`recorder-core` attend un deuxième point d'entrée réel.

## Politique restrictive

Choisir un vocabulaire fermé de test IDs, de chemins, de codes d'erreur et de deux
valeurs postales fictives. Toute autre saisie est masquée avant le pont navigateur.
Cela permet de tester le flux et ses propriétés sans prétendre fournir un filtre
universel de données personnelles. Les sorties critiques sont validées côté Node.

Le champ `captured` décrit uniquement la complétude de la capture. Le marqueur est
une annotation utilisateur, pas un verdict automatique. Pas de fournisseur IA ni
de runner pour exécuter du code généré dans cette tranche.

## Conséquences

Une commande locale suffit, sans secret ni service provisionné. Les tests headless
prouvent la capture et le mode corrigé. La généralisation de la politique, les
selectors sémantiques, les fixtures d'état et la reconstruction restent à venir.
