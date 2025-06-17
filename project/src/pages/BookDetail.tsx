import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { BookOpen, Calendar, User, Tag, FileText, ArrowLeft } from 'lucide-react'

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

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }

    if (id) {
      fetchBookDetails()
    }
  }, [user, id, navigate])

  const fetchBookDetails = async () => {
    try {
      // Fetch book details
      const { data: bookData, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('id', id)
        .eq('user_id', user?.id)
        .single()

      if (bookError) throw bookError
      setBook(bookData)

      // Fetch chapters
      const { data: chaptersData, error: chaptersError } = await supabase
        .from('chapters')
        .select('*')
        .eq('book_id', id)
        .order('order_number')

      if (chaptersError) throw chaptersError
      setChapters(chaptersData || [])
    } catch (error) {
      console.error('Error fetching book details:', error)
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return null
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Libro no encontrado</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 text-indigo-600 hover:text-indigo-700"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
        >
          <ArrowLeft className="h-5 w-5 mr-1" />
          Volver
        </button>
        <div className="flex items-center space-x-2">
          <BookOpen className="h-6 w-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Detalles del Libro</h1>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Book Information */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">{book.title}</h2>
            <div className="flex items-center space-x-4 text-sm text-gray-600 mb-6">
              <div className="flex items-center">
                <User className="h-4 w-4 mr-1" />
                {book.author}
              </div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                {new Date(book.created_at).toLocaleDateString()}
              </div>
              <div className="flex items-center">
                <Tag className="h-4 w-4 mr-1" />
                {book.category}
              </div>
            </div>

            {book.idea && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Idea Principal</h3>
                <p className="text-gray-700">{book.idea}</p>
              </div>
            )}

            {book.description && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Descripción</h3>
                <p className="text-gray-700">{book.description}</p>
              </div>
            )}
          </div>

          {/* Chapters */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Capítulos</h3>
              <span className="text-sm text-gray-500">
                {chapters.length} de {book.extension} capítulos
              </span>
            </div>

            {chapters.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No hay capítulos generados aún</p>
                <p className="text-sm text-gray-400 mt-2">
                  Los capítulos aparecerán aquí una vez que la IA complete la generación
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {chapters.map((chapter) => (
                  <div key={chapter.id} className="border rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">
                      Capítulo {chapter.order_number}: {chapter.title}
                    </h4>
                    {chapter.synopsis && (
                      <p className="text-sm text-gray-600 mb-2">{chapter.synopsis}</p>
                    )}
                    {chapter.content && (
                      <div className="text-sm text-gray-500">
                        Contenido: {chapter.content.length} caracteres
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
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
              <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md text-sm font-medium">
                Descargar PDF
              </button>
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
  )
}