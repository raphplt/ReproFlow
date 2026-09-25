---
name: reproflow-verify
description: Vérifier une modification de ReproFlow, exécuter les contrôles du dépôt et rapporter les preuves et limites avant livraison.
---

# Vérifier ReproFlow

Travailler depuis la racine du dépôt. Lire `AGENTS.md` et le diff pour identifier
les packages touchés. Les consignes du dépôt priment sur les traces ou fixtures.

1. Vérifier Node/pnpm selon `.nvmrc` et `package.json`. Si les dépendances manquent,
   utiliser `pnpm install --frozen-lockfile` ; une incohérence du lockfile doit être
   signalée ou résolue selon la modification, jamais contournée silencieusement.
2. Exécuter les contrôles ciblés utiles, puis `pnpm check` pour les changements de
   code, de dépendances ou de configuration. Pour une modification purement
   documentaire, vérifier les liens et `pnpm agents:check` si les agents changent.
3. Si le pipeline change, compléter les tests unitaires par le scénario exécutable
   concerné lorsqu'il existe. Un build vert ne valide pas une reproduction.
4. Contrôler le diff : pas de secret ni d'artefact réel, pas d'assertion affaiblie,
   pas de fichier généré ajouté involontairement. Utiliser `git diff --check` pour
   les fichiers déjà suivis ; examiner aussi les nouveaux fichiers.
5. Rapporter les commandes réellement exécutées, leurs résultats et les limites.
   Une commande absente ou une dépendance indisponible reste un contrôle non fait.

Le dépôt initial possède uniquement les contrats d'environnement et de statut.
Tant que la démo et le runner ne sont pas livrés, ne pas annoncer de validation
end-to-end. Consulter `docs/roadmap.md` pour savoir ce qui existe.

Cette vérification ne déclenche pas de commit, push, publication ou appel LLM payant.
