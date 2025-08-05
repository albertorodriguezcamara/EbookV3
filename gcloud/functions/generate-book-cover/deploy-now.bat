@echo off
echo Desplegando generate-book-cover con soporte para Recraft...

gcloud functions deploy generate-book-cover --runtime=nodejs20 --trigger-http --allow-unauthenticated --entry-point=generateBookCover --memory=4GiB --timeout=540s --region=europe-west1 --max-instances=3 --set-env-vars="SUPABASE_URL=https://ydorhokujupnxpyrxczv.supabase.co,SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkb3Job2t1anVwbnhweXJ4Y3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDEzMTA0MCwiZXhwIjoyMDU1NzA3MDQwfQ.PW51n-DXxQ9h7xONqIZXmPgryG09tHoVNk8Tw7msEps"

echo Despliegue completado.
