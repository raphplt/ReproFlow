# RTK — proxy de commandes optionnel

RTK peut réduire la sortie des commandes de développement. Il ne constitue pas
une dépendance du projet, des tests ou de la CI.

Avant utilisation, vérifier `command -v rtk`, puis `rtk --version` et `rtk gain`.
Si le binaire est absent, utiliser directement les commandes ordinaires :
`git status`, `pnpm check`, etc. Ne pas installer ni modifier les hooks globaux
pour pouvoir travailler sur ce dépôt.

Si des hooks Claude Code réécrivent déjà les commandes vers RTK, éviter le double
préfixage. Le dépôt ne configure pas de hook RTK supplémentaire.

Commandes de diagnostic RTK :

```sh
rtk gain
rtk gain --history
rtk discover
rtk proxy <commande>
```

Conserver les codes de sortie et consulter la sortie complète lorsqu'une erreur
est tronquée ; une sortie résumée ne remplace pas la vérification des résultats.
