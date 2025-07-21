-- Elimina duplicados manteniendo la fila más antigua por (book_id, order_number)
DELETE FROM chapters c
USING chapters d
WHERE c.book_id = d.book_id
  AND c.order_number = d.order_number
  AND c.id > d.id;

-- Añade una restricción para evitar futuros duplicados de capítulos por libro
ALTER TABLE chapters
ADD CONSTRAINT chapters_book_order_unique UNIQUE (book_id, order_number);
