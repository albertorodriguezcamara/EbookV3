@echo off
echo ========================================
echo REESCRIBIR CAPITULOS CON CONTENIDO CORTADO
echo ========================================
echo.
echo Libro: Daily Grace
echo Total de capitulos a reescribir: 17
echo.
echo NOTA: Estos capitulos tienen contenido incompleto o cortado
echo y necesitan ser regenerados completamente.
echo.
echo Iniciando reescritura de capitulos cortados...
echo.

echo Reescribiendo capitulo 133 (The Good Soil of a Teachable Heart) - 111 chars...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"92cca627-2668-4631-8961-ee05a3ed60eb\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Reescribiendo capitulo 2 (The Unshakeable Foundation) - 265 chars...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"d38f4404-e402-424f-8d33-2cf405cdd972\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Reescribiendo capitulo 273 (Redeeming the Time) - 694 chars...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"34340fdd-271a-4f39-bc94-cbbd1ffe7e4a\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Reescribiendo capitulo 326 (A Heavenly Peace for Earthly Chaos) - 869 chars...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"a596e14d-d9e6-497d-9016-5b59b4a357eb\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Reescribiendo capitulo 65 (The Next Right Step) - 940 chars...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"f59db1de-6842-407a-96fc-88c434b4f23a\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Reescribiendo capitulo 141 (The Cords of Fellowship) - 942 chars...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"138992bd-2b09-4b93-9812-0a9635747433\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Reescribiendo capitulo 42 (Cultivating a Teachable Spirit) - 1113 chars...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"49edbb87-9437-4b7b-96fa-07f89b1db335\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Reescribiendo capitulo 9 (The Ripple Effect of Grace) - 1153 chars...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"e659abb5-685d-473b-9957-85e3bc362cbd\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Reescribiendo capitulo 138 (Watering Your Soul with the Word) - 1557 chars...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"f1032bde-807c-4ca0-a9f8-0aa9ca9c8adf\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Reescribiendo capitulo 160 (Speaking Words of Life) - 1584 chars...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"5d9c8176-cb45-483e-a63c-5b6914feb814\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Reescribiendo capitulo 8 (Just Start Talking) - 1642 chars...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"b82fceff-e243-4add-b3bd-a6feafc6ce71\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Reescribiendo capitulo 80 (The Audacity of Asking) - 1726 chars...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"83cb683b-3818-4cf7-a466-e790890b2a9b\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Reescribiendo capitulo 106 (Breaking the Old Chains) - 1795 chars...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"fa7248ba-0d9a-434e-adc4-81caf886c639\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Reescribiendo capitulo 66 (The Purpose in Pruning) - 1867 chars...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"a95064dd-65c6-461f-8019-b3a6c4a2ae94\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Reescribiendo capitulo 45 (The Power of a Gentle Answer) - 1909 chars...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"27949a2f-2174-49d5-907b-5b9723bc7001\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Reescribiendo capitulo 72 (The Discipline of Silence) - 1956 chars...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"32f119a3-7f3b-4626-966f-eb6b6685d12c\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Reescribiendo capitulo 136 (The Strength of a Gentle Spirit) - 1980 chars...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"7fc7a4a3-02b5-43ba-83ae-f1f849b6bb0d\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo.
echo ========================================
echo REESCRITURA COMPLETADA
echo ========================================
echo.
echo Se han enviado 17 solicitudes de reescritura
echo Los capitulos seran regenerados con contenido completo
echo.
echo CAPITULOS REESCRITOS:
echo - Cap 133: The Good Soil of a Teachable Heart (111 -> ~6000 chars)
echo - Cap 2: The Unshakeable Foundation (265 -> ~6000 chars)  
echo - Cap 273: Redeeming the Time (694 -> ~6000 chars)
echo - Cap 326: A Heavenly Peace for Earthly Chaos (869 -> ~6000 chars)
echo - Y 13 capitulos adicionales con contenido cortado
echo.
echo Verifica el progreso en la base de datos en unos minutos.
echo.
pause
