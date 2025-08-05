import React, { useState, useEffect } from 'react'
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

export default function PromptsAdmin() {
  const { user } = useAuth()
  const [prompts, setPrompts] = useState<AIPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Estados para filtros
  const [filterFunction, setFilterFunction] = useState('')
  const [filterLanguage, setFilterLanguage] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => {
    fetchPrompts()
  }, [])

  const fetchPrompts = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('ai_prompts_multilingual')
        .select('*')
        .order('function_name', { ascending: true })
        .order('language', { ascending: true })
        .order('prompt_type', { ascending: true })

      if (error) throw error

      setPrompts(data || [])
    } catch (err: any) {
      console.error('Error fetching prompts:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (prompt: AIPrompt) => {
    // Navegar a la página de edición
    window.location.href = `/admin/prompts/edit/${prompt.id}`
  }
  
  const handleNew = () => {
    // Navegar a la página de creación
    window.location.href = '/admin/prompts/new'
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este prompt?')) {
      return
    }

    try {
      setError(null)
      
      const { error } = await supabase
        .from('ai_prompts_multilingual')
        .delete()
        .eq('id', id)

      if (error) throw error

      await fetchPrompts()
    } catch (err: any) {
      console.error('Error deleting prompt:', err)
      setError(err.message)
    }
  }

  // Filtrar prompts
  const filteredPrompts = prompts.filter(prompt => {
    return (
      (!filterFunction || prompt.function_name === filterFunction) &&
      (!filterLanguage || prompt.language === filterLanguage) &&
      (!filterType || prompt.prompt_type === filterType)
    )
  })

  if (loading) {
    return <div className="admin-section">
      <h2>Gestión de Prompts Multilingües</h2>
      <p>Cargando prompts...</p>
    </div>
  }

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Gestión de Prompts Multilingües</h2>
        <button 
          onClick={handleNew}
          className="admin-btn admin-btn-success"
        >
          Nuevo Prompt
        </button>
      </div>

      {error && (
        <div className="admin-alert admin-alert-error">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="admin-filters" style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <select 
          value={filterFunction} 
          onChange={(e) => setFilterFunction(e.target.value)}
          className="admin-select"
        >
          <option value="">Todas las funciones</option>
          {FUNCTION_NAMES.map(fn => (
            <option key={fn.value} value={fn.value}>{fn.label}</option>
          ))}
        </select>

        <select 
          value={filterLanguage} 
          onChange={(e) => setFilterLanguage(e.target.value)}
          className="admin-select"
        >
          <option value="">Todos los idiomas</option>
          {LANGUAGES.map(lang => (
            <option key={lang.value} value={lang.value}>{lang.label}</option>
          ))}
        </select>

        <select 
          value={filterType} 
          onChange={(e) => setFilterType(e.target.value)}
          className="admin-select"
        >
          <option value="">Todos los tipos</option>
          {PROMPT_TYPES.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>

        {(filterFunction || filterLanguage || filterType) && (
          <button 
            onClick={() => {
              setFilterFunction('')
              setFilterLanguage('')
              setFilterType('')
            }}
            className="admin-btn admin-btn-secondary"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla de prompts */}
      {filteredPrompts.length === 0 ? (
        <p>No hay prompts que coincidan con los filtros seleccionados</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Función</th>
              <th>Tipo</th>
              <th>Idioma</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th>Estado</th>
              <th>Actualizado</th>
              <th style={{textAlign: 'center'}}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredPrompts.map((prompt) => (
              <tr key={prompt.id}>
                <td>
                  <span className="admin-badge admin-badge-info">
                    {FUNCTION_NAMES.find(fn => fn.value === prompt.function_name)?.label || prompt.function_name}
                  </span>
                </td>
                <td>
                  <span className="admin-badge admin-badge-secondary">
                    {PROMPT_TYPES.find(type => type.value === prompt.prompt_type)?.label || prompt.prompt_type}
                  </span>
                </td>
                <td>
                  <span className="admin-badge admin-badge-primary">
                    {LANGUAGES.find(lang => lang.value === prompt.language)?.label || prompt.language}
                  </span>
                </td>
                <td>{prompt.description || '-'}</td>
                <td>{prompt.category}</td>
                <td>
                  <span className={`admin-badge ${prompt.is_active ? 'admin-badge-success' : 'admin-badge-danger'}`}>
                    {prompt.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>{new Date(prompt.updated_at).toLocaleDateString()}</td>
                <td style={{textAlign: 'center'}}>
                  <div style={{display: 'flex', gap: '5px', justifyContent: 'center'}}>
                    <button
                      onClick={() => handleEdit(prompt)}
                      className="admin-btn admin-btn-sm admin-btn-primary"
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(prompt.id)}
                      className="admin-btn admin-btn-sm admin-btn-danger"
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
