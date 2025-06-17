import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, LogOut, User } from 'lucide-react';
import '../styles/Layout.css'; // Importamos la nueva hoja de estilos

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="layout">
      <header className="layout-header">
        <nav className="header-nav">
          <Link to="/" className="nav-brand">
            <BookOpen className="nav-brand-icon" />
            <span className="nav-brand-text">AI Ebook Creator</span>
          </Link>

          <div className="nav-menu">
            {user ? (
              <>
                <Link to="/dashboard" className="nav-link">Dashboard</Link>
                {isAdmin && (
                  <Link to="/admin" className="nav-link">Admin</Link>
                )}
                <Link to="/create-book/step/1" className="nav-button">Crear Ebook</Link>
                
                <div className="user-info">
                  <User size={18} />
                  <span className="user-info-email">{user.email}</span>
                  <button onClick={handleSignOut} className="signout-button" title="Cerrar sesión">
                    <LogOut size={18} />
                  </button>
                </div>
              </>
            ) : (
              <Link to="/" className="nav-button">Iniciar Sesión</Link>
            )}
          </div>
        </nav>
      </header>

      <main className="layout-main">{children}</main>
    </div>
  );
}