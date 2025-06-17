import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface AIProvider {
  id: string
  name: string
}

interface ModelFormProps {
  model?: {
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
    created_at?: string
    updated_at?: string
  }
  onSuccess: () => void
  onCancel: () => void
}

export default function ModelForm({ model, onSuccess, onCancel }: ModelFormProps) {
  const [name, setName] = useState(model?.name || '')
  const [displayName, setDisplayName] = useState(model?.display_name || '')
  const [description, setDescription] = useState(model?.description || '')
  const [maxTokens, setMaxTokens] = useState(model?.max_tokens?.toString() || '')
  const [pricePer1k, setPricePer1k] = useState(model?.price_per_1k?.toString() || '')
  const [type, setType] = useState(model?.type || '')
  const [active, setActive] = useState(model?.active ?? true)
  const [rating, setRating] = useState(model?.rating?.toString() || '')
  const [justification, setJustification] = useState(model?.justification || '')
  const [providerId, setProviderId] = useState(model?.provider_id || '')

  const [providers, setProviders] = useState<AIProvider[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!model

  // Cargar proveedores para el selector
  useEffect(() => {
    const fetchProviders = async () => {
      const { data, error } = await supabase
        .from('ai_providers')
        .select('id, name')
        .order('name')
      
      if (error) {
        console.error('Error cargando proveedores:', error)
        return
      }
      
      setProviders(data || [])
      
      if (!providerId && data && data.length > 0) {
        setProviderId(data[0].id)
      }
    }
    fetchProviders()
  }, [providerId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const modelData = {
        name,
        display_name: displayName,
        description,
        max_tokens: maxTokens ? parseInt(maxTokens, 10) : null,
        price_per_1k: pricePer1k ? parseFloat(pricePer1k) : null,
        type,
        active,
        rating: rating ? parseInt(rating, 10) : null,
        justification,
        provider_id: providerId || null
      }
      if (isEditing) {
        const { error } = await supabase
          .from('ai_models')
          .update(modelData)
          .eq('id', model.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('ai_models')
          .insert(modelData)
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
        {isEditing ? 'Editar Modelo' : 'Nuevo Modelo'}
      </h2>

      <form onSubmit={handleSubmit} className="admin-form">
        <div className="admin-form-group">
          <label className="admin-label">Nombre (técnico)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="admin-input"
            required
          />
        </div>
        <div className="admin-form-group">
          <label className="admin-label">Nombre para mostrar</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="admin-input"
            required
          />
        </div>
        <div className="admin-form-group">
          <label className="admin-label">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="admin-input"
            rows={2}
          />
        </div>
        <div className="admin-form-group">
          <label className="admin-label">Proveedor</label>
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="admin-select"
            required
          >
            <option value="">Seleccionar proveedor</option>
            {providers.map(provider => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-grid-2-col">
          <div className="admin-form-group">
            <label className="admin-label">Tipo</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="admin-select"
              required
            >
              <option value="">Seleccionar tipo</option>
              <option value="writer">Escritora</option>
              <option value="editor">Editora</option>
              <option value="image">Imagen</option>
              <option value="cover">Portada</option>
            </select>
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Máx. tokens</label>
            <input
              type="number"
              value={maxTokens}
              onChange={e => setMaxTokens(e.target.value)}
              className="admin-input"
              min="0"
              placeholder="Ej: 8192"
            />
          </div>
        </div>
        <div className="admin-grid-2-col">
          <div className="admin-form-group">
            <label className="admin-label">Precio por 1k (USD)</label>
            <input
              type="number"
              value={pricePer1k}
              onChange={e => setPricePer1k(e.target.value)}
              className="admin-input"
              step="0.0001"
              min="0"
              placeholder="Ej: 0.0300"
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Rating (1-10)</label>
            <input
              type="number"
              value={rating}
              onChange={e => setRating(e.target.value)}
              className="admin-input"
              min="0"
              max="10"
              placeholder="Ej: 8"
            />
          </div>
        </div>
        <div className="admin-form-group">
          <label className="admin-label">Justificación</label>
          <textarea
            value={justification}
            onChange={e => setJustification(e.target.value)}
            className="admin-input"
            rows={2}
          />
        </div>
        <div className="admin-checkbox-group">
          <input
            type="checkbox"
            checked={active}
            onChange={e => setActive(e.target.checked)}
            id="active"
            className="admin-checkbox"
          />
          <label htmlFor="active" className="admin-label">Activo</label>
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
