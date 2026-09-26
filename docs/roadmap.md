# Roadmap

## État actuel

**POC/MVP local demo-shop opérationnel.** La capture réelle génère un test qui
reproduit le bug trois fois puis passe trois fois sur la variante corrigée,
sans modifier la source ni l'oracle. Cette acceptation est automatisée dans
`apps/workbench/e2e/pipeline.test.ts` et exécutée par `pnpm test:pipeline`.

## M1 — Capture livrée

- [x] Workspace strict, contrats Zod, CI Node 24 / 26.
- [x] Boutique synthétique, état initial reproductible, mode corrigé.
- [x] Recorder Chromium manuel, événements ordonnés, masquage avant export.
- [x] Marqueur cassé et confirmation explicite de `/checkout`.
- [x] Tests navigateur de capture, confidentialité et annulation.

## M2 — Reconstruction livrée pour la fixture

- [x] Actions ordonnées et liens vers les événements sources.
- [x] Saisies contiguës et submit dédoublonné, navigation observée conservée.
- [x] Rejet des captures incomplètes, valeurs finales masquées et cibles inconnues.
- [x] Aucun fournisseur LLM requis.

## M3 — Génération livrée

- [x] Test Playwright ESM lisible, téléchargeable, source déterministe.
- [x] Oracle confirmé conservé ; fixture et viewport explicites.
- [x] Hash du fichier conservé pour chaque exécution.

## M4 — Runner livré

- [x] Docker non root, filesystem readonly, sans volumes hôte ni réseau externe.
- [x] Limites de durée, mémoire, CPU, processus, tmpfs et sorties.
- [x] Reporter à preuves structurées expurgées ; annulation et nettoyage.
- [x] Tests effectifs du refus d'écriture et d'accès réseau.

## M5 — Validation livrée

- [x] Distinction bug, réussite, génération, infrastructure et non-conclusion.
- [x] Décomptes observés ; variabilité uniquement dans des runs comparables.
- [x] Acceptation centrale : même test rouge sur bug, vert après correction.

## M6 — Interface locale livrée

- [x] Projet Demo Shop, capture manuelle, démo automatisée et import JSON.
- [x] Historique persistant, rapport détaillé, téléchargement test/trace/preuves.
- [x] Relance, annulation et rapport HTML autonome.
- [x] Vérifications navigateur aux formats ordinateur et mobile.

## Prochaine étape après ce POC

Choisir une deuxième application synthétique pour définir une politique de
capture configurable, des sélecteurs sémantiques et un contrat de fixtures plus
générique. Étendre la preuve avant d'introduire une orchestration distante.

Restent hors du MVP local : applications arbitraires, comptes et projets multiples,
LLM, réparation automatique, screenshots/traces Playwright de pages utilisateur,
intégrations GitHub (V1.5), import de sessions tierces et correction automatique.
