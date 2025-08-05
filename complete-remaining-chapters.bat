@echo off
echo.
echo ========================================
echo  COMPLETAR CAPITULOS RESTANTES - DIRECTO
echo ========================================
echo.
echo Libro: Daily Grace: A 2025 Devotional
echo Estrategia: Procesar capítulos sin contenido individualmente
echo.
echo Capitulos sin contenido identificados:
echo 16, 27, 39, 84, 109, 111, 202, 228, 234, 246, 256, 323, 328, 346
echo.
echo IMPORTANTE: Este script procesara cada capitulo individualmente
echo usando llamadas directas para evitar errores de la función batch
echo.

echo Procesando capitulo 16 (The Strength of Patience)...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"d549f8a0-a8c2-4c0c-9580-a7c017ed6e5f\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Procesando capitulo 27 (Stronger Together)...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"2e41891d-810f-4367-a7c0-90e43804fbfa\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Procesando capitulo 39 (The Wisdom of Listening)...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"697065d9-8b84-4d83-9c3f-f9fd56d69840\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Procesando capitulo 84 (The Purpose in the Pause)...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"73fbc4cc-5dda-4dcd-9dc3-8e3526e5282a\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Procesando capitulo 109 (Unwrapping Your Spiritual Gifts)...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"a14d102c-322e-437f-8e4e-7f88931c2254\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Procesando capitulo 111 (Your Story, His Glory)...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"e4e85f4f-4da7-4a26-a76e-b7bad053f058\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Procesando capitulo 202 (The Peace of Being Fully Known)...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"0c4aeb34-564e-4bd0-9a94-bede5d9b1d5f\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Procesando capitulo 228 (The Shield That Quenches)...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"17904cd4-bba0-4994-bdbe-c0f309121fdc\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Procesando capitulo 234 (A Glory Beyond Compare)...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"bc53a89d-6114-455b-b6b6-283fed08d3a8\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Procesando capitulo 246 (Two Kinds of Wisdom)...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"47190144-3704-4941-b826-939596492834\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Procesando capitulo 256 (A Treasure Beyond Gold)...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"e4c36326-1177-4776-9b45-4b1f85113b82\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Procesando capitulo 323 (The Long-Awaited Dawn)...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"7cf92ed7-ccb4-4cad-9d3c-18ad2a77398a\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Procesando capitulo 328 (The Gift of Smallness)...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"2ff7b928-59d8-4ca2-a89b-5795abf694dc\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo Procesando capitulo 346 (The Unexpected Package)...
curl -X POST "https://europe-west1-export-document-project.cloudfunctions.net/write-chapter-content" ^
-H "Content-Type: application/json" ^
-d "{\"chapter_id\":\"814e3038-13fb-4c4e-9ec1-69f29df54d67\",\"job_id\":\"0d977792-2f9a-4ab1-a415-61484efef236\",\"processing_mode\":\"single\"}" ^
-s -o nul

echo.
echo ========================================
echo  PROCESAMIENTO COMPLETADO
echo ========================================
echo.
echo Todos los 14 capitulos han sido enviados para procesamiento
echo El sistema deberia completar el contenido en los proximos minutos
echo.
echo Para verificar progreso:
echo SELECT COUNT(CASE WHEN content IS NOT NULL AND content != '' THEN 1 END) as con_contenido FROM chapters WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24';
echo.
pause
