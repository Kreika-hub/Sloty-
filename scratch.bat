@echo off
node src/modules/fix_guard.js
npm run build
git add .
git commit -m "Flujo de visitantes frecuentes con autocompletado interactivo y campos personalizados"
git push
git rev-parse HEAD
