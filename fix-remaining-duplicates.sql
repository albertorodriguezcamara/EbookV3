-- ========================================
-- CORRECCIÓN FINAL DE DUPLICADOS
-- Query corregida para evitar crear nuevos duplicados
-- ========================================

-- PASO 1: Verificar duplicados actuales
SELECT title, array_agg(order_number ORDER BY order_number) as chapters, COUNT(*) as count
FROM chapters 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' 
GROUP BY title 
HAVING COUNT(*) > 1 
ORDER BY count DESC;

-- PASO 2: Corregir "The Sacred Pause" (capítulos 4, 30)
-- Mantener: 4 → "The Sacred Pause"
-- Cambiar: 30 → título único
UPDATE chapters 
SET title = 'The Peaceful Moment' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' AND order_number = 30;

-- PASO 3: Verificar si quedan otros duplicados de la lista original
-- (En caso de que no se hayan aplicado todas las correcciones anteriores)

-- Verificar "The Rhythm of Rest" - capítulo 31
SELECT order_number, title FROM chapters 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' 
AND order_number = 31;

-- Si aún es "The Rhythm of Rest", cambiar:
UPDATE chapters 
SET title = 'The Gentle Stillness' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' 
AND order_number = 31 
AND title = 'The Rhythm of Rest';

-- PASO 4: Aplicar correcciones restantes solo si los títulos aún están duplicados
-- (Usar WHERE con condición del título original para evitar sobrescribir)

-- "Dressed for the Day" → capítulo 38
UPDATE chapters 
SET title = 'Clothed in Purpose' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' 
AND order_number = 38 
AND title = 'Dressed for the Day';

-- "Hope as an Anchor" → capítulo 59
UPDATE chapters 
SET title = 'The Steadfast Foundation' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' 
AND order_number = 59 
AND title = 'Hope as an Anchor';

-- "More Than Conquerors" → capítulo 240
UPDATE chapters 
SET title = 'Victory Through Him' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' 
AND order_number = 240 
AND title = 'More Than Conquerors';

-- "Stronger Together" → capítulo 230
UPDATE chapters 
SET title = 'United in Faith' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' 
AND order_number = 230 
AND title = 'Stronger Together';

-- "The Discipline of Celebration" → capítulo 55
UPDATE chapters 
SET title = 'The Practice of Joy' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' 
AND order_number = 55 
AND title = 'The Discipline of Celebration';

-- "The Freedom of Forgiveness" → capítulo 52
UPDATE chapters 
SET title = 'The Liberation of Grace' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' 
AND order_number = 52 
AND title = 'The Freedom of Forgiveness';

-- "The Sabbath Heart" → capítulo 191
UPDATE chapters 
SET title = 'The Restful Spirit' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' 
AND order_number = 191 
AND title = 'The Sabbath Heart';

-- "The Shared Weight" → capítulo 153
UPDATE chapters 
SET title = 'The Common Burden' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' 
AND order_number = 153 
AND title = 'The Shared Weight';

-- "The Unforced Rhythms of Grace" → capítulo 187
UPDATE chapters 
SET title = 'The Natural Flow of Mercy' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' 
AND order_number = 187 
AND title = 'The Unforced Rhythms of Grace';

-- "Unplugging the Soul" → capítulo 193
UPDATE chapters 
SET title = 'Disconnecting to Reconnect' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' 
AND order_number = 193 
AND title = 'Unplugging the Soul';

-- PASO 5: Verificación final - NO debe haber duplicados
SELECT title, COUNT(*) as count 
FROM chapters 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' 
GROUP BY title 
HAVING COUNT(*) > 1 
ORDER BY count DESC;

-- RESULTADO ESPERADO: Sin resultados (0 duplicados)

-- PASO 6: Mostrar algunos títulos corregidos como ejemplo
SELECT order_number, title 
FROM chapters 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' 
AND order_number IN (4, 30, 31, 38, 52, 55, 59, 75, 153, 187, 191, 193, 230, 240)
ORDER BY order_number;
