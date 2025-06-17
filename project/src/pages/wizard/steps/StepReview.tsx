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
  type: string; // To help in rendering the value appropriately
}

const StepReview: React.FC = () => {
  const { state, prevStep, reset } = useWizard();
  const navigate = useNavigate();

  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [subcategoryName, setSubcategoryName] = useState<string | null>(null);
  const [resolvedAgents, setResolvedAgents] = useState<ResolvedAgents>({});
  const [resolvedDetails, setResolvedDetails] = useState<ResolvedDetail[]>([]);
  
  const [loadingReviewData, setLoadingReviewData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    const fetchReviewData = async () => {
      setLoadingReviewData(true);
      setError(null);
      try {
        // Fetch Category Name
        if (state.categoryId) {
          const { data: catData, error: catError } = await supabase
            .from('categories')
            .select('display_name')
            .eq('id', state.categoryId)
            .single();
          if (catError) throw new Error(`Error cargando categoría: ${catError.message}`);
          setCategoryName(catData?.display_name || 'Desconocido');
        }

        // Resolve Detail Display Names and Values
        if (Object.keys(state.details).length > 0) {
          const details: ResolvedDetail[] = [];
          const dynamicAttributes: Record<string, { displayName: string, type: string }> = {};

          // 1. Fetch definitions for DYNAMIC attributes
          if (state.subcategoryId) {
            const { data: subcatData, error: subcatError } = await supabase
              .from('categories')
              .select('display_name')
              .eq('id', state.subcategoryId)
              .single();
            if (subcatError) throw new Error(`Error cargando subcategoría: ${subcatError.message}`);
            
            const fetchedSubcategoryName = subcatData?.display_name || null;
            setSubcategoryName(fetchedSubcategoryName || 'Desconocido'); // Keep this for the UI

            if (fetchedSubcategoryName) {
              const { data: attrsData, error: attrsError } = await supabase
                .from('subcategory_attributes')
                .select('name, display_name, type')
                .eq('subcategory', fetchedSubcategoryName);
              
              if (attrsError) throw new Error(`Error cargando atributos de subcategoría: ${attrsError.message}`);

              if (attrsData) {
                attrsData.forEach(attr => {
                  dynamicAttributes[attr.name] = { displayName: attr.display_name, type: attr.type };
                });
              }
            }
          }

          // 2. Define FIXED attributes
          const fixedAttributes: Record<string, { displayName: string, type: string, order: number }> = {
            provisional_title: { displayName: 'Título Provisional', type: 'text', order: 1 },
            idea: { displayName: 'Idea Principal / Sinopsis', type: 'textarea', order: 2 },
            num_chapters: { displayName: 'Número de Capítulos', type: 'number', order: 3 },
            chapter_length: { displayName: 'Extensión de los Capítulos', type: 'select', order: 4 },
          };

          // 3. Iterate through all details in state and build the resolved list
          for (const key in state.details) {
            if (state.details.hasOwnProperty(key) && state.details[key] !== null && state.details[key] !== '') {
              let displayName = key;
              let type = 'text';
              let value = state.details[key];

              if (fixedAttributes[key]) {
                displayName = fixedAttributes[key].displayName;
                type = fixedAttributes[key].type;
                if (key === 'chapter_length') {
                  switch(value) {
                    case 'corto': value = 'Corto (~500 palabras)'; break;
                    case 'medio': value = 'Medio (~1500 palabras)'; break;
                    case 'largo': value = 'Largo (~2500+ palabras)'; break;
                  }
                }
              } else if (dynamicAttributes[key]) {
                displayName = dynamicAttributes[key].displayName;
                type = dynamicAttributes[key].type;
              } else {
                continue; // Skip details that have no definition
              }

              details.push({
                id: key,
                displayName,
                value,
                type,
              });
            }
          }
          
          // 4. Sort the details to show fixed ones first, in order
          details.sort((a, b) => {
            const orderA = fixedAttributes[a.id]?.order ?? 99;
            const orderB = fixedAttributes[b.id]?.order ?? 99;
            return orderA - orderB;
          });

          setResolvedDetails(details);
        }

        // Resolve Agent Names
        const agentPromises = (Object.keys(state.agentConfig) as Array<keyof WizardState['agentConfig']>)
          .filter(role => state.agentConfig[role]?.providerId && state.agentConfig[role]?.modelId)
          .map(async (role) => {
            const config = state.agentConfig[role];
            if (!config) return { role, data: { providerName: null, modelName: null } };

            const { data: provData, error: provError } = await supabase
              .from('ai_providers')
              .select('name')
              .eq('id', config.providerId)
              .single();
            if (provError) console.warn(`Error cargando proveedor para ${role}: ${provError.message}`);
            
            const { data: modelData, error: modelError } = await supabase
              .from('ai_models')
              .select('display_name')
              .eq('id', config.modelId)
              .single();
            if (modelError) console.warn(`Error cargando modelo para ${role}: ${modelError.message}`);

            return {
              role,
              data: {
                providerName: provData?.name || 'No encontrado',
                modelName: modelData?.display_name || 'No encontrado',
              }
            };
          });
        
        const resolvedAgentResults = await Promise.all(agentPromises);
        const newResolvedAgents: ResolvedAgents = {};
        resolvedAgentResults.forEach(res => {
          if (res) newResolvedAgents[res.role as keyof ResolvedAgents] = res.data;
        });
        setResolvedAgents(newResolvedAgents);

      } catch (err: any) {
        console.error("Error fetching review data:", err);
        setError(err.message || 'Error al cargar los datos para la revisión.');
      }
      setLoadingReviewData(false);
    };

    if (state.step === 4) { // Only fetch if this step is active
        fetchReviewData();
    }
  }, [state.categoryId, state.subcategoryId, state.details, state.agentConfig, state.step]);

  const handleCreateBook = async () => {
    if (!termsAccepted) {
      setError('Debes aceptar los términos y condiciones para continuar.');
      return;
    }
    setError(null);
    setLoadingReviewData(true); // Use loading state for creation process

    try {
      // 1. Prepare book data from wizard state
      const { data: { user } } = await supabase.auth.getUser();
      const bookPayload = {
        user_id: user?.id || null,
        title: state.details?.title || 'Libro sin título', // Assuming 'title' is a common detail
        category_id: state.categoryId,
        subcategory_id: state.subcategoryId,
        // Store details as JSON. Ensure it's not excessively large or complex.
        // Consider if all details should be stored or just a subset/reference.
        form_details: state.details, 
        ai_config: state.agentConfig, // Store agent configuration
        status: 'pending', // Initial status
        // Add other relevant fields from your 'books' table schema
      };

      if (!bookPayload.user_id) {
        throw new Error('Usuario no autenticado. No se puede crear el libro.');
      }

      // 2. Insert into 'books' table
      const { data: newBook, error: insertError } = await supabase
        .from('books')
        .insert([bookPayload])
        .select('id')
        .single();

      if (insertError) {
        throw new Error(`Error al crear el libro: ${insertError.message}`);
      }

      if (!newBook || !newBook.id) {
        throw new Error('No se pudo obtener el ID del libro creado.');
      }

      // 3. Reset wizard state
      reset();

      // 4. Navigate to the 'creating book' page or dashboard
      // For now, let's navigate to a placeholder creating page with the new book's ID
      navigate(`/creating-book/${newBook.id}`); 
      // Or navigate('/dashboard') if direct creation is preferred

    } catch (err: any) {
      console.error("Error creating book:", err);
      setError(err.message || 'Ocurrió un error al intentar crear el libro.');
      setLoadingReviewData(false);
    }
  };

  const handleCancel = () => {
    reset();
    navigate('/'); // Redirige a la página principal o dashboard
  };

  if (loadingReviewData && state.step === 4) return <p>Cargando revisión...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
  // Only render content if it's the current step, otherwise WizardLayout might show it briefly during transitions
  if (state.step !== 4) return null; 

  return (
    <div>
      <h2>Revisa y Confirma tu Libro</h2>

      <section style={{ marginBottom: '20px' }}>
        <h4>Categoría</h4>
        <p><strong>Categoría:</strong> {categoryName || 'No seleccionada'}</p>
        <p><strong>Subcategoría:</strong> {subcategoryName || 'No seleccionada'}</p>
      </section>

      <section style={{ marginBottom: '20px' }}>
        <h4>Detalles del Libro</h4>
        {resolvedDetails.length > 0 ? (
          <ul>
            {resolvedDetails.map(detail => (
              <li key={detail.id}>
                <strong>{detail.displayName}:</strong> {typeof detail.value === 'boolean' ? (detail.value ? 'Sí' : 'No') : detail.value.toString()}
              </li>
            ))}
          </ul>
        ) : (
          <p>No se han proporcionado detalles.</p>
        )}
      </section>

      <section style={{ marginBottom: '20px' }}>
        <h4>Configuración de IA</h4>
        {Object.keys(resolvedAgents).length > 0 ? (
          <ul>
            {(Object.keys(resolvedAgents) as Array<keyof ResolvedAgents>).map(role => {
              const agent = resolvedAgents[role];
              if (!agent || !agent.providerName) return null;
              return (
                <li key={role} style={{ textTransform: 'capitalize' }}>
                  <strong>{role.replace('_', ' ')}:</strong> {agent.providerName} - {agent.modelName}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>No se ha configurado la IA.</p>
        )}
      </section>

      <div style={{ marginTop: '20px', marginBottom: '20px' }}>
        <label>
          <input 
            type="checkbox" 
            checked={termsAccepted} 
            onChange={(e) => setTermsAccepted(e.target.checked)} 
          />
          Acepto los Términos y Condiciones y entiendo los costes asociados (si aplican).
        </label>
      </div>

      <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button 
            type="button" 
            onClick={handleCancel}
            style={{ padding: '10px 15px', marginRight: '10px', cursor: 'pointer', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px' }}
            disabled={loadingReviewData}
          >
            Cancelar
          </button>
          <button 
            type="button" 
            onClick={prevStep} 
            style={{ padding: '10px 15px', cursor: 'pointer', backgroundColor: '#ff9800', color: 'white', border: 'none', borderRadius: '4px' }}
            disabled={loadingReviewData}
          >
            Atrás
          </button>
        </div>
        <button 
          type="button" 
          onClick={handleCreateBook} 
          style={{ padding: '10px 15px', cursor: 'pointer', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px' }}
          disabled={!termsAccepted || loadingReviewData}
        >
          {loadingReviewData ? 'Creando libro...' : 'Crear Libro'}
        </button>
      </div>
    </div>
  );
};

export default StepReview;
