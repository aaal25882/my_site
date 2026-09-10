-- اجرای یک‌باره در Supabase SQL Editor
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_price_cny numeric(14,2),
  ADD COLUMN IF NOT EXISTS product_category text,
  ADD COLUMN IF NOT EXISTS manual_weight_kg numeric(10,3),
  ADD COLUMN IF NOT EXISTS quote_status text NOT NULL DEFAULT 'pending'
    CHECK (quote_status IN ('pending','estimated','approved','expired','rejected')),
  ADD COLUMN IF NOT EXISTS quoted_total_toman bigint,
  ADD COLUMN IF NOT EXISTS quote_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS quote_provider_snapshot jsonb;

CREATE INDEX IF NOT EXISTS orders_quote_status_idx ON public.orders(quote_status);

-- کاربر عادی نباید مبلغ تأییدشده یا snapshot محاسبه را تغییر دهد.
REVOKE INSERT, UPDATE ON public.orders FROM authenticated;
GRANT INSERT (
  buyer_id,title,product_url,quantity,color,model,weight_kg,estimated_price,
  destination_city,notes,status,product_price_cny,product_category,manual_weight_kg
) ON public.orders TO authenticated;
GRANT UPDATE (
  title,product_url,quantity,color,model,weight_kg,estimated_price,
  destination_city,notes,status,product_price_cny,product_category,manual_weight_kg
) ON public.orders TO authenticated;
GRANT SELECT, DELETE ON public.orders TO authenticated;
