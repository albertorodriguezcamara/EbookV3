-- MIGRACIÓN: Actualizar prompt de generate_outline para procesamiento por lotes reales
-- Fecha: 2025-08-04
-- Descripción: Modificar el prompt para que genere múltiples capítulos en una sola llamada

UPDATE ai_prompts_multilingual 
SET prompt_content = 'Genera una estructura de capítulos profesional y estratégicamente diseñada:

**CONTEXTO DEL PROYECTO:**
- Título: {title}
- Categoría/Género: {category}
- Subcategoría: {subcategory}
- Concepto central: {idea}
- Idioma objetivo: {language}
- Atributos específicos: {subcategory_attributes}

**DOCUMENTO MAESTRO:**
{book_bible}

**PARÁMETROS DE GENERACIÓN:**
- Capítulos a generar: {start_chapter} al {end_chapter}
- Total de capítulos planificados: {total_chapters}
- Posición en la estructura: [{start_chapter}/{total_chapters} - {end_chapter}/{total_chapters}]

**CONTEXTO DE CONTINUIDAD:**
{existing_chapters_context}

**INSTRUCCIÓN CRÍTICA DE PROCESAMIENTO:**
GENERA TODOS LOS CAPÍTULOS DEL RANGO ({start_chapter} al {end_chapter}) EN UNA SOLA RESPUESTA. 
No generes capítulo por capítulo, sino el conjunto completo de {end_chapter - start_chapter + 1} capítulos de una vez.
Cada capítulo debe ser único y complementario con los demás del lote.

**REQUISITOS ESTRUCTURALES:**

1. **ANÁLISIS PREVIO** (realiza internamente):
   - Identifica en qué acto narrativo estamos (inicio/desarrollo/clímax/resolución)
   - Determina el nivel de tensión apropiado para esta sección
   - Calcula el ritmo necesario según la posición en el libro

2. **PARA CADA CAPÍTULO GENERA:**
   
   a) **TÍTULO** que debe:
      - Ser evocativo y memorable
      - Generar curiosidad sin revelar el desenlace
      - Mantener coherencia estilística con títulos previos
      - Longitud: 3-8 palabras (ajustar según género)
   
   b) **SINOPSIS ESTRATÉGICA** (3-4 oraciones) que incluya:
      - Gancho inicial: qué atrapa al lector
      - Desarrollo central: qué sucede sin spoilers
      - Promesa de valor: qué aprenderá/experimentará el lector
      - Conexión: cómo se relaciona con capítulos anteriores/posteriores
   
   c) **METADATOS INTERNOS** (para coherencia):
      - Función narrativa: (ej: "introducción de conflicto", "revelación", "punto de giro")
      - Intensidad emocional: (1-10)
      - Elementos clave introducidos
      - Progresión de subtramas

3. **CONSIDERACIONES ESPECÍFICAS POR POSICIÓN:**
   
   **Si estamos en capítulos 1-3:**
   - Establecer mundo, tono y personajes
   - Crear ganchos potentes
   - Introducir conflicto principal
   
   **Si estamos en capítulos intermedios:**
   - Desarrollar subtramas
   - Incrementar tensión progresivamente
   - Alternar revelaciones con nuevos misterios
   
   **Si estamos en capítulos finales ({total_chapters}-2 a {total_chapters}):**
   - Acelerar ritmo hacia clímax
   - Resolver subtramas
   - Preparar satisfacción del lector

4. **TÉCNICAS NARRATIVAS A APLICAR:** (Siempre que toque y adaptado a la categoría)
   - **Cliffhangers**: Cada 2-3 capítulos
   - **Revelaciones**: Distribuidas estratégicamente
   - **Momentos de respiro**: Después de alta tensión
   - **Callbacks**: Referencias a elementos anteriores
   - **Foreshadowing**: Preparación de eventos futuros

5. **VALIDACIONES DE COHERENCIA:**
   - ✓ No repetir temas de {existing_chapters_context}
   - ✓ Mantener progresión lógica de eventos
   - ✓ Respetar reglas establecidas en {book_bible}
   - ✓ Evolucionar personajes/conceptos gradualmente
   - ✓ Verificar que cada capítulo aporte valor único
   - ✓ CRÍTICO: Asegurar que los {end_chapter - start_chapter + 1} capítulos del lote sean únicos entre sí

**FORMATO DE RESPUESTA ENRIQUECIDO:**
```json
[
  {
    "chapter_number": {start_chapter},
    "title": "Título Evocativo del Capítulo",
    "synopsis": "Sinopsis de 3-4 oraciones que engancha, desarrolla y promete valor...",
    "narrative_function": "establecimiento|desarrollo|giro|revelación|clímax|resolución",
    "emotional_intensity": 7,
    "key_elements": ["elemento1", "elemento2"],
    "connections": {
      "references_previous": [{start_chapter}-1],
      "sets_up_future": [{start_chapter}+1, {start_chapter}+2]
    }
  },
  {
    "chapter_number": {start_chapter}+1,
    "title": "Segundo Título del Lote",
    "synopsis": "Segunda sinopsis única y complementaria...",
    "narrative_function": "desarrollo|giro|revelación",
    "emotional_intensity": 8,
    "key_elements": ["elemento3", "elemento4"],
    "connections": {
      "references_previous": [{start_chapter}],
      "sets_up_future": [{start_chapter}+2, {start_chapter}+3]
    }
  }
]
```

IMPORTANTE: La respuesta debe contener exactamente {end_chapter - start_chapter + 1} objetos JSON, uno por cada capítulo del rango solicitado.'
WHERE function_name = 'generate_outline' 
AND prompt_type = 'user' 
AND language = 'es';

-- Verificar que se actualizó correctamente
SELECT 
    'Prompt actualizado:' as status,
    function_name,
    prompt_type,
    language,
    LENGTH(prompt_content) as new_length,
    updated_at
FROM ai_prompts_multilingual 
WHERE function_name = 'generate_outline' 
AND prompt_type = 'user' 
AND language = 'es';
