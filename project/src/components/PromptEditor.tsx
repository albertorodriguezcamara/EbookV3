import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface AIPrompt {
  id: string
  function_name: string
  prompt_type: string
  language: string
  prompt_content: string
  description?: string
  category: string
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

const FUNCTION_NAMES = [
  { value: 'book_bible', label: 'Book Bible' },
  { value: 'write_chapter', label: 'Escribir Capítulo' },
  { value: 'generate_outline', label: 'Generar Esquema' }
]

const PROMPT_TYPES = [
  { value: 'system', label: 'System' },
  { value: 'user', label: 'User' },
  { value: 'context', label: 'Context' }
]

const LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'Inglés' },
  { value: 'fr', label: 'Francés' },
  { value: 'de', label: 'Alemán' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Portugués' }
]

// Variables disponibles para cada función
const FUNCTION_VARIABLES = {
  book_bible: [
    { name: 'title', description: 'Título del libro' },
    { name: 'author', description: 'Autor del libro' },
    { name: 'category', description: 'Categoría del libro' },
    { name: 'subcategory', description: 'Subcategoría del libro' },
    { name: 'idea', description: 'Idea/concepto del libro' },
    { name: 'language', description: 'Idioma del libro' },
    { name: 'target_number_of_chapters', description: 'Número objetivo de capítulos' },
    { name: 'subcategory_attributes', description: 'Todos los atributos específicos de la subcategoría (JSON)' }
  ],
  write_chapter: [
    { name: 'title', description: 'Título del libro' },
    { name: 'category', description: 'Categoría del libro' },
    { name: 'language', description: 'Idioma del libro' },
    { name: 'chapter_title', description: 'Título del capítulo' },
    { name: 'chapter_synopsis', description: 'Sinopsis del capítulo' },
    { name: 'book_bible', description: 'Biblia del libro (JSON)' },
    { name: 'previous_chapters_context', description: 'Contexto de capítulos anteriores' },
    { name: 'target_word_count', description: 'Número objetivo de palabras' },
    { name: 'subcategory_attributes', description: 'Todos los atributos específicos de la subcategoría (JSON)' }
  ],
  generate_outline: [
    { name: 'title', description: 'Título del libro' },
    { name: 'category', description: 'Categoría del libro' },
    { name: 'subcategory', description: 'Subcategoría del libro' },
    { name: 'idea', description: 'Idea/concepto del libro' },
    { name: 'language', description: 'Idioma del libro' },
    { name: 'start_chapter', description: 'Capítulo inicial del rango' },
    { name: 'end_chapter', description: 'Capítulo final del rango' },
    { name: 'total_chapters', description: 'Total de capítulos del libro' },
    { name: 'existing_chapters_context', description: 'Contexto de capítulos ya generados' },
    { name: 'book_bible', description: 'Biblia del libro (JSON)' },
    { name: 'subcategory_attributes', description: 'Todos los atributos específicos de la subcategoría (JSON)' }
  ]
}

// Variables dinámicas de book_attributes (disponibles para todas las funciones)
const BOOK_ATTRIBUTES_VARIABLES = [
  { name: 'age_range', description: 'Rango de edad objetivo' },
  { name: 'ambientacion_misterio', description: 'Ambientación del misterio' },
  { name: 'aplicacion_practica', description: 'Aplicación práctica del contenido' },
  { name: 'area_autoconocimiento', description: 'Área de autoconocimiento' },
  { name: 'area_negocios', description: 'Área de negocios' },
  { name: 'art_style', description: 'Estilo artístico' },
  { name: 'aspecto_religioso', description: 'Aspecto religioso' },
  { name: 'aspectos_incluidos', description: 'Aspectos incluidos en el contenido' },
  { name: 'budget', description: 'Presupuesto' },
  { name: 'campo_investigacion', description: 'Campo de investigación' },
  { name: 'chapter_length', description: 'Longitud de capítulos' },
  { name: 'color_scheme', description: 'Esquema de colores' },
  { name: 'conflicto_romantico', description: 'Conflicto romántico' },
  { name: 'corriente_filosofica', description: 'Corriente filosófica' },
  { name: 'criterio_seleccion', description: 'Criterio de selección' },
  { name: 'destinations', description: 'Destinos' },
  { name: 'destino_viaje', description: 'Destino del viaje' },
  { name: 'edad_objetivo', description: 'Edad objetivo' },
  { name: 'ejercicios_incluidos', description: 'Ejercicios incluidos' },
  { name: 'enfoque_estudio', description: 'Enfoque de estudio' },
  { name: 'enfoque_pedagogico', description: 'Enfoque pedagógico' },
  { name: 'estilo_literario', description: 'Estilo literario' },
  { name: 'estilo_narrativo', description: 'Estilo narrativo' },
  { name: 'estrategias_propuestas', description: 'Estrategias propuestas' },
  { name: 'genero_comic', description: 'Género del cómic' },
  { name: 'grado_academico', description: 'Grado académico' },
  { name: 'hallazgos_principales', description: 'Hallazgos principales' },
  { name: 'has_cover', description: 'Tiene portada' },
  { name: 'hechos_importantes', description: 'Hechos importantes' },
  { name: 'heroes_protagonistas', description: 'Héroes protagonistas' },
  { name: 'herramientas_necesarias', description: 'Herramientas necesarias' },
  { name: 'illustration_style', description: 'Estilo de ilustración' },
  { name: 'implantes', description: 'Implantes (cyberpunk)' },
  { name: 'investigador_protagonista', description: 'Investigador protagonista' },
  { name: 'is_illustrated', description: 'Es ilustrado' },
  { name: 'longitud_promedio', description: 'Longitud promedio' },
  { name: 'materia_estudio', description: 'Materia de estudio' },
  { name: 'materia_texto', description: 'Materia del texto' },
  { name: 'mensaje_moral', description: 'Mensaje moral' },
  { name: 'metodologia_investigacion', description: 'Metodología de investigación' },
  { name: 'metodos_estudio', description: 'Métodos de estudio' },
  { name: 'moral_lesson', description: 'Lección moral' },
  { name: 'mundo_fantastico', description: 'Mundo fantástico' },
  { name: 'nivel_academico', description: 'Nivel académico' },
  { name: 'nivel_complejidad', description: 'Nivel de complejidad' },
  { name: 'nivel_fitness', description: 'Nivel de fitness' },
  { name: 'num_chapters', description: 'Número de capítulos' },
  { name: 'numero_elementos', description: 'Número de elementos' },
  { name: 'objetivos_salud', description: 'Objetivos de salud' },
  { name: 'objetivo_transformacion', description: 'Objetivo de transformación' },
  { name: 'panel_layout', description: 'Diseño de paneles' },
  { name: 'pasos_proceso', description: 'Pasos del proceso' },
  { name: 'personajes_comic', description: 'Personajes del cómic' },
  { name: 'personajes_infantiles', description: 'Personajes infantiles' },
  { name: 'personajes_principales', description: 'Personajes principales' },
  { name: 'personajes_secundarios', description: 'Personajes secundarios' },
  { name: 'preguntas_fundamentales', description: 'Preguntas fundamentales' },
  { name: 'protagonistas_romance', description: 'Protagonistas del romance' },
  { name: 'quest_mision', description: 'Misión/quest' },
  { name: 'season', description: 'Temporada/estación' },
  { name: 'setting', description: 'Ambientación/escenario' },
  { name: 'target_number_of_chapters', description: 'Número objetivo de capítulos' },
  { name: 'target_word_count', description: 'Número objetivo de palabras' },
  { name: 'tema_curiosidades', description: 'Tema de curiosidades' },
  { name: 'tema_listas', description: 'Tema de listas' },
  { name: 'tema_practico', description: 'Tema práctico' },
  { name: 'tematica_cuentos', description: 'Temática de cuentos' },
  { name: 'tematica_microrrelatos', description: 'Temática de microrrelatos' },
  { name: 'tipo_datos', description: 'Tipo de datos' },
  { name: 'tipo_empresa', description: 'Tipo de empresa' },
  { name: 'tipo_entrenamiento', description: 'Tipo de entrenamiento' },
  { name: 'tipo_misterio', description: 'Tipo de misterio' },
  { name: 'tipo_romance', description: 'Tipo de romance' },
  { name: 'tipo_viajero', description: 'Tipo de viajero' },
  { name: 'tono', description: 'Tono del contenido' },
  { name: 'tradicion_religiosa', description: 'Tradición religiosa' },
  { name: 'valores_ensenar', description: 'Valores a enseñar' }
]

export default function PromptEditor() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  
  const [formData, setFormData] = useState({
    function_name: searchParams.get('function') || '',
    prompt_type: searchParams.get('type') || '',
    language: searchParams.get('language') || '',
    prompt_content: '',
    description: '',
    category: 'general',
    is_active: true
  })

  const isEditing = !!id

  useEffect(() => {
    if (isEditing && id) {
      fetchPrompt(id)
    }
  }, [id, isEditing])

  const fetchPrompt = async (promptId: string) => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('ai_prompts_multilingual')
        .select('*')
        .eq('id', promptId)
        .single()

      if (error) throw error

      setFormData({
        function_name: data.function_name,
        prompt_type: data.prompt_type,
        language: data.language,
        prompt_content: data.prompt_content,
        description: data.description || '',
        category: data.category,
        is_active: data.is_active
      })

    } catch (err: any) {
      console.error('Error fetching prompt:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setSaving(true)
      setError(null)

      const promptData = {
        function_name: formData.function_name,
        prompt_type: formData.prompt_type,
        language: formData.language,
        prompt_content: formData.prompt_content,
        description: formData.description || null,
        category: formData.category,
        is_active: formData.is_active,
        updated_by: user?.id,
        updated_at: new Date().toISOString()
      }

      let result
      if (isEditing) {
        // Actualizar prompt existente
        result = await supabase
          .from('ai_prompts_multilingual')
          .update(promptData)
          .eq('id', id)
      } else {
        // Crear nuevo prompt
        result = await supabase
          .from('ai_prompts_multilingual')
          .insert([{
            ...promptData,
            created_by: user?.id,
            created_at: new Date().toISOString()
          }])
      }

      if (result.error) throw result.error

      // Volver a la página de administración
      navigate('/admin?tab=prompts')

    } catch (err: any) {
      console.error('Error saving prompt:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    navigate('/admin?tab=prompts')
  }

  // Obtener variables disponibles para la función seleccionada
  const getAvailableVariables = () => {
    if (!formData.function_name) return []
    
    // Variables específicas de la función
    const functionVariables = FUNCTION_VARIABLES[formData.function_name as keyof typeof FUNCTION_VARIABLES] || []
    
    return functionVariables
  }
  
  // Obtener variables específicas de subcategoría (book_attributes)
  const getSubcategoryVariables = () => {
    return BOOK_ATTRIBUTES_VARIABLES
  }

  // Función para insertar variable en el textarea
  const insertVariable = (variableName: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = formData.prompt_content
    const before = text.substring(0, start)
    const after = text.substring(end)
    const variableTag = `{${variableName}}`
    
    const newText = before + variableTag + after
    setFormData({...formData, prompt_content: newText})
    
    // Restaurar el foco y posición del cursor
    setTimeout(() => {
      textarea.focus()
      const newPosition = start + variableTag.length
      textarea.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  if (loading) {
    return (
      <div className="admin-section">
        <h2>{isEditing ? 'Editando Prompt' : 'Nuevo Prompt'}</h2>
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="prompt-editor-container">
      {/* Header fijo */}
      <div className="prompt-editor-header">
        <div className="prompt-editor-title">
          <h2>{isEditing ? 'Editar Prompt' : 'Nuevo Prompt'}</h2>
          <div className="prompt-editor-actions">
            <button 
              type="button"
              onClick={handleCancel}
              className="admin-btn admin-btn-secondary"
            >
              ← Volver a Prompts
            </button>
            <button 
              type="submit"
              form="prompt-form"
              className="admin-btn admin-btn-primary" 
              disabled={saving}
            >
              {saving ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear')}
            </button>
          </div>
        </div>
        
        {error && (
          <div className="admin-alert admin-alert-error">
            {error}
          </div>
        )}
      </div>

      {/* Contenido principal con layout mejorado */}
      <div className="prompt-editor-content">
        <form id="prompt-form" onSubmit={handleSubmit} className="prompt-editor-form">
        {/* Columna principal - Formulario */}
        <div>
          <div className="admin-form-row">
            <div className="admin-form-group">
              <label>Función *</label>
              <select
                value={formData.function_name}
                onChange={(e) => setFormData({...formData, function_name: e.target.value})}
                required
                className="admin-input"
              >
                <option value="">Seleccionar función</option>
                {FUNCTION_NAMES.map(fn => (
                  <option key={fn.value} value={fn.value}>{fn.label}</option>
                ))}
              </select>
            </div>

            <div className="admin-form-group">
              <label>Tipo *</label>
              <select
                value={formData.prompt_type}
                onChange={(e) => setFormData({...formData, prompt_type: e.target.value})}
                required
                className="admin-input"
              >
                <option value="">Seleccionar tipo</option>
                {PROMPT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="admin-form-row">
            <div className="admin-form-group">
              <label>Idioma *</label>
              <select
                value={formData.language}
                onChange={(e) => setFormData({...formData, language: e.target.value})}
                required
                className="admin-input"
              >
                <option value="">Seleccionar idioma</option>
                {LANGUAGES.map(lang => (
                  <option key={lang.value} value={lang.value}>{lang.label}</option>
                ))}
              </select>
            </div>

            <div className="admin-form-group">
              <label>Descripción</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="admin-input"
                placeholder="Descripción opcional del prompt"
              />
            </div>
          </div>

          <div className="admin-form-row">
            <div className="admin-form-group">
              <label>Categoría</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="admin-input"
                placeholder="general"
              />
            </div>

            <div className="admin-form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                />
                Activo
              </label>
            </div>
          </div>

          <div className="admin-form-group">
            <label>Contenido del Prompt *</label>
            <textarea
              ref={textareaRef}
              value={formData.prompt_content}
              onChange={(e) => setFormData({...formData, prompt_content: e.target.value})}
              required
              className="admin-textarea"
              rows={20}
              placeholder="Contenido del prompt con placeholders como {title}, {language}, etc."
              style={{ minHeight: '500px' }}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>
              Usa las etiquetas de la derecha o escribe manualmente placeholders como {`{title}`}, {`{language}`}, etc.
            </small>
          </div>

          <div className="admin-form-actions">
            <button type="button" onClick={handleCancel} className="admin-btn admin-btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear')}
            </button>
          </div>
        </div>

        {/* Columna lateral - Variables */}
        <div style={{ position: 'sticky', top: '20px', height: 'fit-content' }}>
          {formData.function_name && (
            <div className="variable-tags-container">
              {/* Variables estándar de la función */}
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>
                📝 Variables estándar:
              </div>
              <div className="variable-tags" style={{ marginBottom: '15px' }}>
                {getAvailableVariables().map((variable) => (
                  <button
                    key={variable.name}
                    type="button"
                    className="variable-tag variable-tag-standard"
                    onClick={() => insertVariable(variable.name)}
                    title={variable.description}
                  >
                    {`{${variable.name}}`}
                  </button>
                ))}
              </div>
              
              {/* Variable recomendada para atributos de subcategoría */}
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0066cc', marginBottom: '8px' }}>
                ⭐ Variable recomendada:
              </div>
              <div className="variable-tags" style={{ marginBottom: '15px' }}>
                <button
                  type="button"
                  className="variable-tag variable-tag-recommended"
                  onClick={() => insertVariable('subcategory_attributes')}
                  title="Contiene todos los atributos específicos de la subcategoría en formato JSON. Recomendado para prompts genéricos."
                >
                  {'{subcategory_attributes}'}
                </button>
              </div>
              
              {/* Variables individuales de subcategoría (colapsables) */}
              <details style={{ marginTop: '10px' }}>
                <summary style={{ fontSize: '12px', color: '#666', cursor: 'pointer', marginBottom: '8px' }}>
                  🔍 Variables individuales (opcional)
                </summary>
                <div className="variable-tags" style={{ maxHeight: '300px', overflowY: 'auto', padding: '5px', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
                  {getSubcategoryVariables().map((variable) => (
                    <button
                      key={variable.name}
                      type="button"
                      className="variable-tag variable-tag-subcategory"
                      onClick={() => insertVariable(variable.name)}
                      title={variable.description}
                    >
                      {`{${variable.name}}`}
                    </button>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
