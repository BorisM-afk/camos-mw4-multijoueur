<?php
// Emplacement de la base SQLite.
// Par défaut : dossier "camos-data" À CÔTÉ du dossier web (hors de www), donc
// inaccessible aux visiteurs. Sur alwaysdata : /home/TONCOMPTE/camos-data/camos.db
$racine = $_SERVER['DOCUMENT_ROOT'] ?? '';
define('DB_PATH', $racine !== '' ? dirname(rtrim($racine, '/\\')) . '/camos-data/camos.db' : __DIR__ . '/data/camos.db');

// Anti force brute (fenêtre glissante de 15 minutes)
const ECHECS_PAR_IP = 8;           // mauvais mots de passe par adresse IP
const ECHECS_PAR_PSEUDO = 10;      // mauvais mots de passe sur un même pseudo (toutes IP)
const FENETRE_ECHECS = 900;
// Anti spam de comptes
const INSCRIPTIONS_PAR_IP = 5;     // comptes créés par IP...
const FENETRE_INSCRIPTIONS = 3600; // ...par heure
