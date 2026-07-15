
-- bot_config singleton
CREATE TABLE IF NOT EXISTS public.bot_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  telegram_token text,
  telegram_chat_id text,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.bot_config (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.bot_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "root manage bot" ON public.bot_config;
CREATE POLICY "root manage bot" ON public.bot_config FOR ALL
  USING (public.has_role(auth.uid(), 'root'))
  WITH CHECK (public.has_role(auth.uid(), 'root'));

DROP POLICY IF EXISTS "admin view bot" ON public.bot_config;
CREATE POLICY "admin view bot" ON public.bot_config FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Prevent future birth dates
CREATE OR REPLACE FUNCTION public.check_alumno_nacimiento()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.nacimiento IS NOT NULL AND NEW.nacimiento > CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha de nacimiento no puede ser futura';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_alumno_nacimiento ON public.alumnos;
CREATE TRIGGER trg_alumno_nacimiento
BEFORE INSERT OR UPDATE ON public.alumnos
FOR EACH ROW EXECUTE FUNCTION public.check_alumno_nacimiento();
