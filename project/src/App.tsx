import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'

import BookDetail from './pages/BookDetail'
import Admin from './pages/Admin'
import BookEditor from './pages/BookEditor'
import AICreator from './pages/AICreator'

// Wizard imports
import { WizardProvider } from './pages/wizard/WizardContext'; // Importar WizardProvider
import WizardLayout from './pages/wizard/WizardLayout';
import StepCategory from './pages/wizard/steps/StepCategory';
import StepDetails from './pages/wizard/steps/StepDetails';
import StepAI from './pages/wizard/steps/StepAI';
import StepReview from './pages/wizard/steps/StepReview';

import BookCreationMonitorPage from './pages/BookCreationMonitorPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/ai-creator" element={<AICreator />} />
            <Route path="/book/:id" element={<BookDetail />} />
            <Route path="/admin/*" element={<Admin />} />
            <Route path="/book-editor" element={<BookEditor />} />

            {/* Wizard de creación de libros */}
            <Route
              path="/create-book/*" // Usar un comodín para que esta ruta maneje todas las sub-rutas
              element={ // WizardProvider envuelve el conjunto de rutas del wizard
                <WizardProvider>
                  <Routes> {/* Un nuevo conjunto de Routes para el wizard anidado */}
                    <Route element={<WizardLayout />}> {/* WizardLayout actúa como layout para los pasos */}
                      <Route path="step/1" element={<StepCategory />} />
                      <Route path="step/2" element={<StepDetails />} />
                      <Route path="step/3" element={<StepAI />} />
                      <Route path="step/4" element={<StepReview />} />
                      {/* Redirigir /create-book (sin step) a step/1 */}
                      <Route index element={<Navigate to="step/1" replace />} />
                    </Route>
                  </Routes>
                </WizardProvider>
              }
            />
            {/* La ruta antigua /creating-book/:id ha sido eliminada para forzar el uso de la nueva ruta unificada */}

            {/* ✅ NUEVA RUTA UNIFICADA para el monitoreo de creación */}
            <Route path="/book-creation/:requestId" element={<BookCreationMonitorPage />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  )
}

export default App