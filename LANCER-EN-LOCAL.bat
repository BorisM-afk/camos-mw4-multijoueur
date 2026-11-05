@echo off
cd /d "%~dp0"
where php >nul 2>nul
if errorlevel 1 (
  echo PHP est introuvable. Voir LISEZMOI.md
  pause
  exit /b
)
echo Site lance en local sur http://localhost:8765  -  ferme cette fenetre pour l arreter.
start "" http://localhost:8765
php -S localhost:8765
