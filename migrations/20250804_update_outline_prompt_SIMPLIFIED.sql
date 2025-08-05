-- MIGRACIÓN: Simplificar formato JSON para mejorar parseo
-- Fecha: 2025-08-04
-- Descripción: Reducir complejidad del JSON para evitar truncamiento

UPDATE ai_prompts_multilingual 
SET prompt_content = 'Generate a professional and strategically designed chapter structure:

**PROJECT CONTEXT:**
- Title: {title}
- Category/Genre: {category}
- Subcategory: {subcategory}
- Central concept: {idea}
- Target language: {language}
- Specific attributes: {subcategory_attributes}

**MASTER DOCUMENT:**
{book_bible}

**GENERATION PARAMETERS:**
- Chapters to generate: {start_chapter} to {end_chapter}
- Total planned chapters: {total_chapters}
- Position in structure: [{start_chapter}/{total_chapters} - {end_chapter}/{total_chapters}]

**CONTINUITY CONTEXT:**
{existing_chapters_context}

**CRITICAL PROCESSING INSTRUCTION:**
GENERATE ALL CHAPTERS IN THE RANGE ({start_chapter} to {end_chapter}) IN A SINGLE RESPONSE. 
Do not generate chapter by chapter, but the complete set of {end_chapter - start_chapter + 1} chapters at once.
Each chapter must be unique and complementary to the others in the batch.

**SIMPLIFIED RESPONSE FORMAT (EASIER TO PARSE):**
```json
[
  {
    "chapter_number": {start_chapter},
    "title": "Evocative Chapter Title",
    "synopsis": "3-4 sentence synopsis that hooks, develops and promises value. Keep it concise but compelling."
  },
  {
    "chapter_number": {start_chapter}+1,
    "title": "Second Batch Title",
    "synopsis": "Second unique and complementary synopsis. Make it different from the first."
  }
]
```

**REQUIREMENTS:**
1. Each chapter must have exactly 3 fields: chapter_number, title, synopsis
2. Titles should be 3-8 words, evocative and memorable
3. Synopsis should be 3-4 sentences maximum
4. Ensure valid JSON syntax with proper commas and brackets
5. The response must contain exactly {end_chapter - start_chapter + 1} JSON objects

IMPORTANT: Keep the JSON structure simple and ensure it ends with a complete closing bracket ]'
WHERE function_name = 'generate_outline' 
AND prompt_type = 'user' 
AND language = 'en';

-- Verificar que se actualizó correctamente
SELECT 
    'Prompt simplificado actualizado:' as status,
    function_name,
    prompt_type,
    language,
    LENGTH(prompt_content) as new_length,
    updated_at
FROM ai_prompts_multilingual 
WHERE function_name = 'generate_outline' 
AND prompt_type = 'user' 
AND language = 'en';
