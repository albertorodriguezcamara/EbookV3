import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Category {
  id: string;
  name: string;
  display_name: string;
}

interface SubcategoryAttribute {
  id: string;
  display_name: string;
  type: 'text' | 'textarea' | 'select' | 'number';
  required: boolean;
  options: string[] | null;
}

const BookEditor: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [attributes, setAttributes] = useState<SubcategoryAttribute[]>([]);
  const [formData, setFormData] = useState<{ [key: string]: any }>({});
  const [loading, setLoading] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      setLoading('Cargando categorías...');
      const { data, error } = await supabase.from('categories').select('id, name, display_name').is('parent_id', null).order('display_order');
      if (error) setError(error.message); else if (data) setCategories(data);
      setLoading('');
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (!selectedCategory) {
      setSubcategories([]); setSelectedSubcategory(''); setAttributes([]); setFormData({});
      return;
    }
    const fetchSubcategories = async () => {
      setLoading('Cargando subcategorías...');
      const { data, error } = await supabase.from('categories').select('id, name, display_name').eq('parent_id', selectedCategory).order('display_order');
      if (error) setError(error.message); else if (data) setSubcategories(data);
      setSelectedSubcategory(''); setAttributes([]); setFormData({});
      setLoading('');
    };
    fetchSubcategories();
  }, [selectedCategory]);

  useEffect(() => {
    if (!selectedSubcategory) {
      setAttributes([]); setFormData({});
      return;
    }
    const fetchAttributes = async () => {
      setLoading('Cargando atributos...');
      setError(null); // Clear previous errors
      setAttributes([]); // Clear previous attributes
      try {
        // 1. Fetch the subcategory name using selectedSubcategory (which is an ID)
        const { data: subcatNameData, error: subcatNameError } = await supabase
          .from('categories')
          .select('display_name')
          .eq('id', selectedSubcategory)
          .single();

        if (subcatNameError) throw new Error(`Error fetching subcategory name: ${subcatNameError.message}`);
        if (!subcatNameData || !subcatNameData.display_name) throw new Error('Subcategory name not found.');

        const subcategoryName = subcatNameData.display_name;

        // 2. Fetch attributes using the subcategory name
        const { data, error } = await supabase
          .from('subcategory_attributes')
          .select('*')
          .eq('subcategory', subcategoryName) // Filter by the 'subcategory' text column
          .order('display_order'); // Assuming display_order is preferred, or 'id'

        if (error) throw error;
        
        setAttributes(data || []);
        const initialData = (data || []).reduce((acc, attr) => ({ ...acc, [attr.id]: attr.default_value ?? '' }), {});
        setFormData(initialData);

      } catch (err: any) {
        setError(`Error al cargar atributos: ${err.message}`);
        setAttributes([]); // Ensure attributes are cleared on error
      } finally {
        setLoading('');
      }
    };
    fetchAttributes();
  }, [selectedSubcategory]);

  const handleInputChange = (attributeId: string, value: any) => {
    setFormData(prev => ({ ...prev, [attributeId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setError('Debes iniciar sesión para crear un ebook.'); return; }
    if (!title.trim() || !selectedCategory || !selectedSubcategory) { setError('Por favor, completa el título, la categoría y la subcategoría.'); return; }

    setLoading('Guardando ebook...');
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from('books')
        .insert([{ user_id: user.id, title: title.trim(), category_id: selectedCategory, subcategory_id: selectedSubcategory, book_attributes: formData, status: 'draft' }])
        .select()
        .single();

      if (insertError) throw insertError;
      
      console.log('Libro creado:', data);
      navigate('/dashboard'); // Redirigir al dashboard por ahora
    } catch (err: any) {
      setError(`Error al guardar el libro: ${err.message}`);
    } finally {
      setLoading('');
    }
  };

  const renderAttributeInput = (attr: SubcategoryAttribute) => {
    const commonProps = {
      id: attr.id,
      className: 'admin-input',
      value: formData[attr.id] || '',
      onChange: (e: React.ChangeEvent<any>) => handleInputChange(attr.id, e.target.value),
      required: attr.required,
      disabled: !!loading,
    };

    switch (attr.type) {
      case 'textarea': return <textarea {...commonProps} rows={4} />;
      case 'select': return (
        <select {...commonProps} className="admin-select">
          <option value="">Seleccione</option>
          {attr.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
      case 'number': return <input type="number" {...commonProps} />;
      default: return <input type="text" {...commonProps} />;
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-form-container">
        <h1 className="admin-title">Crear Nuevo Ebook</h1>
        {error && <div className="admin-error">{error}</div>}
        {loading && <div className="admin-loading">{loading}</div>}

        <form onSubmit={handleSubmit} className="admin-form admin-section">
          <div className="admin-form-group">
            <label htmlFor="title" className="admin-label">Título del Ebook</label>
            <input type="text" id="title" className="admin-input" value={title} onChange={e => setTitle(e.target.value)} required disabled={!!loading} />
          </div>

          <div className="admin-form-group">
            <label className="admin-label">Categoría</label>
            <select className="admin-select" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} disabled={!!loading} required>
              <option value="">Seleccione una categoría</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.display_name}</option>)}
            </select>
          </div>

          {subcategories.length > 0 && (
            <div className="admin-form-group">
              <label className="admin-label">Subcategoría</label>
              <select className="admin-select" value={selectedSubcategory} onChange={e => setSelectedSubcategory(e.target.value)} disabled={!!loading} required>
                <option value="">Seleccione una subcategoría</option>
                {subcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.display_name}</option>)}
              </select>
            </div>
          )}

          {attributes.length > 0 && <hr className="admin-hr" />}

          {attributes.map(attr => (
            <div key={attr.id} className="admin-form-group">
              <label htmlFor={attr.id} className="admin-label">{attr.display_name}{attr.required && ' *'}</label>
              {renderAttributeInput(attr)}
            </div>
          ))}

          {selectedSubcategory && (
            <div className="admin-form-actions">
              <button type="submit" className="admin-btn admin-btn-primary" disabled={!!loading}>
                {loading ? 'Guardando...' : 'Crear Ebook y Empezar'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default BookEditor;
