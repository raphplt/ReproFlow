# Workers

`runner` exécute les tests Playwright canoniques dans Docker, sans réseau externe
ni volume hôte, avec limites de ressources et collecte de preuves expurgées.
Construire l'image avec `pnpm runner:build`, vérifier avec `pnpm test:pipeline`.
Voir [l'architecture](../docs/architecture.md).
