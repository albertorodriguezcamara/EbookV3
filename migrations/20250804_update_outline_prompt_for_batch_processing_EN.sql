-- MIGRATION: Update generate_outline prompt for real batch processing
-- Date: 2025-08-04
-- Description: Modify the prompt to generate multiple chapters in a single call

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

**STRUCTURAL REQUIREMENTS:**

1. **PRIOR ANALYSIS** (perform internally):
   - Identify which narrative act we are in (beginning/development/climax/resolution)
   - Determine appropriate tension level for this section
   - Calculate necessary pacing according to position in the book

2. **FOR EACH CHAPTER GENERATE:**
   
   a) **TITLE** that must:
      - Be evocative and memorable
      - Generate curiosity without revealing the outcome
      - Maintain stylistic coherence with previous titles
      - Length: 3-8 words (adjust according to genre)
   
   b) **STRATEGIC SYNOPSIS** (3-4 sentences) that includes:
      - Initial hook: what captures the reader
      - Central development: what happens without spoilers
      - Value promise: what the reader will learn/experience
      - Connection: how it relates to previous/subsequent chapters
   
   c) **INTERNAL METADATA** (for coherence):
      - Narrative function: (e.g., "conflict introduction", "revelation", "turning point")
      - Emotional intensity: (1-10)
      - Key elements introduced
      - Subplot progression

3. **SPECIFIC CONSIDERATIONS BY POSITION:**
   
   **If we are in chapters 1-3:**
   - Establish world, tone and characters
   - Create powerful hooks
   - Introduce main conflict
   
   **If we are in intermediate chapters:**
   - Develop subplots
   - Progressively increase tension
   - Alternate revelations with new mysteries
   
   **If we are in final chapters ({total_chapters}-2 to {total_chapters}):**
   - Accelerate pace towards climax
   - Resolve subplots
   - Prepare reader satisfaction

4. **NARRATIVE TECHNIQUES TO APPLY:** (When appropriate and adapted to category)
   - **Cliffhangers**: Every 2-3 chapters
   - **Revelations**: Strategically distributed
   - **Breathing moments**: After high tension
   - **Callbacks**: References to previous elements
   - **Foreshadowing**: Preparation for future events

5. **COHERENCE VALIDATIONS:**
   - ✓ Do not repeat themes from {existing_chapters_context}
   - ✓ Maintain logical progression of events
   - ✓ Respect rules established in {book_bible}
   - ✓ Evolve characters/concepts gradually
   - ✓ Verify that each chapter provides unique value
   - ✓ CRITICAL: Ensure that the {end_chapter - start_chapter + 1} chapters in the batch are unique among themselves

**ENRICHED RESPONSE FORMAT:**
```json
[
  {
    "chapter_number": {start_chapter},
    "title": "Evocative Chapter Title",
    "synopsis": "3-4 sentence synopsis that hooks, develops and promises value...",
    "narrative_function": "establishment|development|turn|revelation|climax|resolution",
    "emotional_intensity": 7,
    "key_elements": ["element1", "element2"],
    "connections": {
      "references_previous": [{start_chapter}-1],
      "sets_up_future": [{start_chapter}+1, {start_chapter}+2]
    }
  },
  {
    "chapter_number": {start_chapter}+1,
    "title": "Second Batch Title",
    "synopsis": "Second unique and complementary synopsis...",
    "narrative_function": "development|turn|revelation",
    "emotional_intensity": 8,
    "key_elements": ["element3", "element4"],
    "connections": {
      "references_previous": [{start_chapter}],
      "sets_up_future": [{start_chapter}+2, {start_chapter}+3]
    }
  }
]
```

IMPORTANT: The response must contain exactly {end_chapter - start_chapter + 1} JSON objects, one for each chapter in the requested range.'
WHERE function_name = 'generate_outline' 
AND prompt_type = 'user' 
AND language = 'en';

-- Verify that it was updated correctly
SELECT 
    'Prompt updated:' as status,
    function_name,
    prompt_type,
    language,
    LENGTH(prompt_content) as new_length,
    updated_at
FROM ai_prompts_multilingual 
WHERE function_name = 'generate_outline' 
AND prompt_type = 'user' 
AND language = 'en';
