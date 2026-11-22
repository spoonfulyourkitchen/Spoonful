@echo off
REM Spoonful 3.4.0: Release-Build. Nur arm64-v8a + armeabi-v7a (kein x86),
REM KEIN "clean" (das hat in 3.3.3 die Bundles zerschossen), Log in _build.log.
cd /d "D:\Spoonful\mobile\android"
set "JAVA_HOME=C:\Java\jdk-17.0.10+7"
call gradlew.bat --console=plain -PreactNativeArchitectures=arm64-v8a,armeabi-v7a assembleRelease > "D:\Spoonful\_build.log" 2>&1
echo exit=%ERRORLEVEL% >> "D:\Spoonful\_build.log"
