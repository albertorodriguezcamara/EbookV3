import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { BookOpen, Calendar, Tag, FileText, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
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
  tone: string
  language: string
  extension: number
  book_size: string
  created_at: string
  cover_image_url?: string
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
  const [jobId, setJobId] = useState<string | null>(null);

  // State for export history
  const [exportHistory, setExportHistory] = useState<ExportJob[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }

    if (id) {
      fetchBookDetails()
      fetchExportHistory()
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

    fetchAiModels();
  }, []);

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

      if (data.job_id) {
        setJobId(data.job_id);
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
              <img 
                src={book.cover_image_url || 'https://placehold.co/150x220/e2e8f0/a0aec0?text=Libro'} 
                alt={`Portada de ${book.title}`} 
                className="w-36 h-52 object-cover rounded-md shadow-md mb-4 sm:mb-0 sm:mr-6"
              />
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
              </div>
            </div>

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
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{chapter.content || "Contenido pendiente de generación..."}</p>
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
    </div>
  );
}