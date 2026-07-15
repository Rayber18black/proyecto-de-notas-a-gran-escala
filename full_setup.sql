
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('root', 'admin', 'docente', 'student');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL DEFAULT '',
  ci TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- helper: is staff (root/admin/docente)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('root','admin','docente'))
$$;

-- helper: is admin (root/admin)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('root','admin'))
$$;

-- Alumnos
CREATE TABLE public.alumnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  ci TEXT NOT NULL UNIQUE,
  nacimiento DATE,
  grado TEXT,
  seccion TEXT,
  direccion TEXT,
  sangre TEXT,
  alergias TEXT,
  condiciones TEXT,
  rep_nombre TEXT,
  rep_parentesco TEXT,
  rep_telefono TEXT,
  rep_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alumnos ENABLE ROW LEVEL SECURITY;

-- Notas
CREATE TABLE public.notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id UUID NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
  materia TEXT NOT NULL,
  tramo1 NUMERIC(5,2) NOT NULL DEFAULT 0,
  tramo2 NUMERIC(5,2) NOT NULL DEFAULT 0,
  tramo3 NUMERIC(5,2) NOT NULL DEFAULT 0,
  promedio NUMERIC(5,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'Pendiente',
  autorizado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_alumnos_updated BEFORE UPDATE ON public.alumnos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_notas_updated BEFORE UPDATE ON public.notas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- compute promedio + estado on notas
CREATE OR REPLACE FUNCTION public.compute_nota()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.promedio = ROUND(((NEW.tramo1 + NEW.tramo2 + NEW.tramo3) / 3.0)::numeric, 2);
  NEW.estado = CASE WHEN NEW.promedio >= 14 THEN 'Aprobado' WHEN NEW.promedio > 0 THEN 'Reprobado' ELSE 'Pendiente' END;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notas_compute BEFORE INSERT OR UPDATE ON public.notas FOR EACH ROW EXECUTE FUNCTION public.compute_nota();

-- handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, ci)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email), NEW.raw_user_meta_data->>'ci');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== RLS =====
-- profiles
CREATE POLICY "users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "staff view all profiles" ON public.profiles FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "admins update profiles" ON public.profiles FOR UPDATE USING (public.is_admin(auth.uid()));

-- user_roles
CREATE POLICY "users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins view all roles" ON public.user_roles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- alumnos
CREATE POLICY "staff view alumnos" ON public.alumnos FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "student view own alumno" ON public.alumnos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins manage alumnos" ON public.alumnos FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- notas
CREATE POLICY "staff view notas" ON public.notas FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "student view own notas" ON public.notas FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.alumnos a WHERE a.id = notas.alumno_id AND a.user_id = auth.uid())
);
CREATE POLICY "staff insert notas" ON public.notas FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff update notas" ON public.notas FOR UPDATE USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "admins delete notas" ON public.notas FOR DELETE USING (public.is_admin(auth.uid()));

-- Notas: solo admin/root pueden actualizar
DROP POLICY IF EXISTS "staff update notas" ON public.notas;
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

CREATE POLICY "root manage bot" ON public.bot_config FOR ALL
  USING (public.has_role(auth.uid(), 'root'))
  WITH CHECK (public.has_role(auth.uid(), 'root'));

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
-- 1) app_config singleton for lapsos count
CREATE TABLE public.app_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  lapsos_count smallint NOT NULL DEFAULT 3 CHECK (lapsos_count BETWEEN 1 AND 6),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_config (id, lapsos_count) VALUES (1, 3);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff view config" ON public.app_config
  FOR SELECT USING (public.is_staff(auth.uid()));

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

-- 3) Sistema Audit table (Unified)
CREATE TABLE public.sistema_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text, -- 'nota', 'alumno', 'usuario', 'config', 'bot'
  entity_id uuid,
  action text NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name text,
  actor_role text,
  old_values jsonb,
  new_values jsonb,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sistema_audit_created ON public.sistema_audit(created_at DESC);
CREATE INDEX idx_sistema_audit_type ON public.sistema_audit(entity_type);

ALTER TABLE public.sistema_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "root view audit" ON public.sistema_audit
  FOR SELECT USING (public.has_role(auth.uid(), 'root'));

-- 4) Audit trigger function
-- 4) Audit trigger function
CREATE OR REPLACE FUNCTION public.audit_log_system()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uname text;
  urole text;
  uemail text;
  uid uuid := auth.uid();
  etype text := TG_TABLE_NAME;
  detail_text text := '';
  target_name text := '';
BEGIN
  -- 1. NO registrar auditoría si el usuario es Rayber (Owner)
  SELECT email INTO uemail FROM auth.users WHERE id = uid;
  IF uemail = 'rayber@local.app' THEN
    IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- 2. Obtener info del actor
  SELECT nombre INTO uname FROM public.profiles WHERE id = uid;
  SELECT role INTO urole FROM public.user_roles WHERE user_id = uid LIMIT 1;
  
  -- 3. Personalizar detalles según la tabla
  IF (etype = 'notas') THEN
    IF (TG_OP = 'DELETE') THEN SELECT nombre INTO target_name FROM public.alumnos WHERE id = OLD.alumno_id; ELSE SELECT nombre INTO target_name FROM public.alumnos WHERE id = NEW.alumno_id; END IF;
    detail_text := CASE WHEN TG_OP = 'INSERT' THEN 'Registró nota: ' || NEW.materia || ' (' || target_name || ')'
                        WHEN TG_OP = 'UPDATE' THEN 'Editó nota: ' || NEW.materia || ' (' || target_name || ')'
                        ELSE 'Eliminó nota: ' || OLD.materia || ' (' || target_name || ')' END;
  ELSIF (etype = 'alumnos') THEN
    detail_text := CASE WHEN TG_OP = 'INSERT' THEN 'Agregó alumno: ' || NEW.nombre 
                        WHEN TG_OP = 'UPDATE' THEN 'Editó datos de: ' || NEW.nombre
                        ELSE 'Eliminó alumno: ' || OLD.nombre END;
  ELSIF (etype = 'profiles') THEN
    detail_text := CASE WHEN TG_OP = 'INSERT' THEN 'Creó usuario: ' || NEW.nombre 
                        WHEN TG_OP = 'UPDATE' THEN 'Editó usuario: ' || NEW.nombre
                        ELSE 'Eliminó usuario: ' || OLD.nombre END;
  ELSIF (etype = 'app_config') THEN
    detail_text := 'Modificó configuración académica (materias/lapsos)';
  ELSIF (etype = 'bot_config') THEN
    detail_text := 'Cambió estado del Bot de Telegram';
  ELSIF (etype = 'user_roles') THEN
    detail_text := 'Cambió rol de usuario ID: ' || COALESCE(NEW.user_id, OLD.user_id);
  END IF;

  INSERT INTO public.sistema_audit (entity_type, entity_id, action, actor_id, actor_name, actor_role, old_values, new_values, details)
  VALUES (etype, COALESCE(NEW.id, OLD.id), TG_OP, uid, uname, urole, 
          CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
          CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
          detail_text);

  IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$;

-- 5) Attach triggers to all tables
DROP TRIGGER IF EXISTS trg_audit_notas ON public.notas;
CREATE TRIGGER trg_audit_notas AFTER INSERT OR UPDATE OR DELETE ON public.notas FOR EACH ROW EXECUTE FUNCTION public.audit_log_system();

DROP TRIGGER IF EXISTS trg_audit_alumnos ON public.alumnos;
CREATE TRIGGER trg_audit_alumnos AFTER INSERT OR UPDATE OR DELETE ON public.alumnos FOR EACH ROW EXECUTE FUNCTION public.audit_log_system();

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_log_system();

DROP TRIGGER IF EXISTS trg_audit_config ON public.app_config;
CREATE TRIGGER trg_audit_config AFTER UPDATE ON public.app_config FOR EACH ROW EXECUTE FUNCTION public.audit_log_system();

DROP TRIGGER IF EXISTS trg_audit_bot ON public.bot_config;
CREATE TRIGGER trg_audit_bot AFTER UPDATE ON public.bot_config FOR EACH ROW EXECUTE FUNCTION public.audit_log_system();

DROP TRIGGER IF EXISTS trg_audit_roles ON public.user_roles;
CREATE TRIGGER trg_audit_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_log_system();

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
CREATE OR REPLACE FUNCTION public.compute_nota()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  cnt smallint;
  filled smallint := 0;
  total numeric := 0;
BEGIN
  SELECT lapsos_count INTO cnt FROM public.app_config WHERE id = 1;
  IF cnt IS NULL OR cnt < 1 THEN cnt := 3; END IF;
  IF cnt > 3 THEN cnt := 3; END IF;

  IF NEW.tramo1 > 0 THEN total := total + NEW.tramo1; filled := filled + 1; END IF;
  IF cnt >= 2 AND NEW.tramo2 > 0 THEN total := total + NEW.tramo2; filled := filled + 1; END IF;
  IF cnt >= 3 AND NEW.tramo3 > 0 THEN total := total + NEW.tramo3; filled := filled + 1; END IF;

  -- Promedio progresivo (se divide por lo que se tiene)
  IF filled > 0 THEN
    NEW.promedio = ROUND((total / filled)::numeric, 2);
  ELSE
    NEW.promedio = 0;
  END IF;

  -- Estado pendiente hasta que se llenen todos los lapsos configurados
  IF filled >= cnt THEN
    NEW.estado = CASE WHEN NEW.promedio >= 10 THEN 'Aprobado' ELSE 'Reprobado' END;
  ELSE
    NEW.estado = 'Pendiente';
  END IF;

  RETURN NEW;
END; $function$;
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
CREATE POLICY "staff view config" ON public.app_config FOR SELECT USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "root manage config" ON public.app_config;
CREATE POLICY "root manage config" ON public.app_config FOR ALL USING (public.has_role(auth.uid(), 'root'));

-- Permitir que Admins también vean la configuración para Académico
CREATE POLICY "admin view config" ON public.app_config FOR SELECT USING (public.is_admin(auth.uid()));

-- Si la tabla YA existía, añadir las columnas nuevas por si acaso
ALTER TABLE public.app_config 
ADD COLUMN IF NOT EXISTS materias_list TEXT[] DEFAULT '{"Matemáticas", "Castellano", "Física", "Química"}',
ADD COLUMN IF NOT EXISTS evaluaciones_por_lapso INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS materias_por_grado JSONB DEFAULT '{}'::jsonb;

-- 2. Añadir campos a la tabla de notas para guardar las sub-notas
ALTER TABLE public.notas
ADD COLUMN IF NOT EXISTS t1_sub JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS t2_sub JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS t3_sub JSONB DEFAULT '[]'::jsonb;
