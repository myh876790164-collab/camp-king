@echo off
rem Camp King - offline launcher: opens the game in an Edge app window (no address bar).
rem Saves are kept by Edge for this folder. Do not move the folder after you start playing,
rem or use "export save" in Settings first.
setlocal
set "P=%~dp0index.html"
set "U=file:///%P:\=/%"
start "" msedge --app="%U%" --window-size=1280,800 2>nul
if errorlevel 1 start "" "%P%"
endlocal
