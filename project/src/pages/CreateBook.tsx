import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { BookOpen, Sparkles } from 'lucide-react'

interface Category {
  id: string
  name: string
  display_name: string
  description: string
}

export default function CreateBook() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    idea: '',
    description: '',
    category: '',
    tone: 'neutral',
    language: 'es',
    extension: 5,
    book_size: '6x9'
  })

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }

    fetchCategories()
  }, [user, navigate])

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // ✅ USAR FLUJO NUEVO: handle-book-creation-request en lugar de inserción directa
      console.log('Iniciando creación de libro con flujo nuevo...')
      
      // Preparar payload para el nuevo flujo
      const bookPayload = {
        title: formData.title,
        author: formData.author,
        idea: formData.idea,
        language: formData.language,
        category_id: formData.category, // Asumiendo que category contiene el ID
        subcategory_id: null, // Ajustar según sea necesario
        target_word_count: 1000, // Valor por defecto, ajustar según sea necesario
        target_number_of_chapters: formData.extension,
        book_attributes: {
          tone: formData.tone,
          book_size: formData.book_size,
          description: formData.description
        },
        ai_config: {
          writer_model_id: 'default-writer-model-id', // Ajustar con modelo real
          editor_model_id: 'default-editor-model-id', // Ajustar con modelo real
          image_generator_model_id: null
        }
      }

      // Llamar al nuevo flujo a través de Edge Function
      const { data, error } = await supabase.functions.invoke(
        'handle-book-creation-request',
        {
          body: bookPayload
        }
      )

      if (error) {
        console.error('Error en handle-book-creation-request:', error)
        throw error
      }

      console.log('Libro creado exitosamente:', data)
      
      // Redirigir al libro creado (necesitarás obtener el book_id de la respuesta)
      if (data?.book_id) {
        navigate(`/book/${data.book_id}`)
      } else {
        // Fallback: redirigir al dashboard si no tenemos book_id
        navigate('/dashboard')
      }
    } catch (error) {
      console.error('Error creating book:', error)
      alert('Error al crear el libro. Por favor, inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'extension' ? parseInt(value) : value
    }))
  }

  if (!user) {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-8">
        <div className="flex justify-center items-center space-x-2 mb-4">
          <BookOpen className="h-8 w-8 text-indigo-600" />
          <Sparkles className="h-6 w-6 text-yellow-500" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Crear Nuevo Libro</h1>
        <p className="text-gray-600 mt-2">Completa los detalles y deja que la IA cree tu libro</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Título */}
          <div className="md:col-span-2">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Título del Libro *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
              placeholder="Ej: El Misterio del Castillo Perdido"
            />
          </div>

          {/* Autor */}
          <div>
            <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-2">
              Autor *
            </label>
            <input
              type="text"
              id="author"
              name="author"
              value={formData.author}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
              placeholder="Tu nombre"
            />
          </div>

          {/* Categoría */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              Categoría *
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              <option value="">Selecciona una categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.display_name}
                </option>
              ))}
            </select>
          </div>

          {/* Idea Principal */}
          <div className="md:col-span-2">
            <label htmlFor="idea" className="block text-sm font-medium text-gray-700 mb-2">
              Idea Principal
            </label>
            <textarea
              id="idea"
              name="idea"
              value={formData.idea}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Describe brevemente la idea central de tu libro..."
            />
          </div>

          {/* Descripción */}
          <div className="md:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Descripción Detallada
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Proporciona más detalles sobre el contenido, personajes, trama, etc..."
            />
          </div>

          {/* Tono */}
          <div>
            <label htmlFor="tone" className="block text-sm font-medium text-gray-700 mb-2">
              Tono
            </label>
            <select
              id="tone"
              name="tone"
              value={formData.tone}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="neutral">Neutral</option>
              <option value="formal">Formal</option>
              <option value="informal">Informal</option>
              <option value="humorous">Humorístico</option>
              <option value="dramatic">Dramático</option>
              <option value="academic">Académico</option>
            </select>
          </div>

          {/* Idioma */}
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
              Idioma
            </label>
            <select
              id="language"
              name="language"
              value={formData.language}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="es">Español</option>
              <option value="en">Inglés</option>
              <option value="fr">Francés</option>
              <option value="de">Alemán</option>
              <option value="it">Italiano</option>
            </select>
          </div>

          {/* Extensión */}
          <div>
            <label htmlFor="extension" className="block text-sm font-medium text-gray-700 mb-2">
              Número de Capítulos
            </label>
            <input
              type="number"
              id="extension"
              name="extension"
              value={formData.extension}
              onChange={handleChange}
              min="1"
              max="50"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Tamaño del Libro */}
          <div>
            <label htmlFor="book_size" className="block text-sm font-medium text-gray-700 mb-2">
              Tamaño del Libro
            </label>
            <select
              id="book_size"
              name="book_size"
              value={formData.book_size}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="6x9">6" x 9" (Estándar)</option>
              <option value="5x8">5" x 8" (Compacto)</option>
              <option value="8.5x11">8.5" x 11" (Carta)</option>
              <option value="7x10">7" x 10" (Grande)</option>
            </select>
          </div>
        </div>

        <div className="mt-8 flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-md font-medium flex items-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Creando...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Crear Libro</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}