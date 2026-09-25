# Applications de démonstration

`demo-shop` est un serveur HTTP sur loopback avec interface panier/adresse/checkout.
`pnpm demo` orchestre la boutique et le recorder ; `pnpm demo --fixed` sélectionne
le mode corrigé. Aucun service externe ou paiement n'est utilisé.

Le scénario de capture est testé dans les deux modes. La génération automatique
du test de régression est le prochain objectif après reconstruction.
