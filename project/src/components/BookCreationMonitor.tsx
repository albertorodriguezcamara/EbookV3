import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface BookCreationLog {
  id: string
  step_type: string
  step_detail: string | null
  status: string
  ai_request: string | null
  ai_response: string | null
  error_message: string | null
  duration_seconds: number | null
  word_count: number | null
  tokens_used: number | null
  ai_model: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

interface BookCreationProgress {
  total_steps: number
  completed_steps: number
  current_step: string
  progress_percentage: number
  estimated_time_remaining: number | null
  logs: BookCreationLog[]
}

interface Props {
  bookId: string
  onComplete?: () => void
  onError?: (error: string) => void
}

const STEP_ICONS = {
  book_bible: '📖',
  outline: '📋',
  chapter: '📝',
  cover: '🎨'
}

const STEP_NAMES = {
  book_bible: 'Book Bible',
  outline: 'Índice',
  chapter: 'Capítulo',
  cover: 'Portada'
}

const STATUS_COLORS = {
  pending: '#6c757d',
  in_progress: '#007bff',
  completed: '#28a745',
  error: '#dc3545'
}

export default function BookCreationMonitor({ bookId, onComplete, onError }: Props) {
  const { user } = useAuth()
  const [progress, setProgress] = useState<BookCreationProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [showAllLogs, setShowAllLogs] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!bookId || !user) return

    // Cargar progreso inicial
    fetchProgress()

    // Configurar polling cada 2 segundos
    intervalRef.current = setInterval(fetchProgress, 2000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [bookId, user])

  // Función para verificar si el libro está realmente completado
  const checkIfBookCreationIsComplete = (logs: BookCreationLog[]): boolean => {
    // 1. Verificar que book_bible esté completado
    const bookBibleCompleted = logs.some(log => 
      log.step_type === 'book_bible' && log.status === 'completed'
    )
    
    // 2. Verificar que outline esté completado
    const outlineCompleted = logs.some(log => 
      log.step_type === 'outline' && log.status === 'completed'
    )
    
    // 3. Contar capítulos completados (buscar logs de outline que contengan "Capítulo X generado")
    const completedChapters = logs.filter(log => 
      log.step_type === 'outline' && 
      log.status === 'completed' && 
      log.step_detail && 
      log.step_detail.includes('generado:')
    ).length
    
    // 4. Verificar que no hay pasos en progreso (excepto logs informativos)
    const hasInProgressSteps = logs.some(log => 
      log.status === 'in_progress' && 
      ['book_bible', 'outline', 'chapter', 'cover'].includes(log.step_type)
    )
    
    // 5. Verificar que hay al menos un capítulo esperado
    const expectedChapters = progress?.total_steps ? Math.max(1, progress.total_steps - 2) : 1
    
    console.log('[BookCreationMonitor] 🔍 VERIFICACIÓN DETALLADA DE FINALIZACIÓN:')
    console.log('  📖 Book Bible completado:', bookBibleCompleted)
    console.log('  📋 Outline completado:', outlineCompleted)
    console.log('  📝 Capítulos completados:', completedChapters, '/ esperados:', expectedChapters)
    console.log('  ⏳ Hay pasos en progreso:', hasInProgressSteps)
    console.log('  📊 Total logs:', logs.length)
    
    // Logging detallado de todos los logs
    logs.forEach((log, index) => {
      console.log(`    ${index + 1}. ${log.step_type} - ${log.status} - ${log.step_detail || 'sin detalle'}`)
    })
    
    // CONDICIONES MÁS ESTRICTAS:
    // - Book bible completado
    // - Outline completado  
    // - Al menos el número esperado de capítulos completados
    // - No hay pasos principales en progreso
    const isComplete = bookBibleCompleted && 
                      outlineCompleted && 
                      completedChapters >= expectedChapters && 
                      !hasInProgressSteps
    
    console.log('  ✅ RESULTADO FINAL:', isComplete ? 'COMPLETADO - ACTIVANDO REDIRECCIÓN' : 'AÚN EN PROCESO')
    
    return isComplete
  }

  const fetchProgress = async () => {
    try {
      console.log(`[BookCreationMonitor] Fetching progress for bookId: ${bookId}`);
      const { data, error } = await supabase
        .rpc('get_book_creation_progress', { p_book_id: bookId })

      console.log(`[BookCreationMonitor] Raw response:`, { data, error });

      if (error) throw error

      if (data && data.length > 0) {
        const progressData = data[0]
        console.log(`[BookCreationMonitor] Progress data:`, progressData);
        console.log(`[BookCreationMonitor] Logs count: ${progressData.logs?.length || 0}`);
        console.log(`[BookCreationMonitor] Logs details:`, progressData.logs);
        
        // Logging específico para book_bible
        const bookBibleLogs = progressData.logs?.filter(log => log.step_type === 'book_bible') || [];
        console.log(`[BookCreationMonitor] Book Bible logs encontrados:`, bookBibleLogs.length);
        bookBibleLogs.forEach((log, index) => {
          console.log(`[BookCreationMonitor] Book Bible Log ${index + 1}:`, {
            id: log.id,
            status: log.status,
            step_detail: log.step_detail,
            has_ai_request: !!log.ai_request,
            has_ai_response: !!log.ai_response,
            ai_request_length: log.ai_request?.length || 0,
            ai_response_length: log.ai_response?.length || 0,
            created_at: log.created_at,
            completed_at: log.completed_at
          });
        });
        console.log(`[BookCreationMonitor] Logs details:`, progressData.logs);
        
        setProgress({
          total_steps: progressData.total_steps,
          completed_steps: progressData.completed_steps,
          current_step: progressData.current_step,
          progress_percentage: progressData.progress_percentage,
          estimated_time_remaining: progressData.estimated_time_remaining,
          logs: progressData.logs || []
        })

        // Verificar si el proceso está realmente completado (lógica robusta)
        const isReallyComplete = checkIfBookCreationIsComplete(progressData.logs || [])
        if (isReallyComplete) {
          console.log('[BookCreationMonitor] Libro realmente completado, activando redirección')
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
          }
          if (onComplete) {
            onComplete()
          }
        }

        // Si hay errores, notificar
        const hasErrors = progressData.logs?.some((log: BookCreationLog) => log.status === 'error')
        if (hasErrors && onError) {
          const errorLog = progressData.logs.find((log: BookCreationLog) => log.status === 'error')
          onError(errorLog?.error_message || 'Error desconocido')
        }
      }

      setLoading(false)
    } catch (err: any) {
      console.error('Error fetching progress:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  const toggleLogExpansion = (logId: string) => {
    const newExpanded = new Set(expandedLogs)
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId)
    } else {
      newExpanded.add(logId)
    }
    setExpandedLogs(newExpanded)
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  // Función para formatear contenido de IA (JSON y texto)
  const formatAIContent = (content: string) => {
    if (!content) return ''
    
    try {
      // Intentar parsear como JSON para formatearlo
      const parsed = JSON.parse(content)
      return JSON.stringify(parsed, null, 2)
    } catch {
      // Si no es JSON válido, devolver el contenido tal como está
      return content
    }
  }

  const getStatusBadge = (status: string) => {
    const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || '#6c757d'
    const labels = {
      pending: 'Pendiente',
      in_progress: 'En progreso',
      completed: 'Completado',
      error: 'Error'
    }

    return (
      <span 
        className="status-badge"
        style={{ 
          backgroundColor: color,
          color: 'white',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 'bold'
        }}
      >
        {labels[status as keyof typeof labels] || status}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="book-creation-monitor">
        <div className="monitor-loading">
          <h3>🚀 Iniciando creación del libro...</h3>
          <p>Preparando el proceso de generación...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="book-creation-monitor">
        <div className="monitor-error">
          <h3>❌ Error en el monitoreo</h3>
          <p>{error}</p>
          <button onClick={fetchProgress} className="admin-btn admin-btn-primary">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!progress) {
    return (
      <div className="book-creation-monitor">
        <div className="monitor-empty">
          <h3>📚 Esperando inicio de creación...</h3>
          <p>El proceso de creación aún no ha comenzado.</p>
        </div>
      </div>
    )
  }

  // Crear estructura jerárquica de logs agrupados por fase
  const createHierarchicalLogs = (logs: BookCreationLog[]) => {
    const logsByStepType = new Map<string, BookCreationLog[]>()
    
    // Agrupar logs por step_type
    logs.forEach(log => {
      if (!logsByStepType.has(log.step_type)) {
        logsByStepType.set(log.step_type, [])
      }
      logsByStepType.get(log.step_type)!.push(log)
    })
    
    const hierarchicalLogs: (BookCreationLog & { isGroup?: boolean, subLogs?: BookCreationLog[] })[] = []
    
    logsByStepType.forEach((stepLogs, stepType) => {
      // Ordenar logs por fecha cronológica
      const sortedLogs = stepLogs.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      
      // Para fases únicas (book_bible, outline, cover), crear estructura jerárquica
      if (['book_bible', 'outline', 'cover'].includes(stepType)) {
        // Buscar el log principal (sin step_detail específico o con el genérico)
        const mainLog = sortedLogs.find(log => 
          !log.step_detail || 
          log.step_detail === 'Generando biblia del libro' ||
          log.step_detail === 'Generando esquema de capítulos' ||
          log.step_detail === 'Generando portada'
        ) || sortedLogs[0] // Usar el primero como fallback
        
        // Los logs intermedios son todos los demás
        const subLogs = sortedLogs.filter(log => log.id !== mainLog.id)
        
        // Crear log principal con sub-logs anidados
        hierarchicalLogs.push({
          ...mainLog,
          isGroup: true,
          subLogs: subLogs
        })
      } else {
        // Para chapters, mantener individualmente
        hierarchicalLogs.push(...sortedLogs)
      }
    })
    
    // Ordenar por fecha de creación para mantener orden cronológico
    return hierarchicalLogs.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }
  
  const hierarchicalLogs = createHierarchicalLogs(progress.logs)
  const visibleLogs = showAllLogs ? hierarchicalLogs : hierarchicalLogs.slice(0, 10)
  
  // Logging para diagnosticar el filtrado
  console.log('🔧 [BookCreationMonitor] Filtrado de logs:');
  console.log('  - Total logs recibidos:', progress.logs.length);
  console.log('  - Logs tras agrupación jerárquica:', hierarchicalLogs.length);
  console.log('  - Logs visibles:', visibleLogs.length);
  hierarchicalLogs.forEach((log: any) => {
    console.log(`    - ${log.step_type}: ${log.step_detail || 'Sin detalle'} (${log.status})${log.isGroup ? ' [GRUPO]' : ''}`);
    if (log.subLogs) {
      log.subLogs.forEach((subLog: any) => {
        console.log(`      └─ ${subLog.step_detail || 'Sin detalle'} (${subLog.status})`);
      });
    }
  });

  return (
    <div className="book-creation-monitor">
      {/* Header con progreso general */}
      <div className="monitor-header">
        <h3>🚀 Creando libro en tiempo real</h3>
        <div className="progress-bar-container">
          <div className="progress-info">
            <span>Progreso: {progress.completed_steps}/{progress.total_steps} pasos</span>
            <span>{progress.progress_percentage}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${progress.progress_percentage}%` }}
            />
          </div>
        </div>
        <div className="current-step">
          <strong>Paso actual:</strong> {progress.current_step}
        </div>
      </div>

      {/* Resumen de pasos */}
      <div className="steps-summary">
        <h4>📊 Resumen de pasos</h4>
        <div className="steps-grid">
          {Object.entries(STEP_NAMES).map(([stepType, stepName]) => {
            const stepLogs = progress.logs.filter(log => log.step_type === stepType)
            const completed = stepLogs.filter(log => log.status === 'completed').length
            const inProgress = stepLogs.filter(log => log.status === 'in_progress').length
            const errors = stepLogs.filter(log => log.status === 'error').length
            const total = stepType === 'chapter' ? 
              progress.total_steps - 2 : // Restar book_bible y outline
              stepLogs.length || (stepLogs.length > 0 ? 1 : 0)
            
            // Logging detallado para diagnosticar el problema
            if (stepType === 'book_bible') {
              console.log('🔍 [BookCreationMonitor] Diagnóstico Book Bible:');
              console.log('  - stepType buscado:', stepType);
              console.log('  - Total logs recibidos:', progress.logs.length);
              console.log('  - Logs filtrados para book_bible:', stepLogs.length);
              console.log('  - stepLogs encontrados:', stepLogs);
              console.log('  - Todos los step_types disponibles:', progress.logs.map(log => log.step_type));
              console.log('  - completed:', completed, 'inProgress:', inProgress, 'errors:', errors);
            }

            return (
              <div key={stepType} className="step-summary">
                <div className="step-icon">{STEP_ICONS[stepType as keyof typeof STEP_ICONS]}</div>
                <div className="step-info">
                  <div className="step-name">{stepName}</div>
                  <div className="step-stats">
                    {completed > 0 && <span className="stat completed">✅ {completed}</span>}
                    {inProgress > 0 && <span className="stat in-progress">🔄 {inProgress}</span>}
                    {errors > 0 && <span className="stat error">❌ {errors}</span>}
                    {total > completed + inProgress + errors && 
                      <span className="stat pending">⏳ {total - completed - inProgress - errors}</span>
                    }
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Log de actividad */}
      <div className="activity-log">
        <div className="log-header">
          <h4>📝 Log de actividad</h4>
          <div className="log-actions">
            {progress.logs.length > 10 && (
              <button 
                onClick={() => setShowAllLogs(!showAllLogs)}
                className="admin-btn admin-btn-sm admin-btn-secondary"
              >
                {showAllLogs ? `Mostrar menos` : `Ver todos (${progress.logs.length})`}
              </button>
            )}
          </div>
        </div>

        <div className="log-entries">
          {visibleLogs.map((log: any) => {
            // Si es un grupo jerárquico (book_bible, outline, cover)
            if (log.isGroup && log.subLogs) {
              return (
                <div key={log.id} className={`log-entry ${log.status} log-group`}>
                  <div className="log-main" onClick={() => toggleLogExpansion(log.id)}>
                    <div className="log-time">
                      [{formatTimestamp(log.created_at)}]
                    </div>
                    <div className="log-icon">
                      {STEP_ICONS[log.step_type as keyof typeof STEP_ICONS] || '📄'}
                    </div>
                    <div className="log-content">
                      <div className="log-title">
                        {STEP_NAMES[log.step_type as keyof typeof STEP_NAMES] || log.step_type}
                        <span className="sub-logs-count">({log.subLogs.length + 1} pasos)</span>
                      </div>
                      <div className="log-meta">
                        {getStatusBadge(log.status)}
                        {log.duration_seconds && (
                          <span className="duration">⏱️ {formatDuration(log.duration_seconds)}</span>
                        )}
                        {log.word_count && (
                          <span className="word-count">📝 {log.word_count} palabras</span>
                        )}
                        {log.ai_model && (
                          <span className="ai-model">🤖 {log.ai_model}</span>
                        )}
                      </div>
                    </div>
                    <div className="log-expand">
                      {expandedLogs.has(log.id) ? '▼' : '▶'}
                    </div>
                  </div>
                  
                  {/* Sub-logs anidados cuando se expande */}
                  {expandedLogs.has(log.id) && (
                    <div className="log-details">
                      <div className="sub-logs">
                        {/* Log principal como primer paso */}
                        <div className="sub-log main-step">
                          <div className="sub-log-header">
                            <span className="step-number">1.</span>
                            <span className="step-title">{log.step_detail || 'Iniciando proceso'}</span>
                            <span className="step-status">{getStatusBadge(log.status)}</span>
                            <span className="step-time">[{formatTimestamp(log.created_at)}]</span>
                          </div>
                          {(log.ai_request || log.ai_response || log.error_message) && (
                            <div className="sub-log-content">
                              {log.error_message && (
                                <div className="error-message">
                                  <strong>❌ Error:</strong> {log.error_message}
                                </div>
                              )}
                              {log.ai_request && (
                                <div className="ai-request">
                                  <strong>📤 Prompt enviado a IA:</strong>
                                  <pre className="ai-content">{log.ai_request}</pre>
                                </div>
                              )}
                              {log.ai_response && (
                                <div className="ai-response">
                                  <strong>📥 Respuesta de IA:</strong>
                                  <pre className="ai-content">{log.ai_response}</pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Sub-logs intermedios */}
                        {log.subLogs.map((subLog: any, index: number) => (
                            <div key={subLog.id} className={`sub-log ${subLog.status}`}>
                              <div className="sub-log-header" onClick={() => toggleLogExpansion(subLog.id)}>
                                <span className="step-number">{index + 2}.</span>
                                <span className="step-title">{subLog.step_detail || 'Paso intermedio'}</span>
                                <span className="step-status">{getStatusBadge(subLog.status)}</span>
                                <span className="step-time">[{formatTimestamp(subLog.created_at)}]</span>
                                {(subLog.ai_request || subLog.ai_response || subLog.error_message) && (
                                  <span className="log-expand" style={{marginLeft: '10px', cursor: 'pointer', fontSize: '16px'}}>
                                    {expandedLogs.has(subLog.id) ? '▼' : '▶'}
                                  </span>
                                )}
                              </div>
                              {expandedLogs.has(subLog.id) && (subLog.ai_request || subLog.ai_response || subLog.error_message) && (
                                <div className="sub-log-content">
                                  {subLog.error_message && (
                                    <div className="error-message">
                                      <strong>❌ Error:</strong> {subLog.error_message}
                                    </div>
                                  )}
                                  {subLog.ai_request && (
                                    <div className="ai-request" style={{marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid #e9ecef'}}>
                                      <strong style={{color: '#007bff'}}>📤 Prompt enviado a IA:</strong>
                                      <pre style={{
                                        backgroundColor: '#ffffff',
                                        border: '1px solid #dee2e6',
                                        borderRadius: '4px',
                                        padding: '12px',
                                        marginTop: '8px',
                                        fontSize: '12px',
                                        lineHeight: '1.4',
                                        overflow: 'auto',
                                        maxHeight: '300px',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word'
                                      }}>{formatAIContent(subLog.ai_request)}</pre>
                                    </div>
                                  )}
                                  {subLog.ai_response && (
                                    <div className="ai-response" style={{marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid #e9ecef'}}>
                                      <strong style={{color: '#28a745'}}>📥 Respuesta de IA:</strong>
                                      <pre style={{
                                        backgroundColor: '#ffffff',
                                        border: '1px solid #dee2e6',
                                        borderRadius: '4px',
                                        padding: '12px',
                                        marginTop: '8px',
                                        fontSize: '12px',
                                        lineHeight: '1.4',
                                        overflow: 'auto',
                                        maxHeight: '300px',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word'
                                      }}>{formatAIContent(subLog.ai_response)}</pre>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            } else {
              // Log individual (chapters, etc.)
              return (
                <div key={log.id} className={`log-entry ${log.status}`}>
                  <div className="log-main" onClick={() => toggleLogExpansion(log.id)}>
                    <div className="log-time">
                      [{formatTimestamp(log.created_at)}]
                    </div>
                    <div className="log-icon">
                      {STEP_ICONS[log.step_type as keyof typeof STEP_ICONS] || '📄'}
                    </div>
                    <div className="log-content">
                      <div className="log-title">
                        {STEP_NAMES[log.step_type as keyof typeof STEP_NAMES] || log.step_type}
                        {log.step_detail && ` - ${log.step_detail}`}
                      </div>
                      <div className="log-meta">
                        {getStatusBadge(log.status)}
                        {log.duration_seconds && (
                          <span className="duration">⏱️ {formatDuration(log.duration_seconds)}</span>
                        )}
                        {log.word_count && (
                          <span className="word-count">📝 {log.word_count} palabras</span>
                        )}
                        {log.ai_model && (
                          <span className="ai-model">🤖 {log.ai_model}</span>
                        )}
                      </div>
                    </div>
                    <div className="log-expand">
                      {expandedLogs.has(log.id) ? '▼' : '▶'}
                    </div>
                  </div>

                  {expandedLogs.has(log.id) && (
                    <div className="log-details">
                      {log.error_message && (
                        <div className="error-message">
                          <strong>❌ Error:</strong> {log.error_message}
                        </div>
                      )}
                      {log.ai_request && (
                        <div className="ai-request" style={{marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid #e9ecef'}}>
                          <strong style={{color: '#007bff'}}>📤 Prompt enviado:</strong>
                          <pre style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #dee2e6',
                            borderRadius: '4px',
                            padding: '12px',
                            marginTop: '8px',
                            fontSize: '12px',
                            lineHeight: '1.4',
                            overflow: 'auto',
                            maxHeight: '300px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                          }}>{formatAIContent(log.ai_request)}</pre>
                        </div>
                      )}
                      {log.ai_response && (
                        <div className="ai-response" style={{marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid #e9ecef'}}>
                          <strong style={{color: '#28a745'}}>📥 Respuesta de IA:</strong>
                          <pre style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #dee2e6',
                            borderRadius: '4px',
                            padding: '12px',
                            marginTop: '8px',
                            fontSize: '12px',
                            lineHeight: '1.4',
                            overflow: 'auto',
                            maxHeight: '300px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                          }}>{formatAIContent(log.ai_response)}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            }
          })}
        </div>

        {progress.logs.length === 0 && (
          <div className="log-empty">
            <p>No hay actividad registrada aún...</p>
          </div>
        )}
      </div>
    </div>
  )
}
