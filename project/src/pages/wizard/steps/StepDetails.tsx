import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWizard } from '../WizardContext';
import { supabase } from '../../../lib/supabase';
import { SubcategoryAttribute } from '../types';

// Componente para manejar campos de tipo array
const ArrayInput: React.FC<{
  name: string;
  value: string[];
  onChange: (name: string, value: string[], type: 'array') => void;
  placeholder?: string;
}> = ({ name, value = [], onChange, placeholder }) => {
  const [inputValue, setInputValue] = useState('');

  const handleAddItem = () => {
    if (inputValue.trim() !== '') {
      onChange(name, [...value, inputValue.trim()], 'array');
      setInputValue('');
    }
  };

  const handleRemoveItem = (indexToRemove: number) => {
    onChange(name, value.filter((_, index) => index !== indexToRemove), 'array');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder || 'Añadir elemento...'}
          style={{ flexGrow: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddItem();
            }
          }}
        />
        <button type="button" onClick={handleAddItem} style={{ marginLeft: '8px', padding: '8px 12px' }}>Añadir</button>
      </div>
      <ul style={{ listStyleType: 'none', paddingLeft: 0, marginTop: '10px' }}>
        {(value || []).map((item, index) => (
          <li key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px', borderBottom: '1px solid #eee' }}>
            {item}
            <button type="button" onClick={() => handleRemoveItem(index)} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer' }}>✖</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const StepDetails: React.FC = () => {
  const { state, dispatch, prevStep, nextStep, reset } = useWizard();
  const navigate = useNavigate();
  const [attributes, setAttributes] = useState<SubcategoryAttribute[]>([]);
  const [loadingAttributes, setLoadingAttributes] = useState(false);

  const [formData, setFormData] = useState<Record<string, any>>(() => ({
    provisional_title: '',
    idea: '',
    num_chapters: 5,
    chapter_length: 'medio',
    ...state.details,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchAttributes = useCallback(async () => {
    if (!state.subcategoryId) return;
    setLoadingAttributes(true);
    setAttributes([]);
    try {
      const { data: subcatData, error: subcatError } = await supabase
        .from('categories')
        .select('name')
        .eq('id', state.subcategoryId)
        .single();

      if (subcatError) throw new Error(`Error fetching subcategory name: ${subcatError.message}`);
      if (!subcatData?.name) throw new Error('Subcategory name not found.');

      const { data, error } = await supabase
        .from('subcategory_attributes')
        .select('*')
        .eq('subcategory', subcatData.name);

      if (error) throw error;

      const parsedAttributes = (data || []).map((attr: any) => {
        let options = attr.options;
        if (typeof options === 'string') {
          try {
            options = JSON.parse(options);
          } catch {
            options = [];
          }
        }
        return { ...attr, options: Array.isArray(options) ? options : [] };
      });
      setAttributes(parsedAttributes);

      const dynamicDefaults: Record<string, any> = {};
      parsedAttributes.forEach((attr: SubcategoryAttribute) => {
        if (formData[attr.name] === undefined) {
          if (attr.default_value !== null && attr.default_value !== undefined) {
            if (attr.type === 'array' && typeof attr.default_value === 'string') {
              try {
                dynamicDefaults[attr.name] = JSON.parse(attr.default_value);
              } catch (e) {
                dynamicDefaults[attr.name] = [];
              }
            } else if (attr.type === 'boolean') {
              dynamicDefaults[attr.name] = attr.default_value === 'true';
            } else {
              dynamicDefaults[attr.name] = attr.default_value;
            }
          } else {
            dynamicDefaults[attr.name] = attr.type === 'boolean' ? false : (attr.type === 'array' ? [] : '');
          }
        }
      });

      if (Object.keys(dynamicDefaults).length > 0) {
        setFormData(prevData => ({ ...prevData, ...dynamicDefaults }));
      }

    } catch (error) {
      console.error('Error fetching subcategory attributes:', error);
    }
    setLoadingAttributes(false);
  }, [state.subcategoryId]);

  useEffect(() => {
    fetchAttributes();
  }, [fetchAttributes]);

  const handleInputChange = (name: string, value: any, type: SubcategoryAttribute['type']) => {
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? null : parseFloat(value)) : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!formData['provisional_title']) newErrors['provisional_title'] = 'El título provisional es obligatorio.';
    if (!formData['idea']) newErrors['idea'] = 'La idea principal es obligatoria.';
    if (!formData['num_chapters'] || formData['num_chapters'] <= 0) newErrors['num_chapters'] = 'El número de capítulos es obligatorio y debe ser mayor que 0.';
    if (!formData['chapter_length']) newErrors['chapter_length'] = 'Debes seleccionar una extensión para los capítulos.';

    attributes.forEach((attr: SubcategoryAttribute) => {
      if (attr.required) {
        const value = formData[attr.name];
        if (attr.type === 'array') {
          if (!value || value.length === 0) {
            newErrors[attr.name] = `El campo ${attr.display_name} es obligatorio y debe contener al menos un elemento.`;
          }
        } else if (value === undefined || value === '' || value === null) {
          newErrors[attr.name] = `El campo ${attr.display_name} es obligatorio.`;
        }
      }
      if (attr.type === 'email' && formData[attr.name] && !/\S+@\S+\.\S+/.test(formData[attr.name])) {
        newErrors[attr.name] = `Por favor, introduce un email válido para ${attr.display_name}.`;
      }
      if (attr.type === 'url' && formData[attr.name] && !/^(ftp|http|https):\/\/[^ "]+$/.test(formData[attr.name])) {
        newErrors[attr.name] = `Por favor, introduce una URL válida para ${attr.display_name}.`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [attributes, formData]);

  const handleNext = useCallback(() => {
    if (validateForm()) {
      dispatch({ type: 'SET_DETAILS', details: formData });
      nextStep();
    }
  }, [dispatch, formData, nextStep, validateForm]);

  const handleCancel = useCallback(() => {
    reset();
    navigate('/');
  }, [navigate, reset]);

  const renderField = useCallback((attr: SubcategoryAttribute) => {
    const commonProps = {
      id: attr.name,
      name: attr.name,
      required: !!attr.required,
      className: errors[attr.name] ? 'input-error' : '',
      style: { padding: '8px', marginBottom: '5px', border: errors[attr.name] ? '1px solid red' : '1px solid #ccc', borderRadius: '4px', width: '100%', boxSizing: 'border-box' as const },
    };

    switch (attr.type) {
      case 'text':
      case 'email':
      case 'url':
        return <input type={attr.type} {...commonProps} value={formData[attr.name] || ''} onChange={(e) => handleInputChange(attr.name, e.target.value, attr.type)} />;
      case 'textarea':
        return <textarea {...commonProps} value={formData[attr.name] || ''} onChange={(e) => handleInputChange(attr.name, e.target.value, attr.type)} />;
      case 'number':
        return <input type="number" {...commonProps} value={formData[attr.name] || ''} onChange={(e) => handleInputChange(attr.name, e.target.value, attr.type)} />;
      case 'boolean':
        return (
          <input
            type="checkbox"
            id={attr.name}
            name={attr.name}
            checked={!!formData[attr.name]}
            onChange={(e) => handleInputChange(attr.name, e.target.checked, 'boolean')}
            style={{ height: '20px', width: '20px' }}
          />
        );
      case 'select':
        return (
          <select {...commonProps} value={formData[attr.name] || ''} onChange={(e) => handleInputChange(attr.name, e.target.value, attr.type)}>
            <option value="" disabled>Selecciona...</option>
            {attr.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        );
      case 'array':
        return (
          <ArrayInput
            name={attr.name}
            value={formData[attr.name] || []}
            onChange={handleInputChange}
            placeholder={`Añadir a ${attr.display_name}...`}
          />
        );
      default:
        return <p>Tipo de campo no soportado: {attr.type}</p>;
    }
  }, [errors, formData]);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ textAlign: 'center' }}>2. Detalles del Libro</h2>
      <form onSubmit={(e) => e.preventDefault()} noValidate>
        <div className="form-group">
          <label htmlFor="provisional_title" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Título Provisional<span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="text"
            id="provisional_title"
            name="provisional_title"
            value={formData.provisional_title || ''}
            onChange={(e) => handleInputChange('provisional_title', e.target.value, 'text')}
            className={errors['provisional_title'] ? 'input-error' : ''}
            style={{ padding: '8px', marginBottom: '5px', border: errors['provisional_title'] ? '1px solid red' : '1px solid #ccc', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}
          />
          {errors['provisional_title'] && <small style={{ color: 'red', display: 'block', marginTop: '3px' }}>{errors['provisional_title']}</small>}
        </div>

        <div className="form-group">
          <label htmlFor="idea" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Idea Principal / Sinopsis<span style={{ color: 'red' }}>*</span>
          </label>
          <textarea
            id="idea"
            name="idea"
            value={formData.idea || ''}
            onChange={(e) => handleInputChange('idea', e.target.value, 'textarea')}
            className={errors['idea'] ? 'input-error' : ''}
            style={{ padding: '8px', marginBottom: '5px', border: errors['idea'] ? '1px solid red' : '1px solid #ccc', borderRadius: '4px', width: '100%', boxSizing: 'border-box', minHeight: '80px' }}
          />
          {errors['idea'] && <small style={{ color: 'red', display: 'block', marginTop: '3px' }}>{errors['idea']}</small>}
        </div>

        <div className="form-group">
          <label htmlFor="num_chapters" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Número de Capítulos<span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="number"
            id="num_chapters"
            name="num_chapters"
            value={formData.num_chapters || ''}
            onChange={(e) => handleInputChange('num_chapters', e.target.value, 'number')}
            className={errors['num_chapters'] ? 'input-error' : ''}
            style={{ padding: '8px', marginBottom: '5px', border: errors['num_chapters'] ? '1px solid red' : '1px solid #ccc', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}
            min="1"
          />
          {errors['num_chapters'] && <small style={{ color: 'red', display: 'block', marginTop: '3px' }}>{errors['num_chapters']}</small>}
        </div>

        <div className="form-group">
          <label htmlFor="chapter_length" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Extensión de los Capítulos<span style={{ color: 'red' }}>*</span>
          </label>
          <select
            id="chapter_length"
            name="chapter_length"
            value={formData.chapter_length || 'medio'}
            onChange={(e) => handleInputChange('chapter_length', e.target.value, 'select')}
            className={errors['chapter_length'] ? 'input-error' : ''}
            style={{ padding: '8px', marginBottom: '5px', border: errors['chapter_length'] ? '1px solid red' : '1px solid #ccc', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}
          >
            <option value="corto">Corto (~500 palabras)</option>
            <option value="medio">Medio (~1500 palabras)</option>
            <option value="largo">Largo (~2500+ palabras)</option>
          </select>
          {errors['chapter_length'] && <small style={{ color: 'red', display: 'block', marginTop: '3px' }}>{errors['chapter_length']}</small>}
        </div>

        {loadingAttributes && <p>Cargando atributos dinámicos...</p>}
        {attributes.length > 0 && <h3 style={{ marginTop: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>Atributos Específicos</h3>}
        {attributes.map(attr => (
          <div className="form-group" key={attr.id}>
            <label htmlFor={attr.name} style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              {attr.display_name}
              {attr.required && <span style={{ color: 'red' }}>*</span>}
            </label>
            {renderField(attr)}
            {attr.description && <small style={{ color: '#666', display: 'block', marginTop: '3px' }}>{attr.description}</small>}
            {errors[attr.name] && <small style={{ color: 'red', display: 'block', marginTop: '3px' }}>{errors[attr.name]}</small>}
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
          <button type="button" onClick={prevStep} style={{ padding: '10px 20px' }}>Atrás</button>
          <button type="button" onClick={handleCancel} style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px' }}>Cancelar</button>
          <button type="button" onClick={handleNext} style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px' }}>Siguiente</button>
        </div>
      </form>
    </div>
  );
};

export default StepDetails;
