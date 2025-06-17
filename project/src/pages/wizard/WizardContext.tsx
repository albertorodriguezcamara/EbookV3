import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { WizardState } from './types';

const initialState: WizardState = {
  step: 1,
  categoryId: null,
  subcategoryId: null,
  details: {},
  isIllustrated: false,
  hasCover: false,
  agentConfig: {
    editor: null,
    writer: null,
    image: null,
    cover: null,
  },
};

const WIZARD_STORAGE_KEY = 'wizard-state-v1';

function loadState(): WizardState {
  try {
    const raw = sessionStorage.getItem(WIZARD_STORAGE_KEY);
    if (raw) return { ...initialState, ...JSON.parse(raw) };
  } catch {}
  return initialState;
}

function saveState(state: WizardState) {
  sessionStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(state));
}

type WizardAction =
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'GO_TO_STEP'; step: number }
  | { type: 'SET_CATEGORY'; categoryId: string; subcategoryId: string }
  | { type: 'SET_DETAILS'; details: Record<string, any> }
  | { type: 'SET_IS_ILLUSTRATED'; isIllustrated: boolean }
  | { type: 'SET_HAS_COVER'; hasCover: boolean }
  | { type: 'SET_AGENT_CONFIG'; agentConfig: WizardState['agentConfig'] }
  | { type: 'RESET' };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'NEXT_STEP':
      // Ensure we don't go past the last step (Review is 4, Creating is 5)
      return { ...state, step: Math.min(state.step + 1, 4) }; 
    case 'PREV_STEP':
      return { ...state, step: Math.max(state.step - 1, 1) };
    case 'GO_TO_STEP':
        return { ...state, step: action.step };
    case 'SET_CATEGORY':
      return { ...state, categoryId: action.categoryId, subcategoryId: action.subcategoryId, step: 2, details: {}, agentConfig: initialState.agentConfig };
    case 'SET_DETAILS':
      return { ...state, details: action.details, step: 3 };
    case 'SET_AGENT_CONFIG':
      return { ...state, agentConfig: action.agentConfig, step: state.step + 1 };
    case 'SET_IS_ILLUSTRATED':
      // Si se desmarca, resetea la configuración de IA para imágenes
      const imageAgentConfig = action.isIllustrated ? state.agentConfig.image : null;
      return {
        ...state,
        isIllustrated: action.isIllustrated,
        agentConfig: { ...state.agentConfig, image: imageAgentConfig },
      };
    case 'SET_HAS_COVER':
      // Si se desmarca, resetea la configuración de IA para portadas
      const coverAgentConfig = action.hasCover ? state.agentConfig.cover : null;
      return {
        ...state,
        hasCover: action.hasCover,
        agentConfig: { ...state.agentConfig, cover: coverAgentConfig },
      };
    case 'RESET':
      return { ...initialState, step: 1 };
    default:
      return state;
  }
}

const WizardContext = createContext<{
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
} | undefined>(undefined);

export const WizardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(wizardReducer, undefined, loadState);

  useEffect(() => { saveState(state); }, [state]);

  const nextStep = () => dispatch({ type: 'NEXT_STEP' });
  const prevStep = () => dispatch({ type: 'PREV_STEP' });
  const reset = () => dispatch({ type: 'RESET' });

  return (
    <WizardContext.Provider value={{ state, dispatch, nextStep, prevStep, reset }}>
      {children}
    </WizardContext.Provider>
  );
};

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard debe usarse dentro de <WizardProvider>');
  return ctx;
}
