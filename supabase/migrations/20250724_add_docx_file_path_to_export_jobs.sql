-- Migración: Añadir columna docx_file_path a la tabla export_jobs
-- Fecha: 2025-07-24
-- Descripción: La función generate-book-docx necesita guardar la ruta del archivo DOCX generado

ALTER TABLE export_jobs ADD COLUMN docx_file_path TEXT;

-- Comentario: Esta columna almacenará la ruta del archivo DOCX en Supabase Storage
-- para permitir referencias futuras y gestión de archivos
