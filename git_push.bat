@echo off
git rm --cached scratch/check_duplicates.js
del /f /q scratch\check_duplicates.js
call npm run build
git add src/modules/guard.js src/modules/admin.js src/modules/master.js src/main.js git_push.bat
git commit -m "fix(guard/admin): protect customFields against null config, replace all remaining alerts, and remove duplicate resident debug script"
git push
