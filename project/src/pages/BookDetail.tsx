import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { BookOpen, Calendar, Tag, FileText, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import type { RealtimeChannel } from '@supabase/supabase-js'

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

  // State for export process
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }

    if (id) {
      fetchBookDetails()
    }
  }, [user, id, navigate])

  // Effect for Realtime subscription
  useEffect(() => {
    if (!jobId) return;

    const channel: RealtimeChannel = supabase
      .channel(`export-job-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'export_jobs', filter: `id=eq.${jobId}` },
        (payload) => {
          console.log('Payload recibido de Realtime:', payload);
          const updatedJob = payload.new as { status: string; download_url: string | null; status_message: string };
          setExportStatus(updatedJob.status_message || `Estado: ${updatedJob.status}`);

          if (updatedJob.status === 'completed' || updatedJob.status === 'html_generated') {
            if (updatedJob.download_url) {
              setExportUrl(updatedJob.download_url);
              setExportStatus('¡Tu libro está listo! Puedes descargarlo.');
              setExporting(false);
              channel.unsubscribe();
            }
          } else if (updatedJob.status === 'failed') {
            setExportError(`La exportación ha fallado: ${updatedJob.status_message}`);
            setExporting(false);
            channel.unsubscribe();
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Suscrito a las actualizaciones del trabajo de exportación: ${jobId}`);
        } else if (err) {
          console.error('Error en la suscripción a Realtime:', err);
          setExportError('Error de conexión para monitorizar el progreso.');
          setExporting(false);
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
        .select('id, name');
      
      if (error) {
        console.error('Error fetching AI models:', error);
      } else {
        setAiModels(data || []);
      }
    };

    fetchAiModels();
  }, []);

  const maxRetries = 10;
  
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
    };

    try {
      const { data, error } = await supabase.functions.invoke('handle-export-request', {
        body: {
          book_id: id,
          format: 'pdf',
          color_scheme: 'standard',
          export_options: exportOptions,
          editor_model_id: selectedModelId || undefined,
        },
      });

      if (error) throw error;

      if (data.job_id) {
        setJobId(data.job_id);
        setExportStatus('Trabajo de exportación creado. Esperando la generación del fichero...');
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
                    <span>{chapters.length}/{book.extension}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{ width: `${(chapters.length / book.extension) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  Estado: <span className="font-medium">En progreso</span>
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

      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Opciones de Exportación</h2>
            
            <div className="space-y-4">
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

              <div>
                <label htmlFor="ai-model" className="block text-sm font-medium text-gray-300">Maquetador IA (Opcional)</label>
                <select
                  id="ai-model"
                  value={selectedModelId || ''}
                  onChange={(e) => setSelectedModelId(e.target.value || null)}
                  className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">Usar el editor por defecto del libro</option>
                  {aiModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-400">
                  Selecciona una IA para generar el diseño del libro. Si no eliges ninguna, se usará la configurada en los ajustes del libro.
                </p>
              </div>
            </div>

            <div className="mt-8 flex justify-end space-x-4">
              <button
                onClick={handleCancelExport}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmExport}
                disabled={exporting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md text-sm font-medium disabled:bg-indigo-400 disabled:cursor-not-allowed"
              >
                {exporting ? 'Iniciando...' : 'Confirmar y Exportar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}