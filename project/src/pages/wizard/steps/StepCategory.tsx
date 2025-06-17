import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWizard } from '../WizardContext';
import { supabase } from '../../../lib/supabase'; // Ajusta la ruta según tu estructura
import { Category } from '../types'; // Importa el tipo Category

const StepCategory: React.FC = () => {
  const { state, dispatch, reset } = useWizard();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(state.categoryId);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(state.subcategoryId);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .is('parent_id', null) // Solo categorías principales
          .order('display_order');
        if (error) throw error;
        setCategories(data || []);
      } catch (error) {
        console.error('Error fetching categories:', error);
        // Aquí podrías mostrar un error al usuario
      }
      setLoadingCategories(false);
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedCategoryId) {
      const fetchSubcategories = async () => {
        setLoadingSubcategories(true);
        setSubcategories([]); // Limpia subcategorías anteriores
        setSelectedSubcategoryId(null); // Deselecciona subcategoría anterior
        try {
          const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('parent_id', selectedCategoryId)
            .order('display_order');
          if (error) throw error;
          setSubcategories(data || []);
        } catch (error) {
          console.error('Error fetching subcategories:', error);
        }
        setLoadingSubcategories(false);
      };
      fetchSubcategories();
    }
  }, [selectedCategoryId]);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategoryId(e.target.value);
  };

  const handleSubcategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSubcategoryId(e.target.value);
  };

  const handleNext = () => {
    if (selectedCategoryId && selectedSubcategoryId) {
      dispatch({ type: 'SET_CATEGORY', categoryId: selectedCategoryId, subcategoryId: selectedSubcategoryId });
    }
  };

  const handleCancel = () => {
    reset();
    navigate('/'); // Redirige a la página principal o dashboard
  };

  return (
    <div>
      <h2>1. Selecciona Categoría y Subcategoría</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="category-select" style={{ display: 'block', marginBottom: '5px' }}>Categoría:</label>
        <select 
          id="category-select" 
          value={selectedCategoryId || ''} 
          onChange={handleCategoryChange}
          disabled={loadingCategories}
          style={{ padding: '8px', minWidth: '200px' }}
        >
          <option value="" disabled>{loadingCategories ? 'Cargando...' : 'Selecciona una categoría'}</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.display_name}</option>
          ))}
        </select>
      </div>

      {selectedCategoryId && (
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="subcategory-select" style={{ display: 'block', marginBottom: '5px' }}>Subcategoría:</label>
          <select 
            id="subcategory-select" 
            value={selectedSubcategoryId || ''} 
            onChange={handleSubcategoryChange}
            disabled={loadingSubcategories || subcategories.length === 0}
            style={{ padding: '8px', minWidth: '200px' }}
          >
            <option value="" disabled>
              {loadingSubcategories ? 'Cargando...' : (subcategories.length === 0 ? 'No hay subcategorías' : 'Selecciona una subcategoría')}
            </option>
            {subcategories.map(subcat => (
              <option key={subcat.id} value={subcat.id}>{subcat.display_name}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={handleCancel}
          style={{ padding: '10px 15px', marginRight: '10px', cursor: 'pointer', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Cancelar
        </button>
        <button 
          onClick={handleNext} 
          disabled={!selectedCategoryId || !selectedSubcategoryId}
          style={{ padding: '10px 15px', cursor: (!selectedCategoryId || !selectedSubcategoryId) ? 'not-allowed' : 'pointer', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default StepCategory;
