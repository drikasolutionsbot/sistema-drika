-- Persist verified PIX recipient details returned by gateway (MisticPay beneficiary / Efí favorecido)
-- on wallet_transactions so transfer receipts display the real bank recipient name, document, bank, and E2E ID.

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS recipient_document text,
  ADD COLUMN IF NOT EXISTS recipient_bank text,
  ADD COLUMN IF NOT EXISTS recipient_ispb text,
  ADD COLUMN IF NOT EXISTS end_to_end_id text;
