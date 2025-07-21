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


  // Initialize local state for agent selections from context or default
  const initialAgentConfig = state.agentConfig || {
    editor: null,
    writer: null,
    image: null,
    cover: null,   // Standardized to 'cover' for cover generation
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



  const handleNext = () => {
    // Validate only active roles
    const activeRoles = definedRoles.filter(role => {
      if (role === 'image' && !isIllustrated) return false;
      if (role === 'cover' && !state.details.generate_cover) return false; // Usar el estado del wizard
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
    <div className="wizard-step-container">
      <h2 className="wizard-step-title">3. Configuración de IA</h2>
      <p>Define qué IA se encargará de cada tarea. Puedes omitir las que no necesites.</p>

      <div className="ai-options-grid">
        <div className="ai-option-card">
          <label className="wizard-checkbox-container">
            <input
              type="checkbox"
              checked={isIllustrated}
              onChange={handleIllustratedChange}
              style={{ display: 'none' }}
            />
            <div className={`wizard-checkbox ${isIllustrated ? 'checked' : ''}`}></div>
            <strong>¿Libro Ilustrado?</strong>
          </label>
          <small>Se generarán imágenes para acompañar el texto.</small>
        </div>

      </div>
      
      {definedRoles.map(role => {
        // Conditionally render image/cover roles
        if (role === 'image' && !isIllustrated) return null;
        if (role === 'cover' && !state.details.generate_cover) return null;

        const selectedProviderId = selectedAgents[role]?.providerId;
        const availableModels = models.filter(m => m.provider_id === selectedProviderId && m.type === role && m.active);

        return (
          <div key={role} className="ai-provider-section">
            <h3 className="ai-provider-title">{role.replace('_', ' ')}</h3>
            <div className="form-group">
              <label htmlFor={`${role}-provider`}>Proveedor:</label>
              <select
                id={`${role}-provider`}
                value={selectedProviderId || ''}
                onChange={(e) => handleProviderChange(role, e.target.value || null)}
              >
                <option value="">Selecciona un proveedor</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor={`${role}-model`}>Modelo:</label>
              <select
                id={`${role}-model`}
                value={selectedAgents[role]?.modelId || ''}
                onChange={(e) => handleModelChange(role, e.target.value || null)}
                disabled={!selectedProviderId || availableModels.length === 0}
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

      <div className="wizard-nav-buttons">
        <div className="wizard-nav-group">
          <button 
            type="button" 
            onClick={handleCancel}
            className="wizard-btn wizard-btn-danger"
          >
            Cancelar
          </button>
          <button 
            type="button" 
            onClick={prevStep} 
            className="wizard-btn wizard-btn-warning"
          >
            Anterior
          </button>
        </div>
        <button 
          type="button" 
          onClick={handleNext} 
          className="wizard-btn wizard-btn-primary"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default StepAI;
