import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AIModel } from './wizard/types';
import '../styles/ai-creator.css';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  data?: any;
}

interface KeywordInput {
  keywords: string[];
  mainKeyword: string;
  titleKeyword: string;
}

interface ThematicSuggestion {
  category: string;
  subcategory: string;
  theme: string;
  description: string;
  keywords_used: string[];
}

interface TitleSuggestion {
  title: string;
  subtitle?: string;
  keywords_incorporated: string[];
  amazon_optimized: boolean;
}

interface BookConfiguration {
  title: string;
  subtitle?: string;
  idea: string;
  category: string;
  subcategory: string;
  book_attributes: Record<string, any>;
  target_audience: string;
  estimated_pages: number;
  target_number_of_chapters: number;
  target_word_count: number;
  writer_model_id: string;
  editor_model_id: string;
  image_generator_model_id?: string;
  isIllustrated: boolean;
  hasCover: boolean;
}

const AICreator: React.FC = () => {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Estado principal
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentStep, setCurrentStep] = useState<'keywords' | 'themes' | 'titles' | 'details' | 'config' | 'review'>('keywords');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Modelos de IA
  const [writerModels, setWriterModels] = useState<any[]>([]);
  const [editorModels, setEditorModels] = useState<any[]>([]);
  const [imageModels, setImageModels] = useState<any[]>([]);
  const [selectedWriterModel, setSelectedWriterModel] = useState<string>('');
  
  // Datos del flujo
  const [keywordInput, setKeywordInput] = useState<KeywordInput>({
    keywords: [],
    mainKeyword: '',
    titleKeyword: ''
  });
  const [themes, setThemes] = useState<ThematicSuggestion[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<ThematicSuggestion | null>(null);
  const [titles, setTitles] = useState<TitleSuggestion[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<TitleSuggestion | null>(null);
  const [bookConfig, setBookConfig] = useState<Partial<BookConfiguration>>({});
  
  // Detección de idioma
  const [detectedLanguage, setDetectedLanguage] = useState<string>('');
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [languageConfirmed, setLanguageConfirmed] = useState(false);
  const [bookLanguage, setBookLanguage] = useState<string>('es'); // Idioma del libro (por defecto español)
  
  // Estados del formulario
  const [keywordText, setKeywordText] = useState('');
  const [mainKeywordIndex, setMainKeywordIndex] = useState<number>(-1);
  const [titleKeywordIndex, setTitleKeywordIndex] = useState<number>(-1);

  useEffect(() => {
    loadAIModels();
    
    // Agregar mensaje de bienvenida inicial
    setTimeout(() => {
      addAssistantMessage(
        '¡Hola! 👋 Soy tu asistente de IA para crear libros. Escribe palabras clave relacionadas con el libro que quieres crear y te ayudaré a generar temáticas, títulos y todos los detalles necesarios.\n\n**Ejemplo:** "romance, vampiros, misterio, aventura"'
      );
    }, 500);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };



  // Función para detectar idioma del texto
  const detectLanguage = (text: string): string => {
    const cleanText = text.toLowerCase().trim();
    
    // Palabras clave en diferentes idiomas
    const spanishKeywords = ['libro', 'escribir', 'novela', 'historia', 'capítulo', 'personaje', 'trama', 'argumento', 'ficción', 'romance', 'misterio', 'aventura', 'fantasía', 'ciencia', 'biografía', 'ensayo', 'poesía', 'cuento', 'relato', 'narrativa', 'drama', 'comedia', 'thriller', 'terror', 'horror', 'suspenso', 'acción', 'guerra', 'histórico', 'contemporáneo', 'clásico', 'moderno', 'literatura', 'autor', 'escritor', 'lector', 'publicar', 'editorial'];
    const englishKeywords = ['book', 'write', 'novel', 'story', 'chapter', 'character', 'plot', 'fiction', 'romance', 'mystery', 'adventure', 'fantasy', 'science', 'biography', 'essay', 'poetry', 'tale', 'narrative', 'drama', 'comedy', 'thriller', 'horror', 'suspense', 'action', 'war', 'historical', 'contemporary', 'classic', 'modern', 'literature', 'author', 'writer', 'reader', 'publish', 'publisher'];
    const frenchKeywords = ['livre', 'écrire', 'roman', 'histoire', 'chapitre', 'personnage', 'intrigue', 'fiction', 'romance', 'mystère', 'aventure', 'fantaisie', 'science', 'biographie', 'essai', 'poésie', 'conte', 'récit', 'narratif', 'drame', 'comédie', 'thriller', 'horreur', 'suspense', 'action', 'guerre', 'historique', 'contemporain', 'classique', 'moderne', 'littérature', 'auteur', 'écrivain', 'lecteur', 'publier', 'éditeur'];
    
    // Patrones específicos de cada idioma
    const spanishPatterns = /\b(el|la|los|las|un|una|de|del|en|con|por|para|que|es|son|está|están|tiene|tienen|quiero|necesito|me|te|se|nos|muy|más|menos|también|pero|aunque|porque|cuando|donde|como|qué|cuál|cuáles|cuándo|dónde|cómo|por qué)\b/g;
    const englishPatterns = /\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by|from|about|into|through|during|before|after|above|below|up|down|out|off|over|under|again|further|then|once|here|there|when|where|why|how|all|any|both|each|few|more|most|other|some|such|no|nor|not|only|own|same|so|than|too|very|can|will|just|should|now|would|could|might|must|shall|may|ought|need|want|like|know|think|see|get|make|take|come|go|say|tell|ask|give|find|feel|seem|look|try|work|call|move|live|believe|hold|bring|happen|write|provide|sit|stand|lose|pay|meet|include|continue|set|learn|change|lead|understand|watch|follow|stop|create|speak|read|allow|add|spend|grow|open|walk|win|offer|remember|love|consider|appear|buy|wait|serve|die|send|expect|build|stay|fall|cut|reach|kill|remain|suggest|raise|pass|sell|require|report|decide|pull)\b/g;
    const frenchPatterns = /\b(le|la|les|un|une|de|du|des|en|dans|sur|avec|par|pour|que|qui|est|sont|a|ont|je|tu|il|elle|nous|vous|ils|elles|me|te|se|nous|vous|très|plus|moins|aussi|mais|bien|comme|quand|où|comment|pourquoi|quel|quelle|quels|quelles)\b/g;
    
    // Contar coincidencias
    const spanishKeywordMatches = spanishKeywords.filter(keyword => cleanText.includes(keyword)).length;
    const englishKeywordMatches = englishKeywords.filter(keyword => cleanText.includes(keyword)).length;
    const frenchKeywordMatches = frenchKeywords.filter(keyword => cleanText.includes(keyword)).length;
    
    const spanishPatternMatches = (cleanText.match(spanishPatterns) || []).length;
    const englishPatternMatches = (cleanText.match(englishPatterns) || []).length;
    const frenchPatternMatches = (cleanText.match(frenchPatterns) || []).length;
    
    // Calcular puntuación total
    const spanishScore = spanishKeywordMatches * 2 + spanishPatternMatches;
    const englishScore = englishKeywordMatches * 2 + englishPatternMatches;
    const frenchScore = frenchKeywordMatches * 2 + frenchPatternMatches;
    
    // Determinar idioma
    if (spanishScore > englishScore && spanishScore > frenchScore) {
      return 'es';
    } else if (englishScore > frenchScore) {
      return 'en';
    } else if (frenchScore > 0) {
      return 'fr';
    }
    
    // Por defecto, español
    return 'es';
  };
  
  // Función para obtener el nombre del idioma
  const getLanguageName = (code: string): string => {
    const languages: { [key: string]: string } = {
      'es': 'Español',
      'en': 'English',
      'fr': 'Français'
    };
    return languages[code] || 'Español';
  };

  const loadAIModels = async () => {
    try {
      const { data: models, error } = await supabase
        .from('ai_models')
        .select(`
          *,
          ai_providers (*)
        `)
        .eq('active', true)
        .order('rating', { ascending: false });

      if (error) throw error;

      const writers = models.filter(m => m.type === 'writer');
      const editors = models.filter(m => m.type === 'editor');
      const images = models.filter(m => m.type === 'image');

      setWriterModels(writers);
      setEditorModels(editors);
      setImageModels(images);

      // Seleccionar el primer modelo escritor por defecto
      if (writers.length > 0) {
        setSelectedWriterModel(writers[0].id);
      }
    } catch (error) {
      console.error('Error loading AI models:', error);
    }
  };

  const addMessage = (type: ChatMessage['type'], content: string, data?: any) => {
    const message: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      timestamp: new Date(),
      data
    };
    setMessages(prev => [...prev, message]);
    setTimeout(scrollToBottom, 100);
  };

  const addSystemMessage = (content: string, data?: any) => {
    addMessage('system', content, data);
  };

  const addUserMessage = (content: string, data?: any) => {
    addMessage('user', content, data);
  };

  const addAssistantMessage = (content: string, data?: any) => {
    addMessage('assistant', content, data);
  };

  // Función para manejar el primer mensaje con detección de idioma
  const handleFirstMessage = (text: string) => {
    if (!isFirstMessage || languageConfirmed) {
      return false; // No es el primer mensaje o ya se confirmó el idioma
    }

    const detected = detectLanguage(text);
    setDetectedLanguage(detected);
    setIsFirstMessage(false);
    
    // Agregar el mensaje del usuario
    addUserMessage(text);
    
    // Mostrar confirmación de idioma
    const languageName = getLanguageName(detected);
    const confirmationMessage = detected === 'es' 
      ? `He detectado que prefieres escribir en **${languageName}**. ¿Te gustaría continuar en este idioma?`
      : detected === 'en'
      ? `I detected that you prefer to write in **${languageName}**. Would you like to continue in this language?`
      : `J'ai détecté que vous préférez écrire en **${languageName}**. Souhaitez-vous continuer dans cette langue?`;
    
    addAssistantMessage(confirmationMessage, { 
      type: 'language_confirmation', 
      detectedLanguage: detected,
      originalText: text 
    });
    
    return true; // Se manejó como primer mensaje
  };
  
  // Función para confirmar el idioma
  const confirmLanguage = (confirmed: boolean, originalText: string) => {
    if (confirmed) {
      setLanguageConfirmed(true);
      // Establecer el idioma del libro basado en la detección
      setBookLanguage(detectedLanguage);
      
      // El chat siempre continúa en castellano, pero el libro se creará en el idioma detectado
      const languageName = getLanguageName(detectedLanguage);
      const message = `Perfecto, he detectado que quieres crear el libro en **${languageName}**. El chat continuará en castellano, pero el contenido del libro se generará en ${languageName}. Ahora procesaré tus palabras clave para generar temáticas.`;
      
      addAssistantMessage(message);
      processKeywordsFromText(originalText);
    } else {
      // Permitir al usuario elegir otro idioma
      const message = 'Por favor, escribe tu mensaje en el idioma que prefieras para el libro y volveré a detectarlo.';
      addAssistantMessage(message);
      setIsFirstMessage(true);
      setDetectedLanguage('');
    }
  };
  
  // Función para procesar palabras clave desde texto libre
  const processKeywordsFromText = (text: string) => {
    // Extraer palabras clave del texto (implementación básica)
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 6); // Tomar las primeras 6 palabras relevantes
    
    if (words.length >= 2) {
      const input: KeywordInput = {
        keywords: words,
        mainKeyword: words[0],
        titleKeyword: words[1]
      };
      
      setKeywordInput(input);
      generateThemes(input);
    } else {
      const message = detectedLanguage === 'es'
        ? 'Necesito más información. Por favor, proporciona al menos 2 palabras clave relacionadas con tu libro.'
        : detectedLanguage === 'en'
        ? 'I need more information. Please provide at least 2 keywords related to your book.'
        : 'J\'ai besoin de plus d\'informations. Veuillez fournir au moins 2 mots-clés liés à votre livre.';
      
      addAssistantMessage(message);
    }
  };

  const handleKeywordSubmit = () => {
    if (!keywordText.trim()) return;

    // Verificar si es el primer mensaje
    if (handleFirstMessage(keywordText)) {
      setKeywordText('');
      return;
    }

    const keywords = keywordText.split(',').map(k => k.trim()).filter(k => k);
    if (keywords.length < 2) {
      addSystemMessage('Por favor, proporciona al menos 2 palabras clave separadas por comas.');
      return;
    }

    if (mainKeywordIndex === -1 || titleKeywordIndex === -1) {
      addSystemMessage('Por favor, selecciona cuál es la palabra clave principal y cuál usarás para el título.');
      return;
    }

    const input: KeywordInput = {
      keywords,
      mainKeyword: keywords[mainKeywordIndex],
      titleKeyword: keywords[titleKeywordIndex]
    };

    setKeywordInput(input);
    addUserMessage(`Palabras clave: ${keywords.join(', ')}\nPalabra clave principal: ${input.mainKeyword}\nPalabra para título: ${input.titleKeyword}`);
    
    generateThemes(input);
  };

  const generateThemes = async (input: KeywordInput) => {
    setIsLoading(true);
    addAssistantMessage('Analizando tus palabras clave y generando temáticas categorizadas...');

    try {
      const { data, error } = await supabase.functions.invoke('ai-creator-chat', {
        body: {
          action: 'generate_themes',
          payload: {
            ...input,
            modelId: selectedWriterModel,
            bookLanguage: bookLanguage // Idioma del libro para la IA
          }
        }
      });

      if (error) throw error;

      setThemes(data.themes);
      setCurrentStep('themes');
      
      addAssistantMessage(
        'He generado varias temáticas basadas en tus palabras clave. Selecciona la que más te interese:',
        { themes: data.themes }
      );
    } catch (error) {
      console.error('Error generating themes:', error);
      addSystemMessage('Error al generar temáticas. Por favor, inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleThemeSelection = (theme: ThematicSuggestion) => {
    setSelectedTheme(theme);
    addUserMessage(`Temática seleccionada: ${theme.theme} (${theme.category} > ${theme.subcategory})`);
    
    generateTitles(theme);
  };

  const generateTitles = async (theme: ThematicSuggestion) => {
    setIsLoading(true);
    addAssistantMessage('Perfecto! Ahora voy a generar varios títulos optimizados para Amazon basados en tu temática...');

    try {
      const { data, error } = await supabase.functions.invoke('ai-creator-chat', {
        body: {
          action: 'generate_titles',
          payload: {
            selectedTheme: theme,
            keywords: keywordInput,
            modelId: selectedWriterModel,
            bookLanguage: bookLanguage
          }
        }
      });

      if (error) throw error;

      setTitles(data.titles);
      setCurrentStep('titles');
      
      addAssistantMessage(
        'Aquí tienes varios títulos optimizados para Amazon. Selecciona el que más te guste:',
        { titles: data.titles }
      );
    } catch (error) {
      console.error('Error generating titles:', error);
      addSystemMessage('Error al generar títulos. Por favor, inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTitleSelection = (title: TitleSuggestion) => {
    setSelectedTitle(title);
    addUserMessage(`Título seleccionado: "${title.title}"${title.subtitle ? ` - ${title.subtitle}` : ''}`);
    
    generateBookDetails(title);
  };

  const generateBookDetails = async (title: TitleSuggestion) => {
    setIsLoading(true);
    addAssistantMessage('Excelente elección! Ahora voy a desarrollar automáticamente todos los detalles del libro basándome en la categoría y los requisitos específicos...');

    try {
      const { data, error } = await supabase.functions.invoke('ai-creator-chat', {
        body: {
          action: 'generate_book_details',
          payload: {
            selectedTitle: title,
            selectedTheme,
            keywords: keywordInput,
            modelId: selectedWriterModel,
            bookLanguage: bookLanguage
          }
        }
      });

      if (error) throw error;

      setBookConfig(prev => ({
        ...prev,
        title: title.title,
        subtitle: title.subtitle,
        idea: data.idea,
        category: data.category,
        subcategory: data.subcategory,
        book_attributes: data.book_attributes,
        target_audience: data.target_audience,
        estimated_pages: data.estimated_pages,
        writer_model_id: selectedWriterModel
      }));

      setCurrentStep('config');
      
      addAssistantMessage(
        'Perfecto! He generado automáticamente todos los detalles del libro. Ahora necesito que configures algunos parámetros finales:',
        { bookDetails: data }
      );
    } catch (error) {
      console.error('Error generating book details:', error);
      addSystemMessage('Error al generar detalles del libro. Por favor, inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigSubmit = () => {
    setCurrentStep('review');
    addAssistantMessage(
      'Excelente! Aquí tienes un resumen completo de tu libro. Revisa todos los detalles y cuando estés listo, podremos crear el libro:',
      { finalConfig: bookConfig }
    );
  };

  const handleCreateBook = async () => {
    if (!bookConfig.title || !selectedTheme) return;

    setIsLoading(true);
    addAssistantMessage('Creando tu libro... Esto puede tomar unos minutos.');

    try {
      // Obtener usuario actual
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Usuario no autenticado');
      }

      // Obtener IDs de categoría y subcategoría
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('name', selectedTheme.category)
        .single();

      const { data: subcategoryData, error: subcategoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('name', selectedTheme.subcategory)
        .single();

      if (categoryError || subcategoryError) {
        throw new Error('Error al obtener IDs de categoría');
      }

      const payload = {
        title: bookConfig.title,
        author: user.email?.split('@')[0] || 'Usuario', // Usar parte del email como autor por defecto
        idea: bookConfig.idea,
        language: bookLanguage, // Usar el idioma del libro seleccionado
        category_id: categoryData.id,
        subcategory_id: subcategoryData.id,
        target_word_count: bookConfig.target_word_count || 50000,
        target_number_of_chapters: bookConfig.target_number_of_chapters || 10,
        book_attributes: bookConfig.book_attributes || {},
        ai_config: {
          writer_model_id: bookConfig.writer_model_id,
          editor_model_id: bookConfig.editor_model_id || bookConfig.writer_model_id, // Usar writer como fallback
          image_generator_model_id: bookConfig.image_generator_model_id
        }
      };

      const { data, error } = await supabase.functions.invoke('handle-book-creation-request', {
        body: payload
      });

      if (error) throw error;

      if (!data.request_id) {
        throw new Error('La respuesta de la función no incluyó un request_id.');
      }

      addAssistantMessage('¡Solicitud de creación recibida! Te redirigiremos a la página de monitoreo para que puedas seguir el progreso en tiempo real.');
      
      // Navegar a la página de monitoreo unificada
      setTimeout(() => {
        navigate(`/book-creation/${data.request_id}`);
      }, 2000);

    } catch (error) {
      console.error('Error creating book:', error);
      addSystemMessage('Error al crear el libro. Por favor, inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderKeywordInput = () => {
    const keywords = keywordText.split(',').map(k => k.trim()).filter(k => k);
    
    return (
      <div className="ai-creator-input">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Palabras clave (separadas por comas):
          </label>
          <textarea
            value={keywordText}
            onChange={(e) => setKeywordText(e.target.value)}
            placeholder="Ejemplo: marketing digital, redes sociales, emprendimiento, estrategia"
            className="w-full p-3 border rounded-lg resize-none"
            rows={3}
          />
        </div>

        {keywords.length >= 2 && (
          <div className="mb-4">
            <div className="mb-3">
              <label className="block text-sm font-medium mb-2">
                Selecciona la palabra clave principal:
              </label>
              <div className="flex flex-wrap gap-2">
                {keywords.map((keyword, index) => (
                  <button
                    key={index}
                    onClick={() => setMainKeywordIndex(index)}
                    className={`px-3 py-1 rounded-full text-sm border ${
                      mainKeywordIndex === index
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    {keyword}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Selecciona la palabra para el título:
              </label>
              <div className="flex flex-wrap gap-2">
                {keywords.map((keyword, index) => (
                  <button
                    key={index}
                    onClick={() => setTitleKeywordIndex(index)}
                    className={`px-3 py-1 rounded-full text-sm border ${
                      titleKeywordIndex === index
                        ? 'bg-green-500 text-white border-green-500'
                        : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    {keyword}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Selecciona el modelo de IA escritor:
          </label>
          <select
            value={selectedWriterModel}
            onChange={(e) => setSelectedWriterModel(e.target.value)}
            className="w-full p-3 border rounded-lg"
          >
            {writerModels.map(model => (
              <option key={model.id} value={model.id}>
                {model.display_name} ({(model as any).ai_providers?.name})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleKeywordSubmit}
          disabled={keywords.length < 2 || mainKeywordIndex === -1 || titleKeywordIndex === -1 || !selectedWriterModel}
          className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Generar Temáticas
        </button>
      </div>
    );
  };

  const renderThemeSelection = (themes: ThematicSuggestion[]) => {
    return (
      <div className="ai-creator-themes">
        <div className="grid gap-4">
          {themes.map((theme, index) => (
            <div
              key={index}
              onClick={() => handleThemeSelection(theme)}
              className="p-4 border rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-lg">{theme.theme}</h3>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {theme.category} → {theme.subcategory}
                </span>
              </div>
              <p className="text-gray-600 mb-2">{theme.description}</p>
              <div className="flex flex-wrap gap-1">
                {theme.keywords_used.map((keyword, kidx) => (
                  <span key={kidx} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTitleSelection = (titles: TitleSuggestion[]) => {
    return (
      <div className="ai-creator-titles">
        <div className="grid gap-4">
          {titles.map((title, index) => (
            <div
              key={index}
              onClick={() => handleTitleSelection(title)}
              className="p-4 border rounded-lg cursor-pointer hover:bg-green-50 hover:border-green-300 transition-colors"
            >
              <h3 className="font-bold text-lg mb-1">{title.title}</h3>
              {title.subtitle && (
                <p className="text-gray-600 mb-2">{title.subtitle}</p>
              )}
              <div className="flex flex-wrap gap-1 mb-2">
                {title.keywords_incorporated.map((keyword, kidx) => (
                  <span key={kidx} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                    {keyword}
                  </span>
                ))}
              </div>
              {title.amazon_optimized && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                  ✓ Optimizado para Amazon
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderBookDetails = (details: any) => {
    return (
      <div className="ai-creator-details">
        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <h3 className="font-semibold mb-2">Idea del libro generada:</h3>
          <p className="text-gray-700">{details.idea}</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Público objetivo:</label>
            <p className="text-gray-700 bg-gray-50 p-2 rounded">{details.target_audience}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Páginas estimadas:</label>
            <p className="text-gray-700 bg-gray-50 p-2 rounded">{details.estimated_pages}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Número de capítulos:</label>
            <input
              type="number"
              value={bookConfig.target_number_of_chapters || 10}
              onChange={(e) => setBookConfig(prev => ({ ...prev, target_number_of_chapters: parseInt(e.target.value) }))}
              className="w-full p-2 border rounded"
              min="1"
              max="200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Palabras por capítulo (aprox):</label>
            <input
              type="number"
              value={bookConfig.target_word_count || 50000}
              onChange={(e) => setBookConfig(prev => ({ ...prev, target_word_count: parseInt(e.target.value) }))}
              className="w-full p-2 border rounded"
              min="1000"
              step="1000"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">IA Editora:</label>
            <select
              value={bookConfig.editor_model_id || ''}
              onChange={(e) => setBookConfig(prev => ({ ...prev, editor_model_id: e.target.value }))}
              className="w-full p-2 border rounded"
            >
              <option value="">Seleccionar editor...</option>
              {editorModels.map(model => (
                <option key={model.id} value={model.id}>
                  {model.display_name} ({(model as any).ai_providers?.name})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">IA para Imágenes:</label>
            <select
              value={bookConfig.image_generator_model_id || ''}
              onChange={(e) => setBookConfig(prev => ({ 
                ...prev, 
                image_generator_model_id: e.target.value,
                isIllustrated: !!e.target.value 
              }))}
              className="w-full p-2 border rounded"
            >
              <option value="">Sin imágenes</option>
              {imageModels.map(model => (
                <option key={model.id} value={model.id}>
                  {model.display_name} ({(model as any).ai_providers?.name})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={bookConfig.hasCover || false}
              onChange={(e) => setBookConfig(prev => ({ ...prev, hasCover: e.target.checked }))}
              className="mr-2"
            />
            Generar portada automáticamente
          </label>
        </div>

        <button
          onClick={handleConfigSubmit}
          className="w-full bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600"
        >
          Continuar a Revisión
        </button>
      </div>
    );
  };

  // Componente para confirmar idioma detectado
  const renderLanguageConfirmation = (data: any) => {
    const { detectedLanguage, originalText } = data;
    const languageName = getLanguageName(detectedLanguage);
    
    return (
      <div className="language-confirmation mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🌐</span>
          <div>
            <p className="font-medium text-blue-800">
              {detectedLanguage === 'es' && 'Idioma detectado:'}
              {detectedLanguage === 'en' && 'Detected language:'}
              {detectedLanguage === 'fr' && 'Langue détectée:'}
              <span className="ml-2 font-bold">{languageName}</span>
            </p>
            <p className="text-sm text-blue-600">
              {detectedLanguage === 'es' && '¿Deseas continuar en este idioma?'}
              {detectedLanguage === 'en' && 'Do you want to continue in this language?'}
              {detectedLanguage === 'fr' && 'Voulez-vous continuer dans cette langue?'}
            </p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => confirmLanguage(true, originalText)}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
          >
            {detectedLanguage === 'es' && '✓ Sí, continuar'}
            {detectedLanguage === 'en' && '✓ Yes, continue'}
            {detectedLanguage === 'fr' && '✓ Oui, continuer'}
          </button>
          <button
            onClick={() => confirmLanguage(false, originalText)}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
          >
            {detectedLanguage === 'es' && '✗ Cambiar idioma'}
            {detectedLanguage === 'en' && '✗ Change language'}
            {detectedLanguage === 'fr' && '✗ Changer de langue'}
          </button>
        </div>
      </div>
    );
  };

  const renderFinalReview = (config: Partial<BookConfiguration>) => {
    return (
      <div className="ai-creator-review">
        <div className="bg-blue-50 p-6 rounded-lg mb-6">
          <h2 className="text-2xl font-bold mb-4">📚 {config.title}</h2>
          {config.subtitle && (
            <h3 className="text-lg text-gray-600 mb-4">{config.subtitle}</h3>
          )}
          
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <strong>Categoría:</strong> {config.category} → {config.subcategory}
            </div>
            <div>
              <strong>Capítulos:</strong> {config.target_number_of_chapters}
            </div>
            <div>
              <strong>Palabras objetivo:</strong> {config.target_word_count?.toLocaleString()}
            </div>
            <div>
              <strong>Páginas estimadas:</strong> {config.estimated_pages}
            </div>
          </div>

          <div className="mb-4">
            <strong>Idea del libro:</strong>
            <p className="mt-2 text-gray-700">{config.idea}</p>
          </div>

          <div className="mb-4">
            <strong>Público objetivo:</strong> {config.target_audience}
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <strong>IA Escritora:</strong><br />
              {writerModels.find(m => m.id === config.writer_model_id)?.display_name}
            </div>
            <div>
              <strong>IA Editora:</strong><br />
              {config.editor_model_id ? 
                editorModels.find(m => m.id === config.editor_model_id)?.display_name : 
                'No seleccionada'
              }
            </div>
            <div>
              <strong>Extras:</strong><br />
              {config.isIllustrated ? '🎨 Con imágenes' : ''}<br />
              {config.hasCover ? '📖 Con portada' : ''}
            </div>
          </div>
        </div>

        <button
          onClick={handleCreateBook}
          disabled={isLoading}
          className="w-full bg-purple-500 text-white py-4 px-6 rounded-lg hover:bg-purple-600 disabled:bg-gray-300 text-lg font-semibold"
        >
          {isLoading ? 'Creando libro...' : '🚀 Crear mi libro'}
        </button>
      </div>
    );
  };

  return (
    <div className="ai-creator-container">
      {/* Header compacto */}
      <div className="ai-creator-header">
        <h1>IA Creator</h1>
        
        {/* Solo selector de modelo de IA */}
        <div className="ai-creator-selectors">
          <div className="ai-model-selector">
            <label htmlFor="ai-model-select">🤖 Modelo IA:</label>
            <select 
              id="ai-model-select"
              value={selectedWriterModel} 
              onChange={(e) => setSelectedWriterModel(e.target.value)}
              disabled={messages.some(msg => msg.type === 'user')}
            >
              <option value="">Seleccionar modelo...</option>
              {writerModels.map((model: any) => (
                <option key={model.id} value={model.id}>
                  {model.display_name} ({model.ai_providers?.name})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Chat container */}
      <div className="ai-creator-chat">
        <div className="chat-messages">
          {messages.map((message) => (
            <div key={message.id} className={`message ${message.type}`}>
              <div className="message-content">
                <p className="whitespace-pre-wrap">{message.content}</p>
                
                {/* Renderizar contenido especial basado en el tipo de mensaje */}
                {message.data?.type === 'language_confirmation' && renderLanguageConfirmation(message.data)}
                {message.data?.themes && renderThemeSelection(message.data.themes)}
                {message.data?.titles && renderTitleSelection(message.data.titles)}
                {message.data?.bookDetails && renderBookDetails(message.data.bookDetails)}
                {message.data?.finalConfig && renderFinalReview(message.data.finalConfig)}
              </div>
              <div className="message-timestamp">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="message assistant">
              <div className="message-content loading">
                <div className="loading-content">
                  <div className="loading-spinner"></div>
                  Procesando...
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="ai-creator-input">
          <div className="input-container">
            <textarea
              value={keywordText}
              onChange={(e) => setKeywordText(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                  e.preventDefault();
                  handleKeywordSubmit();
                }
              }}
              placeholder="Escribe palabras clave relacionadas con tu libro (ej: romance, vampiros, misterio, aventura)..."
              disabled={isLoading}
              rows={1}
              style={{
                height: 'auto',
                minHeight: '50px',
                maxHeight: '150px',
                overflowY: keywordText.length > 100 ? 'auto' : 'hidden'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 150) + 'px';
              }}
            />
            <button
              onClick={handleKeywordSubmit}
              disabled={isLoading || !keywordText.trim()}
            >
              {isLoading ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AICreator;
