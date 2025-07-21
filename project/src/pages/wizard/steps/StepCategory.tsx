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
    <div className="wizard-step-container">
      <h2 className="wizard-step-title">1. Selecciona Categoría y Subcategoría</h2>
      
      <div className="form-group">
        <label htmlFor="category-select">Categoría:</label>
        <select 
          id="category-select" 
          value={selectedCategoryId || ''} 
          onChange={handleCategoryChange}
          disabled={loadingCategories}
        >
          <option value="" disabled>{loadingCategories ? 'Cargando...' : 'Selecciona una categoría'}</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.display_name}</option>
          ))}
        </select>
      </div>

      {selectedCategoryId && (
        <div className="form-group">
          <label htmlFor="subcategory-select">Subcategoría:</label>
          <select 
            id="subcategory-select" 
            value={selectedSubcategoryId || ''} 
            onChange={handleSubcategoryChange}
            disabled={loadingSubcategories || subcategories.length === 0}
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

      <div className="wizard-nav-buttons">
        <div className="wizard-nav-group">
          <button 
            onClick={handleCancel}
            className="wizard-btn wizard-btn-danger"
          >
            Cancelar
          </button>
        </div>
        <button 
          onClick={handleNext} 
          disabled={!selectedCategoryId || !selectedSubcategoryId}
          className="wizard-btn wizard-btn-primary"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default StepCategory;
