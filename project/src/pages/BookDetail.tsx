import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { BookOpen, BookText, Bot, Calendar, ChevronDown, ChevronUp, FileText, Tag, ArrowLeft } from 'lucide-react'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Constantes para los tamaños KDP
const KDP_PAPERBACK_SIZES = [
  '12,7 x 20,32 cm (5" x 8")',
  '12,85 x 19,84 cm (5,06" x 7,81")',
  '13,34 x 20,32 cm (5,25" x 8")',
  '13,97 x 21,59 cm (5,5" x 8,5")',
  '15,24 x 22,86 cm (6" x 9")', // Más popular
  '15,6 x 23,39 cm (6,14" x 9,21")',
  '16,99 x 24,41 cm (6,69" x 9,61")',
  '17,78 x 25,4 cm (7" x 10")',
  '18,9 x 24,61 cm (7,44" x 9,69")',
  '19,05 x 23,5 cm (7,5" x 9,25")',
  '20,32 x 25,4 cm (8" x 10")',
  '20,96 x 15,24 cm (8,25" x 6")',
  '20,96 x 20,96 cm (8,25" x 8,25")',
  '21,59 x 21,59 cm (8,5" x 8,5")',
  '21,59 x 27,94 cm (8,5" x 11")',
  '21 x 29,7 cm (8,27" x 11,69")'
];

const KDP_HARDCOVER_SIZES = [
  '13,97 x 21,59 cm (5,5" x 8,5")',
  '15,24 x 22,86 cm (6" x 9")', // Más popular
  '15,6 x 23,39 cm (6,14" x 9,21")',
  '17,78 x 25,4 cm (7" x 10")',
  '20,96 x 27,94 cm (8,25" x 11")'
];

const INK_TYPES = {
  black_white: 'Tinta negra y papel blanco',
  black_cream: 'Tinta negra y papel crema',
  color_standard: 'Tinta de color estándar y papel blanco',
  color_premium: 'Tinta de color prémium y papel blanco'
};

interface Book {
  id: string
  title: string
  author: string
  idea: string
  description: string
  category: string
  subcategory?: string
  tone: string
  language: string
  extension: number
  book_size: string
  created_at: string
  cover_image_url?: string
  ai_config?: {
    writer_model_id: string
    editor_model_id: string
    image_generator_model_id?: string
  }
}

interface Chapter {
  id: string
  title: string
  content: string
  synopsis: string
  order_number: number
  created_at: string
}

interface ExportJob {
  id: string
  status: string
  format: string
  download_url: string | null
  created_at: string
  export_options: any
  editor_model_id: string | null
}

interface AIPromptLog {
  id: string;
  timestamp: string;
  phase: string;
  prompt_text: string;
  response_text: string;
  model_used: string;
  metadata?: {
    status?: string;
    duration_seconds?: number;
    word_count?: number;
    tokens_used?: number;
  };
}

interface ChapterSelection {
  id: string
  title: string
  order_number: number
  hasContent: boolean
  selected: boolean
}

export default function BookDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [book, setBook] = useState<Book | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

  // State for export modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [dedication, setDedication] = useState('');
  const [acknowledgements, setAcknowledgements] = useState('');
  const [isbn, setIsbn] = useState('');
  const [aiModels, setAiModels] = useState<any[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  
  // State for manual cover generation
  const [generatingCover, setGeneratingCover] = useState(false);
  const [coverGenerationStatus, setCoverGenerationStatus] = useState<string | null>(null);
;
  const [coverModels, setCoverModels] = useState<any[]>([]);
  const [selectedCoverModelId, setSelectedCoverModelId] = useState<string | null>(null);
  const [showCoverModelSelection, setShowCoverModelSelection] = useState(false);
  
  // State for cover gallery
  const [bookCovers, setBookCovers] = useState<any[]>([]);
  const [showCoverGallery, setShowCoverGallery] = useState(false);
;
  
  // State for KDP format selection
  const [kdpFormatType, setKdpFormatType] = useState<'paperback' | 'hardcover'>('paperback');
  const [kdpFormatSize, setKdpFormatSize] = useState('15,24 x 22,86 cm (6" x 9")');
  const [kdpInkType, setKdpInkType] = useState<'black_white' | 'black_cream' | 'color_standard' | 'color_premium'>('black_white');
  const [kdpPaperType, setKdpPaperType] = useState<'white' | 'cream'>('white');

  // State for export process
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  
  // State for chapter rewriting
  const [isRewriteModalOpen, setIsRewriteModalOpen] = useState(false);
  const [chapterSelections, setChapterSelections] = useState<ChapterSelection[]>([]);
  const [rewritingChapters, setRewritingChapters] = useState(false);
  const [rewriteStatus, setRewriteStatus] = useState<string | null>(null);
;
  const [jobId, setJobId] = useState<string | null>(null);

  // State for export history
  const [exportHistory, setExportHistory] = useState<ExportJob[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // State for Book Bible and AI Logs
  const [bookBible, setBookBible] = useState<any>(null);
  const [isBibleExpanded, setIsBibleExpanded] = useState(false);
  const [chapterLogs, setChapterLogs] = useState<Record<string, AIPromptLog[]>>({});
  const [expandedLogChapterId, setExpandedLogChapterId] = useState<string | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchBookBibleLog = async (bookId: string) => {
    try {
      const { data, error } = await supabase
        .from('ai_prompts_log')
        .select('response_text')
        .eq('book_id', bookId)
        .is('chapter_id', null)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // It's okay if no log is found, so we only log other errors
        if (error.code !== 'PGRST116') {
          console.error('Error fetching book bible log:', error);
        }
        return;
      }

      if (data && data.response_text) {
        // The response might be a stringified JSON, so we parse it.
        try {
          const parsedBible = JSON.parse(data.response_text);
          setBookBible(parsedBible);
        } catch (e) {
          // If it's not a JSON string, use it as is.
          setBookBible(data.response_text);
        }
      }
    } catch (err: any) {
      console.error('Error processing book bible log:', err.message);
    }
  }

  useEffect(() => {
    if (id && user) {
      fetchBookDetails()
      fetchBookBibleLog(id)
    }
  }, [id, user])

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }

    if (id) {
      fetchBookDetails()
      fetchExportHistory()
      fetchBookCovers()
    }
  }, [user, id, navigate])

  // Effect for Realtime subscription + Polling fallback
  useEffect(() => {
    if (!jobId) return;

    console.log(`🔌 Configurando WebSocket para job: ${jobId}`);
    
    // Polling fallback - verificar estado cada 3 segundos
    const pollJobStatus = async () => {
      try {
        const { data: job, error } = await supabase
          .from('export_jobs')
          .select('status, download_url, status_message')
          .eq('id', jobId)
          .single();
        
        if (error) {
          console.error('❌ Error en polling:', error);
          return;
        }
        
        if (job) {
          console.log('🔄 Polling - Job status:', job.status);
          
          // Actualizar estado
          setExportStatus(job.status_message || `Estado: ${job.status}`);
          
          if (job.status === 'completed' && job.download_url) {
            console.log('✅ Polling detectó job completado!');
            handleJobCompleted(job.download_url);
            return true; // Job completado, detener polling
          }
          
          if (job.status === 'failed') {
            console.log('❌ Polling detectó job fallido');
            setExportError(job.status_message || 'Error en la exportación');
            setExporting(false);
            setJobId(null);
            return true; // Job fallido, detener polling
          }
        }
      } catch (error) {
        console.error('❌ Error en polling:', error);
      }
      return false; // Continuar polling
    };
    
    // Función para manejar job completado
    const handleJobCompleted = (downloadUrl: string) => {
      console.log('🔗 URL de descarga disponible, iniciando descarga automática...');
      setExportUrl(downloadUrl);
      setExportStatus('¡Tu libro DOCX está listo! Descargando automáticamente...');
      
      // Descargar automáticamente el archivo
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${book?.title || 'libro'}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Actualizar estado final
      setTimeout(() => {
        console.log('🔄 Reseteando estado del botón de exportación...');
        setExportStatus('¡Descarga completada! Tu libro DOCX ha sido descargado.');
        setExporting(false);
        console.log('🔴 setExporting(false) ejecutado');
        fetchExportHistory();
        
        setTimeout(() => {
          console.log('🧹 Limpiando estado completo...');
          setExportStatus(null);
          setExportError(null);
          setExportUrl(null);
          setJobId(null);
        }, 3000);
      }, 1000);
    };
    
    // Iniciar polling inmediatamente y luego cada 3 segundos
    const pollingInterval = setInterval(async () => {
      const completed = await pollJobStatus();
      if (completed) {
        clearInterval(pollingInterval);
      }
    }, 3000);
    
    // Polling inicial inmediato
    pollJobStatus().then(completed => {
      if (completed) {
        clearInterval(pollingInterval);
      }
    });
    
    const channel: RealtimeChannel = supabase
      .channel(`export-job-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'export_jobs', filter: `id=eq.${jobId}` },
        (payload) => {
          console.log('📡 Payload recibido de Realtime:', payload);
          console.log('📊 Estado actual del botón - exporting:', exporting);
          const updatedJob = payload.new as { status: string; download_url: string | null; status_message: string };
          console.log('🔄 Job actualizado:', {
            status: updatedJob.status,
            download_url: updatedJob.download_url ? 'SÍ' : 'NO',
            status_message: updatedJob.status_message
          });
          
          // Si WebSocket funciona, detener polling
          clearInterval(pollingInterval);
          
          // Actualizar el mensaje de estado
          setExportStatus(updatedJob.status_message || `Estado: ${updatedJob.status}`);

          if (updatedJob.status === 'completed') {
            console.log('✅ Job completado detectado por WebSocket!');
            if (updatedJob.download_url) {
              handleJobCompleted(updatedJob.download_url);
            } else {
              setExportError('El archivo se generó pero no se pudo obtener la URL de descarga.');
              setExporting(false);
            }
            channel.unsubscribe();
          } else if (updatedJob.status === 'failed') {
            setExportError(`La exportación ha fallado: ${updatedJob.status_message}`);
            setExporting(false);
            setJobId(null);
            channel.unsubscribe();
          } else if (updatedJob.status === 'processing' || updatedJob.status === 'generating_pdf') {
            setExportStatus(updatedJob.status_message || 'Procesando...');
          }
        }
      )
      .subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Suscrito a las actualizaciones del trabajo de exportación: ${jobId}`);
        } else if (err) {
          console.error('Error en la suscripción a Realtime:', err);
          
          // Verificar si es un error de token expirado
          if (err.message && err.message.includes('Token has expired')) {
            console.log('🔄 Token expirado detectado, intentando renovar sesión...');
            
            try {
              // Intentar renovar la sesión
              const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
              
              if (refreshError) {
                console.error('Error renovando sesión:', refreshError);
                setExportError('Sesión expirada. Por favor, recarga la página e inicia sesión nuevamente.');
                setExporting(false);
                return;
              }
              
              if (session) {
                console.log('✅ Sesión renovada exitosamente, reintentando suscripción...');
                
                // Limpiar el canal actual
                channel.unsubscribe();
                
                // Reintentar la suscripción después de un breve delay
                setTimeout(() => {
                  // Reiniciar el proceso de suscripción
                  window.location.reload(); // Solución temporal para reiniciar completamente
                }, 1000);
                
                return;
              }
            } catch (refreshError) {
              console.error('Error durante la renovación de sesión:', refreshError);
            }
          }
          
          setExportError('Error de conexión para monitorizar el progreso. Usando polling como respaldo.');
          // No detener la exportación, el polling seguirá funcionando
        }
      });

    // Cleanup function to unsubscribe
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [jobId]);

  useEffect(() => {
    const fetchAiModels = async () => {
      const { data, error } = await supabase
        .from('ai_models')
        .select('id, name, display_name, description')
        .eq('type', 'editor')
        .eq('active', true)
        .order('display_name');
      
      if (error) {
        console.error('Error fetching AI models:', error);
      } else {
        setAiModels(data || []);
        // Seleccionar el primer modelo por defecto si hay modelos disponibles
        if (data && data.length > 0 && !selectedModelId) {
          setSelectedModelId(data[0].id);
        }
      }
    };

    const fetchCoverModels = async () => {
      const { data, error } = await supabase
        .from('ai_models')
        .select('id, name, display_name, description, ai_providers!inner(name)')
        .eq('type', 'cover')
        .eq('active', true)
        .order('display_name');
      
      if (error) {
        console.error('Error fetching cover models:', error);
      } else {
        setCoverModels(data || []);
        // Seleccionar el primer modelo de portada por defecto
        if (data && data.length > 0 && !selectedCoverModelId) {
          setSelectedCoverModelId(data[0].id);
        }
      }
    };

    fetchAiModels();
    fetchCoverModels();
  }, []);

  // Función para cargar las portadas de la galería
  const fetchBookCovers = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('book_covers')
        .select('*')
        .eq('book_id', id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching book covers:', error);
        return;
      }
      
      setBookCovers(data || []);
      
      // Encontrar la portada activa
      const activeCover = data?.find(cover => cover.is_active);
      if (activeCover) {
        // setActiveCoverId(activeCover.id); // This state is no longer in use
      }
    } catch (error) {
      console.error('Error loading book covers:', error);
    }
  };

  // Función para cambiar la portada activa
  const setActiveCover = async (coverId: string) => {
    if (!id) return;
    
    try {
      // Actualizar la portada activa en la base de datos
      const { error } = await supabase
        .from('book_covers')
        .update({ is_active: true })
        .eq('id', coverId);
      
      if (error) {
        console.error('Error setting active cover:', error);
        return;
      }
      
      // Actualizar el estado local
      setBookCovers(prev => prev.map(cover => ({
        ...cover,
        is_active: cover.id === coverId
      })));
      
      // Actualizar la URL de portada en el libro para compatibilidad
      const selectedCover = bookCovers.find(cover => cover.id === coverId);
      if (selectedCover) {
        await supabase
          .from('books')
          .update({ cover_image_url: selectedCover.image_url })
          .eq('id', id);
        
        // Recargar datos del libro para reflejar el cambio
        window.location.reload();
      }
    } catch (error) {
      console.error('Error setting active cover:', error);
    }
  };

  const maxRetries = 10;
  
  const fetchExportHistory = async () => {
    if (!id || !user?.id) return;
    
    setLoadingHistory(true);
    try {
      // TEMPORAL: Mostrar TODAS las exportaciones para diagnosticar el problema
      const { data, error } = await supabase
        .from('export_jobs')
        .select('*')
        .eq('book_id', id)
        .eq('user_id', user.id)
        // .eq('status', 'completed')  // ❌ COMENTADO TEMPORALMENTE
        // .not('download_url', 'is', null)  // ❌ COMENTADO TEMPORALMENTE
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setExportHistory(data || []);
    } catch (error: any) {
      console.error('Error al obtener historial de exportaciones:', error);
    } finally {
      setLoadingHistory(false);
    }
  };
  
  const fetchBookDetails = async (retry = 0) => {
    try {
      console.log(`Intentando obtener detalles del libro con ID: ${id} y user_id: ${user?.id} (intento ${retry + 1}/${maxRetries})`);
      
      const { data: bookData, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('id', id)
        .eq('user_id', user?.id)
        .maybeSingle()

      if (bookError) throw bookError;
      
      if (!bookData) {
        if (retry < maxRetries - 1) {
          setStatusMessage(`Esperando a que el libro esté disponible... (intento ${retry + 1}/${maxRetries})`)
          setTimeout(() => fetchBookDetails(retry + 1), 3000)
          return
        } else {
          throw new Error('Se alcanzó el número máximo de reintentos. El libro no está disponible.');
        }
      }
      
      setBook(bookData)

      const { data: chaptersData, error: chaptersError } = await supabase
        .from('chapters')
        .select('*')
        .eq('book_id', id)
        .order('order_number')

      if (chaptersError) throw chaptersError;
      setChapters(chaptersData || [])

    } catch (error: any) {
      console.error('Error al obtener detalles del libro:', error)
      setError(error.message || 'Ocurrió un error inesperado.')
    } finally {
      setLoading(false)
    }
  }

  const fetchChapterLogs = async (chapterId: string) => {
    if (expandedLogChapterId === chapterId) {
      setExpandedLogChapterId(null); // Collapse if already open
      return;
    }

    // If logs are already fetched, just expand
    if (chapterLogs[chapterId]) {
      setExpandedLogChapterId(chapterId);
      return;
    }

    setLoadingLogs(true);
    try {
      // First, get the chapter title to match with logs
      const chapter = chapters.find(ch => ch.id === chapterId);
      if (!chapter) {
        throw new Error('Capítulo no encontrado');
      }

      // Search for logs in book_creation_logs that mention this chapter's title
      const { data, error } = await supabase
        .from('book_creation_logs')
        .select('*')
        .eq('book_id', id)
        .or(`step_detail.ilike.%${chapter.title}%,step_detail.ilike.%capítulo ${chapter.order_number}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        // Transform the data to match the expected format
        const transformedLogs = data.map(log => ({
          id: log.id,
          timestamp: log.created_at,
          phase: log.step_type,
          prompt_text: log.ai_request || 'No disponible',
          response_text: log.ai_response || log.step_detail || 'No disponible',
          model_used: log.ai_model || 'No especificado',
          metadata: {
            status: log.status,
            duration_seconds: log.duration_seconds,
            word_count: log.word_count,
            tokens_used: log.tokens_used
          }
        }));
        
        setChapterLogs(prev => ({ ...prev, [chapterId]: transformedLogs }));
        setExpandedLogChapterId(chapterId);
      } else {
        // If no specific logs found, show a message
        setChapterLogs(prev => ({ ...prev, [chapterId]: [] }));
        setExpandedLogChapterId(chapterId);
      }
    } catch (error: any) {
      console.error('Error fetching chapter logs:', error.message);
      setError('No se pudieron cargar los logs de IA para este capítulo.');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleExportClick = () => {
    setDedication('');
    setAcknowledgements('');
    setIsbn('');
    // Resetear valores KDP a los por defecto
    setKdpFormatType('paperback');
    setKdpFormatSize('15,24 x 22,86 cm (6" x 9")');
    setKdpInkType('black_white');
    setKdpPaperType('white');
    setIsExportModalOpen(true);
  };

  const handleCancelExport = () => {
    setIsExportModalOpen(false);
  };

  const handleConfirmExport = async () => {
    if (!id) return;

    setExporting(true);
    setExportStatus('Iniciando exportación...');
    setExportError(null);
    setExportUrl(null);
    setIsExportModalOpen(false);

    const exportOptions = {
      dedication: dedication || undefined,
      acknowledgements: acknowledgements || undefined,
      isbn: isbn || undefined,
      kdp_format_type: kdpFormatType,
      kdp_format_size: kdpFormatSize,
      kdp_ink_type: kdpInkType,
      kdp_paper_type: kdpPaperType,
    };

    try {
      const { data, error } = await supabase.functions.invoke('handle-export-request', {
        body: {
          book_id: id,
          format: 'docx', // Cambiado a DOCX
          color_scheme: 'standard',
          export_options: exportOptions,
          editor_model_id: selectedModelId || undefined,
        },
      });

      if (error) throw error;

      if (data.jobId) {
        setJobId(data.jobId);
        setExportStatus('Trabajo de exportación creado. Generando DOCX con IA + docxtemplater...');
      } else {
        throw new Error('No se recibió un ID de trabajo del servidor.');
      }
    } catch (err: any) {
      console.error('Error al iniciar la exportación:', err);
      setExportError(err.message || 'Ocurrió un error al iniciar la exportación.');
      setExporting(false);
    }
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  // Función para generar portada manualmente
  const handleGenerateCover = async (coverModelId?: string) => {
    if (!id || !user?.id) return;
    
    const modelToUse = coverModelId || selectedCoverModelId;
    
    setGeneratingCover(true);
    setCoverGenerationStatus('Iniciando generación de portada...');
    setShowCoverModelSelection(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-cover-manual', {
        body: { 
          book_id: id,
          image_model_id: modelToUse
        }
      });
      
      if (error) {
        throw new Error(error.message || 'Error al iniciar la generación de portada');
      }
      
      if (!data.success) {
        throw new Error(data.message || 'Error al iniciar la generación de portada');
      }
      
      setCoverGenerationStatus('Generando portada con IA...');
      
      // Iniciar polling para monitorear el progreso
      const pollCoverProgress = async () => {
        try {
          const { data: jobData, error: jobError } = await supabase
            .from('jobs')
            .select('status, status_message, progress_percentage')
            .eq('id', data.job_id)
            .single();
            
          if (jobError) {
            console.error('Error polling cover job:', jobError);
            return false;
          }
          
          setCoverGenerationStatus(jobData.status_message || `Estado: ${jobData.status}`);
          
          if (jobData.status === 'completed') {
            // Recargar datos del libro y galería de portadas
            await fetchBookDetails();
            await fetchBookCovers(); // Recargar galería para mostrar la nueva portada
            setGeneratingCover(false);
            setCoverGenerationStatus('¡Portada generada exitosamente!');
            setTimeout(() => setCoverGenerationStatus(null), 3000);
            return true;
          } else if (jobData.status === 'failed') {
            setGeneratingCover(false);
            setCoverGenerationStatus(`Error: ${jobData.status_message}`);
            setTimeout(() => setCoverGenerationStatus(null), 5000);
            return true;
          }
          
          return false;
        } catch (error) {
          console.error('Error en polling:', error);
          return false;
        }
      };
      
      // Cleanup después de 5 minutos máximo
      const timeoutId = setTimeout(() => {
        clearInterval(pollingInterval);
        setGeneratingCover(false);
        setCoverGenerationStatus('Timeout - verifica el estado manualmente');
        setTimeout(() => setCoverGenerationStatus(null), 5000);
      }, 300000); // 5 minutos
      
      // Polling cada 3 segundos con cleanup automático
      const pollingInterval = setInterval(async () => {
        const completed = await pollCoverProgress();
        if (completed) {
          clearInterval(pollingInterval);
          clearTimeout(timeoutId); // Limpiar timeout cuando termine exitosamente
        }
      }, 3000);
      
    } catch (error: any) {
      console.error('Error generating cover:', error);
      setGeneratingCover(false);
      setCoverGenerationStatus(`Error: ${error.message}`);
      setTimeout(() => setCoverGenerationStatus(null), 5000);
    }
  };

  // Funciones wrapper para manejar clicks
  const handleGenerateCoverClick = () => {
    if (coverModels.length > 1) {
      setShowCoverModelSelection(true);
    } else {
      handleGenerateCover();
    }
  };

  const handleRegenerateCoverClick = () => {
    if (coverModels.length > 1) {
      setShowCoverModelSelection(true);
    } else {
      handleGenerateCover();
    }
  };

  // Funciones para reescritura de capítulos
  const handleRewriteChaptersClick = () => {
    // Preparar la lista de capítulos con su estado
    const selections: ChapterSelection[] = chapters.map(chapter => ({
      id: chapter.id,
      title: chapter.title,
      order_number: chapter.order_number,
      hasContent: !!(chapter.content && chapter.content.trim()),
      selected: false
    }));
    
    setChapterSelections(selections);
    setIsRewriteModalOpen(true);
  };

  const handleChapterSelectionChange = (chapterId: string, selected: boolean) => {
    setChapterSelections(prev => 
      prev.map(chapter => 
        chapter.id === chapterId ? { ...chapter, selected } : chapter
      )
    );
  };

  const handleSelectAllChapters = () => {
    setChapterSelections(prev => 
      prev.map(chapter => ({ ...chapter, selected: true }))
    );
  };

  const handleSelectEmptyChapters = () => {
    setChapterSelections(prev => 
      prev.map(chapter => ({ 
        ...chapter, 
        selected: !chapter.hasContent 
      }))
    );
  };

  const handleSelectNoneChapters = () => {
    setChapterSelections(prev => 
      prev.map(chapter => ({ ...chapter, selected: false }))
    );
  };

  const handleConfirmRewrite = async () => {
    const selectedChapterIds = chapterSelections
      .filter(chapter => chapter.selected)
      .map(chapter => chapter.id);
    
    if (selectedChapterIds.length === 0) {
      alert('Por favor selecciona al menos un capítulo para reescribir.');
      return;
    }

    if (!book?.ai_config?.writer_model_id) {
      alert('No se encontró la configuración de IA del libro. No se puede proceder.');
      return;
    }

    setRewritingChapters(true);
    setRewriteStatus('Iniciando reescritura de capítulos...');
    setIsRewriteModalOpen(false);

    try {
      // Crear job de reescritura para seguimiento
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .insert({
          book_id: id,
          status: 'processing',
          status_message: `Reescribiendo ${selectedChapterIds.length} capítulos seleccionados`,
          progress_percentage: 10,
          payload: {
            chapter_ids: selectedChapterIds,
            rewrite_mode: true
          }
        })
        .select()
        .single();

      if (jobError) {
        throw new Error(jobError.message);
      }

      setJobId(jobData.id);
      setRewriteStatus(`Reescribiendo ${selectedChapterIds.length} capítulos...`);

      // Log de inicio
      await supabase.from('creation_logs').insert({
        book_id: id,
        message: `🔄 Iniciando reescritura de ${selectedChapterIds.length} capítulos seleccionados por el usuario`
      });

      // MÉTODO SIMPLE: Limpiar contenido y activar triggers existentes
      // Esto reutiliza toda la infraestructura ya probada
      for (const chapterId of selectedChapterIds) {
        // Limpiar el contenido del capítulo para que se considere "pendiente"
        await supabase
          .from('chapters')
          .update({ 
            content: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', chapterId);
      }

      // Los triggers existentes detectarán los capítulos con content=null
      // y los procesarán automáticamente usando la configuración original del libro

      // Actualizar job a completado ya que el método simple no requiere seguimiento complejo
      await supabase
        .from('jobs')
        .update({
          status: 'completed',
          status_message: `Reescritura de ${selectedChapterIds.length} capítulos iniciada exitosamente`,
          progress_percentage: 100
        })
        .eq('id', jobData.id);

      // Mostrar mensaje de éxito inmediato
      setRewritingChapters(false);
      setRewriteStatus('¡Reescritura iniciada! Los capítulos se están procesando automáticamente.');
      
      // Recargar capítulos después de un breve delay para mostrar el cambio
      setTimeout(async () => {
        await fetchBookDetails();
        setRewriteStatus('Los capítulos se están reescribiendo en segundo plano...');
        setTimeout(() => setRewriteStatus(null), 3000);
      }, 2000);
      
    } catch (error: any) {
      console.error('Error rewriting chapters:', error);
      setRewritingChapters(false);
      setRewriteStatus(`Error: ${error.message}`);
      setTimeout(() => setRewriteStatus(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-indigo-600 animate-pulse mx-auto" />
          <p className="text-lg text-gray-700 mt-4">Cargando detalles del libro...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <p className="text-lg text-red-600">{error}</p>
          <button 
            onClick={() => navigate(-1)} 
            className="mt-4 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-lg text-gray-700">Libro no encontrado.</p>
          <button 
            onClick={() => navigate('/dashboard')} 
            className="mt-4 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700"
          >
            Ir al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a la lista
        </button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2">
            {/* Book Header */}
            <div className="flex flex-col sm:flex-row items-start bg-white rounded-lg shadow-lg p-6 mb-8">
              <div className="relative">
                <img 
                  src={book.cover_image_url || 'https://placehold.co/150x220/e2e8f0/a0aec0?text=Libro'} 
                  alt={`Portada de ${book.title}`} 
                  className="w-36 h-52 object-cover rounded-md shadow-md mb-4 sm:mb-0 sm:mr-6"
                />
                {/* Botón para generar portada si no existe */}
                {!book.cover_image_url && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-md">
                    <button
                      onClick={handleGenerateCoverClick}
                      disabled={generatingCover}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2"
                    >
                      {generatingCover ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Generando...</span>
                        </>
                      ) : (
                        <>
                          <span>🎨</span>
                          <span>Generar Portada</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
                {/* Botones para portada existente */}
                {book.cover_image_url && (
                  <div className="absolute bottom-2 right-2 flex space-x-2">
                    {/* Botón de galería */}
                    {bookCovers.length > 1 && (
                      <button
                        onClick={() => setShowCoverGallery(true)}
                        className="bg-purple-600 bg-opacity-75 hover:bg-opacity-90 text-white p-2 rounded-full text-xs transition-all"
                        title="Ver galería de portadas"
                      >
                        <span>🖼️</span>
                      </button>
                    )}
                    {/* Botón de regenerar */}
                    <button
                      onClick={handleRegenerateCoverClick}
                      disabled={generatingCover}
                      className="bg-gray-800 bg-opacity-75 hover:bg-opacity-90 disabled:bg-opacity-50 text-white p-2 rounded-full text-xs transition-all"
                      title="Regenerar portada"
                    >
                      {generatingCover ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <span>🔄</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900">{book.title}</h1>
                <p className="text-lg text-gray-700 mt-1">por {book.author}</p>
                <div className="flex items-center text-sm text-gray-500 mt-4 space-x-4">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1.5" />
                    <span>Creado el {new Date(book.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center">
                    <Tag className="w-4 h-4 mr-1.5" />
                    <span className="capitalize">{book.category}</span>
                  </div>
                </div>
                <p className="text-gray-600 mt-4 text-sm">{book.idea}</p>
                
                {/* Estado de generación de portada */}
                {coverGenerationStatus && (
                  <div className="mt-4 p-3 rounded-md bg-blue-50 border border-blue-200">
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      <p className="text-sm text-blue-700">{coverGenerationStatus}</p>
                    </div>
                  </div>
                )}
                
                {/* Modal de selección de modelo de portada */}
                {showCoverModelSelection && (
                  <div className="mt-4 p-4 rounded-md bg-indigo-50 border border-indigo-200">
                    <h4 className="text-sm font-medium text-indigo-900 mb-3 flex items-center">
                      <span className="🎨 mr-2">🎨</span>
                      Selecciona el modelo de IA para generar la portada
                    </h4>
                    
                    <div className="space-y-2 mb-4">
                      {coverModels.map((model) => (
                        <label key={model.id} className="flex items-start p-3 border border-indigo-200 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors">
                          <input
                            type="radio"
                            name="cover-model"
                            value={model.id}
                            checked={selectedCoverModelId === model.id}
                            onChange={() => setSelectedCoverModelId(model.id)}
                            className="mt-1 mr-3 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-indigo-900">{model.display_name}</div>
                            <div className="text-sm text-indigo-700 mt-1">
                              Proveedor: {model.ai_providers?.name || 'N/A'}
                            </div>
                            {model.description && (
                              <div className="text-sm text-indigo-600 mt-1">{model.description}</div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                    
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleGenerateCover(selectedCoverModelId || undefined)}
                        disabled={!selectedCoverModelId || generatingCover}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2"
                      >
                        <span>🎨</span>
                        <span>Generar Portada</span>
                      </button>
                      
                      <button
                        onClick={() => setShowCoverModelSelection(false)}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Book Bible */}
            {bookBible && (
              <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                <button 
                  onClick={() => setIsBibleExpanded(!isBibleExpanded)}
                  className="w-full flex justify-between items-center p-4 text-left bg-gray-50 hover:bg-gray-100 rounded-md"
                >
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <BookText className="w-6 h-6 mr-3 text-indigo-600" />
                    Biblia del Libro (Guía de IA)
                  </h2>
                  {isBibleExpanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                </button>
                {isBibleExpanded && (
                  <div className="mt-4 p-4 border-t border-gray-200 bg-gray-50 rounded-b-md">
                    <div className="bg-white p-6 rounded-md border shadow-sm">
                      <div className="prose max-w-none">
                        {typeof bookBible === 'string' ? (
                          <div className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
                            {bookBible}
                          </div>
                        ) : (
                          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono bg-gray-50 p-4 rounded-md border overflow-x-auto leading-relaxed">
                            {JSON.stringify(bookBible, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Chapters */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Capítulos</h2>
              {statusMessage && <p className="mb-4 text-blue-600 bg-blue-100 p-3 rounded-md">{statusMessage}</p>}
              <div className="space-y-4">
                {chapters.length > 0 ? (
                  chapters.map(chapter => (
                    <div key={chapter.id} className="border border-gray-200 rounded-md">
                      <button 
                        onClick={() => toggleChapter(chapter.id)} 
                        className="w-full flex justify-between items-center p-4 text-left"
                      >
                        <span className="font-medium text-gray-800">Capítulo {chapter.order_number}: {chapter.title}</span>
                        {expandedChapters[chapter.id] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                      {expandedChapters[chapter.id] && (
                        <div className="p-4 border-t border-gray-200 bg-gray-50">
                          <h4 className="font-semibold mb-2 text-gray-700">Sinopsis</h4>
                          <p className="text-sm text-gray-600 mb-4 whitespace-pre-wrap">{chapter.synopsis}</p>
                          <h4 className="font-semibold mb-2 text-gray-700">Contenido</h4>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap mb-6">{chapter.content || "Contenido pendiente de generación..."}</p>

                          {/* AI Logs Section */}
                          <div className="border-t border-gray-300 pt-4">
                            <button 
                              onClick={() => fetchChapterLogs(chapter.id)}
                              disabled={loadingLogs}
                              className="flex items-center space-x-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:text-gray-400 transition-colors"
                            >
                              <Bot className="w-4 h-4" />
                              <span>{expandedLogChapterId === chapter.id ? 'Ocultar Log IA' : 'Ver Log IA'}</span>
                              {loadingLogs && expandedLogChapterId !== chapter.id && (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                              )}
                            </button>

                            {expandedLogChapterId === chapter.id && (
                              <div className="mt-4 space-y-4 p-4 bg-white rounded-md border border-gray-200">
                                {loadingLogs ? (
                                  <p className="text-sm text-gray-500">Cargando logs...</p>
                                ) : chapterLogs[chapter.id] && chapterLogs[chapter.id].length > 0 ? (
                                  chapterLogs[chapter.id].map(log => (
                                    <div key={log.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                                      <div className="mb-2">
                                        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                                          {log.phase}
                                        </span>
                                        <span className="ml-2 text-xs text-gray-500">
                                          {log.model_used}
                                        </span>
                                        {log.metadata?.status && (
                                          <span className={`ml-2 inline-block text-xs px-2 py-1 rounded-full font-medium ${
                                            log.metadata.status === 'completed' ? 'bg-green-100 text-green-800' : 
                                            log.metadata.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-gray-100 text-gray-800'
                                          }`}>
                                            {log.metadata.status}
                                          </span>
                                        )}
                                      </div>
                                      
                                      <h5 className="font-semibold text-gray-800 mb-2">Prompt Enviado a IA</h5>
                                      <div className="mb-4 bg-white rounded-md border border-gray-300 shadow-sm">
                                        {(() => {
                                          try {
                                            const parsed = JSON.parse(log.prompt_text);
                                            return (
                                              <div className="max-h-96 overflow-y-auto p-4">
                                                <div className="space-y-4">
                                                  {parsed.system && (
                                                    <div>
                                                      <h6 className="font-semibold text-sm text-blue-700 mb-2">Instrucciones del Sistema:</h6>
                                                      <p className="text-sm text-gray-700 leading-relaxed bg-blue-50 p-3 rounded border-l-4 border-blue-200">
                                                        {parsed.system}
                                                      </p>
                                                    </div>
                                                  )}
                                                  {parsed.user && (
                                                    <div>
                                                      <h6 className="font-semibold text-sm text-green-700 mb-2">Prompt del Usuario:</h6>
                                                      <div className="text-sm text-gray-700 leading-relaxed bg-green-50 p-3 rounded border-l-4 border-green-200 whitespace-pre-wrap">
                                                        {parsed.user}
                                                      </div>
                                                    </div>
                                                  )}
                                                  {parsed.config && (
                                                    <div>
                                                      <h6 className="font-semibold text-sm text-purple-700 mb-2">Configuración:</h6>
                                                      <div className="text-sm text-gray-700 bg-purple-50 p-3 rounded border-l-4 border-purple-200">
                                                        <div className="grid grid-cols-2 gap-2">
                                                          <span><strong>Modelo:</strong> {parsed.config.model}</span>
                                                          <span><strong>Proveedor:</strong> {parsed.config.provider}</span>
                                                          <span><strong>Temperatura:</strong> {parsed.config.temperature}</span>
                                                          <span><strong>Max Tokens:</strong> {parsed.config.max_tokens}</span>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          } catch (e) {
                                            return (
                                              <div className="max-h-96 overflow-y-auto">
                                                <pre className="p-4 text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
                                                  {log.prompt_text}
                                                </pre>
                                              </div>
                                            );
                                          }
                                        })()}
                                      </div>
                                      
                                      <h5 className="font-semibold text-gray-800 mb-2">Respuesta Recibida</h5>
                                      <div className="mb-3 bg-white rounded-md border border-gray-300 shadow-sm">
                                        {(() => {
                                          try {
                                            const parsed = JSON.parse(log.response_text);
                                            return (
                                              <div className="max-h-96 overflow-y-auto p-4">
                                                {Array.isArray(parsed) ? (
                                                  <div className="space-y-4">
                                                    {parsed.map((item, index) => (
                                                      <div key={index} className="bg-gray-50 p-4 rounded-lg border">
                                                        {item.chapter_number && (
                                                          <div className="mb-3">
                                                            <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                                                              Capítulo {item.chapter_number}
                                                            </span>
                                                          </div>
                                                        )}
                                                        {item.title && (
                                                          <h6 className="font-bold text-lg text-gray-900 mb-2">{item.title}</h6>
                                                        )}
                                                        {item.synopsis && (
                                                          <div className="mb-3">
                                                            <p className="text-sm text-gray-700 leading-relaxed">{item.synopsis}</p>
                                                          </div>
                                                        )}
                                                        {item.narrative_function && (
                                                          <div className="mb-2">
                                                            <span className="text-xs text-gray-600"><strong>Función narrativa:</strong> {item.narrative_function}</span>
                                                          </div>
                                                        )}
                                                        {item.emotional_intensity && (
                                                          <div className="mb-2">
                                                            <span className="text-xs text-gray-600"><strong>Intensidad emocional:</strong> {item.emotional_intensity}/10</span>
                                                          </div>
                                                        )}
                                                        {item.key_elements && item.key_elements.length > 0 && (
                                                          <div className="mb-2">
                                                            <p className="text-xs text-gray-600 mb-1"><strong>Elementos clave:</strong></p>
                                                            <div className="flex flex-wrap gap-1">
                                                              {item.key_elements.map((element: string, i: number) => (
                                                                <span key={i} className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                                                                  {element}
                                                                </span>
                                                              ))}
                                                            </div>
                                                          </div>
                                                        )}
                                                      </div>
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <pre className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
                                                    {JSON.stringify(parsed, null, 2)}
                                                  </pre>
                                                )}
                                              </div>
                                            );
                                          } catch (e) {
                                            return (
                                              <div className="max-h-96 overflow-y-auto">
                                                <pre className="p-4 text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
                                                  {log.response_text}
                                                </pre>
                                              </div>
                                            );
                                          }
                                        })()}
                                      </div>
                                      
                                      {log.metadata && (
                                        <div className="text-xs text-gray-500 mt-2 space-x-4">
                                          {log.metadata.word_count && <span>Palabras: {log.metadata.word_count}</span>}
                                          {log.metadata.tokens_used && <span>Tokens: {log.metadata.tokens_used}</span>}
                                          {log.metadata.duration_seconds && <span>Duración: {log.metadata.duration_seconds}s</span>}
                                        </div>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm text-gray-500">No se encontraron logs para este capítulo.</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 px-4 border-2 border-dashed border-gray-300 rounded-lg">
                    <FileText className="w-16 h-16 text-gray-400 mx-auto" />
                    <p className="mt-4 text-gray-600">Los capítulos aún no se han generado. El proceso está en marcha.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="md:col-span-1 space-y-6">
            {/* Book Details */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuración</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Tono:</span>
                  <span className="text-sm font-medium text-gray-900 capitalize">{book.tone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Idioma:</span>
                  <span className="text-sm font-medium text-gray-900 uppercase">{book.language}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Capítulos:</span>
                  <span className="text-sm font-medium text-gray-900">{book.extension}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Tamaño:</span>
                  <span className="text-sm font-medium text-gray-900">{book.book_size}</span>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Progreso</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Capítulos generados</span>
                    <span>{chapters.length}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: chapters.length > 0 ? '100%' : '0%' }}
                    ></div>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  Estado: <span className="font-medium text-green-600">
                    {chapters.length > 0 ? 'Completado' : 'En progreso'}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones</h3>
              <div className="space-y-2">
                {!exportUrl ? (
                  <button
                    onClick={handleExportClick}
                    disabled={exporting}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md text-sm font-medium disabled:bg-indigo-400 disabled:cursor-not-allowed"
                  >
                    {exporting ? 'Exportando...' : 'Exportar Libro'}
                  </button>
                ) : (
                  <a
                    href={exportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full block text-center bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md text-sm font-medium"
                  >
                    Descargar Archivo
                  </a>
                )}
                {exportStatus && <p className="text-sm text-gray-600 mt-2 text-center">{exportStatus}</p>}
                {exportError && <p className="text-sm text-red-600 mt-2 text-center">{exportError}</p>}

                {/* Botón de reescritura de capítulos */}
                <button
                  onClick={handleRewriteChaptersClick}
                  disabled={rewritingChapters || chapters.length === 0}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white py-2 px-4 rounded-md text-sm font-medium disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {rewritingChapters ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Reescribiendo...</span>
                    </>
                  ) : (
                    <>
                      <span>✏️</span>
                      <span>Reescribir Capítulos</span>
                    </>
                  )}
                </button>
                {rewriteStatus && <p className="text-sm text-orange-600 mt-2 text-center">{rewriteStatus}</p>}

                <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-md text-sm font-medium">
                  Editar Configuración
                </button>
                <button className="w-full bg-red-100 hover:bg-red-200 text-red-700 py-2 px-4 rounded-md text-sm font-medium">
                  Eliminar Libro
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Export History Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Historial de Exportaciones</h2>
          
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-2 text-gray-600">Cargando historial...</span>
            </div>
          ) : exportHistory.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay exportaciones</h3>
              <p className="mt-1 text-sm text-gray-500">
                Aún no has exportado este libro. Haz clic en "Exportar" para crear tu primera versión DOCX.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {exportHistory.map((exportJob) => {
                const getStatusColor = (status: string) => {
                  switch (status) {
                    case 'completed': return 'bg-green-100 text-green-800';
                    case 'processing': return 'bg-blue-100 text-blue-800';
                    case 'pending': return 'bg-yellow-100 text-yellow-800';
                    case 'failed': return 'bg-red-100 text-red-800';
                    default: return 'bg-gray-100 text-gray-800';
                  }
                };
                
                const getStatusLabel = (status: string) => {
                  switch (status) {
                    case 'completed': return 'Completado';
                    case 'processing': return 'Procesando';
                    case 'pending': return 'Pendiente';
                    case 'failed': return 'Fallido';
                    default: return status;
                  }
                };
                
                return (
                  <div key={exportJob.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-indigo-600" />
                        <span className="font-medium text-gray-900">Exportación DOCX</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(exportJob.status)}`}>
                          {getStatusLabel(exportJob.status)}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(exportJob.created_at).toLocaleString('es-ES')}
                      </span>
                    </div>
                    
                    <div className="mt-3 flex justify-end">
                      {exportJob.download_url ? (
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = exportJob.download_url!;
                            link.download = `${book?.title || 'libro'}.docx`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                        >
                          Descargar
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {exportJob.status === 'pending' && 'Esperando procesamiento...'}
                          {exportJob.status === 'processing' && 'Generando documento...'}
                          {exportJob.status === 'failed' && 'Error en la exportación'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-xl">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                <FileText className="mr-3 text-indigo-600" size={28} />
                Exportar a Word (DOCX)
              </h2>
              <p className="text-gray-600 mt-2">Configura las opciones de tu libro para Amazon KDP</p>
            </div>
            
            <div className="px-8 py-6">
              <div className="space-y-6">
              <div>
                <label htmlFor="dedication" className="block text-sm font-medium text-gray-700">Dedicatoria (Opcional)</label>
                <textarea
                  id="dedication"
                  value={dedication}
                  onChange={(e) => setDedication(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Para mi familia..."
                />
              </div>
              
              <div>
                <label htmlFor="acknowledgements" className="block text-sm font-medium text-gray-700">Agradecimientos (Opcional)</label>
                <textarea
                  id="acknowledgements"
                  value={acknowledgements}
                  onChange={(e) => setAcknowledgements(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="A todos los que me apoyaron..."
                />
              </div>

              <div>
                <label htmlFor="isbn" className="block text-sm font-medium text-gray-700">ISBN (Opcional)</label>
                <input
                  type="text"
                  id="isbn"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="978-3-16-148410-0"
                />
              </div>

              {/* Sección de Formato KDP */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Formato Amazon KDP</h3>
                
                {/* Tipo de libro */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de libro</label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="paperback"
                        checked={kdpFormatType === 'paperback'}
                        onChange={(e) => {
                          setKdpFormatType(e.target.value as 'paperback' | 'hardcover');
                          // Resetear tamaño al cambiar tipo
                          if (e.target.value === 'paperback') {
                            setKdpFormatSize('15,24 x 22,86 cm (6" x 9")');
                          } else {
                            setKdpFormatSize('15,24 x 22,86 cm (6" x 9")');
                          }
                        }}
                        className="mr-2 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">Tapa blanda</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="hardcover"
                        checked={kdpFormatType === 'hardcover'}
                        onChange={(e) => {
                          setKdpFormatType(e.target.value as 'paperback' | 'hardcover');
                          if (e.target.value === 'hardcover') {
                            setKdpFormatSize('15,24 x 22,86 cm (6" x 9")');
                          }
                        }}
                        className="mr-2 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">Tapa dura</span>
                    </label>
                  </div>
                </div>

                {/* Tamaño del libro */}
                <div className="mb-4">
                  <label htmlFor="kdp-size" className="block text-sm font-medium text-gray-700">Tamaño de impresión</label>
                  <select
                    id="kdp-size"
                    value={kdpFormatSize}
                    onChange={(e) => setKdpFormatSize(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    {(kdpFormatType === 'paperback' ? KDP_PAPERBACK_SIZES : KDP_HARDCOVER_SIZES).map((size) => (
                      <option key={size} value={size}>
                        {size} {size === '15,24 x 22,86 cm (6" x 9")' ? '(Recomendado)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    El tamaño 6" x 9" es el más popular para la mayoría de libros.
                  </p>
                </div>

                {/* Tipo de tinta y papel */}
                <div className="mb-4">
                  <label htmlFor="kdp-ink" className="block text-sm font-medium text-gray-700">Tipo de tinta y papel</label>
                  <select
                    id="kdp-ink"
                    value={kdpInkType}
                    onChange={(e) => {
                      const inkType = e.target.value as 'black_white' | 'black_cream' | 'color_standard' | 'color_premium';
                      setKdpInkType(inkType);
                      // Actualizar tipo de papel automáticamente
                      if (inkType === 'black_cream') {
                        setKdpPaperType('cream');
                      } else {
                        setKdpPaperType('white');
                      }
                    }}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    {Object.entries(INK_TYPES).map(([key, label]) => {
                      // Filtrar opciones para tapa dura
                      if (kdpFormatType === 'hardcover' && (key === 'color_standard' || key === 'color_premium')) {
                        return null;
                      }
                      return (
                        <option key={key} value={key}>
                          {label} {key === 'black_white' ? '(Más económico)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {kdpInkType === 'black_white' && 'Opción más económica para libros sin imágenes en color.'}
                    {kdpInkType === 'black_cream' && 'Papel crema da un aspecto más clásico y es menos cansado para la vista.'}
                    {kdpInkType.startsWith('color') && 'Para libros con imágenes, gráficos o elementos en color.'}
                  </p>
                </div>
              </div>

              {/* Sección de Maquetador IA */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <span className="bg-indigo-100 text-indigo-800 p-2 rounded-lg mr-3">
                    🤖
                  </span>
                  Maquetador IA
                </h3>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <label htmlFor="ai-model" className="block text-sm font-medium text-gray-700 mb-3">
                    Selecciona el modelo de IA para maquetar tu libro
                  </label>
                  
                  {aiModels.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-gray-500 text-sm">Cargando modelos disponibles...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Opción por defecto */}
                      <label className="flex items-start p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="radio"
                          name="ai-model"
                          value=""
                          checked={!selectedModelId}
                          onChange={() => setSelectedModelId(null)}
                          className="mt-1 mr-3 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">Editor por defecto del libro</div>
                          <div className="text-sm text-gray-500 mt-1">
                            Utiliza la configuración de IA establecida en los ajustes del libro
                          </div>
                        </div>
                      </label>
                      
                      {/* Modelos disponibles */}
                      {aiModels.map((model) => (
                        <label key={model.id} className="flex items-start p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                          <input
                            type="radio"
                            name="ai-model"
                            value={model.id}
                            checked={selectedModelId === model.id}
                            onChange={() => setSelectedModelId(model.id)}
                            className="mt-1 mr-3 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{model.display_name || model.name}</div>
                            {model.description && (
                              <div className="text-sm text-gray-500 mt-1">{model.description}</div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      💡 <strong>Consejo:</strong> Los diferentes modelos de IA pueden generar estilos únicos. 
                      Experimenta con diferentes opciones para encontrar el que mejor se adapte a tu libro.
                    </p>
                  </div>
                </div>
              </div>
              </div>
              
              {/* Botones de acción */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-8 py-6 rounded-b-xl">
                <div className="flex justify-end space-x-4">
                  <button
                    onClick={handleCancelExport}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-6 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmExport}
                    disabled={exporting}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-lg text-sm font-medium disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors flex items-center"
                  >
                    {exporting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Iniciando exportación...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2" size={16} />
                        Confirmar y Exportar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Galería de Portadas */}
      {showCoverGallery && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Galería de Portadas</h2>
                <button
                  onClick={() => setShowCoverGallery(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {bookCovers.map((cover) => (
                  <div
                    key={cover.id}
                    className={`relative group cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
                      cover.is_active
                        ? 'border-indigo-500 ring-2 ring-indigo-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setActiveCover(cover.id)}
                  >
                    <img
                      src={cover.image_url}
                      alt={`Portada ${new Date(cover.created_at).toLocaleDateString()}`}
                      className="w-full h-48 object-cover"
                    />
                    
                    {/* Overlay con información */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all flex items-end">
                      <div className="p-3 text-white transform translate-y-full group-hover:translate-y-0 transition-transform">
                        <p className="text-xs font-medium">
                          {new Date(cover.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs opacity-90">
                          {cover.provider_used} - {cover.model_used}
                        </p>
                        {cover.is_active && (
                          <span className="inline-block bg-indigo-600 text-white px-2 py-1 rounded text-xs mt-1">
                            Activa
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  {bookCovers.length} portada{bookCovers.length !== 1 ? 's' : ''} disponible{bookCovers.length !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={() => setShowCoverGallery(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de reescritura de capítulos */}
      {isRewriteModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <span className="✏️ mr-2">✏️</span>
                Reescribir Capítulos
              </h3>
              
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-4">
                  Selecciona los capítulos que deseas reescribir. Se conservará toda la configuración de IA y parámetros originales del libro.
                </p>
                
                {/* Botones de selección rápida */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={handleSelectAllChapters}
                    className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-md text-sm font-medium transition-colors"
                  >
                    Seleccionar todos
                  </button>
                  <button
                    onClick={handleSelectEmptyChapters}
                    className="bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1 rounded-md text-sm font-medium transition-colors"
                  >
                    Solo capítulos vacíos
                  </button>
                  <button
                    onClick={handleSelectNoneChapters}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-md text-sm font-medium transition-colors"
                  >
                    Deseleccionar todos
                  </button>
                </div>
                
                {/* Lista de capítulos */}
                <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                  <div className="space-y-1 p-2">
                    {chapterSelections.map((chapter) => (
                      <label
                        key={chapter.id}
                        className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                          chapter.selected 
                            ? 'bg-orange-50 border-orange-200 border' 
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={chapter.selected}
                          onChange={(e) => handleChapterSelectionChange(chapter.id, e.target.checked)}
                          className="mr-3 text-orange-600 focus:ring-orange-500 rounded"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">
                              Capítulo {chapter.order_number}: {chapter.title}
                            </span>
                            <div className="flex items-center space-x-2">
                              {chapter.hasContent ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <span className="w-2 h-2 bg-green-400 rounded-full mr-1"></span>
                                  Con contenido
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  <span className="w-2 h-2 bg-red-400 rounded-full mr-1"></span>
                                  Vacío
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* Resumen de selección */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">
                      {chapterSelections.filter(c => c.selected).length} de {chapterSelections.length} capítulos seleccionados
                    </span>
                    {chapterSelections.filter(c => c.selected && !c.hasContent).length > 0 && (
                      <span className="ml-2 text-orange-600">
                        ({chapterSelections.filter(c => c.selected && !c.hasContent).length} vacíos)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Botones de acción */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setIsRewriteModalOpen(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmRewrite}
                  disabled={chapterSelections.filter(c => c.selected).length === 0}
                  className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white px-4 py-2 rounded-md text-sm font-medium disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  <span>✏️</span>
                  <span>Reescribir Capítulos Seleccionados</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}