ALTER TABLE "public"."channel_configs"
ADD COLUMN "embed_config" jsonb,
ADD COLUMN "content" text;
