# Camos MW4 – mise en ligne sur alwaysdata

Remplace TONCOMPTE par le nom de ton compte alwaysdata partout ci-dessous.

## 1. Préparer le compte (admin.alwaysdata.com)
- **Environnement > PHP** : PHP 8.1 ou plus récent.
- **Accès distant > SSH/SFTP** : modifie ton utilisateur et coche « Activer la
  connexion par mot de passe » (le temps de l'envoi, voir Sécurité).
- Rien à créer dans « Bases de données » : le site utilise SQLite, un fichier
  `camos.db` créé automatiquement.

## 2. Envoyer les fichiers (FileZilla)
- SFTP · Hôte `ssh-TONCOMPTE.alwaysdata.net` · Port 22 · Utilisateur `TONCOMPTE`
- Active « Serveur > Forcer l'affichage des fichiers cachés » (pour `.htaccess`).
- Copie le **contenu** du dossier `camos-mw4` dans `/home/TONCOMPTE/www/`.

## 3. Ouvrir le site
https://TONCOMPTE.alwaysdata.net → crée ton compte joueur.
La base est créée dans `/home/TONCOMPTE/camos-data/camos.db`, hors de `www`.

---

# Sécurité

## Ce qui est déjà en place dans les fichiers
| Protection | Contre quoi |
|---|---|
| Mots de passe hachés (`password_hash`, bcrypt) | Vol de la base : les mots de passe restent illisibles |
| Base hors du dossier web, fichier en 0600 | Téléchargement de la base par un visiteur |
| Requêtes SQL préparées | Injection SQL |
| Jeton anti-CSRF + vérification de l'origine | Un autre site qui agirait à la place du joueur |
| Cookie de session `HttpOnly`, `Secure`, `SameSite=Strict`, préfixe `__Host-` | Vol ou détournement de session |
| `session.use_strict_mode`, nouvel ID à chaque connexion | Fixation de session |
| 8 échecs max par IP et 10 par pseudo sur 15 min | Force brute sur les mots de passe |
| 5 inscriptions max par IP et par heure | Spam de faux comptes |
| Temps de réponse identique pour un pseudo inconnu | Deviner quels pseudos existent |
| Content-Security-Policy stricte (aucun script inline) | Injection de scripts (XSS) |
| HSTS, X-Frame-Options, nosniff, Referrer-Policy | Rétrogradation en HTTP, clickjacking |
| `.htaccess` qui bloque `config.php`, `.sql`, `.db`, `.md`, fichiers cachés, listing | Lecture de fichiers internes |
| Erreurs PHP jamais affichées aux visiteurs | Fuite d'informations techniques |
| Corps de requête limité à 8 Ko, 1000 camos max par joueur | Abus / remplissage de la base |

## Ce que tu dois faire côté alwaysdata
1. **Forcer le HTTPS** : Web > Sites > modifier ton site > coche
   « Forcer HTTPS ». Sans HTTPS les mots de passe circulent en clair.
2. **Double authentification** sur ton compte alwaysdata (Profil > Sécurité).
   C'est la porte d'entrée de tout le site.
3. **SFTP** : après l'envoi des fichiers, décoche « connexion par mot de passe »
   et utilise une clé SSH (FileZilla la gère), ou garde un mot de passe long et
   unique.
4. **PHP à jour** : repasse sur la dernière version proposée de temps en temps.
5. **Sauvegardes** : alwaysdata sauvegarde ton compte chaque jour ; télécharge
   aussi `camos-data/camos.db` de temps en temps.
6. Ne mets jamais `camos.db` ni une copie de sauvegarde dans `www/`.

## Vérifier que tout est bien protégé
- https://TONCOMPTE.alwaysdata.net/schema.sql → doit afficher **403**.
- https://TONCOMPTE.alwaysdata.net/config.php → **403**.
- https://securityheaders.com avec l'adresse du site → note A attendue.

## Mot de passe oublié
Pas d'e-mail : à la création du compte, chaque joueur reçoit un **code de
secours** (XXXX-XXXX-XXXX-XXXX), affiché une seule fois. Avec son pseudo et ce
code, il choisit un nouveau mot de passe via « Mot de passe oublié ? ». Le code
est alors remplacé par un nouveau (un code ne sert qu'une fois) et ses autres
appareils sont déconnectés. Depuis « Mon compte », un joueur peut changer son
mot de passe ou générer un nouveau code.

Si un joueur a perdu mot de passe ET code, toi seul peux l'aider : supprime son
compte dans `camos.db` (DB Browser for SQLite, table `utilisateurs`) pour qu'il
le recrée.

## Repartir de zéro (vider tous les comptes)
Dans FileZilla, supprime le dossier `/home/TONCOMPTE/camos-data/` en entier.
Il est recréé vide à la prochaine inscription. Tous les comptes et toutes les
progressions sont effacés définitivement.

## Mettre à jour le site plus tard
Nouveaux camos : remplace `assets/camos-data.js`. Ne supprime jamais
`/home/TONCOMPTE/camos-data/` : c'est la progression de tous les joueurs.

## Tester en local
`LANCER-EN-LOCAL.bat` (PHP requis). En local, PHP n'applique pas le
`.htaccess` : c'est normal que `schema.sql` y soit lisible.
