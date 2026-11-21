-- ============================================================================
-- Support Infinite Stock per specific Product, per specific Variation (field),
-- and per specific Stock Item (is_infinite)
-- ============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS infinite_stock boolean NOT NULL DEFAULT false;

ALTER TABLE public.product_fields
  ADD COLUMN IF NOT EXISTS infinite_stock boolean NOT NULL DEFAULT false;

ALTER TABLE public.product_stock_items
  ADD COLUMN IF NOT EXISTS is_infinite boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.consume_order_stock(
  _tenant_id uuid,
  _product_id uuid,
  _field_id uuid DEFAULT NULL::uuid,
  _qty integer DEFAULT 1,
  _delivered_to text DEFAULT NULL::text
)
RETURNS SETOF public.product_stock_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _safe_qty integer := LEAST(GREATEST(COALESCE(_qty, 1), 1), 1000);
  _field_count integer := 0;
  _has_own_field_pool boolean := false;
  _is_infinite boolean := false;
  _field_infinite boolean := false;
  _pool_contents text[];
  _pool_field_ids uuid[];
  _pool_len integer := 0;
  _i integer;
  _idx integer;
BEGIN
  IF _tenant_id IS NULL OR _product_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(p.infinite_stock, false)
  INTO _is_infinite
  FROM public.products p
  WHERE p.id = _product_id
    AND p.tenant_id = _tenant_id;

  IF _field_id IS NOT NULL THEN
    SELECT COALESCE(pf.infinite_stock, false)
    INTO _field_infinite
    FROM public.product_fields pf
    WHERE pf.id = _field_id
      AND pf.tenant_id = _tenant_id;
  END IF;

  -- Also check if there are item-level infinite stock items in the target pool
  IF NOT _is_infinite AND NOT _field_infinite THEN
    IF _field_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.product_stock_items psi
        WHERE psi.tenant_id = _tenant_id
          AND psi.product_id = _product_id
          AND psi.field_id = _field_id
          AND psi.delivered = false
          AND psi.is_infinite = true
      ) INTO _field_infinite;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.product_stock_items psi
        WHERE psi.tenant_id = _tenant_id
          AND psi.product_id = _product_id
          AND psi.delivered = false
          AND psi.is_infinite = true
      ) INTO _is_infinite;
    END IF;
  END IF;

  -- ==========================================================================
  -- INFINITE STOCK MODE (Product-level, Variation-level, or Item-level):
  -- Never deplete undelivered items; clone delivered copies for the buyer.
  -- ==========================================================================
  IF _is_infinite OR _field_infinite THEN
    IF _field_id IS NOT NULL THEN
      SELECT array_agg(psi.content ORDER BY psi.is_infinite DESC, psi.created_at ASC, psi.id ASC),
             array_agg(psi.field_id ORDER BY psi.is_infinite DESC, psi.created_at ASC, psi.id ASC)
      INTO _pool_contents, _pool_field_ids
      FROM public.product_stock_items psi
      WHERE psi.tenant_id = _tenant_id
        AND psi.product_id = _product_id
        AND psi.field_id = _field_id
        AND psi.delivered = false;
    END IF;

    IF _pool_contents IS NULL OR array_length(_pool_contents, 1) IS NULL THEN
      SELECT array_agg(psi.content ORDER BY psi.is_infinite DESC, (psi.field_id IS NOT NULL) ASC, psi.created_at ASC, psi.id ASC),
             array_agg(psi.field_id ORDER BY psi.is_infinite DESC, (psi.field_id IS NOT NULL) ASC, psi.created_at ASC, psi.id ASC)
      INTO _pool_contents, _pool_field_ids
      FROM public.product_stock_items psi
      WHERE psi.tenant_id = _tenant_id
        AND psi.product_id = _product_id
        AND psi.delivered = false;
    END IF;

    _pool_len := COALESCE(array_length(_pool_contents, 1), 0);
    IF _pool_len = 0 THEN
      RETURN;
    END IF;

    FOR _i IN 1.._safe_qty LOOP
      _idx := ((_i - 1) % _pool_len) + 1;
      RETURN QUERY
      INSERT INTO public.product_stock_items (
        product_id,
        tenant_id,
        field_id,
        content,
        delivered,
        delivered_at,
        delivered_to,
        is_infinite
      )
      VALUES (
        _product_id,
        _tenant_id,
        COALESCE(_field_id, _pool_field_ids[_idx]),
        _pool_contents[_idx],
        true,
        now(),
        _delivered_to,
        false
      )
      RETURNING *;
    END LOOP;

    RETURN;
  END IF;

  -- ==========================================================================
  -- NORMAL FINITE STOCK MODE
  -- ==========================================================================
  IF _field_id IS NOT NULL THEN
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

  SELECT count(*)::integer
  INTO _field_count
  FROM public.product_fields pf
  WHERE pf.tenant_id = _tenant_id
    AND pf.product_id = _product_id;

  IF _field_count > 0 THEN
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
$function$;
