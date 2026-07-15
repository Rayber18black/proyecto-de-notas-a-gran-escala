-- 1) Limit grades to 0-20
-- First, fix any existing data that violates the new rule
UPDATE public.notas SET tramo1 = 20 WHERE tramo1 > 20;
UPDATE public.notas SET tramo2 = 20 WHERE tramo2 > 20;
UPDATE public.notas SET tramo3 = 20 WHERE tramo3 > 20;

ALTER TABLE public.notas 
  ADD CONSTRAINT tramo1_limit CHECK (tramo1 >= 0 AND tramo1 <= 20),
  ADD CONSTRAINT tramo2_limit CHECK (tramo2 >= 0 AND tramo2 <= 20),
  ADD CONSTRAINT tramo3_limit CHECK (tramo3 >= 0 AND tramo3 <= 20);

-- 2) Update compute_nota to ensure average is also capped (safety)
CREATE OR REPLACE FUNCTION public.compute_nota()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  cnt smallint;
  total numeric;
BEGIN
  SELECT lapsos_count INTO cnt FROM public.app_config WHERE id = 1;
  IF cnt IS NULL OR cnt < 1 THEN cnt := 3; END IF;
  IF cnt > 3 THEN cnt := 3; END IF;

  total := 0;
  IF cnt >= 1 THEN total := total + COALESCE(NEW.tramo1,0); END IF;
  IF cnt >= 2 THEN total := total + COALESCE(NEW.tramo2,0); END IF;
  IF cnt >= 3 THEN total := total + COALESCE(NEW.tramo3,0); END IF;

  NEW.promedio = ROUND((total / cnt)::numeric, 2);
  -- Cap average at 20 just in case
  IF NEW.promedio > 20 THEN NEW.promedio := 20; END IF;
  
  NEW.estado = CASE WHEN NEW.promedio >= 10 THEN 'Aprobado' WHEN NEW.promedio > 0 THEN 'Reprobado' ELSE 'Pendiente' END;
  RETURN NEW;
END; $function$;

-- 3) Improve handle_new_user to avoid conflicts with Edge Function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, ci)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email), NEW.raw_user_meta_data->>'ci')
  ON CONFLICT (id) DO UPDATE SET 
    nombre = EXCLUDED.nombre,
    ci = EXCLUDED.ci;

  -- Only insert default 'student' role if no role exists yet
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  END IF;
  
  RETURN NEW;
END; $$;
