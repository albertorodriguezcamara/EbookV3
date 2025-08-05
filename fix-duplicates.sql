-- ========================================
-- QUERY PARA ELIMINAR TÍTULOS DUPLICADOS
-- Renombra duplicados con sinónimos únicos
-- ========================================

-- ESTRATEGIA: Mantener el primer capítulo con título original, 
-- renombrar los siguientes con sinónimos

BEGIN;

-- 1. "The Rhythm of Rest" (capítulos 21, 30, 31)
-- Mantener: 21 → "The Rhythm of Rest"
UPDATE chapters 
SET title = 'The Sacred Pause' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' AND order_number = 30;

UPDATE chapters 
SET title = 'The Gentle Stillness' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' AND order_number = 31;

-- 2. "Dressed for the Day" (capítulos 25, 38)
-- Mantener: 25 → "Dressed for the Day"
UPDATE chapters 
SET title = 'Clothed in Purpose' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' AND order_number = 38;

-- 3. "Hope as an Anchor" (capítulos 50, 59)
-- Mantener: 50 → "Hope as an Anchor"
UPDATE chapters 
SET title = 'The Steadfast Foundation' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' AND order_number = 59;

-- 4. "More Than Conquerors" (capítulos 75, 240)
-- Mantener: 75 → "More Than Conquerors"
UPDATE chapters 
SET title = 'Victory Through Him' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' AND order_number = 240;

-- 5. "Stronger Together" (capítulos 27, 230)
-- Mantener: 27 → "Stronger Together"
UPDATE chapters 
SET title = 'United in Faith' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' AND order_number = 230;

-- 6. "The Discipline of Celebration" (capítulos 47, 55)
-- Mantener: 47 → "The Discipline of Celebration"
UPDATE chapters 
SET title = 'The Practice of Joy' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' AND order_number = 55;

-- 7. "The Freedom of Forgiveness" (capítulos 43, 52)
-- Mantener: 43 → "The Freedom of Forgiveness"
UPDATE chapters 
SET title = 'The Liberation of Grace' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' AND order_number = 52;

-- 8. "The Sabbath Heart" (capítulos 182, 191)
-- Mantener: 182 → "The Sabbath Heart"
UPDATE chapters 
SET title = 'The Restful Spirit' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' AND order_number = 191;

-- 9. "The Shared Weight" (capítulos 142, 153)
-- Mantener: 142 → "The Shared Weight"
UPDATE chapters 
SET title = 'The Common Burden' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' AND order_number = 153;

-- 10. "The Unforced Rhythms of Grace" (capítulos 77, 187)
-- Mantener: 77 → "The Unforced Rhythms of Grace"
UPDATE chapters 
SET title = 'The Natural Flow of Mercy' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' AND order_number = 187;

-- 11. "Unplugging the Soul" (capítulos 183, 193)
-- Mantener: 183 → "Unplugging the Soul"
UPDATE chapters 
SET title = 'Disconnecting to Reconnect' 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' AND order_number = 193;

-- Verificar cambios
SELECT 'DESPUÉS DE CORRECCIÓN:' as status;
SELECT title, COUNT(*) as count 
FROM chapters 
WHERE book_id = '1c2c7a69-38f4-4ded-b02d-dfe462caec24' 
GROUP BY title 
HAVING COUNT(*) > 1 
ORDER BY count DESC;

COMMIT;

-- ========================================
-- RESULTADO ESPERADO: 0 duplicados
-- ========================================
