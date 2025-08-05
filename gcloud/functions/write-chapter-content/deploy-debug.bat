@echo off
echo Desplegando write-chapter-content con diagnóstico completo...

REM Verificar que estamos en el directorio correcto
if not exist "index.js" (
    echo ERROR: No se encuentra index.js en el directorio actual
    echo Asegurate de ejecutar este script desde el directorio write-chapter-content
    pause
    exit /b 1
)

echo.
echo === INFORMACIÓN DE DIAGNÓSTICO ===
echo Directorio actual: %CD%
echo.
echo Archivos en el directorio:
dir /b
echo.
echo Verificando gcloud...
gcloud --version
echo.
echo Proyecto actual de gcloud:
gcloud config get-value project
echo.
echo === INICIANDO DESPLIEGUE ===
echo.

REM Desplegar con logging detallado
gcloud functions deploy write-chapter-content ^
    --runtime=nodejs20 ^
    --trigger-http ^
    --allow-unauthenticated ^
    --entry-point=write-chapter-content ^
    --memory=4GiB ^
    --timeout=540s ^
    --region=europe-west1 ^
    --set-env-vars="SUPABASE_URL=%SUPABASE_URL%,SUPABASE_SERVICE_ROLE_KEY=%SUPABASE_SERVICE_ROLE_KEY%" ^
    --max-instances=10 ^
    --verbosity=debug

echo.
echo === VERIFICACIÓN POST-DESPLIEGUE ===
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Despliegue completado exitosamente!
    echo.
    echo Información de la función:
    gcloud functions describe write-chapter-content --region=europe-west1
    echo.
    echo URL de la función:
    gcloud functions describe write-chapter-content --region=europe-west1 --format="value(httpsTrigger.url)"
    echo.
    echo Logs recientes:
    gcloud functions logs read write-chapter-content --region=europe-west1 --limit=10
) else (
    echo.
    echo ❌ Error en el despliegue. 
    echo.
    echo Logs de error:
    gcloud functions logs read write-chapter-content --region=europe-west1 --limit=20
    echo.
)

pause
