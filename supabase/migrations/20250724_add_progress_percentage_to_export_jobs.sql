-- Migración: Añadir columna progress_percentage a la tabla export_jobs
-- Fecha: 2025-07-24
-- Descripción: La función generate-book-docx necesita actualizar el progreso del job

ALTER TABLE export_jobs ADD COLUMN progress_percentage INTEGER DEFAULT 0;

-- Comentario: Esta columna almacenará el porcentaje de progreso del job (0-100)
-- para mostrar el estado de avance en tiempo real en el frontend
