import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, Routes, Route } from 'react-router-dom'
import ProviderForm from '../components/ProviderForm'
import ModelForm from '../components/ModelForm'
import RoleManager from '../components/RoleManager'
import CategoryAdmin from '../components/CategoryAdmin'
import SubcategoryAttributesAdmin from '../components/SubcategoryAttributesAdmin'
import PromptsAdmin from '../components/PromptsAdmin'
import PromptEditor from '../components/PromptEditorImproved'
import EditSubcategoryAttribute from './EditSubcategoryAttribute'
import EditCategory from './EditCategory'
import '../styles/Admin.css'

interface AIProvider {
  id: string
  name: string
  base_url: string | null
  api_key: string | null
  created_at: string
}

interface AIModel {
  id: string
  name: string
  display_name: string
  description: string | null
  max_tokens: number | null
  price_per_1k: number | null
  type: string
  active: boolean
  rating: number | null
  justification: string | null
  provider_id: string | null
  provider?: AIProvider
  created_at: string
  updated_at?: string
}

export default function Admin() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [models, setModels] = useState<AIModel[]>([])
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Estados para gestionar formularios
  const [showProviderForm, setShowProviderForm] = useState(false)
  const [showModelForm, setShowModelForm] = useState(false)
  const [editingProvider, setEditingProvider] = useState<AIProvider | undefined>()
  const [editingModel, setEditingModel] = useState<AIModel | undefined>()
  const [deleteConfirm, setDeleteConfirm] = useState<{type: 'provider' | 'model', id: string} | null>(null)

  // Verificación real de rol usando la tabla user_roles
  useEffect(() => {
    const verifyRole = async () => {
      if (loading) return
      if (!user) {
        navigate('/')
        return
      }
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (error || !data || data.role !== 'admin') {
        navigate('/')
      }
    }
    verifyRole()
  }, [user, loading, navigate])

  // Función para recargar datos
  const fetchData = async () => {
    setFetching(true)
    const { data: provData, error: provErr } = await supabase
      .from('ai_providers')
      .select('*')
      .order('created_at', { ascending: true })

    if (provErr) {
      setError(provErr.message)
      setFetching(false)
      return
    }

    const { data: modelData, error: modelErr } = await supabase
      .from('ai_models')
      .select('*')
      .order('created_at', { ascending: true })

    if (modelErr) {
      setError(modelErr.message)
      setFetching(false)
      return
    }

    const provMap = Object.fromEntries(provData.map((p) => [p.id, p]))
    const enrichedModels = modelData.map((m) => ({ ...m, provider: provMap[m.provider_id] }))

    setProviders(provData)
    setModels(enrichedModels)
    setFetching(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  // AdminDashboard inner component
  const AdminDashboard: React.FC = () => {
    return (
      <div className="admin-container">
        <h1 className="admin-title">Panel de Administración</h1>

        {/* Diálogo de confirmación para eliminar */}
        {deleteConfirm && (
          <div className="admin-dialog-overlay">
            <div className="admin-dialog">
              <h3 className="admin-dialog-title">Confirmar eliminación</h3>
              <p className="admin-dialog-content">¿Estás seguro de que deseas eliminar este {deleteConfirm.type === 'provider' ? 'proveedor' : 'modelo'}? Esta acción no se puede deshacer.</p>
              <div className="admin-form-actions">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="admin-btn admin-btn-secondary"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    if (deleteConfirm.type === 'provider') {
                      handleDeleteProvider(deleteConfirm.id)
                    } else {
                      handleDeleteModel(deleteConfirm.id)
                    }
                  }}
                  className="admin-btn admin-btn-danger"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="admin-section">
          <div className="admin-section-header">
            <h2>Proveedores de IA</h2>
            <button 
              onClick={() => {
                setEditingProvider(undefined)
                setShowProviderForm(true)
              }}
              className="admin-btn admin-btn-success"
            >
              Nuevo Proveedor
            </button>
          </div>
          
          {fetching ? (
            <p>Cargando proveedores...</p>
          ) : providers.length === 0 ? (
            <p>No hay proveedores registrados</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Base URL</th>
                  <th>API Key</th>
                  <th>Creado</th>
                  <th style={{textAlign: 'center'}}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.base_url ?? '—'}</td>
                    <td>
                      <span className={`admin-badge ${p.api_key ? 'admin-badge-success' : 'admin-badge-warning'}`}>
                        {p.api_key ? 'Establecida' : 'No establecida'}
                      </span>
                    </td>
                    <td>{new Date(p.created_at).toLocaleString()}</td>
                    <td className="actions">
                      <button 
                        onClick={() => handleEditProvider(p)}
                        className="admin-btn admin-btn-primary"
                      >
                        Editar
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm({type: 'provider', id: p.id})}
                        className="admin-btn admin-btn-danger"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="admin-section">
          <div className="admin-section-header">
            <h2>Modelos de IA</h2>
            <button 
              onClick={() => {
                setEditingModel(undefined)
                setShowModelForm(true)
              }}
              className="admin-btn admin-btn-success"
            >
              Nuevo Modelo
            </button>
          </div>
          
          {fetching ? (
            <p>Cargando modelos...</p>
          ) : models.length === 0 ? (
            <p>No hay modelos registrados</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Nombre para mostrar</th>
                  <th>Tipo</th>
                  <th>Activo</th>
                  <th>Proveedor</th>
                  <th>Rating</th>
                  <th>Creado</th>
                  <th style={{textAlign: 'center'}}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m.display_name}</td>
                    <td>{m.type}</td>
                    <td>
                      <span className={`admin-badge ${m.active ? 'admin-badge-success' : 'admin-badge-neutral'}`}>
                        {m.active ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td>{m.provider?.name ?? 'Desconocido'}</td>
                    <td>{m.rating ?? '—'}</td>
                    <td>{m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}</td>
                    <td className="actions">
                      <button 
                        onClick={() => handleEditModel(m)}
                        className="admin-btn admin-btn-primary"
                      >
                        Editar
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm({type: 'model', id: m.id})}
                        className="admin-btn admin-btn-danger"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Gestión de prompts multilingües */}
        <div className="admin-section">
          <PromptsAdmin />
        </div>

        {/* Gestión de categorías */}
        <div className="admin-section">
          <CategoryAdmin />
        </div>

        {/* Gestión de atributos de subcategoría */}
        <div className="admin-section">
          <SubcategoryAttributesAdmin />
        </div>

        {/* Gestión de roles */}
        <div className="admin-section">
          <RoleManager />
        </div>
      </div>
    )
  }

  // Funciones para gestionar proveedores
  const handleEditProvider = (provider: AIProvider) => {
    setEditingProvider(provider)
    setShowProviderForm(true)
  }
  
  const handleDeleteProvider = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ai_providers')
        .delete()
        .eq('id', id)
        
      if (error) throw error
      
      // Recargar datos
      fetchData()
      setDeleteConfirm(null)
    } catch (err: any) {
      setError(`Error al eliminar: ${err.message}`)
    }
  }
  
  // Funciones para gestionar modelos
  const handleEditModel = (model: AIModel) => {
    setEditingModel(model)
    setShowModelForm(true)
  }
  
  const handleDeleteModel = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ai_models')
        .delete()
        .eq('id', id)
        
      if (error) throw error
      
      // Recargar datos
      fetchData()
      setDeleteConfirm(null)
    } catch (err: any) {
      setError(`Error al eliminar: ${err.message}`)
    }
  }

  if (loading) return <p className="admin-loading">Cargando…</p>
  if (error) return <p className="admin-error">Error: {error}</p>

  // Renderizado condicional para formularios
  if (showProviderForm) {
    return (
      <div className="admin-container">
        <ProviderForm 
          provider={editingProvider}
          onSuccess={() => {
            setShowProviderForm(false)
            setEditingProvider(undefined)
            fetchData()
          }}
          onCancel={() => {
            setShowProviderForm(false)
            setEditingProvider(undefined)
          }}
        />
      </div>
    )
  }
  
  if (showModelForm) {
    return (
      <div className="admin-container">
        <ModelForm 
          model={editingModel}
          onSuccess={() => {
            setShowModelForm(false)
            setEditingModel(undefined)
            fetchData()
          }}
          onCancel={() => {
            setShowModelForm(false)
            setEditingModel(undefined)
          }}
        />
      </div>
    )
  }

  return (
    <Routes>
      <Route index element={<AdminDashboard />} />
      <Route path="prompts/new" element={<PromptEditor />} />
      <Route path="prompts/edit/:id" element={<PromptEditor />} />
      <Route path="attribute/new" element={<EditSubcategoryAttribute />} />
      <Route path="attribute/:id" element={<EditSubcategoryAttribute />} />
      <Route path="category/new" element={<EditCategory />} />
      <Route path="category/:id" element={<EditCategory />} />
    </Routes>
  )
;
}
