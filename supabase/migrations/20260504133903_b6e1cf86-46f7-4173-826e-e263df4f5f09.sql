-- 1) app_config singleton for lapsos count
CREATE TABLE IF NOT EXISTS public.app_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  lapsos_count smallint NOT NULL DEFAULT 3 CHECK (lapsos_count BETWEEN 1 AND 6),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_config (id, lapsos_count) VALUES (1, 3) ON CONFLICT DO NOTHING;

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff view config" ON public.app_config;
CREATE POLICY "staff view config" ON public.app_config
  FOR SELECT USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "root manage config" ON public.app_config;
CREATE POLICY "root manage config" ON public.app_config
  FOR ALL USING (public.has_role(auth.uid(), 'root'))
  WITH CHECK (public.has_role(auth.uid(), 'root'));

-- 2) Update compute_nota: minimum passing grade now 10
CREATE OR REPLACE FUNCTION public.compute_nota()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.promedio = ROUND(((NEW.tramo1 + NEW.tramo2 + NEW.tramo3) / 3.0)::numeric, 2);
  NEW.estado = CASE WHEN NEW.promedio >= 10 THEN 'Aprobado' WHEN NEW.promedio > 0 THEN 'Reprobado' ELSE 'Pendiente' END;
  RETURN NEW;
END; $function$;

-- 3) Audit table
CREATE TABLE IF NOT EXISTS public.notas_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id uuid,
  alumno_id uuid,
  action text NOT NULL,
  changed_by uuid,
  changed_by_name text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notas_audit_created ON public.notas_audit(created_at DESC);

ALTER TABLE public.notas_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "root view audit" ON public.notas_audit;
CREATE POLICY "root view audit" ON public.notas_audit
  FOR SELECT USING (public.has_role(auth.uid(), 'root'));

-- 4) Audit trigger function
CREATE OR REPLACE FUNCTION public.audit_notas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uname text;
  uid uuid := auth.uid();
BEGIN
  SELECT nombre INTO uname FROM public.profiles WHERE id = uid;

  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.notas_audit (nota_id, alumno_id, action, changed_by, changed_by_name, new_values)
    VALUES (NEW.id, NEW.alumno_id, 'INSERT', uid, uname, to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.notas_audit (nota_id, alumno_id, action, changed_by, changed_by_name, old_values, new_values)
    VALUES (NEW.id, NEW.alumno_id, 'UPDATE', uid, uname, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.notas_audit (nota_id, alumno_id, action, changed_by, changed_by_name, old_values)
    VALUES (OLD.id, OLD.alumno_id, 'DELETE', uid, uname, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

-- 5) Attach triggers
DROP TRIGGER IF EXISTS trg_audit_notas_ins ON public.notas;
DROP TRIGGER IF EXISTS trg_audit_notas_upd ON public.notas;
DROP TRIGGER IF EXISTS trg_audit_notas_del ON public.notas;

CREATE TRIGGER trg_audit_notas_ins AFTER INSERT ON public.notas
  FOR EACH ROW EXECUTE FUNCTION public.audit_notas();
CREATE TRIGGER trg_audit_notas_upd AFTER UPDATE ON public.notas
  FOR EACH ROW EXECUTE FUNCTION public.audit_notas();
CREATE TRIGGER trg_audit_notas_del AFTER DELETE ON public.notas
  FOR EACH ROW EXECUTE FUNCTION public.audit_notas();

-- 6) Ensure compute_nota trigger exists (if not already)
DROP TRIGGER IF EXISTS trg_compute_nota ON public.notas;
CREATE TRIGGER trg_compute_nota BEFORE INSERT OR UPDATE ON public.notas
  FOR EACH ROW EXECUTE FUNCTION public.compute_nota();

-- 7) Ensure protect_alumno_nombre and check_alumno_nacimiento triggers exist
DROP TRIGGER IF EXISTS trg_protect_alumno_nombre ON public.alumnos;
CREATE TRIGGER trg_protect_alumno_nombre BEFORE UPDATE ON public.alumnos
  FOR EACH ROW EXECUTE FUNCTION public.protect_alumno_nombre();

DROP TRIGGER IF EXISTS trg_check_alumno_nacimiento ON public.alumnos;
CREATE TRIGGER trg_check_alumno_nacimiento BEFORE INSERT OR UPDATE ON public.alumnos
  FOR EACH ROW EXECUTE FUNCTION public.check_alumno_nacimiento();