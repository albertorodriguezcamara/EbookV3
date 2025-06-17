import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Category {
  id?: string;
  name: string;
  display_name: string;
  description?: string | null;
  icon?: string | null;
  parent_id?: string | null;
  display_order?: number | null;
  color?: string | null;
}

export default function EditCategory() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<Category>({
    name: '',
    display_name: '',
    description: '',
    icon: '',
    parent_id: null,
    display_order: 0,
    color: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    const fetchOne = async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('id', id).single();
      if (error) setError(error.message);
      else if (data) setForm(data);
    };
    fetchOne();
  }, [id, isEdit]);

  const handleChange = (field: keyof Category, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const payload = {
      name: form.name,
      display_name: form.display_name,
      description: form.description || null,
      icon: form.icon || null,
      parent_id: form.parent_id || null,
      display_order: form.display_order ?? 0,
      color: form.color || null
    };
    try {
      if (isEdit) {
        const { error } = await supabase.from('categories').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('categories').insert([payload]);
        if (error) throw error;
      }
      navigate('/admin');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-container">
      <h1 className="admin-title">{isEdit ? 'Editar Categoría' : 'Nueva Categoría'}</h1>
      {error && <p className="admin-error">{error}</p>}
      <form onSubmit={handleSubmit} className="admin-form">
        <div className="admin-form-group">
          <label className="admin-label">Nombre (único)</label>
          <input
            type="text"
            className="admin-input"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
          />
        </div>
        <div className="admin-form-group">
          <label className="admin-label">Nombre para mostrar</label>
          <input
            type="text"
            className="admin-input"
            value={form.display_name}
            onChange={(e) => handleChange('display_name', e.target.value)}
            required
          />
        </div>
        <div className="admin-form-group">
          <label className="admin-label">Descripción</label>
          <input
            type="text"
            className="admin-input"
            value={form.description ?? ''}
            onChange={(e) => handleChange('description', e.target.value)}
          />
        </div>
        <div className="admin-form-grid">
            <div className="admin-form-group">
                <label className="admin-label">Icono</label>
                <input
                  type="text"
                  className="admin-input"
                  value={form.icon ?? ''}
                  onChange={(e) => handleChange('icon', e.target.value)}
                />
            </div>
            <div className="admin-form-group">
                <label className="admin-label">Color</label>
                <input
                  type="text"
                  className="admin-input"
                  value={form.color ?? ''}
                  onChange={(e) => handleChange('color', e.target.value)}
                />
            </div>
        </div>
        <div className="admin-form-group">
          <label className="admin-label">Orden</label>
          <input
            type="number"
            className="admin-input"
            value={form.display_order ?? 0}
            onChange={(e) => handleChange('display_order', Number(e.target.value))}
          />
        </div>
        <div className="admin-form-actions">
          <button type="button" className="admin-btn admin-btn-secondary" onClick={() => navigate('/admin')}>Cancelar</button>
          <button type="submit" disabled={loading} className="admin-btn admin-btn-primary">
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
