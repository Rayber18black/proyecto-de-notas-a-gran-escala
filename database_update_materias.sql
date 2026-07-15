-- Script para habilitar las materias por grado
ALTER TABLE public.app_config 
ADD COLUMN IF NOT EXISTS materias_por_grado JSONB DEFAULT '{}'::jsonb;
