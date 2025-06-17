import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { BookOpen, Plus, Clock, CheckCircle, AlertCircle } from 'lucide-react'

interface Book {
  id: string
  title: string
  author: string
  category: string
  created_at: string
  // Add other fields as needed based on your schema
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }

    fetchBooks()
  }, [user, navigate])

  const fetchBooks = async () => {
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setBooks(data || [])
    } catch (error) {
      console.error('Error fetching books:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'processing':
        return <Clock className="h-5 w-5 text-yellow-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mis Libros</h1>
          <p className="text-gray-600 mt-2">Gestiona y crea nuevos libros con IA</p>
        </div>
        <Link
          to="/create"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nuevo Libro</span>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">No tienes libros aún</h3>
          <p className="text-gray-600 mb-6">Comienza creando tu primer libro con IA</p>
          <Link
            to="/create"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium inline-flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Crear Primer Libro</span>
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <Link
              key={book.id}
              to={`/book/${book.id}`}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
                    {book.title}
                  </h3>
                  <p className="text-sm text-gray-600">por {book.author}</p>
                </div>
                {getStatusIcon('draft')}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Categoría:</span>
                  <span className="text-gray-900 capitalize">{book.category}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Creado:</span>
                  <span className="text-gray-900">
                    {new Date(book.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Estado:</span>
                  <span className="text-sm font-medium text-gray-900">Borrador</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}