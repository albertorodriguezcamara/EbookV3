import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Attribute {
  id: string
  subcategory: string
  name: string
  display_name: string
  description: string | null
  type: string
  required: boolean
  options: string[] | null
  default_value: string | null
  validation_rule: string | null
  created_at: string
  updated_at: string
}

export default function SubcategoryAttributesAdmin() {
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Attribute | null>(null);
  const navigate = useNavigate();

  const fetchAttributes = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('subcategory_attributes')
      .select('*')
      .order('subcategory')
    if (error) setError(error.message)
    else setAttributes(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchAttributes() }, [])

  const handleEdit = (attr: Attribute) => {
    navigate(`/admin/attribute/${attr.id}`);
  }

  const handleDelete = async (id: string) => {
    setLoading(true)
    const { error } = await supabase.from('subcategory_attributes').delete().eq('id', id)
    if (error) {
      setError(error.message)
    } else {
      fetchAttributes()
    }
    setLoading(false)
    setDeleteConfirm(null)
  }

  const handleCreate = () => {
    navigate('/admin/attribute/new');
  }

  return (
    <div className="admin-section">
        {deleteConfirm && (
            <div className="admin-dialog-overlay">
                <div className="admin-dialog">
                    <h3 className="admin-dialog-title">Confirmar eliminación</h3>
                    <p className="admin-dialog-content">¿Seguro que deseas eliminar el atributo "{deleteConfirm.name}"?</p>
                    <div className="admin-form-actions">
                        <button onClick={() => setDeleteConfirm(null)} className="admin-btn admin-btn-secondary">Cancelar</button>
                        <button onClick={() => handleDelete(deleteConfirm.id)} className="admin-btn admin-btn-danger">Eliminar</button>
                    </div>
                </div>
            </div>
        )}
        <div className="admin-section-header">
            <h2>Atributos dinámicos de subcategoría</h2>
            <button className="admin-btn admin-btn-success" onClick={handleCreate}>Nuevo Atributo</button>
        </div>
        {error && <div className="admin-error">{error}</div>}
        {loading && !deleteConfirm ? <p className='admin-loading'>Cargando...</p> : (
            <table className="admin-table">
                <thead>
                    <tr>
                        <th>Subcategoría</th>
                        <th>Nombre</th>
                        <th>Nombre para mostrar</th>
                        <th>Tipo</th>
                        <th>Requerido</th>
                        <th>Opciones</th>
                        <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {attributes.map(attr => (
                        <tr key={attr.id}>
                            <td>{attr.subcategory}</td>
                            <td>{attr.name}</td>
                            <td>{attr.display_name}</td>
                            <td>{attr.type}</td>
                            <td>
                                <span className={`admin-badge ${attr.required ? 'admin-badge-success' : 'admin-badge-neutral'}`}>
                                    {attr.required ? 'Sí' : 'No'}
                                </span>
                            </td>
                            <td><code>{(() => {
                                if (!attr.options) return '—';
                                if (Array.isArray(attr.options)) return attr.options.join(', ');
                                return String(attr.options);
                            })()}</code></td>
                            <td className="actions">
                                <button className="admin-btn admin-btn-primary" onClick={() => handleEdit(attr)}>Editar</button>
                                <button className="admin-btn admin-btn-danger" onClick={() => setDeleteConfirm(attr)}>Eliminar</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
    </div>
  )
}
