import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../../lib/supabase'; // Asegúrate que la ruta es correcta
import { RealtimeChannel } from '@supabase/supabase-js';

interface JobPayload {
  id: string;
  book_id: string;
  status_message?: string;
  progress_percentage?: number;
  status?: 'processing' | 'completed' | 'failed';
  error_message?: string;
}

const CreatingBook: React.FC = () => {
    // Obtenemos el requestId (UUID) desde la URL o desde el estado de navegación
  const { requestId, id } = useParams<{ requestId: string; id: string }>();
  const location = useLocation();
  const requestIdFromState = (location.state as any)?.requestId as string | undefined;
  const effectiveRequestId = requestId || id || requestIdFromState;

  // bookId definitivo cuando la creación termina
  const [finalBookId, setFinalBookId] = useState<string | null>(null);
  // Alias para seguir usando la variable bookId en el código existente
  const bookId = finalBookId ?? undefined;
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState('Iniciando la creación de tu ebook...');
  const [progress, setProgress] = useState(0);
  const [bookTitle, setBookTitle] = useState<string | null>(null);
  const [isJobFound, setIsJobFound] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const simulationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Polling fallback para obtener book_id cuando WebSocket falle
    if (!finalBookId && effectiveRequestId) {
      const pollReqInterval = setInterval(async () => {
        try {
          const { data, error } = await supabase
            .from('book_creation_requests')
            .select('book_id, status')
            .eq('id', effectiveRequestId)
            .maybeSingle();
          if (error) {
            console.warn('Polling request error:', error);
            return;
          }
          if (data?.book_id) {
            console.log('Book_id obtenido por polling:', data.book_id);
            setFinalBookId(data.book_id);
            clearInterval(pollReqInterval);
          }
        } catch (e) {
          console.error('Unexpected polling request error:', e);
        }
      }, 3000);
      return () => clearInterval(pollReqInterval);
    }
  }, [effectiveRequestId, finalBookId]);

  useEffect(() => {
    if (!effectiveRequestId) {
      setStatusMessage('No se proporcionó requestId.');
      return;
    }

    const requestChannel = supabase
      .channel(`book_creation_requests:id=eq.${effectiveRequestId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'book_creation_requests', filter: `id=eq.${effectiveRequestId}` },
        (payload) => {
          const updated = payload.new as { status: string; book_id?: string; error_message?: string };
          console.log('book_creation_requests update', updated);
          if (updated.status === 'completed' && updated.book_id) {
            setFinalBookId(updated.book_id);
            setStatusMessage('¡Solicitud completada! Procesando progreso del libro...');
            supabase.removeChannel(requestChannel);
          } else if (updated.status === 'failed') {
            setJobError(updated.error_message || 'La solicitud de creación ha fallado.');
            supabase.removeChannel(requestChannel);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(requestChannel);
    };
  }, [effectiveRequestId]);

  useEffect(() => {
    if (!finalBookId) return;

    // Polling fallback cada 3s en caso de que WebSocket falle o no esté disponible
    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('*')
          .eq('book_id', finalBookId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) {
          console.warn('Polling jobs error:', error);
          return;
        }
        if (data) {
          updateStateFromJob(data as JobPayload);
          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(pollInterval);
          }
        }
      } catch (e) {
        console.error('Unexpected polling error:', e);
      }
    }, 3000);

    const initialFetchTimeout = setTimeout(() => {
      // Fetch book title
      const fetchBookTitle = async () => {
        const { data, error } = await supabase.from('books').select('title').eq('id', bookId).maybeSingle();
        if (error) {
            console.error("Error fetching book title:", error);
            // Keep trying or show error after a few retries
            return;
        }
        if (data) setBookTitle(data.title || 'Libro sin título');
      };
      fetchBookTitle();

      // Attempt to fetch initial job state
      const fetchInitialJobState = async () => {
        const { data, error } = await supabase
          .from('jobs')
          .select('*')
          .eq('book_id', bookId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error fetching initial job state:', error);
          setJobError('No se pudo cargar el estado inicial del proceso.');
          startSimulationFallback(); 
          return;
        }

        if (data) {
          setIsJobFound(true);
          if (simulationTimeoutRef.current) clearTimeout(simulationTimeoutRef.current);
          updateStateFromJob(data);
        } else {
          setStatusMessage('Esperando que el proceso de creación comience...');
          if (!simulationTimeoutRef.current) {
              simulationTimeoutRef.current = setTimeout(() => {
              if (!isJobFound) startSimulationFallback();
            }, 7000); // Wait 7 seconds for a job to appear before starting simulation
          }
        }
      };

      fetchInitialJobState();
    }, 1500); // Wait 1.5 seconds before the first fetch to avoid race condition

    // Realtime subscription con reintentos
    const setupRealtimeSubscription = (retryCount = 0, maxRetries = 3) => {
      // Limpiar canal anterior si existe
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (e) {
          console.warn('Error al limpiar canal anterior:', e);
        }
      }
      
      console.log(`Intentando conectar al canal de jobs (intento ${retryCount + 1}/${maxRetries + 1})`);
      
      channelRef.current = supabase
        .channel(`jobs:book_id=eq.${bookId}`, {
          config: {
            presence: { key: `user-${Math.floor(Math.random() * 10000)}` }
          }
        })
        .on<JobPayload>(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'jobs', filter: `book_id=eq.${bookId}` },
          (payload) => {
            console.log('Job update received:', payload);
            setIsJobFound(true);
            if (simulationTimeoutRef.current) clearTimeout(simulationTimeoutRef.current);
            if (payload.new) {
              updateStateFromJob(payload.new as JobPayload);
            }
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('Subscribed to jobs channel for bookId:', bookId);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`Subscription error (intento ${retryCount + 1}/${maxRetries + 1}):`, err);
            
            // Reintentar si no hemos alcanzado el máximo de intentos
            if (retryCount < maxRetries) {
              console.log(`Reintentando conexión en ${(retryCount + 1) * 2} segundos...`);
              setTimeout(() => setupRealtimeSubscription(retryCount + 1, maxRetries), (retryCount + 1) * 2000);
            } else {
              console.error('Se alcanzó el máximo de reintentos. Iniciando simulación.');
              setJobError('Error de conexión con el servidor de progreso. Iniciando simulación.');
              if (!isJobFound) startSimulationFallback(); // Fallback if subscription fails and no job found
            }
          }
        });
    };
    
    // Iniciar la suscripción
    setupRealtimeSubscription();

    return () => {
      clearTimeout(initialFetchTimeout); // Clean up the initial fetch timeout
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current).then(
            () => console.log('Unsubscribed from jobs channel'),
            (err) => console.warn('Error al desuscribirse del canal:', err)
          );
        } catch (e) {
          console.warn('Error al limpiar el canal de WebSocket:', e);
        } finally {
          channelRef.current = null;
        }
      }
      if (simulationTimeoutRef.current) {
        clearTimeout(simulationTimeoutRef.current);
      }
    };
  }, [bookId]); // Removed navigate from dependencies as it's stable

  const updateStateFromJob = (job: JobPayload) => {
    setStatusMessage(job.status_message || 'Procesando...');
    setProgress(job.progress_percentage || 0);

    if (job.status === 'completed') {
      setStatusMessage(job.status_message || '¡Tu ebook ha sido creado con éxito!');
      setProgress(100);
      setTimeout(() => navigate(`/book/${bookId}`), 2000);
    } else if (job.status === 'failed') {
      setJobError(job.error_message || 'El proceso de creación falló.');
      setStatusMessage('Error en la creación del libro.');
      // Keep progress as is or set to 0/100 with error indication?
    }
  };

  const checkBookExistsAndNavigate = async () => {
    try {
      const { data, error } = await supabase
        .from('books')
        .select('id')
        .eq('id', bookId)
        .maybeSingle();
      
      if (error) {
        console.error('Error al verificar si el libro existe:', error);
        return false;
      }
      
      if (data) {
        console.log('Libro encontrado, redirigiendo...');
        navigate(`/book/${bookId}`);
        return true;
      } else {
        console.log('Libro aún no disponible, reintentando en 2 segundos...');
        return false;
      }
    } catch (e) {
      console.error('Error inesperado al verificar el libro:', e);
      return false;
    }
  };

  const startSimulationFallback = () => {
    if (isJobFound) return; // Don't start simulation if a real job was found
    console.log('Starting simulation fallback for bookId:', bookId);
    setStatusMessage('Iniciando simulación de progreso...');
    let currentProgress = 0;
    const messages = [
      'Generando la estructura del libro (simulado)...', 
      'Escritores IA redactando (simulado)...', 
      'Diseñando ilustraciones (simulado)...', 
      'Compilando borrador (simulado)...', 
      'Finalizando (simulado)...'
    ];

    const interval = setInterval(() => {
      if (isJobFound && channelRef.current?.state === 'joined') { // Stop simulation if real job data comes in
        clearInterval(interval);
        return;
      }
      currentProgress += 20;
      setProgress(currentProgress);
      setStatusMessage(messages[Math.floor((currentProgress - 1) / 20)] || 'Procesando (simulado)...');
      if (currentProgress >= 100) {
        clearInterval(interval);
        if (!isJobFound) { // Only navigate if no real job completed this
          setStatusMessage('¡Tu ebook ha sido creado con éxito! (simulado)');
          
          // Verificar que el libro exista antes de redirigir
          const checkInterval = setInterval(async () => {
            const exists = await checkBookExistsAndNavigate();
            if (exists) {
              clearInterval(checkInterval);
            }
          }, 2000); // Verificar cada 2 segundos
          
          // Establecer un tiempo máximo de espera (30 segundos)
          setTimeout(() => {
            clearInterval(checkInterval);
            navigate(`/book/${bookId}`); // Redirigir de todos modos después de 30 segundos
          }, 30000);
        }
      }
    }, 2500);
    // Ensure this interval is also cleaned up if the component unmounts during simulation
    const currentChannel = channelRef.current; // Capture for cleanup
    return () => {
        clearInterval(interval);
        if (currentChannel) supabase.removeChannel(currentChannel); 
    }; 
  };

  useEffect(() => {
    // This effect is to handle the case where the component unmounts during simulation
    // The main useEffect's cleanup handles the channel, this is for the simulation interval if it's running standalone
    let cleanupSimulation: (() => void) | undefined;
    if (!isJobFound && bookId && !channelRef.current?.state) {
      // If no job found and channel not active, simulation might be the only thing running
      // This logic is a bit tricky; the simulation is started within the main useEffect.
      // The cleanup of the simulation interval should ideally be tied to its start.
      // The current `startSimulationFallback` returns a cleanup function, but it's not directly used.
      // Let's refine: `startSimulationFallback` should be callable and its interval managed by a ref.
    }
    return () => {
      if (cleanupSimulation) cleanupSimulation();
    };
  }, [isJobFound, bookId]);


  if (!effectiveRequestId) {
    return <p>No se ha proporcionado requestId. Por favor, inicia de nuevo la creación.</p>;
  }

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>{bookTitle ? `Creando: ${bookTitle}` : 'Tu libro se está creando...'}</h2>
      <p style={{ margin: '20px 0', fontSize: '1.1em' }}>{statusMessage}</p>
      {jobError && <p style={{ color: 'red', margin: '10px 0' }}>Error: {jobError}</p>}
      
      {progress < 100 && !jobError && (
        <div style={{ width: '80%', margin: '20px auto', border: '1px solid #ccc', borderRadius: '5px', overflow: 'hidden' }}>
          <div 
            style={{
              width: `${progress}%`,
              height: '30px',
              backgroundColor: jobError ? '#f44336' : '#4CAF50', // Red if error
              textAlign: 'center',
              lineHeight: '30px',
              color: 'white',
              transition: 'width 0.5s ease-in-out, background-color 0.5s ease-in-out'
            }}
          >
            {progress}%
          </div>
        </div>
      )}

      {progress >= 100 && !jobError && (
        <button 
          onClick={() => navigate(`/book/${bookId}`)} 
          style={{ marginTop: '20px', padding: '10px 20px', fontSize: '1em', cursor: 'pointer' }}
        >
          Ver tu Ebook
        </button>
      )}
       {jobError && (
        <button 
          onClick={() => navigate('/')} // Navigate to dashboard or home on error acknowledgement
          style={{ marginTop: '20px', padding: '10px 20px', fontSize: '1em', cursor: 'pointer', backgroundColor: '#f44336', color: 'white' }}
        >
          Volver al Inicio
        </button>
      )}
    </div>
  );
};

export default CreatingBook;
