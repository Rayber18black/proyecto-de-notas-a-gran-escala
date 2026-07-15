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
  IF cnt > 3 THEN cnt := 3; END IF; -- esquema actual soporta máx 3 columnas

  total := 0;
  IF cnt >= 1 THEN total := total + COALESCE(NEW.tramo1,0); END IF;
  IF cnt >= 2 THEN total := total + COALESCE(NEW.tramo2,0); END IF;
  IF cnt >= 3 THEN total := total + COALESCE(NEW.tramo3,0); END IF;

  NEW.promedio = ROUND((total / cnt)::numeric, 2);
  NEW.estado = CASE WHEN NEW.promedio >= 10 THEN 'Aprobado' WHEN NEW.promedio > 0 THEN 'Reprobado' ELSE 'Pendiente' END;
  RETURN NEW;
END; $function$;