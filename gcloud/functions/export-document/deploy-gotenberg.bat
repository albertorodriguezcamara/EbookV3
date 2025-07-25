@echo off
echo 🚀 DESPLEGANDO GOTENBERG COMO SERVICIO SEPARADO

echo 📦 Desplegando Gotenberg en Cloud Run...
gcloud run deploy gotenberg ^
  --image=gotenberg/gotenberg:8 ^
  --platform=managed ^
  --region=europe-west1 ^
  --allow-unauthenticated ^
  --memory=2Gi ^
  --cpu=1 ^
  --timeout=300 ^
  --max-instances=10 ^
  --port=3000

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ GOTENBERG DESPLEGADO CON ÉXITO!
    echo.
    echo 🌐 URL del servicio Gotenberg:
    gcloud run services describe gotenberg --region=europe-west1 --platform=managed --format="value(status.url)"
    echo.
    echo 📝 Añade esta URL como variable de entorno GOTENBERG_URL en tu función export-document
) else (
    echo ❌ Error en el despliegue de Gotenberg
    pause
    exit /b 1
)

pause
