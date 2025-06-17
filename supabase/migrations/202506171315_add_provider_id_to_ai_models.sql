-- Añade columna provider_id a la tabla ai_models y crea la relación FK
alter table public.ai_models
add column if not exists provider_id uuid references public.ai_providers(id);

-- Opcional: si ya conoces qué proveedor corresponde a cada modelo puedes hacer
-- updates aquí. Por ejemplo:
-- update public.ai_models set provider_id = (select id from public.ai_providers where name = 'openai') where tipo = 'image' and name like 'dall-e%';

-- Asegúrate de que las RLS policies contemplen el nuevo campo si es necesario.
