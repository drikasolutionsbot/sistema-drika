
-- 1. Enum for roles
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'support');

-- 2. Enum for product type
CREATE TYPE public.product_type AS ENUM ('digital_auto', 'service', 'hybrid');

-- 3. Enum for order status
CREATE TYPE public.order_status AS ENUM ('pending_payment', 'paid', 'delivering', 'delivered', 'canceled', 'refunded');

-- 4. Enum for ticket status
CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'delivered', 'closed');

-- 5. Enum for coupon type
CREATE TYPE public.coupon_type AS ENUM ('percent', 'fixed');

-- 6. Tenants table (each Discord server/store)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  discord_guild_id TEXT UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#FF69B4',
  secondary_color TEXT DEFAULT '#FFD700',
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 7. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_user_id TEXT UNIQUE,
  discord_username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 8. User roles table (RBAC per tenant)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'support',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 9. Security definer function for role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _tenant_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND tenant_id = _tenant_id AND role = _role
  )
$$;

-- 10. Function to check any role in tenant
CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND tenant_id = _tenant_id
  )
$$;

-- 11. Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 12. Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  type product_type NOT NULL DEFAULT 'digital_auto',
  price_cents INT NOT NULL DEFAULT 0,
  stock INT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 13. Orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_number SERIAL,
  discord_user_id TEXT NOT NULL,
  discord_username TEXT,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  total_cents INT NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'pending_payment',
  coupon_id UUID,
  affiliate_id UUID,
  payment_provider TEXT,
  payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 14. Coupons
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  type coupon_type NOT NULL DEFAULT 'percent',
  value INT NOT NULL DEFAULT 0,
  max_uses INT DEFAULT 100,
  used_count INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- 15. Affiliates
CREATE TABLE public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  commission_percent INT NOT NULL DEFAULT 5,
  total_sales INT NOT NULL DEFAULT 0,
  total_revenue_cents INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

-- 16. Channel configs
CREATE TABLE public.channel_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_key TEXT NOT NULL,
  discord_channel_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, channel_key)
);
ALTER TABLE public.channel_configs ENABLE ROW LEVEL SECURITY;

-- 17. Payment providers
CREATE TABLE public.payment_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL,
  api_key_encrypted TEXT,
  secret_key_encrypted TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, provider_key)
);
ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;

-- 18. Tickets
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  discord_user_id TEXT NOT NULL,
  discord_username TEXT,
  product_name TEXT,
  status ticket_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- Profiles: users can read/update their own
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles: members can view roles in their tenant
CREATE POLICY "Members can view tenant roles" ON public.user_roles FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Owners can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), tenant_id, 'owner'));

-- Tenants: members can view their tenant
CREATE POLICY "Members can view tenant" ON public.tenants FOR SELECT USING (public.is_tenant_member(auth.uid(), id));
CREATE POLICY "Owners can update tenant" ON public.tenants FOR UPDATE USING (public.has_role(auth.uid(), id, 'owner'));
CREATE POLICY "Authenticated can create tenant" ON public.tenants FOR INSERT TO authenticated WITH CHECK (true);

-- Products: tenant members can view, owner/admin can manage
CREATE POLICY "Members can view products" ON public.products FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (public.has_role(auth.uid(), tenant_id, 'owner') OR public.has_role(auth.uid(), tenant_id, 'admin'));

-- Orders: tenant members can view, owner/admin can manage
CREATE POLICY "Members can view orders" ON public.orders FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Admins can manage orders" ON public.orders FOR ALL USING (public.has_role(auth.uid(), tenant_id, 'owner') OR public.has_role(auth.uid(), tenant_id, 'admin'));

-- Coupons
CREATE POLICY "Members can view coupons" ON public.coupons FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Admins can manage coupons" ON public.coupons FOR ALL USING (public.has_role(auth.uid(), tenant_id, 'owner') OR public.has_role(auth.uid(), tenant_id, 'admin'));

-- Affiliates
CREATE POLICY "Members can view affiliates" ON public.affiliates FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Admins can manage affiliates" ON public.affiliates FOR ALL USING (public.has_role(auth.uid(), tenant_id, 'owner') OR public.has_role(auth.uid(), tenant_id, 'admin'));

-- Channel configs
CREATE POLICY "Members can view channels" ON public.channel_configs FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Admins can manage channels" ON public.channel_configs FOR ALL USING (public.has_role(auth.uid(), tenant_id, 'owner') OR public.has_role(auth.uid(), tenant_id, 'admin'));

-- Payment providers
CREATE POLICY "Members can view payment providers" ON public.payment_providers FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Owners can manage payment providers" ON public.payment_providers FOR ALL USING (public.has_role(auth.uid(), tenant_id, 'owner'));

-- Tickets
CREATE POLICY "Members can view tickets" ON public.tickets FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Members can manage tickets" ON public.tickets FOR ALL USING (public.is_tenant_member(auth.uid(), tenant_id));

-- Categories
CREATE POLICY "Members can view categories" ON public.categories FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL USING (public.has_role(auth.uid(), tenant_id, 'owner') OR public.has_role(auth.uid(), tenant_id, 'admin'));

-- ============ TRIGGER: auto-create profile on signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, discord_user_id, discord_username, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'provider_id',
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'user_name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
