import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWizard } from '../WizardContext';
import { supabase } from '../../../lib/supabase';
import { AIProvider, AIModel, WizardState } from '../types';

const StepAI: React.FC = () => {
  const { state, dispatch, prevStep, reset } = useWizard();
  const navigate = useNavigate();
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local state for UI options, synced with global context
  const [isIllustrated, setIsIllustrated] = useState(state.isIllustrated);
  const [hasCover, setHasCover] = useState(state.hasCover);

  // Initialize local state for agent selections from context or default
  const initialAgentConfig = state.agentConfig || {
    editor: null,
    writer: null,
    image: null,
    cover: null,
  };
  const [selectedAgents, setSelectedAgents] = useState<WizardState['agentConfig']>(initialAgentConfig);

  const definedRoles = Object.keys(initialAgentConfig) as Array<keyof WizardState['agentConfig']>;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: providersData, error: providersError } = await supabase
          .from('ai_providers')
          .select('id, name')
          .order('name');

        if (providersError) throw providersError;
        setProviders(providersData || []);

        const { data: modelsData, error: modelsError } = await supabase
          .from('ai_models')
          .select('id, name, display_name, type, provider_id, active')
          .eq('active', true)
          .order('display_name');
        
        if (modelsError) throw modelsError;
        setModels(modelsData || []);

      } catch (err: any) {
        console.error("Error fetching AI data:", err);
        setError('Error al cargar datos de IA. Inténtalo de nuevo.');
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleProviderChange = (role: keyof WizardState['agentConfig'], providerId: string | null) => {
    setSelectedAgents(prev => ({
      ...prev,
      [role]: providerId ? { providerId: providerId, modelId: '' } : null, // Reset model if provider changes
    }));
  };

  const handleModelChange = (role: keyof WizardState['agentConfig'], modelId: string | null) => {
    setSelectedAgents(prev => {
      const currentRoleConfig = prev[role];
      if (currentRoleConfig && modelId) {
        return {
          ...prev,
          [role]: { ...currentRoleConfig, modelId: modelId },
        };
      }
      // If modelId is null or currentRoleConfig is null (should not happen if provider is selected)
      // we might want to reset the role or handle it based on UX decision.
      // For now, only update if there's a current config and a modelId.
      return prev; 
    });
  };

  const handleIllustratedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsIllustrated(checked);
    dispatch({ type: 'SET_IS_ILLUSTRATED', isIllustrated: checked });
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setHasCover(checked);
    dispatch({ type: 'SET_HAS_COVER', hasCover: checked });
  };

  const handleNext = () => {
    // Validate only active roles
    const activeRoles = definedRoles.filter(role => {
      if (role === 'image' && !isIllustrated) return false;
      if (role === 'cover' && !hasCover) return false;
      return true;
    });

    const isValid = activeRoles.every(role => {
      const selection = selectedAgents[role];
      return selection && selection.providerId && selection.modelId;
    });

    if (!isValid) {
      setError('Por favor, selecciona un proveedor y un modelo para cada rol activo.');
      return;
    }
    setError(null);
    dispatch({ type: 'SET_AGENT_CONFIG', agentConfig: selectedAgents });
    // El reducer wizardReducer se encarga de llamar a nextStep() implícitamente al cambiar state.step
  };

  const handleCancel = () => {
    reset();
    navigate('/'); // Redirige a la página principal o dashboard
  };

  if (loading) return <p>Cargando configuración de IA...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <h2>3. Configura los Agentes IA</h2>
      <p>Define qué IA se encargará de cada tarea. Puedes omitir las que no necesites.</p>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div style={{ flex: 1, padding: '15px', border: '1px solid #eee', borderRadius: '5px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isIllustrated}
              onChange={handleIllustratedChange}
              style={{ marginRight: '10px' }}
            />
            <strong>¿Libro Ilustrado?</strong>
          </label>
          <small>Se generarán imágenes para acompañar el texto.</small>
        </div>
        <div style={{ flex: 1, padding: '15px', border: '1px solid #eee', borderRadius: '5px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={hasCover}
              onChange={handleCoverChange}
              style={{ marginRight: '10px' }}
            />
            <strong>¿Generar Portada?</strong>
          </label>
          <small>Se creará una portada única para tu libro.</small>
        </div>
      </div>
      
      {definedRoles.map(role => {
        // Conditionally render image/cover roles
        if (role === 'image' && !isIllustrated) return null;
        if (role === 'cover' && !hasCover) return null;

        const selectedProviderId = selectedAgents[role]?.providerId;
        const availableModels = models.filter(m => m.provider_id === selectedProviderId && m.type === role && m.active);

        return (
          <div key={role} style={{ marginBottom: '20px', padding: '10px', border: '1px solid #eee', borderRadius: '5px' }}>
            <h3 style={{ textTransform: 'capitalize', marginBottom: '10px' }}>{role.replace('_', ' ')}</h3>
            <div style={{ marginBottom: '10px' }}>
              <label htmlFor={`${role}-provider`} style={{ display: 'block', marginBottom: '5px' }}>Proveedor:</label>
              <select
                id={`${role}-provider`}
                value={selectedProviderId || ''}
                onChange={(e) => handleProviderChange(role, e.target.value || null)}
                style={{ width: '100%', padding: '8px' }}
              >
                <option value="">Selecciona un proveedor</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${role}-model`} style={{ display: 'block', marginBottom: '5px' }}>Modelo:</label>
              <select
                id={`${role}-model`}
                value={selectedAgents[role]?.modelId || ''}
                onChange={(e) => handleModelChange(role, e.target.value || null)}
                disabled={!selectedProviderId || availableModels.length === 0}
                style={{ width: '100%', padding: '8px' }}
              >
                <option value="">{selectedProviderId ? (availableModels.length > 0 ? 'Selecciona un modelo' : 'No hay modelos disponibles') : 'Selecciona un proveedor primero'}</option>
                {availableModels.map(m => (
                  <option key={m.id} value={m.id}>{m.display_name}</option>
                ))}
              </select>
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button 
            type="button" 
            onClick={handleCancel}
            style={{ padding: '10px 15px', marginRight: '10px', cursor: 'pointer', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Cancelar
          </button>
          <button 
            type="button" 
            onClick={prevStep} 
            style={{ padding: '10px 15px', cursor: 'pointer', backgroundColor: '#ff9800', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Anterior
          </button>
        </div>
        <button 
          type="button" 
          onClick={handleNext} 
          style={{ padding: '10px 15px', cursor: 'pointer', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default StepAI;
