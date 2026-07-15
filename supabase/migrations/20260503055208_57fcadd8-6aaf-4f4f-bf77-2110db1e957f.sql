-- Notas: solo admin/root pueden actualizar
DROP POLICY IF EXISTS "staff update notas" ON public.notas;
DROP POLICY IF EXISTS "admins update notas" ON public.notas;
CREATE POLICY "admins update notas" ON public.notas
FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Trigger: solo root puede cambiar el nombre del alumno
CREATE OR REPLACE FUNCTION public.protect_alumno_nombre()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.nombre IS DISTINCT FROM OLD.nombre AND NOT public.has_role(auth.uid(), 'root') THEN
    RAISE EXCEPTION 'Solo el usuario root puede modificar el nombre del alumno';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_alumno_nombre ON public.alumnos;
CREATE TRIGGER trg_protect_alumno_nombre
BEFORE UPDATE ON public.alumnos
FOR EACH ROW EXECUTE FUNCTION public.protect_alumno_nombre();
