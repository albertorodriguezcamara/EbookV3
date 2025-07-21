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
    <div className="wizard-step-array-input">
      <div className="wizard-step-array-input-container" style={{ display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder || 'Añadir elemento...'}
          className="wizard-step-array-input-field"
        />
        <button type="button" onClick={handleAddItem} className="wizard-btn wizard-btn-primary">Añadir</button>
      </div>
      <ul className="wizard-step-array-input-list">
        {(value || []).map((item, index) => (
          <li key={index} className="wizard-step-array-input-item">
            {item}
            <button type="button" onClick={() => handleRemoveItem(index)} className="wizard-btn wizard-btn-danger">✖</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const StepDetails: React.FC = () => {
  const { state, dispatch, prevStep, reset } = useWizard();
  const navigate = useNavigate();
  const [attributes, setAttributes] = useState<SubcategoryAttribute[]>([]);
  const [loadingAttributes, setLoadingAttributes] = useState(false);

  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const initialDetails = {
      provisional_title: '',
      author: '',
      idea: '',
      language: 'es', // Default language
      generate_cover: false,
      target_number_of_chapters: 5,
      target_word_count: '1300', // Default to 'Corto'
      ...state.details, // state.details will overwrite defaults if present
    };
    // If state.details had 'language' as undefined or null, or it wasn't present, ensure our default 'es' is set.
    if (initialDetails.language === undefined || initialDetails.language === null || initialDetails.language === '') {
      initialDetails.language = 'es';
    }
    return initialDetails;
  });
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
    if (!formData['author']) newErrors['author'] = 'El autor es obligatorio.';
    if (!formData['idea']) newErrors['idea'] = 'La idea principal es obligatoria.';
    if (!formData['language']) newErrors['language'] = 'El idioma es obligatorio.';
    if (!formData.target_number_of_chapters || formData.target_number_of_chapters < 1) {
      newErrors['target_number_of_chapters'] = 'Debe haber al menos 1 capítulo.';
    }
    if (!formData.target_word_count) newErrors['target_word_count'] = 'Debes seleccionar una extensión para los capítulos.';

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
      const processedDetails = {
        ...formData,
        target_word_count: parseInt(formData.target_word_count, 10),
        target_number_of_chapters: parseInt(formData.target_number_of_chapters, 10),
      };
      dispatch({ type: 'SET_DETAILS', details: processedDetails });
    }
  }, [dispatch, formData, validateForm]);

  const handleCancel = useCallback(() => {
    reset();
    navigate('/');
  }, [reset, navigate]);



  const renderField = useCallback((attr: SubcategoryAttribute) => {
    const commonProps = {
      id: attr.name,
      name: attr.name,
      required: !!attr.required,
      className: errors[attr.name] ? 'input-error' : '',
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
    <div className="wizard-step-container">
      <h2 className="wizard-step-title">2. Detalles del Libro</h2>
      <form onSubmit={(e) => e.preventDefault()} noValidate>
        <div className="form-group">
          <label htmlFor="provisional_title">
            Título Provisional<span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="text"
            id="provisional_title"
            name="provisional_title"
            value={formData.provisional_title || ''}
            onChange={(e) => handleInputChange('provisional_title', e.target.value, 'text')}
            className={errors['provisional_title'] ? 'input-error' : ''}
          />
          {errors['provisional_title'] && <small style={{ color: 'red' }}>{errors['provisional_title']}</small>}
        </div>

        <div className="form-group">
          <label htmlFor="author">
            Autor<span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="text"
            id="author"
            name="author"
            value={formData.author || ''}
            onChange={(e) => handleInputChange('author', e.target.value, 'text')}
            className={errors['author'] ? 'input-error' : ''}
          />
          {errors['author'] && <small style={{ color: 'red' }}>{errors['author']}</small>}
        </div>

        <div className="form-group">
          <label htmlFor="idea">
            Idea Principal / Sinopsis<span style={{ color: 'red' }}>*</span>
          </label>
          <textarea
            id="idea"
            name="idea"
            value={formData.idea || ''}
            onChange={(e) => handleInputChange('idea', e.target.value, 'textarea')}
            className={errors['idea'] ? 'input-error' : ''}
            rows={4}
          />
          {errors['idea'] && <small style={{ color: 'red' }}>{errors['idea']}</small>}
        </div>

        <div className="form-group">
          <label htmlFor="language">
            Idioma del Libro<span style={{ color: 'red' }}>*</span>
          </label>
          <select
            id="language"
            name="language"
            value={formData.language || 'es'}
            onChange={(e) => handleInputChange('language', e.target.value, 'select')}
            className={errors['language'] ? 'input-error' : ''}
          >
            <option value="es">Español</option>
            <option value="en">Inglés</option>
            <option value="fr">Francés</option>
            <option value="de">Alemán</option>
            <option value="pt">Portugués</option>
            {/* TODO: Considerar cargar idiomas desde una lista más completa o configuración */}
          </select>
          {errors['language'] && <small style={{ color: 'red' }}>{errors['language']}</small>}
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="checkbox"
            id="generate_cover"
            name="generate_cover"
            checked={formData.generate_cover || false}
            onChange={(e) => handleInputChange('generate_cover', e.target.checked, 'boolean')}
            style={{ width: 'auto' }}
          />
          <label htmlFor="generate_cover" style={{ marginBottom: '0' }}>
            Generar portada con IA
          </label>
        </div>

        <div className="form-group">
          <label htmlFor="target_number_of_chapters">
            Número de Capítulos<span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="number"
            id="target_number_of_chapters"
            name="target_number_of_chapters"
            value={formData.target_number_of_chapters || ''}
            onChange={(e) => handleInputChange('target_number_of_chapters', e.target.value, 'number')}
            className={errors['target_number_of_chapters'] ? 'input-error' : ''}
            min="1"
          />
          {errors['target_number_of_chapters'] && <small style={{ color: 'red' }}>{errors['target_number_of_chapters']}</small>}
        </div>

        <div className="form-group">
          <label htmlFor="target_word_count">
            Extensión de los Capítulos (palabras)<span style={{ color: 'red' }}>*</span>
          </label>
          <select
            id="target_word_count"
            name="target_word_count"
            value={formData.target_word_count || '1300'}
            onChange={(e) => handleInputChange('target_word_count', e.target.value, 'select')}
            className={errors['target_word_count'] ? 'input-error' : ''}
          >
            <option value="1300">Corto (800–1,800 palabras)</option>
            <option value="2650">Medio (1,800–3,500 palabras)</option>
            <option value="4750">Largo (3,500–6,000 palabras)</option>
            <option value="8000">Extra-largo (6,000–10,000+ palabras)</option>
          </select>
          {errors['target_word_count'] && <small style={{ color: 'red', display: 'block', marginTop: '3px' }}>{errors['target_word_count']}</small>}
        </div>

        {loadingAttributes && <p>Cargando atributos dinámicos...</p>}
        {attributes.length > 0 && <h3 className="wizard-step-subtitle">Atributos Específicos</h3>}
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

        <div className="wizard-nav-buttons">
          <div className="wizard-nav-group">
            <button type="button" onClick={handleCancel} className="wizard-btn wizard-btn-danger">Cancelar</button>
            <button type="button" onClick={prevStep} className="wizard-btn wizard-btn-warning">Atrás</button>
          </div>
          <button type="button" onClick={handleNext} className="wizard-btn wizard-btn-primary">Siguiente</button>
        </div>
      </form>
    </div>
  );
};

export default StepDetails;
