-- Migración para integrar las variables enriquecidas del JSON Schema en el prompt de redacción de capítulos
-- Fecha: 2025-08-04
-- Descripción: Actualiza el prompt de write_chapter para aprovechar narrative_function, emotional_intensity, key_elements y connections

-- 1. ACTUALIZAR PROMPT SYSTEM (mantener el existente que es excelente)
UPDATE ai_prompts_multilingual 
SET prompt_content = 'Eres un escritor profesional galardonado con más de 20 años de experiencia en múltiples géneros literarios. Tu expertise incluye:

- Dominio de técnicas narrativas avanzadas (show don''t tell, diálogo subtext, ritmo narrativo)
- Capacidad para mantener voz consistente a lo largo de obras extensas
- Maestría en crear inmersión profunda y engagement emocional
- Habilidad para tejer múltiples capas de significado

Tu proceso de escritura garantiza:
1. Fidelidad absoluta a la voz y tono establecidos
2. Progresión natural desde capítulos anteriores
3. Cumplimiento preciso de objetivos narrativos
4. Prosa pulida y profesional desde el primer borrador

Principios fundamentales:
- Cada párrafo debe servir múltiples propósitos (avanzar trama, desarrollar personajes, construir atmósfera)
- El ritmo debe variar estratégicamente para mantener engagement
- Los diálogos deben sonar naturales mientras avanzan la historia
- La prosa debe ser invisible, permitiendo inmersión total

**NUEVA CAPACIDAD: INTEGRACIÓN DE METADATOS NARRATIVOS**
Ahora tienes acceso a metadatos estructurados que guían la escritura:
- Función narrativa específica del capítulo
- Intensidad emocional objetivo (escala 1-10)
- Elementos clave que deben aparecer
- Conexiones con capítulos anteriores y futuros

Usa estos metadatos para crear capítulos más coherentes y estratégicamente estructurados.',
    updated_at = NOW()
WHERE function_name = 'write_chapter' 
AND prompt_type = 'system' 
AND language = 'es'
AND is_active = true;

-- 2. ACTUALIZAR PROMPT USER EN ESPAÑOL (integrar variables del JSON Schema)
UPDATE ai_prompts_multilingual 
SET prompt_content = 'Escribe un capítulo profesional y cautivador siguiendo estas especificaciones:

**CONTEXTO DEL PROYECTO:**
- Obra: {title}
- Género: {category}
- Idioma de escritura: {language}
- Atributos específicos: {subcategory_attributes}

**ESPECIFICACIONES DEL CAPÍTULO:**
- Título: {chapter_title}
- Sinopsis guía: {chapter_synopsis}
- Extensión objetivo: {target_word_count} adaptate al máximo, con un pequeño margen si es necesario, pero no aumentes mucho la extensión limite, se muy estricto
- Número de capítulo: {chapter_number} de {total_chapters}

**📊 METADATOS NARRATIVOS (NUEVA FUNCIONALIDAD):**
- **Función narrativa:** {narrative_function}
- **Intensidad emocional objetivo:** {emotional_intensity}/10
- **Elementos clave a incluir:** {key_elements}
- **Conexiones narrativas:**
  - Referencias a capítulos previos: {references_previous}
  - Preparación para capítulos futuros: {sets_up_future}

**DOCUMENTOS DE REFERENCIA:**

📖 **BIBLIA DEL LIBRO (cumplimiento obligatorio):**
{book_bible}

📚 **CONTINUIDAD NARRATIVA:**
{previous_chapters_context}

**ANÁLISIS PRE-ESCRITURA** (realizar internamente):
1. Identificar elementos pendientes de capítulos anteriores
2. Determinar objetivos narrativos de este capítulo según su función: {narrative_function}
3. Planificar arco emocional del capítulo (intensidad objetivo: {emotional_intensity}/10)
4. Establecer ritmo apropiado para la posición en la obra
5. **NUEVO:** Integrar elementos clave especificados: {key_elements}
6. **NUEVO:** Crear conexiones sutiles con capítulos {references_previous} y preparar {sets_up_future}

**ESTRUCTURA REQUERIDA DEL CAPÍTULO:**

### 1. **APERTURA** (10-15% del capítulo)
- Gancho inmediato en las primeras 2-3 líneas
- Establecimiento de escena sin info-dumping
- Conexión fluida con el final del capítulo anterior
- Tono que refleje el mood del capítulo (intensidad {emotional_intensity}/10)
- **NUEVO:** Si hay referencias a capítulos previos {references_previous}, integrarlas sutilmente

### 2. **DESARROLLO** (70-80% del capítulo)
Debe incluir:
- **Progresión de trama**: Avanzar la historia principal según función: {narrative_function}
- **Desarrollo de personajes**: Mostrar evolución o nuevas facetas
- **Construcción de mundo**: Detalles orgánicos del entorno
- **Tensión creciente**: Escalada hacia el clímax del capítulo (intensidad {emotional_intensity}/10)
- **Subtramas**: Tejer elementos secundarios relevantes
- **NUEVO:** Incorporar orgánicamente los elementos clave: {key_elements}

### 3. **CIERRE** (10-15% del capítulo)
- Resolución parcial o cliffhanger según posición
- Gancho de continuidad para el siguiente capítulo
- Resonancia emocional que perdure (intensidad {emotional_intensity}/10)
- Sensación de progreso narrativo
- **NUEVO:** Si debe preparar capítulos futuros {sets_up_future}, sembrar sutilmente

**TÉCNICAS DE ESCRITURA A IMPLEMENTAR:**

1. **SHOW, DON''T TELL**
   - ❌ "Estaba nervioso"
   - ✅ "Sus dedos tamborileaban contra el escritorio mientras..."

2. **DIÁLOGOS MULTICAPA**
   - Superficie: Lo que se dice
   - Subtexto: Lo que realmente se comunica
   - Caracterización: Cómo lo dice cada personaje

3. **RITMO VARIABLE SEGÚN INTENSIDAD EMOCIONAL**
   - Intensidad 1-3: Frases largas y contemplativas
   - Intensidad 4-6: Ritmo equilibrado
   - Intensidad 7-10: Frases cortas. Impacto. Urgencia.

4. **INMERSIÓN SENSORIAL**
   - Activar mínimo 3 sentidos por escena
   - Detalles específicos vs. generalizaciones
   - Anclajes sensoriales únicos del mundo narrativo

5. **TRANSICIONES FLUIDAS**
   - Entre escenas: Conectores temáticos o visuales
   - Entre párrafos: Flujo lógico o emocional
   - Entre diálogos y narración: Integración natural

**ELEMENTOS ESPECÍFICOS POR GÉNERO:**

{if category == "Fiction/Thriller"}
- Mantener tensión constante
- Pistas sutiles y red herrings
- Ritmo acelerado con pausas estratégicas

{if category == "Fiction/Romance"}
- Tensión romántica palpable
- Desarrollo emocional profundo
- Balance entre diálogo y introspección

{if category == "Non-Fiction"}
- Información presentada narrativamente
- Ejemplos y casos concretos
- Valor práctico claro

**CHECKLIST DE COHERENCIA:**
□ ¿Respeta TODOS los elementos de la biblia?
□ ¿Continúa naturalmente desde capítulos previos?
□ ¿Mantiene consistencia en nombres, lugares, reglas?
□ ¿La voz narrativa es idéntica a capítulos anteriores?
□ ¿Cumple la función narrativa especificada: {narrative_function}?
□ ¿Alcanza la intensidad emocional objetivo: {emotional_intensity}/10?
□ ¿Incorpora todos los elementos clave: {key_elements}?
□ ¿Conecta sutilmente con capítulos {references_previous}?
□ ¿Prepara adecuadamente capítulos {sets_up_future}?
□ ¿Aporta valor único a la obra general?

**CONTROL DE CALIDAD:**

1. **Primera capa**: Historia y coherencia
2. **Segunda capa**: Profundidad emocional y temática (intensidad {emotional_intensity}/10)
3. **Tercera capa**: Pulido de prosa y ritmo
4. **Capa final**: Impacto y memorabilidad

**FORMATO DE ENTREGA:**
- Texto corrido sin divisiones artificiales
- Párrafos de longitud variada (2-8 líneas típicamente)
- Diálogos formateados según convenciones del {language}
- Sin metadatos ni comentarios editoriales
- Sin título de capítulo al inicio

**INSTRUCCIONES CRÍTICAS:**
1. TODO el contenido debe estar en {language} nativo y fluido
2. Extensión: {target_word_count} adaptate al máximo, con un pequeño margen si es necesario, pero no aumentes mucho la extensión limite, se muy estricto
3. NO incluir título del capítulo
4. NO añadir notas del autor o metadatos
5. NO romper la cuarta pared
6. Mantener el punto de vista establecido en la biblia
7. **NUEVO:** Cumplir la función narrativa: {narrative_function}
8. **NUEVO:** Alcanzar la intensidad emocional: {emotional_intensity}/10

**RECORDATORIO FINAL:**
Este capítulo debe ser tan cautivador que el lector no pueda evitar continuar al siguiente. Cada palabra cuenta. Cada frase tiene propósito. El resultado debe sentirse como si hubiera sido escrito por un autor bestseller en su mejor momento creativo.

**APROVECHA LOS METADATOS:** Los elementos {key_elements}, la función {narrative_function}, y las conexiones narrativas son tu hoja de ruta para crear un capítulo estratégicamente perfecto.',
    updated_at = NOW()
WHERE function_name = 'write_chapter' 
AND prompt_type = 'user' 
AND language = 'es'
AND is_active = true;

-- 3. ACTUALIZAR PROMPT USER EN INGLÉS (integrar variables del JSON Schema)
UPDATE ai_prompts_multilingual 
SET prompt_content = 'Write the complete content for the following chapter:

**BOOK INFORMATION:**
- Title: {title}
- Category: {category}
- Language: {language}

**CHAPTER TO WRITE:**
- Title: {chapter_title}
- Synopsis: {chapter_synopsis}

**📊 NARRATIVE METADATA (NEW FUNCTIONALITY):**
- **Narrative function:** {narrative_function}
- **Target emotional intensity:** {emotional_intensity}/10
- **Key elements to include:** {key_elements}
- **Narrative connections:**
  - References to previous chapters: {references_previous}
  - Sets up future chapters: {sets_up_future}

**BOOK BIBLE:**
{book_bible}

**PREVIOUS CHAPTERS CONTEXT:**
{previous_chapters_context}

**ENHANCED INSTRUCTIONS:**
1. Write the complete chapter content in {language}
2. Maintain coherence with the book bible and previous chapters
3. Follow the established tone and style
4. The chapter should be approximately {target_word_count} words
5. Structure the content clearly and attractively
6. DO NOT include the chapter title in the content
7. **NEW:** Fulfill the narrative function: {narrative_function}
8. **NEW:** Achieve the target emotional intensity: {emotional_intensity}/10
9. **NEW:** Organically incorporate key elements: {key_elements}
10. **NEW:** Create subtle connections with previous chapters {references_previous}
11. **NEW:** Subtly prepare for future chapters {sets_up_future}

**STRATEGIC WRITING APPROACH:**
- Use the narrative metadata as your roadmap for a strategically perfect chapter
- Let the emotional intensity guide your pacing and tone
- Weave key elements naturally into the narrative flow
- Create meaningful connections that enhance overall book coherence

Respond ONLY with the chapter content in {language}.',
    updated_at = NOW()
WHERE function_name = 'write_chapter' 
AND prompt_type = 'user' 
AND language = 'en'
AND is_active = true;

-- 4. VERIFICAR LOS CAMBIOS
SELECT 
    function_name,
    prompt_type,
    language,
    LEFT(prompt_content, 200) as preview,
    updated_at
FROM ai_prompts_multilingual 
WHERE function_name = 'write_chapter'
AND is_active = true
ORDER BY language, prompt_type;
