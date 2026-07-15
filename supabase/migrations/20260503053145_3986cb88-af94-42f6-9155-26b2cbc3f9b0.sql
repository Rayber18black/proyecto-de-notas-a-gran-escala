-- Roles enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('root', 'admin', 'docente', 'student');
  END IF;
END $$;

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL DEFAULT '',
  ci TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE IF NOT EXISTS public.user_roles (
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
CREATE TABLE IF NOT EXISTS public.alumnos (
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
CREATE TABLE IF NOT EXISTS public.notas (
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
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_alumnos_updated ON public.alumnos;
CREATE TRIGGER trg_alumnos_updated BEFORE UPDATE ON public.alumnos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_notas_updated ON public.notas;
CREATE TRIGGER trg_notas_updated BEFORE UPDATE ON public.notas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- compute promedio + estado on notas
DROP FUNCTION IF EXISTS public.compute_nota() CASCADE;
CREATE OR REPLACE FUNCTION public.compute_nota()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.promedio = ROUND(((NEW.tramo1 + NEW.tramo2 + NEW.tramo3) / 3.0)::numeric, 2);
  NEW.estado = CASE WHEN NEW.promedio >= 14 THEN 'Aprobado' WHEN NEW.promedio > 0 THEN 'Reprobado' ELSE 'Pendiente' END;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notas_compute ON public.notas;
CREATE TRIGGER trg_notas_compute BEFORE INSERT OR UPDATE ON public.notas FOR EACH ROW EXECUTE FUNCTION public.compute_nota();

-- handle new user
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, ci)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email), NEW.raw_user_meta_data->>'ci');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== RLS =====
-- profiles
DROP POLICY IF EXISTS "users view own profile" ON public.profiles;
CREATE POLICY "users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "staff view all profiles" ON public.profiles;
CREATE POLICY "staff view all profiles" ON public.profiles FOR SELECT USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "admins update profiles" ON public.profiles;
CREATE POLICY "admins update profiles" ON public.profiles FOR UPDATE USING (public.is_admin(auth.uid()));

-- user_roles
DROP POLICY IF EXISTS "users view own roles" ON public.user_roles;
CREATE POLICY "users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins view all roles" ON public.user_roles;
CREATE POLICY "admins view all roles" ON public.user_roles FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- alumnos
DROP POLICY IF EXISTS "staff view alumnos" ON public.alumnos;
CREATE POLICY "staff view alumnos" ON public.alumnos FOR SELECT USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "student view own alumno" ON public.alumnos;
CREATE POLICY "student view own alumno" ON public.alumnos FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins manage alumnos" ON public.alumnos;
CREATE POLICY "admins manage alumnos" ON public.alumnos FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- notas
DROP POLICY IF EXISTS "staff view notas" ON public.notas;
CREATE POLICY "staff view notas" ON public.notas FOR SELECT USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "student view own notas" ON public.notas;
CREATE POLICY "student view own notas" ON public.notas FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.alumnos a WHERE a.id = notas.alumno_id AND a.user_id = auth.uid())
);

DROP POLICY IF EXISTS "staff insert notas" ON public.notas;
CREATE POLICY "staff insert notas" ON public.notas FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "staff update notas" ON public.notas;
CREATE POLICY "staff update notas" ON public.notas FOR UPDATE USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "admins delete notas" ON public.notas;
CREATE POLICY "admins delete notas" ON public.notas FOR DELETE USING (public.is_admin(auth.uid()));
