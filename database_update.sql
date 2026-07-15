-- 1. Crear la tabla app_config si no existe
CREATE TABLE IF NOT EXISTS public.app_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    lapsos_count INTEGER DEFAULT 3
);

-- Si la tabla YA existía, añadir las columnas nuevas ANTES de intentar usarlas
ALTER TABLE public.app_config 
ADD COLUMN IF NOT EXISTS materias_list TEXT[] DEFAULT '{"Matemáticas", "Castellano", "Física", "Química"}',
ADD COLUMN IF NOT EXISTS evaluaciones_por_lapso INTEGER DEFAULT 4;

-- Habilitar seguridad para la tabla
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Insertar la fila principal si la tabla estaba vacía
INSERT INTO public.app_config (id, lapsos_count, materias_list, evaluaciones_por_lapso) 
VALUES (1, 3, '{"Matemáticas", "Castellano", "Física", "Química"}', 4)
ON CONFLICT (id) DO NOTHING;

-- Crear políticas de seguridad genéricas para no tener conflictos con otras tablas
DROP POLICY IF EXISTS "staff view config" ON public.app_config;
CREATE POLICY "staff view config" ON public.app_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "root manage config" ON public.app_config;
CREATE POLICY "root manage config" ON public.app_config FOR ALL USING (auth.uid() IS NOT NULL);

-- Si la tabla YA existía, añadir las columnas nuevas por si acaso
ALTER TABLE public.app_config 
ADD COLUMN IF NOT EXISTS materias_list TEXT[] DEFAULT '{"Matemáticas", "Castellano", "Física", "Química"}',
ADD COLUMN IF NOT EXISTS evaluaciones_por_lapso INTEGER DEFAULT 4;

-- 2. Añadir campos a la tabla de notas para guardar las sub-notas
ALTER TABLE public.notas
ADD COLUMN IF NOT EXISTS t1_sub JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS t2_sub JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS t3_sub JSONB DEFAULT '[]'::jsonb;
