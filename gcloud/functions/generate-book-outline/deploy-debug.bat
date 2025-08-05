@echo off
echo Desplegando generate-book-outline con diagnóstico completo...

REM Verificar que estamos en el directorio correcto
if not exist "index.js" (
    echo ERROR: No se encuentra index.js en el directorio actual
    echo Asegurate de ejecutar este script desde el directorio generate-book-outline
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
echo === INICIANDO DESPLIEGUE CON DEBUG ===
echo Configuración para libros grandes:
echo - Memoria: 8GiB (necesaria para 150+ capítulos)
echo - Timeout: 900s (15 minutos)
echo - Max Instancias: 5 (control de concurrencia)
echo.

REM Desplegar con logging detallado
gcloud functions deploy generate-book-outline ^
    --runtime=nodejs20 ^
    --trigger-http ^
    --allow-unauthenticated ^
    --entry-point=generate-book-outline ^
    --memory=8GiB ^
    --timeout=900s ^
    --region=europe-west1 ^
    --set-env-vars="SUPABASE_URL=%SUPABASE_URL%,SUPABASE_SERVICE_ROLE_KEY=%SUPABASE_SERVICE_ROLE_KEY%,GCLOUD_FUNCTION_URL=https://europe-west1-export-document-project.cloudfunctions.net" ^
    --max-instances=5 ^
    --verbosity=debug

echo.
echo === VERIFICACIÓN POST-DESPLIEGUE ===
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Despliegue completado exitosamente!
    echo.
    echo Información de la función:
    gcloud functions describe generate-book-outline --region=europe-west1
    echo.
    echo URL de la función:
    gcloud functions describe generate-book-outline --region=europe-west1 --format="value(httpsTrigger.url)"
    echo.
    echo Logs recientes:
    gcloud functions logs read generate-book-outline --region=europe-west1 --limit=10
    echo.
    echo === PRUEBA DE CONECTIVIDAD ===
    echo Probando conectividad con Supabase...
    echo URL: %SUPABASE_URL%
    echo.
) else (
    echo.
    echo ❌ Error en el despliegue. 
    echo.
    echo Logs de error:
    gcloud functions logs read generate-book-outline --region=europe-west1 --limit=20
    echo.
    echo === DIAGNÓSTICO DE ERRORES ===
    echo 1. Verifica que las variables de entorno estén configuradas
    echo 2. Verifica que el proyecto de gcloud sea correcto
    echo 3. Verifica que tengas permisos para desplegar funciones
    echo.
)

pause
