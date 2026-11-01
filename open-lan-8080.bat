@echo off
rem Allows other devices on the same network to reach port 8080 on this PC.
rem To undo: netsh advfirewall firewall delete rule name="ZTZ96A LAN 8080"
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
netsh advfirewall firewall delete rule name="ZTZ96A LAN 8080" >nul 2>&1
netsh advfirewall firewall add rule name="ZTZ96A LAN 8080" dir=in action=allow protocol=TCP localport=8080 remoteip=localsubnet profile=any
echo.
echo On the tablet, open: http://192.168.5.20:8080/
pause
