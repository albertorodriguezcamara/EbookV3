# Script para llamar manualmente a generate-book-outline
# Creado para reiniciar el job de "Daily Grace" que falló por API sobrecargada

Write-Host "🚀 INICIANDO GENERACIÓN DE ESQUEMA" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan

# Configuración
$url = "https://europe-west1-export-document-project.cloudfunctions.net/generate-book-outline"
$bookId = "1c2c7a69-38f4-4ded-b02d-dfe462caec24"
$jobId = "0d977792-2f9a-4ab1-a415-61484efef236"

$body = @{
    book_id = $bookId
    job_id = $jobId
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
}

Write-Host "📖 Libro: Daily Grace: A 2025 Devotional for Reflection and Spiritual Growth" -ForegroundColor Yellow
Write-Host "👤 Autor: J.D. Shepherd" -ForegroundColor Yellow
Write-Host "🔄 Job ID: $jobId" -ForegroundColor Yellow
Write-Host "🌐 URL: $url" -ForegroundColor Gray
Write-Host ""

Write-Host "⏳ Enviando solicitud..." -ForegroundColor White

try {
    # Realizar la llamada HTTP
    $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -Headers $headers -TimeoutSec 300
    
    Write-Host "✅ RESPUESTA EXITOSA" -ForegroundColor Green
    Write-Host "=" * 30 -ForegroundColor Green
    
    # Mostrar respuesta formateada
    if ($response) {
        $response | ConvertTo-Json -Depth 3 | Write-Host -ForegroundColor White
    } else {
        Write-Host "Respuesta vacía (esto puede ser normal)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "🎉 El proceso ha comenzado exitosamente!" -ForegroundColor Green
    Write-Host "💡 Puedes monitorear el progreso en la base de datos:" -ForegroundColor Cyan
    Write-Host "   SELECT status, status_message, progress_percentage FROM jobs WHERE id = '$jobId';" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ ERROR EN LA SOLICITUD" -ForegroundColor Red
    Write-Host "=" * 30 -ForegroundColor Red
    
    Write-Host "Mensaje de error: $($_.Exception.Message)" -ForegroundColor Red
    
    # Intentar obtener más detalles del error
    if ($_.Exception.Response) {
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Detalles del servidor:" -ForegroundColor Yellow
            Write-Host $responseBody -ForegroundColor White
        } catch {
            Write-Host "No se pudieron obtener detalles adicionales del error" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "💡 Posibles soluciones:" -ForegroundColor Cyan
    Write-Host "1. Verificar que la función esté desplegada correctamente" -ForegroundColor Gray
    Write-Host "2. Comprobar la conectividad a internet" -ForegroundColor Gray
    Write-Host "3. Intentar nuevamente en unos minutos" -ForegroundColor Gray
}

Write-Host ""
Write-Host "🏁 Script completado" -ForegroundColor Cyan
Write-Host "Presiona cualquier tecla para continuar..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
