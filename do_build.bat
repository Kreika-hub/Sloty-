cd /D c:\Users\HP\Desktop\Sloty\Sloty-
call npm run build
git add .
git commit -m "fix(guard): fix processExit schema and tracing"
git push
git log -1 --format=%%H > commit_hash.txt
