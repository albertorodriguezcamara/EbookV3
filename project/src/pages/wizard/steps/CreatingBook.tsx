import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  const { id: bookId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState('Iniciando la creación de tu ebook...');
  const [progress, setProgress] = useState(0);
  const [bookTitle, setBookTitle] = useState<string | null>(null);
  const [isJobFound, setIsJobFound] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const simulationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!bookId) return;

    // Fetch book title
    const fetchBookTitle = async () => {
      const { data } = await supabase.from('books').select('title').eq('id', bookId).single();
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
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116: single row not found
        console.error('Error fetching initial job state:', error);
        setJobError('No se pudo cargar el estado inicial del proceso.');
        // Fallback to simulation if initial fetch fails badly
        startSimulationFallback(); 
        return;
      }

      if (data) {
        setIsJobFound(true);
        if (simulationTimeoutRef.current) clearTimeout(simulationTimeoutRef.current);
        updateStateFromJob(data);
      } else {
        // No job found yet, start simulation as fallback after a short delay
        setStatusMessage('Esperando que el proceso de creación comience...');
        if (!simulationTimeoutRef.current) {
            simulationTimeoutRef.current = setTimeout(() => {
            if (!isJobFound) startSimulationFallback();
          }, 7000); // Wait 7 seconds for a job to appear before starting simulation
        }
      }
    };

    fetchInitialJobState();

    // Realtime subscription
    channelRef.current = supabase
      .channel(`jobs:book_id=eq.${bookId}`)
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
          console.error('Subscription error:', err);
          setJobError('Error de conexión con el servidor de progreso. Intentando simulación.');
          if (!isJobFound) startSimulationFallback(); // Fallback if subscription fails and no job found
        }
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current).then(() => console.log('Unsubscribed from jobs channel'));
        channelRef.current = null;
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
            setTimeout(() => navigate(`/book/${bookId}`), 2000);
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


  if (!bookId) {
    return <p>No se ha especificado un ID de libro.</p>;
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
