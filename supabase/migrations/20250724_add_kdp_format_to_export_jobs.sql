-- Migración para añadir campos de formato KDP a export_jobs
-- Fecha: 2025-07-24
-- Descripción: Añade campos para guardar la selección de tamaño y tipo de impresión según Amazon KDP

ALTER TABLE export_jobs 
ADD COLUMN kdp_format_size VARCHAR(50), -- Ej: "15,24 x 22,86 cm (6\" x 9\")"
ADD COLUMN kdp_format_type VARCHAR(50), -- Ej: "paperback" o "hardcover"
ADD COLUMN kdp_ink_type VARCHAR(50),    -- Ej: "black_white", "black_cream", "color_standard", "color_premium"
ADD COLUMN kdp_paper_type VARCHAR(20);  -- Ej: "white", "cream"

-- Comentarios sobre los valores esperados:
-- kdp_format_size: Tamaño físico del libro según KDP
-- kdp_format_type: "paperback" (tapa blanda) o "hardcover" (tapa dura)
-- kdp_ink_type: "black_white", "black_cream", "color_standard", "color_premium"
-- kdp_paper_type: "white", "cream"
