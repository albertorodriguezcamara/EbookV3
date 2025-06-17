import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'

import BookDetail from './pages/BookDetail'
import Admin from './pages/Admin'
import BookEditor from './pages/BookEditor'

// Wizard imports
import { WizardProvider } from './pages/wizard/WizardContext'; // Importar WizardProvider
import WizardLayout from './pages/wizard/WizardLayout';
import StepCategory from './pages/wizard/steps/StepCategory';
import StepDetails from './pages/wizard/steps/StepDetails';
import StepAI from './pages/wizard/steps/StepAI';
import StepReview from './pages/wizard/steps/StepReview';
import CreatingBook from './pages/wizard/steps/CreatingBook';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/book/:id" element={<BookDetail />} />
            <Route path="/admin/*" element={<Admin />} />
            <Route path="/book-editor" element={<BookEditor />} />

            {/* Wizard de creación de libros */}
            <Route path="/create-book" element={
              <WizardProvider>
                <WizardLayout />
              </WizardProvider>
            }>
              <Route path="step/1" element={<StepCategory />} />
              <Route path="step/2" element={<StepDetails />} />
              <Route path="step/3" element={<StepAI />} />
              <Route path="step/4" element={<StepReview />} />
            </Route>
            {/* Progreso de creación en vivo */}
            <Route path="/creating-book/:id" element={<CreatingBook />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  )
}

export default App