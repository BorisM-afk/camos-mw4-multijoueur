<?php
// API du tracker : comptes joueurs + sauvegarde de la progression
declare(strict_types=1);
require __DIR__ . '/config.php';

ini_set('display_errors', '0');           // jamais de détails d'erreur aux visiteurs
ini_set('session.use_strict_mode', '1');  // refuse les identifiants de session inventés
ini_set('session.use_only_cookies', '1');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name($https ? '__Host-camos' : 'camos_mw4');
session_set_cookie_params(['lifetime' => 60 * 60 * 24 * 30, 'path' => '/', 'httponly' => true, 'secure' => $https, 'samesite' => 'Strict']);
session_start();

function reponse(array $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function erreur(string $msg, int $code = 400): never { reponse(['ok' => false, 'error' => $msg], $code); }

function db(): PDO {
    static $db = null;
    if ($db) return $db;
    $dir = dirname(DB_PATH);
    if (!is_dir($dir)) mkdir($dir, 0700, true);
    $nouvelle = !file_exists(DB_PATH);
    $db = new PDO('sqlite:' . DB_PATH);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    $db->exec(file_get_contents(__DIR__ . '/schema.sql'));
    // Mise à niveau d'une base créée par une version précédente du site
    $cols = array_column($db->query('PRAGMA table_info(utilisateurs)')->fetchAll(PDO::FETCH_ASSOC), 'name');
    if (!in_array('code_hash', $cols, true)) $db->exec('ALTER TABLE utilisateurs ADD COLUMN code_hash TEXT');
    if (!in_array('version', $cols, true)) $db->exec('ALTER TABLE utilisateurs ADD COLUMN version INTEGER NOT NULL DEFAULT 0');
    if ($nouvelle) @chmod(DB_PATH, 0600);
    return $db;
}

function csrf(): string {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}

function utilisateur(): ?array {
    if (empty($_SESSION['uid'])) return null;
    $st = db()->prepare('SELECT id, pseudo, mdp_hash, code_hash, version FROM utilisateurs WHERE id = ?');
    $st->execute([$_SESSION['uid']]);
    $u = $st->fetch(PDO::FETCH_ASSOC);
    // Compte supprimé ou mot de passe changé ailleurs : cette session n'est plus valable
    if (!$u || (int)$u['version'] !== (int)($_SESSION['ver'] ?? -1)) { unset($_SESSION['uid'], $_SESSION['ver']); return null; }
    return $u;
}

function progression(int $uid): object {
    $st = db()->prepare('SELECT cle, debloque_le FROM progression WHERE utilisateur_id = ?');
    $st->execute([$uid]);
    return (object)$st->fetchAll(PDO::FETCH_KEY_PAIR);
}

function etat(): array {
    $u = utilisateur();
    return ['ok' => true, 'csrf' => csrf(), 'user' => $u ? $u['pseudo'] : null, 'has_code' => $u ? !empty($u['code_hash']) : null,
            'checked' => $u ? progression((int)$u['id']) : (object)[]];
}

function ip(): string { return $_SERVER['REMOTE_ADDR'] ?? '?'; }

function compter(string $type, string $champ, string $valeur, int $fenetre): int {
    $st = db()->prepare("SELECT COUNT(*) FROM evenements WHERE type = ? AND $champ = ? AND quand >= ?");
    $st->execute([$type, $valeur, time() - $fenetre]);
    return (int)$st->fetchColumn();
}
function noter(string $type, string $pseudo = ''): void {
    db()->prepare('INSERT INTO evenements (type, ip, pseudo, quand) VALUES (?, ?, ?, ?)')->execute([$type, ip(), strtolower($pseudo), time()]);
}
function nettoyer(): void {
    if (random_int(1, 20) === 1) db()->prepare('DELETE FROM evenements WHERE quand < ?')->execute([time() - 86400]);
}

function connecter(int $uid): void {
    $st = db()->prepare('SELECT version FROM utilisateurs WHERE id = ?');
    $st->execute([$uid]);
    session_regenerate_id(true);
    $_SESSION['uid'] = $uid;
    $_SESSION['ver'] = (int)$st->fetchColumn();
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

// Code de secours : 16 caractères sans lettres ambiguës (pas de 0/O, 1/I/L), affiché XXXX-XXXX-XXXX-XXXX
function nouveau_code(): string {
    $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    $c = '';
    for ($i = 0; $i < 16; $i++) $c .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    return implode('-', str_split($c, 4));
}
function normaliser_code(string $c): string { return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $c)); }
function enregistrer_code(int $uid): string {
    $code = nouveau_code();
    db()->prepare('UPDATE utilisateurs SET code_hash = ? WHERE id = ?')->execute([password_hash(normaliser_code($code), PASSWORD_DEFAULT), $uid]);
    return $code;
}
function verifier_mdp_neuf(string $mdp, string $pseudo): void {
    if (strlen($mdp) < 8) erreur('Le mot de passe doit faire au moins 8 caractères.');
    if (strlen($mdp) > 200) erreur('Mot de passe trop long.');
    if (strcasecmp($mdp, $pseudo) === 0) erreur('Le mot de passe ne doit pas être ton pseudo.');
}
// Change le mot de passe et déconnecte toutes les autres sessions du compte
function changer_mdp(int $uid, string $mdp): void {
    db()->prepare('UPDATE utilisateurs SET mdp_hash = ?, version = version + 1 WHERE id = ?')->execute([password_hash($mdp, PASSWORD_DEFAULT), $uid]);
}
const HASH_FACTICE = '$2y$10$TOOPtU8Qo0HkRizHdv8tx.pxj4xGW./c8RBv16XWtl0sM/Y7R4ymW';

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') reponse(etat());
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') erreur('Méthode non autorisée', 405);

    // 1) La requête doit venir de ce site (en-tête Origin envoyé par les navigateurs)
    $origine = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origine !== '' && parse_url($origine, PHP_URL_HOST) !== parse_url('//' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST)) {
        erreur('Origine refusée.', 403);
    }
    // 2) Jeton anti-CSRF lié à la session
    if (!hash_equals(csrf(), (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) erreur('Session expirée, recharge la page.', 403);
    // 3) Corps JSON de taille raisonnable
    $brut = file_get_contents('php://input', false, null, 0, 8192);
    $in = json_decode((string)$brut, true);
    if (!is_array($in)) erreur('Requête invalide.');
    $action = (string)($in['action'] ?? '');
    nettoyer();

    switch ($action) {
        case 'register': {
            $pseudo = trim((string)($in['pseudo'] ?? ''));
            $mdp = (string)($in['mdp'] ?? '');
            if (!preg_match('/^[A-Za-z0-9_.-]{3,20}$/', $pseudo)) erreur('Pseudo : 3 à 20 caractères (lettres, chiffres, _ . -).');
            verifier_mdp_neuf($mdp, $pseudo);
            if (compter('inscription', 'ip', ip(), FENETRE_INSCRIPTIONS) >= INSCRIPTIONS_PAR_IP) erreur('Trop de comptes créés depuis ta connexion, réessaie plus tard.', 429);
            try {
                db()->prepare('INSERT INTO utilisateurs (pseudo, mdp_hash, cree_le) VALUES (?, ?, ?)')
                    ->execute([$pseudo, password_hash($mdp, PASSWORD_DEFAULT), date('c')]);
            } catch (PDOException $e) {
                erreur('Ce pseudo est déjà pris.', 409);
            }
            noter('inscription', $pseudo);
            $uid = (int)db()->lastInsertId();
            $code = enregistrer_code($uid);
            connecter($uid);
            reponse(etat() + ['recovery_code' => $code]);
        }
        case 'login': {
            $pseudo = trim((string)($in['pseudo'] ?? ''));
            $mdp = (string)($in['mdp'] ?? '');
            if (compter('echec', 'ip', ip(), FENETRE_ECHECS) >= ECHECS_PAR_IP
                || compter('echec', 'pseudo', strtolower($pseudo), FENETRE_ECHECS) >= ECHECS_PAR_PSEUDO) {
                erreur('Trop de tentatives, réessaie dans 15 minutes.', 429);
            }
            $st = db()->prepare('SELECT id, mdp_hash FROM utilisateurs WHERE pseudo = ?');
            $st->execute([$pseudo]);
            $u = $st->fetch(PDO::FETCH_ASSOC);
            // Vérifie toujours un hash (même factice) pour ne pas révéler si le pseudo existe par le temps de réponse
            $hash = $u['mdp_hash'] ?? HASH_FACTICE;
            if (!password_verify($mdp, $hash) || !$u) {
                noter('echec', $pseudo);
                erreur('Pseudo ou mot de passe incorrect.', 401);
            }
            if (password_needs_rehash($u['mdp_hash'], PASSWORD_DEFAULT)) {
                db()->prepare('UPDATE utilisateurs SET mdp_hash = ? WHERE id = ?')->execute([password_hash($mdp, PASSWORD_DEFAULT), $u['id']]);
            }
            connecter((int)$u['id']);
            reponse(etat());
        }
        case 'recover': {
            // Mot de passe oublié : pseudo + code de secours + nouveau mot de passe
            $pseudo = trim((string)($in['pseudo'] ?? ''));
            $code = normaliser_code((string)($in['code'] ?? ''));
            $mdp = (string)($in['mdp'] ?? '');
            if (compter('secours', 'ip', ip(), FENETRE_ECHECS) >= ECHECS_PAR_IP
                || compter('secours', 'pseudo', strtolower($pseudo), FENETRE_ECHECS) >= ECHECS_PAR_PSEUDO) {
                erreur('Trop de tentatives, réessaie dans 15 minutes.', 429);
            }
            $st = db()->prepare('SELECT id, pseudo, code_hash FROM utilisateurs WHERE pseudo = ?');
            $st->execute([$pseudo]);
            $u = $st->fetch(PDO::FETCH_ASSOC);
            $hash = ($u && $u['code_hash']) ? $u['code_hash'] : HASH_FACTICE;
            if (strlen($code) !== 16 || !password_verify($code, $hash) || !$u || !$u['code_hash']) {
                noter('secours', $pseudo);
                erreur('Pseudo ou code de secours incorrect.', 401);
            }
            verifier_mdp_neuf($mdp, $u['pseudo']);
            $uid = (int)$u['id'];
            changer_mdp($uid, $mdp);
            $nouveau = enregistrer_code($uid);   // un code ne sert qu'une fois
            connecter($uid);
            reponse(etat() + ['recovery_code' => $nouveau]);
        }
        case 'logout': {
            $_SESSION = [];
            session_regenerate_id(true);
            reponse(etat());
        }
    }

    // Actions réservées aux joueurs connectés
    $u = utilisateur();
    if (!$u) erreur('Connecte-toi pour enregistrer ta progression.', 401);
    $uid = (int)$u['id'];

    switch ($action) {
        case 'set': {
            $arme = trim((string)($in['arme'] ?? ''));
            $camo = trim((string)($in['camo'] ?? ''));
            if ($arme === '' || $camo === '' || strlen($arme) > 120 || strlen($camo) > 120) erreur('Arme ou camo invalide.');
            $cle = $arme . '|' . $camo;
            if (!empty($in['done'])) {
                $st = db()->prepare('SELECT COUNT(*) FROM progression WHERE utilisateur_id = ?');
                $st->execute([$uid]);
                if ((int)$st->fetchColumn() >= 1000) erreur('Limite atteinte.', 429);
                $date = date('c');
                db()->prepare('INSERT OR REPLACE INTO progression (utilisateur_id, cle, arme, camo, debloque_le) VALUES (?, ?, ?, ?, ?)')
                    ->execute([$uid, $cle, $arme, $camo, $date]);
                reponse(['ok' => true, 'cle' => $cle, 'debloque_le' => $date]);
            }
            db()->prepare('DELETE FROM progression WHERE utilisateur_id = ? AND cle = ?')->execute([$uid, $cle]);
            reponse(['ok' => true, 'cle' => $cle]);
        }
        case 'reset': {
            db()->prepare('DELETE FROM progression WHERE utilisateur_id = ?')->execute([$uid]);
            reponse(['ok' => true]);
        }
        case 'change_password': {
            if (!password_verify((string)($in['actuel'] ?? ''), $u['mdp_hash'])) { noter('echec', $u['pseudo']); erreur('Mot de passe actuel incorrect.', 401); }
            $mdp = (string)($in['mdp'] ?? '');
            verifier_mdp_neuf($mdp, $u['pseudo']);
            changer_mdp($uid, $mdp);
            connecter($uid);                  // garde CETTE session, coupe les autres
            reponse(etat());
        }
        case 'new_code': {
            if (!password_verify((string)($in['actuel'] ?? ''), $u['mdp_hash'])) { noter('echec', $u['pseudo']); erreur('Mot de passe actuel incorrect.', 401); }
            reponse(etat() + ['recovery_code' => enregistrer_code($uid)]);
        }
    }
    erreur('Action inconnue.');
} catch (Throwable $e) {
    error_log('camos-mw4: ' . $e->getMessage());
    erreur('Erreur du serveur.', 500);
}
