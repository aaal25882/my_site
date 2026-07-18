-- =============================================================
-- سامانه خرید و حمل از چین - نسخه پنل نقش‌محور
-- اجرای مجدد این فایل تا حد امکان امن است.
-- =============================================================

-- ---------- انواع داده ----------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typname='user_role' AND n.nspname='public') THEN
    CREATE TYPE public.user_role AS ENUM ('buyer','traveler','admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typname='verification_status' AND n.nspname='public') THEN
    CREATE TYPE public.verification_status AS ENUM ('pending','approved','rejected');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typname='order_status' AND n.nspname='public') THEN
    CREATE TYPE public.order_status AS ENUM ('draft','open','matched','purchased','in_transit','delivered','cancelled');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typname='flight_status' AND n.nspname='public') THEN
    CREATE TYPE public.flight_status AS ENUM ('active','full','completed','cancelled');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typname='document_status' AND n.nspname='public') THEN
    CREATE TYPE public.document_status AS ENUM ('missing','pending','approved','rejected');
  END IF;
END $$;


-- ---------- جداول ----------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'buyer',
  phone text,
  city text,
  bio text,
  verification_status public.verification_status NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.traveler_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  china_city text,
  university text,
  student_id_reference text,
  document_type text,
  document_number text,
  document_path text,
  document_status public.document_status NOT NULL DEFAULT 'missing',
  default_capacity_kg numeric(7,2) CHECK (default_capacity_kg IS NULL OR default_capacity_kg >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.traveler_profiles ADD COLUMN IF NOT EXISTS document_type text;
ALTER TABLE public.traveler_profiles ADD COLUMN IF NOT EXISTS document_number text;
ALTER TABLE public.traveler_profiles ADD COLUMN IF NOT EXISTS document_path text;
ALTER TABLE public.traveler_profiles ADD COLUMN IF NOT EXISTS document_status public.document_status NOT NULL DEFAULT 'missing';

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  product_url text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  color text,
  model text,
  weight_kg numeric(8,2) CHECK (weight_kg IS NULL OR weight_kg >= 0),
  estimated_price numeric(14,2) CHECK (estimated_price IS NULL OR estimated_price >= 0),
  destination_city text,
  notes text,
  status public.order_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  traveler_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  origin_city text NOT NULL,
  destination_city text NOT NULL,
  departure_date date NOT NULL,
  arrival_date date,
  airline text,
  flight_number text,
  capacity_kg numeric(7,2) NOT NULL CHECK (capacity_kg > 0),
  available_capacity_kg numeric(7,2) NOT NULL CHECK (available_capacity_kg >= 0),
  notes text,
  status public.flight_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (available_capacity_kg <= capacity_kg),
  CHECK (arrival_date IS NULL OR arrival_date >= departure_date)
);

CREATE INDEX IF NOT EXISTS orders_buyer_id_idx ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders(status);
CREATE INDEX IF NOT EXISTS flights_traveler_id_idx ON public.flights(traveler_id);
CREATE INDEX IF NOT EXISTS flights_departure_date_idx ON public.flights(departure_date);

-- ---------- توابع کمکی امنیت ----------
CREATE OR REPLACE FUNCTION public.is_admin(check_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = check_user AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved_traveler(check_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = check_user
      AND role = 'traveler'
      AND verification_status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_approved_traveler(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved_traveler(uuid) TO authenticated;

-- ---------- updated_at ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_traveler_profiles_updated_at ON public.traveler_profiles;
CREATE TRIGGER set_traveler_profiles_updated_at BEFORE UPDATE ON public.traveler_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_orders_updated_at ON public.orders;
CREATE TRIGGER set_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_flights_updated_at ON public.flights;
CREATE TRIGGER set_flights_updated_at BEFORE UPDATE ON public.flights FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- هر مدرک جدید یا جایگزین‌شده باید دوباره توسط مدیر بررسی شود.
CREATE OR REPLACE FUNCTION public.set_document_pending()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=public
AS $$
BEGIN
  IF NEW.document_path IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.document_path IS DISTINCT FROM OLD.document_path) THEN
    NEW.document_status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS traveler_document_pending ON public.traveler_profiles;
CREATE TRIGGER traveler_document_pending BEFORE INSERT OR UPDATE ON public.traveler_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_document_pending();


-- ---------- ساخت پروفایل ثبت‌نام ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,auth
AS $$
DECLARE
  requested_role public.user_role;
  initial_status public.verification_status;
  safe_name text;
BEGIN
  IF NEW.raw_user_meta_data ->> 'role' = 'traveler' THEN
    requested_role := 'traveler';
    initial_status := 'pending';
  ELSE
    requested_role := 'buyer';
    initial_status := 'approved';
  END IF;

  safe_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data ->> 'name'), ''),
    split_part(COALESCE(NEW.email,'کاربر جدید'),'@',1)
  );

  INSERT INTO public.profiles(id,full_name,role,verification_status)
  VALUES(NEW.id,safe_name,requested_role,initial_status)
  ON CONFLICT(id) DO NOTHING;

  IF requested_role = 'traveler' THEN
    INSERT INTO public.traveler_profiles(user_id)
    VALUES(NEW.id) ON CONFLICT(user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- عملیات مدیریتی امن ----------
DROP FUNCTION IF EXISTS public.admin_set_traveler_status(uuid,public.verification_status);
DROP FUNCTION IF EXISTS public.admin_set_traveler_status(uuid,public.verification_status,public.document_status);
CREATE FUNCTION public.admin_set_traveler_status(
  target_user uuid,
  new_status public.verification_status,
  new_document_status public.document_status DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'دسترسی مدیر لازم است'; END IF;
  UPDATE public.profiles SET verification_status = new_status
  WHERE id = target_user AND role = 'traveler';
  IF new_document_status IS NOT NULL THEN
    UPDATE public.traveler_profiles SET document_status = new_document_status
    WHERE user_id = target_user;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_traveler_status(uuid,public.verification_status,public.document_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_traveler_status(uuid,public.verification_status,public.document_status) TO authenticated;

-- ---------- RLS ----------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traveler_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;

-- حذف سیاست‌های قدیمی
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own basic profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "traveler_profiles_select" ON public.traveler_profiles;
DROP POLICY IF EXISTS "traveler_profiles_insert" ON public.traveler_profiles;
DROP POLICY IF EXISTS "traveler_profiles_update" ON public.traveler_profiles;
CREATE POLICY "traveler_profiles_select" ON public.traveler_profiles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "traveler_profiles_insert" ON public.traveler_profiles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='traveler'));
CREATE POLICY "traveler_profiles_update" ON public.traveler_profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_update" ON public.orders;
DROP POLICY IF EXISTS "orders_delete" ON public.orders;
CREATE POLICY "orders_select" ON public.orders FOR SELECT TO authenticated
USING (buyer_id=auth.uid() OR public.is_admin() OR (status='open' AND public.is_approved_traveler()));
CREATE POLICY "orders_insert" ON public.orders FOR INSERT TO authenticated
WITH CHECK (buyer_id=auth.uid());
CREATE POLICY "orders_update" ON public.orders FOR UPDATE TO authenticated
USING (buyer_id=auth.uid() OR public.is_admin())
WITH CHECK (buyer_id=auth.uid() OR public.is_admin());
CREATE POLICY "orders_delete" ON public.orders FOR DELETE TO authenticated
USING (buyer_id=auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "flights_select" ON public.flights;
DROP POLICY IF EXISTS "flights_insert" ON public.flights;
DROP POLICY IF EXISTS "flights_update" ON public.flights;
DROP POLICY IF EXISTS "flights_delete" ON public.flights;
CREATE POLICY "flights_select" ON public.flights FOR SELECT TO authenticated
USING (traveler_id=auth.uid() OR public.is_admin());
CREATE POLICY "flights_insert" ON public.flights FOR INSERT TO authenticated
WITH CHECK (traveler_id=auth.uid() AND public.is_approved_traveler());
CREATE POLICY "flights_update" ON public.flights FOR UPDATE TO authenticated
USING (traveler_id=auth.uid() OR public.is_admin())
WITH CHECK (traveler_id=auth.uid() OR public.is_admin());
CREATE POLICY "flights_delete" ON public.flights FOR DELETE TO authenticated
USING (traveler_id=auth.uid() OR public.is_admin());

-- ---------- دسترسی ستون‌ها ----------
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE(full_name,phone,city,bio) ON public.profiles TO authenticated;

REVOKE INSERT, UPDATE ON public.traveler_profiles FROM authenticated;
GRANT SELECT ON public.traveler_profiles TO authenticated;
GRANT INSERT(user_id,china_city,university,student_id_reference,document_type,document_number,document_path,default_capacity_kg,notes) ON public.traveler_profiles TO authenticated;
GRANT UPDATE(china_city,university,student_id_reference,document_type,document_number,document_path,default_capacity_kg,notes) ON public.traveler_profiles TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.orders TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.flights TO authenticated;



-- ---------- فضای خصوصی مدارک حمل‌کنندگان ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'traveler-documents',
  'traveler-documents',
  false,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "traveler_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "traveler_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "traveler_documents_update" ON storage.objects;
DROP POLICY IF EXISTS "traveler_documents_delete" ON storage.objects;

CREATE POLICY "traveler_documents_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'traveler-documents'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
);
CREATE POLICY "traveler_documents_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'traveler-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='traveler')
);
CREATE POLICY "traveler_documents_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='traveler-documents' AND (storage.foldername(name))[1]=auth.uid()::text)
WITH CHECK (bucket_id='traveler-documents' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY "traveler_documents_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='traveler-documents' AND ((storage.foldername(name))[1]=auth.uid()::text OR public.is_admin()));

-- ---------- ساخت مدیر اول ----------
-- بعد از ثبت‌نام خودت، ایمیل واقعی را جایگزین کن و فقط یک بار اجرا کن:
-- UPDATE public.profiles
-- SET role='admin', verification_status='approved'
-- WHERE id=(SELECT id FROM auth.users WHERE email='YOUR_EMAIL@example.com');
