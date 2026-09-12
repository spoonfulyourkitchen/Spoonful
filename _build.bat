@echo off
cd /d "C:\Users\salem\Desktop\Spoonful\mobile\android"
set "JAVA_HOME=C:\Java\jdk-17.0.10+7"
call gradlew.bat --console=plain -q assembleRelease bundleRelease > "C:\Users\salem\Desktop\Spoonful\_build.log" 2>&1
