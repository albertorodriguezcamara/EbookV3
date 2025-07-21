-- Habilitar la extensión moddatetime si aún no está habilitada
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;

-- Habilitar la extensión pgcrypto si aún no está habilitada (para uuid_generate_v4)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Crear la tabla para las solicitudes de creación de libros
CREATE TABLE public.book_creation_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    payload jsonb NOT NULL, -- Aquí guardaremos el JSON completo enviado por el usuario
    status text DEFAULT 'pending'::text NOT NULL, -- Estados: pending, processing, completed, failed
    error_message text NULL, -- Para almacenar mensajes de error si el procesamiento falla
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.book_creation_requests IS 'Tabla para almacenar solicitudes de creación de libros pendientes de procesamiento.';
COMMENT ON COLUMN public.book_creation_requests.payload IS 'JSON con los datos enviados desde el wizard de creación de libros.';
COMMENT ON COLUMN public.book_creation_requests.status IS 'Estado actual de la solicitud de creación (pending, processing, completed, failed).';

-- Trigger para actualizar automáticamente el campo 'updated_at'
-- Asegúrate de que la función moddatetime esté disponible en el esquema 'extensions'
CREATE TRIGGER handle_updated_at
BEFORE UPDATE ON public.book_creation_requests
FOR EACH ROW
EXECUTE FUNCTION extensions.moddatetime (updated_at);

-- Políticas de Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.book_creation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden insertar sus propias solicitudes de creación"
ON public.book_creation_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden ver sus propias solicitudes de creación"
ON public.book_creation_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- El rol de servicio necesita acceso completo para procesar las solicitudes
CREATE POLICY "El rol de servicio tiene acceso completo a las solicitudes de creación"
ON public.book_creation_requests
FOR ALL
TO service_role;
