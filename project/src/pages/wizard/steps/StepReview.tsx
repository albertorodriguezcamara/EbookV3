import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWizard } from '../WizardContext';
import { supabase } from '../../../lib/supabase';
import { WizardState } from '../types';

interface ResolvedAgentConfig {
  providerName: string | null;
  modelName: string | null;
}

interface ResolvedAgents {
  editor?: ResolvedAgentConfig;
  writer?: ResolvedAgentConfig;
  image?: ResolvedAgentConfig;
  cover?: ResolvedAgentConfig;
}

interface ResolvedDetail {
  id: string;
  displayName: string;
  value: any;
  type: string;
}

const StepReview: React.FC = () => {
  const { state, dispatch, prevStep, reset } = useWizard();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [reviewData, setReviewData] = useState<{
    categoryName: string | null;
    subcategoryName: string | null;
    resolvedAgents: ResolvedAgents;
    resolvedDetails: ResolvedDetail[];
  } | null>(null);

  useEffect(() => {
    const fetchReviewData = async () => {
      if (state.step !== 4) return;
      setLoading(true);
      setError(null);

      try {
        let categoryName: string | null = null;
        if (state.categoryId) {
          const { data, error } = await supabase.from('categories').select('display_name').eq('id', state.categoryId).maybeSingle();
          if (error) throw new Error(`Error cargando categoría: ${error.message}`);
          categoryName = data?.display_name || 'Desconocido';
        }

        let subcategoryName: string | null = null;
        const dynamicAttributes: Record<string, { displayName: string, type: string }> = {};
        if (state.subcategoryId) {
          const { data: subcatData, error: subcatError } = await supabase.from('categories').select('name, display_name').eq('id', state.subcategoryId).maybeSingle();
          if (subcatError) throw new Error(`Error cargando subcategoría: ${subcatError.message}`);
          subcategoryName = subcatData?.display_name || 'Desconocido';
          if (subcatData?.name) {
            const { data: attrsData, error: attrsError } = await supabase.from('subcategory_attributes').select('name, display_name, type').eq('subcategory', subcatData.name);
            if (attrsError) throw new Error(`Error cargando atributos: ${attrsError.message}`);
            attrsData?.forEach(attr => { dynamicAttributes[attr.name] = { displayName: attr.display_name, type: attr.type }; });
          }
        }

        const fixedAttributes: Record<string, { displayName: string, type: string, order: number }> = {
          provisional_title: { displayName: 'Título Provisional', type: 'text', order: 1 },
          author: { displayName: 'Autor', type: 'text', order: 2 },
          idea: { displayName: 'Idea Principal / Sinopsis', type: 'textarea', order: 3 },
          language: { displayName: 'Idioma', type: 'select', order: 4 },
          target_number_of_chapters: { displayName: 'Número de Capítulos', type: 'number', order: 5 },
          target_word_count: { displayName: 'Extensión (palabras por cap.)', type: 'select', order: 6 },
          generate_cover: { displayName: 'Generar Portada IA', type: 'boolean', order: 7 },
        };

        const resolvedDetails = Object.entries(state.details).map(([key, value]) => {
          const attr = fixedAttributes[key] || dynamicAttributes[key];
          return {
            id: key,
            displayName: attr?.displayName || key,
            value: value,
            type: attr?.type || 'text',
          };
        }).sort((a, b) => (fixedAttributes[a.id]?.order ?? Infinity) - (fixedAttributes[b.id]?.order ?? Infinity));

        const resolvedAgents: ResolvedAgents = {};
        const agentRoles = Object.keys(state.agentConfig) as Array<keyof WizardState['agentConfig']>;
        const modelIds = agentRoles.map(role => state.agentConfig[role]?.modelId).filter(Boolean) as string[];

        if (modelIds.length > 0) {
          const { data: models, error: modelError } = await supabase.from('ai_models').select('id, display_name, ai_providers(name)').in('id', modelIds);
          if (modelError) throw new Error(`Error cargando modelos: ${modelError.message}`);

          const modelMap = new Map(models.map(m => [m.id, m]));

          for (const role of agentRoles) {
            const modelId = state.agentConfig[role]?.modelId;
            if (modelId && modelMap.has(modelId)) {
              const model = modelMap.get(modelId);
              const provider = model?.ai_providers as any;
              resolvedAgents[role] = {
                providerName: Array.isArray(provider) ? provider[0]?.name : provider?.name || 'N/A',
                modelName: model?.display_name || 'N/A',
              };
            }
          }
        }

        setReviewData({ categoryName, subcategoryName, resolvedAgents, resolvedDetails });

      } catch (err: any) {
        setError(err.message || 'Ocurrió un error desconocido.');
      } finally {
        setLoading(false);
      }
    };

    fetchReviewData();
  }, [state.step, state.categoryId, state.subcategoryId, state.details, state.agentConfig]);

  const handleCreateBook = async () => {
    setLoading(true);
    setError(null);
    try {
      const ai_config: { [key: string]: string | null } = {
        writer_model_id: state.agentConfig.writer?.modelId || null,
        editor_model_id: state.agentConfig.editor?.modelId || null,
        image_generator_model_id: state.details.generate_cover ? state.agentConfig.cover?.modelId || null : null,
      };

      const { provisional_title, author, idea, language, target_word_count, target_number_of_chapters, generate_cover, ...otherDetails } = state.details;
      const book_attributes = { ...otherDetails, is_illustrated: state.isIllustrated };

      const bookPayload = {
        title: provisional_title, author, idea, language,
        category_id: state.categoryId,
        subcategory_id: state.subcategoryId,
        target_word_count: target_word_count ? parseInt(target_word_count, 10) : null,
        target_number_of_chapters: target_number_of_chapters ? parseInt(target_number_of_chapters, 10) : null,
        book_attributes,
        ai_config,
      };

      console.log('Sending bookPayload:', JSON.stringify(bookPayload, null, 2));
    const { data, error } = await supabase.functions.invoke('handle-book-creation-request', { body: bookPayload });

      console.log('Response from handle-book-creation-request:', JSON.stringify(data, null, 2));
      if (error) {
        let msg = error.message;
        try { msg = JSON.parse(error.context?.response?.text || '{}').error || msg; } catch (e) {}
        throw new Error(`Error al crear el libro: ${msg}`);
      }

      if (data && data.request_id) {
        reset();
        dispatch({ type: 'SET_REQUEST_ID', payload: data.request_id });
        navigate(`/creating-book/${data.request_id}`);
      } else {
        throw new Error('La respuesta no incluyó un ID de solicitud.');
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => { reset(); navigate('/'); };

  if (state.step !== 4) return null;
  if (loading) return <div className="wizard-step-container"><p>Cargando revisión...</p></div>;
  if (error) return <div className="wizard-step-container"><p style={{ color: 'red' }}>Error: {error}</p></div>;
  if (!reviewData) return <div className="wizard-step-container"><p>No hay datos para mostrar.</p></div>;

  const { categoryName, subcategoryName, resolvedAgents, resolvedDetails } = reviewData;

  return (
    <div className="wizard-step-container">
      <h2 className="wizard-step-title">Revisa y Confirma tu Libro</h2>

      <section className="review-section">
        <h4>Categoría</h4>
        <div className="review-item"><div className="review-item-label">Categoría:</div><div className="review-item-value">{categoryName || 'N/A'}</div></div>
        <div className="review-item"><div className="review-item-label">Subcategoría:</div><div className="review-item-value">{subcategoryName || 'N/A'}</div></div>
      </section>

      <section className="review-section">
        <h4>Detalles del Libro</h4>
        {resolvedDetails.map(d => (
          <div className="review-item" key={d.id}>
            <div className="review-item-label">{d.displayName}:</div>
            <div className="review-item-value">{typeof d.value === 'boolean' ? (d.value ? 'Sí' : 'No') : d.value?.toString() || 'N/A'}</div>
          </div>
        ))}
      </section>

      <section className="review-section">
        <h4>Configuración de IA</h4>
        {Object.entries(resolvedAgents).map(([role, agent]) => {
          if (!agent?.providerName) return null;
          return (
            <div className="review-item" key={role}>
              <div className="review-item-label" style={{ textTransform: 'capitalize' }}>{role}:</div>
              <div className="review-item-value">{agent.providerName} - {agent.modelName}</div>
            </div>
          );
        })}
      </section>

      <div className="form-group">
        <label className="wizard-checkbox-container">
          <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} style={{ display: 'none' }} />
          <div className={`wizard-checkbox ${termsAccepted ? 'checked' : ''}`}></div>
          Acepto los Términos y Condiciones y entiendo los costes asociados.
        </label>
      </div>

      <div className="wizard-nav-buttons">
        <div className="wizard-nav-group">
          <button type="button" onClick={handleCancel} className="wizard-btn wizard-btn-danger" disabled={loading}>Cancelar</button>
          <button type="button" onClick={prevStep} className="wizard-btn wizard-btn-warning" disabled={loading}>Atrás</button>
        </div>
        <button type="button" onClick={handleCreateBook} className={`wizard-btn wizard-btn-success ${!loading && termsAccepted ? 'wizard-btn-pulse' : ''}`} disabled={!termsAccepted || loading}>
          {loading ? 'Procesando...' : 'Crear Libro'}
        </button>
      </div>
    </div>
  );
};

export default StepReview;
