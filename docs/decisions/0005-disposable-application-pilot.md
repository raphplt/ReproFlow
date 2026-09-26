# 0005 - Application cible jetable

Statut : accepté, 26 septembre 2026.

## Contexte

Le pilote composant prouve un défaut de rendu mais ignore le parent réel,
la navigation Next et l'API. Utiliser le PostgreSQL de développement TCG ou ses
secrets rendrait les résultats risqués et non reproductibles.

## Décision

Construire une image locale à partir d'un snapshot Git filtré d'un checkout de
confiance. Inclure les vrais builds Next/Nest et un PostgreSQL initialisé dans
un tmpfs à chaque exécution. Exécuter tout le parcours dans un unique conteneur
sans réseau externe, ports publiés, volumes hôte ou secrets utilisateur.

L'adaptateur TCG est fixe dans l'image. Le scénario déclaratif n'accepte pas de
commande de démarrage. Le runner vérifie la source canonique et épingle l'image
par son identité immuable. Seul le composant historique varie entre les builds,
pas l'ensemble du dépôt : la comparaison ne prétend pas reconstruire une version
historique complète de TCG.

Ajouter au contrat `application-value` des préconditions explicites : réponse
API initiale, cible visible, réponse filtrée et navigation attendue. Un oracle
rouge sans ces preuves n'est pas une reproduction validée.

## Conséquences

Le pilote valide le parcours réel des filtres avec des données synthétiques et
un test inchangé entre variantes. Le build est plus lourd et nécessite Internet,
mais capture et rejeu restent bornés et sans réseau externe. L'image contient
du code privé et des dépendances de développement : elle reste locale, n'est
pas une image de production ni une solution de build de code non fiable.

La capture manuelle, le workbench et les applications arbitraires restent des
travaux distincts. Aucun push TCG n'est permis. Voir le
[guide du pilote](../tcg-nexus-stack-pilot.md).
