@echo off
echo ================================================
echo  Installation BOT IMAGES BIGBUY
echo ================================================
echo.
echo [1/2] Installation des librairies Python...
pip install -r requirements.txt
echo.
echo [2/2] Installation du navigateur Chromium...
playwright install chromium
echo.
echo ================================================
echo  Installation terminee !
echo  Placez votre Excel dans : input\produits.xlsx
echo  Puis lancez : run.bat
echo ================================================
pause
