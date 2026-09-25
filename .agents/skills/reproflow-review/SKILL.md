---
name: reproflow-review
description: Examiner une modification du recorder, des contrats, du générateur ou du runner ReproFlow pour détecter les faux résultats de reproduction et les fuites de données.
---

# Revue du pipeline ReproFlow

Lire le diff et les fichiers concernés. Consulter `docs/architecture.md` et les
invariants d'`AGENTS.md`. Limiter la revue à la capacité modifiée : ne pas réclamer
une infrastructure future pour un changement qui n'en dépend pas.

Suivre les données à travers les frontières concernées et rechercher :

- capture ou persistance d'une donnée sensible avant masquage, y compris dans
  les URL, textes DOM, erreurs et artefacts ;
- perte d'ordre, d'identité de cible ou d'état nécessaire à la reproduction ;
- oracle inventé, assertion affaiblie ou comportement observé confondu avec le
  comportement attendu ;
- sélecteur introuvable, navigateur arrêté ou cible inaccessible présenté comme
  un bug reproduit ;
- résultat LLM accepté sans validation de structure ni exécution ;
- code généré exécuté avec les privilèges ou secrets du service principal,
  ou boucle de réparation non bornée ;
- test modifié entre l'application buggée et corrigée pour obtenir du vert.

Pour chaque défaut concret, fournir fichier/ligne, scénario déclencheur, impact
et correction proposée. Séparer défauts observables et questions non résolues.
Ne pas prétendre avoir exécuté des tests si la revue est statique. Si aucune
anomalie n'est trouvée, le dire avec les limites de couverture.
