-- MIGRACIÓN: Estructura y datos iniciales para categorías y atributos dinámicos de subcategoría
-- Fecha de creación: 2025-06-17

-- 0. Asegura que todas las columnas existen (idempotente)
alter table categories add column if not exists icon text;
alter table categories add column if not exists parent_id uuid references categories(id) on delete set null;
alter table categories add column if not exists created_at timestamptz not null default now();
alter table categories add column if not exists updated_at timestamptz not null default now();
alter table categories add column if not exists display_order int default 0;
alter table categories add column if not exists color text;

-- 1. Tabla de categorías principales (soporta jerarquía)
create table if not exists categories (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    display_name text not null,
    description text,
    icon text,
    parent_id uuid references categories(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    display_order int default 0,
    color text
);

-- 2. Tabla de atributos dinámicos para subcategorías
create table if not exists subcategory_attributes (
    id uuid primary key default gen_random_uuid(),
    subcategory text not null,
    name text not null,
    display_name text not null,
    description text,
    type text not null, -- select, text, number, etc.
    required boolean not null default false,
    options jsonb, -- opciones para selects
    default_value text,
    validation_rule text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 3. Datos iniciales (seed) para categorías (EJEMPLO, COMENTADO)
-- insert into categories (id, name, display_name, description, icon, parent_id, created_at, updated_at, display_order, color) values
--   ('00000000-0000-0000-0000-000000000001', 'narrativos', 'Narrativos y de Ficción', 'Novelas, cuentos y narrativas interactivas', 'BookOpenIcon', null, '2025-02-27 10:25:51+00', '2025-02-27 10:39:31+00', 1, 'indigo'),
--   ...
-- on conflict (id) do nothing;

-- 4. Datos iniciales (seed) para atributos de subcategoría (EJEMPLO, COMENTADO)
-- insert into subcategory_attributes (id, subcategory, name, display_name, description, type, required, options, default_value, validation_rule, created_at, updated_at) values
--   ('118e8aeb-8826-4a3f-8cde-80c585f78332', 'comics', 'panel_layout', 'Disposición de viñetas', 'Estilo de layout', 'select', true, '["traditional", "experimental", "dynamic"]', 'traditional', null, '2025-02-27 15:31:29+00', '2025-02-27 15:31:29+00'),
--   ...
-- on conflict (id) do nothing;

-- 5. Índices útiles
create index if not exists idx_categories_parent_id on categories(parent_id);
create index if not exists idx_categories_display_order on categories(display_order);
create index if not exists idx_subcategory_attributes_subcategory on subcategory_attributes(subcategory);

-- 6. Comentarios de referencia
-- parent_id permite jerarquía de categorías (categoría/subcategoría)
-- subcategory_attributes permite atributos dinámicos por subcategoría (tipo select/text/number/etc.)
-- options es un array JSON para selects, default_value es string, validation_rule puede ser regex u otra regla
