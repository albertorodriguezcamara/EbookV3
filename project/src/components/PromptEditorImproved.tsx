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

export default function PromptEditor() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Estados para gestión de traducciones
  const [allTranslations, setAllTranslations] = useState<AIPrompt[]>([])
  const [currentLanguage, setCurrentLanguage] = useState('es')
  const [showTranslations, setShowTranslations] = useState(false)
  
  const [formData, setFormData] = useState({
    function_name: searchParams.get('function') || '',
    prompt_type: searchParams.get('type') || '',
    language: searchParams.get('language') || 'es',
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

      setCurrentLanguage(data.language)
      
      // Cargar todas las traducciones de este prompt
      await fetchAllTranslations(data.function_name, data.prompt_type)

    } catch (err: any) {
      console.error('Error fetching prompt:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllTranslations = async (functionName: string, promptType: string) => {
    try {
      const { data, error } = await supabase
        .from('ai_prompts_multilingual')
        .select('*')
        .eq('function_name', functionName)
        .eq('prompt_type', promptType)
        .order('language')

      if (error) throw error
      setAllTranslations(data || [])
    } catch (err: any) {
      console.error('Error fetching translations:', err)
    }
  }

  const handleLanguageSwitch = async (language: string) => {
    const existingTranslation = allTranslations.find(t => t.language === language)
    
    if (existingTranslation) {
      setFormData({
        function_name: existingTranslation.function_name,
        prompt_type: existingTranslation.prompt_type,
        language: existingTranslation.language,
        prompt_content: existingTranslation.prompt_content,
        description: existingTranslation.description || '',
        category: existingTranslation.category,
        is_active: existingTranslation.is_active
      })
    } else {
      // Nueva traducción
      setFormData(prev => ({
        ...prev,
        language: language,
        prompt_content: '',
        description: ''
      }))
    }
    
    setCurrentLanguage(language)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setSaving(true)
      setError(null)

      const existingTranslation = allTranslations.find(t => t.language === currentLanguage)
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
      if (existingTranslation) {
        // Actualizar traducción existente
        result = await supabase
          .from('ai_prompts_multilingual')
          .update(promptData)
          .eq('id', existingTranslation.id)
      } else {
        // Crear nueva traducción
        result = await supabase
          .from('ai_prompts_multilingual')
          .insert([{
            ...promptData,
            created_by: user?.id,
            created_at: new Date().toISOString()
          }])
      }

      if (result.error) throw result.error

      // Recargar traducciones
      await fetchAllTranslations(formData.function_name, formData.prompt_type)

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
    return FUNCTION_VARIABLES[formData.function_name as keyof typeof FUNCTION_VARIABLES] || []
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
      <div className="prompt-editor-container">
        <div className="prompt-editor-loading">
          <h2>{isEditing ? 'Cargando Prompt...' : 'Nuevo Prompt'}</h2>
          <p>Cargando...</p>
        </div>
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
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
        
        {error && (
          <div className="admin-alert admin-alert-error">
            {error}
          </div>
        )}
      </div>

      {/* Contenido principal */}
      <div className="prompt-editor-content">
        {/* Panel de traducciones */}
        {isEditing && allTranslations.length > 0 && (
          <div className="translations-panel">
            <div className="translations-header">
              <h3>Traducciones disponibles</h3>
              <button 
                type="button"
                onClick={() => setShowTranslations(!showTranslations)}
                className="admin-btn admin-btn-sm admin-btn-secondary"
              >
                {showTranslations ? 'Ocultar' : 'Mostrar'} ({allTranslations.length})
              </button>
            </div>
            
            {showTranslations && (
              <div className="translations-list">
                {LANGUAGES.map(lang => {
                  const translation = allTranslations.find(t => t.language === lang.value)
                  const isActive = currentLanguage === lang.value
                  
                  return (
                    <button
                      key={lang.value}
                      type="button"
                      onClick={() => handleLanguageSwitch(lang.value)}
                      className={`translation-btn ${isActive ? 'active' : ''} ${translation ? 'exists' : 'missing'}`}
                      title={translation ? 'Traducción disponible' : 'Crear traducción'}
                    >
                      <span className="flag">{lang.value.toUpperCase()}</span>
                      <span className="label">{lang.label}</span>
                      {translation ? '✓' : '+'}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Layout principal */}
        <div className="prompt-editor-layout">
          {/* Formulario principal */}
          <div className="prompt-editor-form-section">
            <form id="prompt-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Función *</label>
                  <select
                    value={formData.function_name}
                    onChange={(e) => {
                      setFormData({...formData, function_name: e.target.value})
                      if (e.target.value && formData.prompt_type) {
                        fetchAllTranslations(e.target.value, formData.prompt_type)
                      }
                    }}
                    required
                    className="admin-input"
                  >
                    <option value="">Seleccionar función</option>
                    {FUNCTION_NAMES.map(fn => (
                      <option key={fn.value} value={fn.value}>{fn.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Tipo *</label>
                  <select
                    value={formData.prompt_type}
                    onChange={(e) => {
                      setFormData({...formData, prompt_type: e.target.value})
                      if (formData.function_name && e.target.value) {
                        fetchAllTranslations(formData.function_name, e.target.value)
                      }
                    }}
                    required
                    className="admin-input"
                  >
                    <option value="">Seleccionar tipo</option>
                    {PROMPT_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
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

                <div className="form-group">
                  <label>Descripción</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="admin-input"
                    placeholder="Descripción opcional del prompt"
                  />
                </div>

                <div className="form-group">
                  <label>Categoría</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="admin-input"
                    placeholder="general"
                  />
                </div>

                <div className="form-group">
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

              <div className="form-group full-width">
                <label>Contenido del Prompt *</label>
                <textarea
                  ref={textareaRef}
                  value={formData.prompt_content}
                  onChange={(e) => setFormData({...formData, prompt_content: e.target.value})}
                  required
                  className="admin-textarea prompt-textarea"
                  rows={20}
                  placeholder="Contenido del prompt con placeholders como {title}, {language}, etc."
                />
                <small className="form-help">
                  Usa las variables del panel lateral o escribe manualmente placeholders como {`{title}`}, {`{language}`}, etc.
                </small>
              </div>
            </form>
          </div>

          {/* Panel lateral de variables */}
          <div className="variables-panel">
            <div className="variables-panel-content">
              {formData.function_name && (
                <>
                  <div className="variables-section">
                    <h4>📝 Variables estándar</h4>
                    <div className="variables-grid">
                      {getAvailableVariables().map((variable) => (
                        <button
                          key={variable.name}
                          type="button"
                          className="variable-btn standard"
                          onClick={() => insertVariable(variable.name)}
                          title={variable.description}
                        >
                          {`{${variable.name}}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="variables-section">
                    <h4>⭐ Variable recomendada</h4>
                    <button
                      type="button"
                      className="variable-btn recommended"
                      onClick={() => insertVariable('subcategory_attributes')}
                      title="Contiene todos los atributos específicos de la subcategoría en formato JSON. Recomendado para prompts genéricos."
                    >
                      {'{subcategory_attributes}'}
                    </button>
                    <small className="variable-help">
                      Contiene todos los atributos de subcategoría en JSON. Ideal para prompts genéricos.
                    </small>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
