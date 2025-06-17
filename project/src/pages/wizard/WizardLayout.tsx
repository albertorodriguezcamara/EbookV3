import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useWizard } from './WizardContext';

const steps = [
  { step: 1, label: 'Categoría' },
  { step: 2, label: 'Detalles' },
  { step: 3, label: 'IA' },
  { step: 4, label: 'Revisión' },
];

function Stepper() {
  const { state } = useWizard();
  return (
    <nav className="wizard-stepper">
      {steps.map((s, idx) => (
        <span key={s.step} className={state.step === s.step ? 'active' : ''}>
          {s.step}. {s.label}
          {idx < steps.length - 1 && <span className="wizard-stepper-sep">→</span>}
        </span>
      ))}
    </nav>
  );
}

const WizardLayout: React.FC = () => {
  const { state } = useWizard();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.step) {
        navigate(`/create-book/step/${state.step}`);
    }
  }, [state.step, navigate]);

  return (
    <div className="wizard-layout">
      <Stepper />
      <div className="wizard-content">
        <Outlet />
      </div>
    </div>
  );
};

export default WizardLayout;
