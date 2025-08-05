import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import BookCreationMonitor from '../components/BookCreationMonitor';

const BookCreationMonitorPage: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [bookId, setBookId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) {
      setError('No se proporcionó un ID de solicitud.');
      return;
    }

    const pollForBookId = async () => {
      try {
        const { data, error } = await supabase
          .from('book_creation_requests')
          .select('book_id, status, error_message')
          .eq('id', requestId)
          .single();

        if (error) throw error;

        if (data?.status === 'failed') {
          throw new Error(data.error_message || 'La creación del libro falló.');
        }

        if (data?.book_id) {
          setBookId(data.book_id);
          return; // Stop polling
        }

        // If no book_id yet, poll again
        setTimeout(pollForBookId, 3000);
      } catch (err: any) {
        console.error('Error polling for book_id:', err);
        setError(err.message || 'Ocurrió un error al buscar el libro.');
      }
    };

    pollForBookId();
  }, [requestId]);

  const handleComplete = () => {
    if (bookId) {
      console.log(`Creation complete for book ${bookId}, navigating to detail page.`);
      navigate(`/book/${bookId}`);
    }
  };

  const handleError = (errorMsg: string) => {
    console.error('Book creation failed:', errorMsg);
    navigate('/dashboard', { state: { error: 'La creación del libro falló.' } });
  };

  if (error) {
    return <div className="text-red-500 text-center p-8">Error: {error}</div>;
  }

  if (!bookId) {
    return (
      <div className="text-center p-8">
        <p className="text-lg font-semibold">Iniciando la creación de tu ebook...</p>
        <p>Por favor, espera un momento.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <BookCreationMonitor
        bookId={bookId}
        onComplete={handleComplete}
        onError={handleError}
      />
    </div>
  );
};

export default BookCreationMonitorPage;
