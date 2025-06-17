import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Category {
  id: string
  name: string
  display_name: string
  description: string | null
  icon: string | null
  parent_id: string | null
  created_at: string
  updated_at: string
  display_order: number
  color: string | null
}

export default function CategoryAdmin() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Category | null>(null)

  const fetchCategories = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('display_order')
    if (error) setError(error.message)
    else setCategories(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchCategories() }, [])

  const handleEdit = (cat: Category) => {
    navigate(`/admin/category/${cat.id}`)
  }

  const handleDelete = async (id: string) => {
    setLoading(true)
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) {
        setError(error.message)
    } else {
        fetchCategories()
    }
    setLoading(false)
    setDeleteConfirm(null)
  }

  return (
    <div className="admin-section">
        {deleteConfirm && (
            <div className="admin-dialog-overlay">
                <div className="admin-dialog">
                    <h3 className="admin-dialog-title">Confirmar eliminación</h3>
                    <p className="admin-dialog-content">¿Seguro que deseas eliminar la categoría "{deleteConfirm.name}"?</p>
                    <div className="admin-form-actions">
                        <button onClick={() => setDeleteConfirm(null)} className="admin-btn admin-btn-secondary">Cancelar</button>
                        <button onClick={() => handleDelete(deleteConfirm.id)} className="admin-btn admin-btn-danger">Eliminar</button>
                    </div>
                </div>
            </div>
        )}
        <div className="admin-section-header">
            <h2>Categorías</h2>
            <button className="admin-btn admin-btn-success" onClick={() => navigate('/admin/category/new')}>Nueva Categoría</button>
        </div>
        {error && <div className="admin-error">{error}</div>}
        {loading && !deleteConfirm ? <p className='admin-loading'>Cargando...</p> : (
            <table className="admin-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Nombre para mostrar</th>
                        <th>Descripción</th>
                        <th>Icono</th>
                        <th>Color</th>
                        <th>Orden</th>
                        <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {categories.map(cat => (
                        <tr key={cat.id}>
                            <td>{cat.name}</td>
                            <td>{cat.display_name}</td>
                            <td>{cat.description}</td>
                            <td>{cat.icon}</td>
                            <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '20px', height: '20px', backgroundColor: cat.color || 'transparent', border: '1px solid #ccc', borderRadius: '4px' }}></div>
                                    {cat.color}
                                </div>
                            </td>
                            <td>{cat.display_order}</td>
                            <td className="actions">
                                <button className="admin-btn admin-btn-primary" onClick={() => handleEdit(cat)}>Editar</button>
                                <button className="admin-btn admin-btn-danger" onClick={() => setDeleteConfirm(cat)}>Eliminar</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
    </div>
  )
}
