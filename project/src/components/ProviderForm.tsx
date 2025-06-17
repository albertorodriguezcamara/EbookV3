import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

interface ProviderFormProps {
  provider?: {
    id: string
    name: string
    base_url: string | null
    api_key: string | null
  }
  onSuccess: () => void
  onCancel: () => void
}

export default function ProviderForm({ provider, onSuccess, onCancel }: ProviderFormProps) {
  const [name, setName] = useState(provider?.name || '')
  const [baseUrl, setBaseUrl] = useState(provider?.base_url || '')
  const [apiKey, setApiKey] = useState(provider?.api_key || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!provider

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isEditing) {
        // Actualizar proveedor existente
        const { error } = await supabase
          .from('ai_providers')
          .update({
            name,
            base_url: baseUrl || null,
            api_key: apiKey || null,
          })
          .eq('id', provider.id)

        if (error) throw error
      } else {
        // Crear nuevo proveedor
        const { error } = await supabase.from('ai_providers').insert({
          name,
          base_url: baseUrl || null,
          api_key: apiKey || null,
        })

        if (error) throw error
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Ha ocurrido un error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-form-container">
      <h2 className="admin-title">
        {isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}
      </h2>

      <form onSubmit={handleSubmit} className="admin-form">
        <div className="admin-form-group">
          <label className="admin-label">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="admin-input"
            required
          />
        </div>

        <div className="admin-form-group">
          <label className="admin-label">URL Base (opcional)</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="admin-input"
            placeholder="https://api.ejemplo.com"
          />
        </div>

        <div className="admin-form-group">
          <label className="admin-label">API Key (opcional)</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="admin-input"
            placeholder="sk-..."
          />
        </div>

        {error && <div className="admin-error">{error}</div>}

        <div className="admin-form-actions">
          <button
            type="button"
            onClick={onCancel}
            className="admin-btn admin-btn-secondary"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="admin-btn admin-btn-primary"
            disabled={loading}
          >
            {loading ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </form>
    </div>
  )
}
