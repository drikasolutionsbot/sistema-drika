-- Hardening for order delivery, atomic stock consumption, variation isolation, and coupon/quantity integrity

-- 1. Real quantity tracking on orders (so buyers cannot pay 1x or desync payment/delivery)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

UPDATE public.orders
SET quantity = 1
WHERE quantity IS NULL OR quantity < 1 OR quantity > 99;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_quantity_valid;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_quantity_valid CHECK (quantity >= 1 AND quantity <= 99);

-- 2. Performance index for atomic stock claiming with large inventories
CREATE INDEX IF NOT EXISTS idx_product_stock_items_claim
  ON public.product_stock_items (tenant_id, product_id, field_id, delivered, created_at, id)
  WHERE delivered = false;

-- 3. Atomically transition a paid order to 'delivering' so parallel webhooks/polling cannot deliver twice
CREATE OR REPLACE FUNCTION public.claim_order_for_delivery(
  _order_id uuid,
  _tenant_id uuid DEFAULT NULL
)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.orders o
  SET status = 'delivering',
      updated_at = now()
  WHERE o.id = _order_id
    AND (_tenant_id IS NULL OR o.tenant_id = _tenant_id)
    AND o.status = 'paid'
  RETURNING o.*;
END;
$$;

-- 4. Atomically consume stock items with FOR UPDATE SKIP LOCKED and strict variation (field_id) isolation
CREATE OR REPLACE FUNCTION public.consume_order_stock(
  _tenant_id uuid,
  _product_id uuid,
  _field_id uuid DEFAULT NULL,
  _qty integer DEFAULT 1,
  _delivered_to text DEFAULT NULL
)
RETURNS SETOF public.product_stock_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _safe_qty integer := LEAST(GREATEST(COALESCE(_qty, 1), 1), 1000);
  _field_count integer := 0;
  _has_own_field_pool boolean := false;
BEGIN
  IF _tenant_id IS NULL OR _product_id IS NULL THEN
    RETURN;
  END IF;

  IF _field_id IS NOT NULL THEN
    -- Case A: Variation-specific stock first
    RETURN QUERY
    WITH picked AS (
      SELECT psi.id
      FROM public.product_stock_items psi
      WHERE psi.tenant_id = _tenant_id
        AND psi.product_id = _product_id
        AND psi.field_id = _field_id
        AND psi.delivered = false
      ORDER BY psi.created_at ASC, psi.id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT _safe_qty
    ),
    updated AS (
      UPDATE public.product_stock_items target
      SET delivered = true,
          delivered_at = now(),
          delivered_to = COALESCE(_delivered_to, target.delivered_to)
      FROM picked
      WHERE target.id = picked.id
      RETURNING target.*
    )
    SELECT * FROM updated;

    IF FOUND THEN
      RETURN;
    END IF;

    -- Fallback to unassigned general pool (field_id IS NULL) ONLY if this variation never had its own pool
    SELECT EXISTS (
      SELECT 1
      FROM public.product_stock_items psi
      WHERE psi.tenant_id = _tenant_id
        AND psi.product_id = _product_id
        AND psi.field_id = _field_id
    ) INTO _has_own_field_pool;

    IF NOT _has_own_field_pool THEN
      RETURN QUERY
      WITH picked AS (
        SELECT psi.id
        FROM public.product_stock_items psi
        WHERE psi.tenant_id = _tenant_id
          AND psi.product_id = _product_id
          AND psi.field_id IS NULL
          AND psi.delivered = false
        ORDER BY psi.created_at ASC, psi.id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT _safe_qty
      ),
      updated AS (
        UPDATE public.product_stock_items target
        SET delivered = true,
            delivered_at = now(),
            delivered_to = COALESCE(_delivered_to, target.delivered_to)
        FROM picked
        WHERE target.id = picked.id
        RETURNING target.*
      )
      SELECT * FROM updated;
    END IF;

    RETURN;
  END IF;

  -- Case B: No field_id on order
  SELECT count(*)::integer
  INTO _field_count
  FROM public.product_fields pf
  WHERE pf.tenant_id = _tenant_id
    AND pf.product_id = _product_id;

  IF _field_count > 0 THEN
    -- Product has variations: NEVER steal items assigned to any specific variation
    RETURN QUERY
    WITH picked AS (
      SELECT psi.id
      FROM public.product_stock_items psi
      WHERE psi.tenant_id = _tenant_id
        AND psi.product_id = _product_id
        AND psi.field_id IS NULL
        AND psi.delivered = false
      ORDER BY psi.created_at ASC, psi.id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT _safe_qty
    ),
    updated AS (
      UPDATE public.product_stock_items target
      SET delivered = true,
          delivered_at = now(),
          delivered_to = COALESCE(_delivered_to, target.delivered_to)
      FROM picked
      WHERE target.id = picked.id
      RETURNING target.*
    )
    SELECT * FROM updated;
  ELSE
    -- Single-product (no variations): prioritize unassigned items
    RETURN QUERY
    WITH picked AS (
      SELECT psi.id
      FROM public.product_stock_items psi
      WHERE psi.tenant_id = _tenant_id
        AND psi.product_id = _product_id
        AND psi.delivered = false
      ORDER BY (psi.field_id IS NOT NULL) ASC, psi.created_at ASC, psi.id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT _safe_qty
    ),
    updated AS (
      UPDATE public.product_stock_items target
      SET delivered = true,
          delivered_at = now(),
          delivered_to = COALESCE(_delivered_to, target.delivered_to)
      FROM picked
      WHERE target.id = picked.id
      RETURNING target.*
    )
    SELECT * FROM updated;
  END IF;
END;
$$;

-- 5. Atomically apply at most ONE coupon per pending order, validating ownership, expiry & max_uses
CREATE OR REPLACE FUNCTION public.apply_coupon_to_order(
  _order_id uuid,
  _coupon_code text,
  _user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_coupon public.coupons%ROWTYPE;
  v_discount integer := 0;
  v_new_total integer := 0;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.status <> 'pending_payment' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found_or_processed');
  END IF;

  IF v_order.discord_user_id IS NOT NULL AND _user_id IS NOT NULL AND v_order.discord_user_id <> _user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF v_order.coupon_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'coupon_already_applied');
  END IF;

  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE tenant_id = v_order.tenant_id
    AND upper(code) = upper(trim(_coupon_code))
    AND active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'coupon_not_found');
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'coupon_expired');
  END IF;

  IF v_coupon.max_uses IS NOT NULL AND COALESCE(v_coupon.used_count, 0) >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'coupon_usage_limit');
  END IF;

  IF v_coupon.product_id IS NOT NULL AND v_coupon.product_id <> v_order.product_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'coupon_not_valid_for_product');
  END IF;

  IF v_coupon.type = 'percent' THEN
    v_discount := FLOOR(v_order.total_cents::numeric * GREATEST(0, LEAST(100, v_coupon.value)) / 100)::integer;
  ELSE
    v_discount := GREATEST(0, v_coupon.value);
  END IF;

  v_new_total := GREATEST(0, v_order.total_cents - v_discount);

  UPDATE public.orders
  SET total_cents = v_new_total,
      coupon_id = v_coupon.id,
      -- Invalidate any previously generated PIX so user cannot pay old amount for discounted order
      payment_id = NULL,
      pix_brcode = NULL,
      pix_message_id = NULL,
      updated_at = now()
  WHERE id = v_order.id;

  UPDATE public.coupons
  SET used_count = COALESCE(used_count, 0) + 1
  WHERE id = v_coupon.id;

  RETURN jsonb_build_object(
    'ok', true,
    'old_total', v_order.total_cents,
    'new_total', v_new_total,
    'discount', v_discount,
    'coupon_id', v_coupon.id,
    'order_number', v_order.order_number,
    'currency', v_order.currency,
    'tenant_id', v_order.tenant_id,
    'previous_pix_message_id', v_order.pix_message_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_order_for_delivery(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_order_for_delivery(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.consume_order_stock(uuid, uuid, uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_order_stock(uuid, uuid, uuid, integer, text) TO service_role;

REVOKE ALL ON FUNCTION public.apply_coupon_to_order(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_coupon_to_order(uuid, text, text) TO service_role;
