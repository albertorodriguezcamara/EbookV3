import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Attribute {
  id?: string
  subcategory: string
  name: string
  display_name: string
  description: string | null
  type: string
  required: boolean
  options: string[]
  default_value: string | null
  validation_rule: string | null
}

export default function EditSubcategoryAttribute() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState<Partial<Attribute>>({ options: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      setLoading(true)
      supabase
        .from('subcategory_attributes')
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data, error }) => {
          if (error) setError(error.message)
          else if (data) {
            let options: string[] = []
            if (data.options) {
              if (typeof data.options === 'string') {
                const str = data.options.trim()
                if (str.startsWith('[') || str.startsWith('{')) {
                  try {
                    const arr = JSON.parse(str)
                    options = Array.isArray(arr) ? arr : []
                  } catch {
                    options = [str]
                  }
                } else {
                  options = str.split(',').map((opt: string) => opt.trim()).filter(Boolean)
                }
              } else if (Array.isArray(data.options)) {
                options = data.options
              }
            }
            setForm({ ...data, options })
          }
          setLoading(false)
        })
    }
  }, [id])

  const handleChange = (field: keyof Attribute, value: any) => {
    setForm(f => ({ ...f, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const payload = {
      subcategory: form.subcategory,
      name: form.name,
      display_name: form.display_name,
      description: form.description,
      type: form.type,
      required: form.required ?? false,
      options: JSON.stringify(form.options || []),
      default_value: form.default_value,
      validation_rule: form.validation_rule
    }
    try {
      if (id) {
        const { error } = await supabase.from('subcategory_attributes').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('subcategory_attributes').insert([payload])
        if (error) throw error
      }
      navigate('/admin')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-container">
      <h1 className="admin-title">{id ? 'Editar atributo' : 'Nuevo atributo'} de subcategoría</h1>
      {error && <div className="admin-error">{error}</div>}
      {loading ? <p>Cargando...</p> : (
        <form onSubmit={handleSubmit} className="admin-form">
          <div className="admin-form-group">
            <label className="admin-label">Subcategoría</label>
            <input type="text" className="admin-input" value={form.subcategory || ''} onChange={e => handleChange('subcategory', e.target.value)} required />
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Nombre (único)</label>
            <input type="text" className="admin-input" value={form.name || ''} onChange={e => handleChange('name', e.target.value)} required />
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Nombre para mostrar</label>
            <input type="text" className="admin-input" value={form.display_name || ''} onChange={e => handleChange('display_name', e.target.value)} required />
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Descripción</label>
            <input type="text" className="admin-input" value={form.description || ''} onChange={e => handleChange('description', e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Tipo</label>
            <select className="admin-input" value={form.type || ''} onChange={e => handleChange('type', e.target.value)} required>
              <option value="">Seleccionar</option>
              <option value="select">Select</option>
              <option value="text">Texto</option>
              <option value="number">Número</option>
              <option value="boolean">Booleano</option>
            </select>
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Opciones (solo para select, separadas por coma)</label>
            <input type="text" className="admin-input" value={form.options ? (form.options as string[]).join(', ') : ''} onChange={e => handleChange('options', e.target.value.split(',').map((opt: string) => opt.trim()).filter(Boolean))} />
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Valor por defecto</label>
            <input type="text" className="admin-input" value={form.default_value || ''} onChange={e => handleChange('default_value', e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Regla de validación (regex, etc)</label>
            <input type="text" className="admin-input" value={form.validation_rule || ''} onChange={e => handleChange('validation_rule', e.target.value)} />
          </div>
          <div className="admin-form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" id="required-checkbox" checked={form.required || false} onChange={e => handleChange('required', e.target.checked)} style={{width: 'auto'}}/>
            <label htmlFor="required-checkbox" className="admin-label">Requerido</label>
          </div>
          <div className="admin-form-actions">
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => navigate('/admin')}>Cancelar</button>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={loading}>{loading ? 'Guardando...' : (id ? 'Actualizar' : 'Crear')}</button>
          </div>
        </form>
      )}
    </div>
  )
}
