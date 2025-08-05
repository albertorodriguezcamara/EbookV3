-- Migración para crear tabla de prompts multilingües
-- Fecha: 2025-08-01
-- Propósito: Almacenar prompts traducidos para diferentes funciones de IA y idiomas

-- Crear tabla para prompts multilingües
CREATE TABLE IF NOT EXISTS public.ai_prompts_multilingual (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    function_name TEXT NOT NULL, -- 'book_bible', 'write_chapter', 'generate_outline'
    prompt_type TEXT NOT NULL,   -- 'system', 'user', 'context' etc.
    language TEXT NOT NULL,      -- 'es', 'en', 'fr', 'de', etc.
    prompt_content TEXT NOT NULL,
    description TEXT,            -- Descripción del propósito del prompt
    category TEXT,               -- Para filtrar por categoría de libro si es necesario
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Crear índices para optimizar consultas
CREATE INDEX idx_ai_prompts_multilingual_function_language ON public.ai_prompts_multilingual(function_name, language);
CREATE INDEX idx_ai_prompts_multilingual_active ON public.ai_prompts_multilingual(is_active);
CREATE INDEX idx_ai_prompts_multilingual_category ON public.ai_prompts_multilingual(category);

-- Crear constraint único para evitar duplicados
ALTER TABLE public.ai_prompts_multilingual 
ADD CONSTRAINT unique_function_type_language_category 
UNIQUE (function_name, prompt_type, language, category);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_ai_prompts_multilingual_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER trigger_update_ai_prompts_multilingual_updated_at
    BEFORE UPDATE ON public.ai_prompts_multilingual
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_prompts_multilingual_updated_at();

-- Habilitar RLS
ALTER TABLE public.ai_prompts_multilingual ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios autenticados puedan leer todos los prompts
CREATE POLICY "Users can read all prompts" ON public.ai_prompts_multilingual
    FOR SELECT USING (auth.role() = 'authenticated');

-- Política para que solo usuarios autenticados puedan modificar prompts
-- NOTA: Ajustar esta política según tu sistema de roles específico
CREATE POLICY "Authenticated users can modify prompts" ON public.ai_prompts_multilingual
    FOR ALL USING (auth.role() = 'authenticated');

-- Comentario: Si tienes una tabla de roles específica, reemplaza la política anterior con:
-- CREATE POLICY "Only admins can modify prompts" ON public.ai_prompts_multilingual
--     FOR ALL USING (
--         auth.uid() IN (
--             SELECT user_id FROM tu_tabla_de_roles 
--             WHERE role = 'admin'
--         )
--     );

-- Insertar prompts base en español e inglés para las funciones principales
INSERT INTO public.ai_prompts_multilingual (function_name, prompt_type, language, prompt_content, description, category) VALUES

-- BOOK BIBLE PROMPTS
('book_bible', 'system', 'es', 
'Eres un experto creador de "biblias de libro" que desarrolla guías completas y coherentes para la escritura de libros. Tu tarea es crear una guía detallada que asegure la coherencia narrativa y temática a lo largo de toda la obra.',
'Prompt del sistema para generación de book bible en español', 'general'),

('book_bible', 'system', 'en', 
'You are an expert "book bible" creator who develops comprehensive and coherent guides for book writing. Your task is to create a detailed guide that ensures narrative and thematic coherence throughout the entire work.',
'System prompt for book bible generation in English', 'general'),

('book_bible', 'user', 'es',
'Crea una "biblia del libro" completa y detallada para el siguiente proyecto:

**Título:** {title}
**Autor:** {author}
**Categoría:** {category}
**Subcategoría:** {subcategory}
**Idea/Concepto:** {idea}
**Idioma:** {language}
**Número de capítulos:** {target_number_of_chapters}

La biblia del libro debe incluir:

1. **Resumen ejecutivo** (2-3 párrafos)
2. **Tono y estilo narrativo**
3. **Público objetivo**
4. **Temas principales y subtemas**
5. **Estructura general del libro**
6. **Elementos específicos según la categoría**
7. **Directrices de coherencia**

Responde ÚNICAMENTE en {language}. La biblia debe ser específica para la categoría "{category}" y servir como guía maestra para mantener coherencia en todos los capítulos.',
'Prompt principal para generación de book bible en español', 'general'),

('book_bible', 'user', 'en',
'Create a comprehensive and detailed "book bible" for the following project:

**Title:** {title}
**Author:** {author}
**Category:** {category}
**Subcategory:** {subcategory}
**Idea/Concept:** {idea}
**Language:** {language}
**Number of chapters:** {target_number_of_chapters}

The book bible should include:

1. **Executive summary** (2-3 paragraphs)
2. **Narrative tone and style**
3. **Target audience**
4. **Main themes and subthemes**
5. **General book structure**
6. **Category-specific elements**
7. **Coherence guidelines**

Respond ONLY in {language}. The bible should be specific to the "{category}" category and serve as a master guide to maintain coherence across all chapters.',
'Main prompt for book bible generation in English', 'general'),

-- WRITE CHAPTER PROMPTS
('write_chapter', 'system', 'es',
'Eres un escritor experto especializado en crear contenido de alta calidad para libros. Tu tarea es escribir capítulos coherentes, bien estructurados y que mantengan el tono y estilo establecido en la biblia del libro.',
'Prompt del sistema para escritura de capítulos en español', 'general'),

('write_chapter', 'system', 'en',
'You are an expert writer specialized in creating high-quality content for books. Your task is to write coherent, well-structured chapters that maintain the tone and style established in the book bible.',
'System prompt for chapter writing in English', 'general'),

('write_chapter', 'user', 'es',
'Escribe el contenido completo para el siguiente capítulo:

**INFORMACIÓN DEL LIBRO:**
- Título: {title}
- Categoría: {category}
- Idioma: {language}

**CAPÍTULO A ESCRIBIR:**
- Título: {chapter_title}
- Sinopsis: {chapter_synopsis}

**BIBLIA DEL LIBRO:**
{book_bible}

**CONTEXTO DE CAPÍTULOS ANTERIORES:**
{previous_chapters_context}

**INSTRUCCIONES:**
1. Escribe el contenido completo del capítulo en {language}
2. Mantén coherencia con la biblia del libro y capítulos anteriores
3. Sigue el tono y estilo establecido
4. El capítulo debe tener aproximadamente {target_word_count} palabras
5. Estructura el contenido de forma clara y atractiva
6. NO incluyas el título del capítulo en el contenido

Responde ÚNICAMENTE con el contenido del capítulo en {language}.',
'Prompt principal para escritura de capítulos en español', 'general'),

('write_chapter', 'user', 'en',
'Write the complete content for the following chapter:

**BOOK INFORMATION:**
- Title: {title}
- Category: {category}
- Language: {language}

**CHAPTER TO WRITE:**
- Title: {chapter_title}
- Synopsis: {chapter_synopsis}

**BOOK BIBLE:**
{book_bible}

**PREVIOUS CHAPTERS CONTEXT:**
{previous_chapters_context}

**INSTRUCTIONS:**
1. Write the complete chapter content in {language}
2. Maintain coherence with the book bible and previous chapters
3. Follow the established tone and style
4. The chapter should be approximately {target_word_count} words
5. Structure the content clearly and attractively
6. DO NOT include the chapter title in the content

Respond ONLY with the chapter content in {language}.',
'Main prompt for chapter writing in English', 'general'),

-- GENERATE OUTLINE PROMPTS
('generate_outline', 'system', 'es',
'Eres un experto en estructuración de libros que crea esquemas detallados y coherentes. Tu tarea es generar títulos y sinopsis para capítulos que sigan una progresión lógica y mantengan el interés del lector.',
'Prompt del sistema para generación de esquemas en español', 'general'),

('generate_outline', 'system', 'en',
'You are an expert in book structuring who creates detailed and coherent outlines. Your task is to generate titles and synopses for chapters that follow a logical progression and maintain reader interest.',
'System prompt for outline generation in English', 'general'),

('generate_outline', 'user', 'es',
'Genera títulos y sinopsis para los capítulos del siguiente libro:

**INFORMACIÓN DEL LIBRO:**
- Título: {title}
- Categoría: {category}
- Subcategoría: {subcategory}
- Idea: {idea}
- Idioma: {language}

**BIBLIA DEL LIBRO:**
{book_bible}

**CAPÍTULOS A GENERAR:**
- Rango: Capítulos {start_chapter} al {end_chapter}
- Total de capítulos del libro: {total_chapters}

**CAPÍTULOS YA GENERADOS:**
{existing_chapters_context}

**INSTRUCCIONES:**
1. Genera títulos y sinopsis ÚNICAMENTE en {language}
2. Mantén coherencia con la biblia del libro
3. Evita duplicar temas de capítulos ya generados
4. Asegura progresión lógica entre capítulos
5. Cada sinopsis debe tener 2-3 oraciones descriptivas

Responde en formato JSON:
```json
[
  {
    "chapter_number": 1,
    "title": "Título del capítulo",
    "synopsis": "Sinopsis detallada del capítulo..."
  }
]
```',
'Prompt principal para generación de esquemas en español', 'general'),

('generate_outline', 'user', 'en',
'Generate titles and synopses for the chapters of the following book:

**BOOK INFORMATION:**
- Title: {title}
- Category: {category}
- Subcategory: {subcategory}
- Idea: {idea}
- Language: {language}

**BOOK BIBLE:**
{book_bible}

**CHAPTERS TO GENERATE:**
- Range: Chapters {start_chapter} to {end_chapter}
- Total book chapters: {total_chapters}

**ALREADY GENERATED CHAPTERS:**
{existing_chapters_context}

**INSTRUCTIONS:**
1. Generate titles and synopses ONLY in {language}
2. Maintain coherence with the book bible
3. Avoid duplicating themes from already generated chapters
4. Ensure logical progression between chapters
5. Each synopsis should have 2-3 descriptive sentences

Respond in JSON format:
```json
[
  {
    "chapter_number": 1,
    "title": "Chapter title",
    "synopsis": "Detailed chapter synopsis..."
  }
]
```',
'Main prompt for outline generation in English', 'general');

-- Comentario final
COMMENT ON TABLE public.ai_prompts_multilingual IS 'Tabla para almacenar prompts traducidos para diferentes funciones de IA y idiomas';
