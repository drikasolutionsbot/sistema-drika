export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_tokens: {
        Row: {
          allowed_ip: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          label: string | null
          last_used_at: string | null
          revoked: boolean
          tenant_id: string
          token: string
        }
        Insert: {
          allowed_ip?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          last_used_at?: string | null
          revoked?: boolean
          tenant_id: string
          token?: string
        }
        Update: {
          allowed_ip?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          last_used_at?: string | null
          revoked?: boolean
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_logs: {
        Row: {
          action: string
          admin_email: string | null
          admin_user_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          admin_email?: string | null
          admin_user_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          admin_email?: string | null
          admin_user_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      affiliate_payouts: {
        Row: {
          affiliate_id: string
          amount_cents: number
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          amount_cents?: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          amount_cents?: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payouts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_payouts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          active: boolean
          code: string
          commission_fixed_cents: number
          commission_percent: number
          commission_type: string
          created_at: string
          discord_username: string | null
          email: string | null
          id: string
          name: string
          tenant_id: string
          total_revenue_cents: number
          total_sales: number
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          code: string
          commission_fixed_cents?: number
          commission_percent?: number
          commission_type?: string
          created_at?: string
          discord_username?: string | null
          email?: string | null
          id?: string
          name: string
          tenant_id: string
          total_revenue_cents?: number
          total_sales?: number
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          commission_fixed_cents?: number
          commission_percent?: number
          commission_type?: string
          created_at?: string
          discord_username?: string | null
          email?: string | null
          id?: string
          name?: string
          tenant_id?: string
          total_revenue_cents?: number
          total_sales?: number
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generations: {
        Row: {
          category: string
          created_at: string
          credits_used: number
          enhanced_prompt: string | null
          id: string
          result_image_url: string | null
          result_text: string | null
          tenant_id: string
          user_id: string | null
          user_input: string
        }
        Insert: {
          category?: string
          created_at?: string
          credits_used?: number
          enhanced_prompt?: string | null
          id?: string
          result_image_url?: string | null
          result_text?: string | null
          tenant_id: string
          user_id?: string | null
          user_input?: string
        }
        Update: {
          category?: string
          created_at?: string
          credits_used?: number
          enhanced_prompt?: string | null
          id?: string
          result_image_url?: string | null
          result_text?: string | null
          tenant_id?: string
          user_id?: string | null
          user_input?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          automation_id: string
          created_at: string
          details: string | null
          id: string
          result: string
          tenant_id: string
          trigger_data: Json | null
        }
        Insert: {
          automation_id: string
          created_at?: string
          details?: string | null
          id?: string
          result?: string
          tenant_id: string
          trigger_data?: Json | null
        }
        Update: {
          automation_id?: string
          created_at?: string
          details?: string | null
          id?: string
          result?: string
          tenant_id?: string
          trigger_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          enabled: boolean
          executions: number
          id: string
          last_executed_at: string | null
          name: string
          tenant_id: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          enabled?: boolean
          executions?: number
          id?: string
          last_executed_at?: string | null
          name: string
          tenant_id: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          enabled?: boolean
          executions?: number
          id?: string
          last_executed_at?: string | null
          name?: string
          tenant_id?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_commands: {
        Row: {
          category: string
          created_at: string
          description: string
          enabled: boolean
          id: string
          is_default: boolean
          name: string
          options: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          is_default?: boolean
          name: string
          options?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          is_default?: boolean
          name?: string
          options?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_commands_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_modules: {
        Row: {
          color: string
          created_at: string
          custom: boolean
          description: string
          enabled: boolean
          icon_key: string
          id: string
          module_key: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          custom?: boolean
          description?: string
          enabled?: boolean
          icon_key?: string
          id?: string
          module_key: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          custom?: boolean
          description?: string
          enabled?: boolean
          icon_key?: string
          id?: string
          module_key?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_configs: {
        Row: {
          channel_key: string
          created_at: string
          discord_channel_id: string | null
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          channel_key: string
          created_at?: string
          discord_channel_id?: string | null
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          channel_key?: string
          created_at?: string
          discord_channel_id?: string | null
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          expires_at: string | null
          id: string
          max_uses: number | null
          product_id: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["coupon_type"]
          used_count: number
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          product_id?: string | null
          tenant_id: string
          type?: Database["public"]["Enums"]["coupon_type"]
          used_count?: number
          value?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          product_id?: string | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["coupon_type"]
          used_count?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ecloud_backups: {
        Row: {
          backup_type: string
          completed_at: string | null
          created_at: string
          data: Json
          id: string
          members_count: number
          orders_count: number
          products_count: number
          started_at: string
          status: string
          tenant_id: string
          verified_count: number
        }
        Insert: {
          backup_type?: string
          completed_at?: string | null
          created_at?: string
          data?: Json
          id?: string
          members_count?: number
          orders_count?: number
          products_count?: number
          started_at?: string
          status?: string
          tenant_id: string
          verified_count?: number
        }
        Update: {
          backup_type?: string
          completed_at?: string | null
          created_at?: string
          data?: Json
          id?: string
          members_count?: number
          orders_count?: number
          products_count?: number
          started_at?: string
          status?: string
          tenant_id?: string
          verified_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ecloud_backups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      giveaway_entries: {
        Row: {
          discord_avatar: string | null
          discord_user_id: string
          discord_username: string | null
          entered_at: string
          giveaway_id: string
          id: string
          tenant_id: string
        }
        Insert: {
          discord_avatar?: string | null
          discord_user_id: string
          discord_username?: string | null
          entered_at?: string
          giveaway_id: string
          id?: string
          tenant_id: string
        }
        Update: {
          discord_avatar?: string | null
          discord_user_id?: string
          discord_username?: string | null
          entered_at?: string
          giveaway_id?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "giveaway_entries_giveaway_id_fkey"
            columns: ["giveaway_id"]
            isOneToOne: false
            referencedRelation: "giveaways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "giveaway_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      giveaways: {
        Row: {
          channel_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          embed_config: Json
          ends_at: string
          id: string
          message_id: string | null
          prize: string
          require_role_id: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
          winners: Json
          winners_count: number
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          embed_config?: Json
          ends_at: string
          id?: string
          message_id?: string | null
          prize: string
          require_role_id?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
          winners?: Json
          winners_count?: number
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          embed_config?: Json
          ends_at?: string
          id?: string
          message_id?: string | null
          prize?: string
          require_role_id?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          winners?: Json
          winners_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "giveaways_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_config: {
        Row: {
          abacatepay_active: boolean
          abacatepay_api_key: string | null
          abacatepay_webhook_secret: string | null
          auto_activate_plan: boolean
          created_at: string
          efi_active: boolean
          efi_cert_pem: string | null
          efi_client_id: string | null
          efi_client_secret: string | null
          efi_key_pem: string | null
          efi_pix_key: string | null
          global_bot_banner_force_reapply_at: string | null
          global_bot_banner_url: string | null
          global_bot_status: string
          id: string
          master_plan_name: string
          master_price_cents: number
          pro_plan_name: string
          pro_price_cents: number
          pushinpay_active: boolean
          pushinpay_api_key: string | null
          referral_bonus_credits_cents: number
          referral_bonus_days: number
          stat_products: number
          stat_products_label: string
          stat_sales: number
          stat_sales_label: string
          stat_servers: number
          stat_servers_label: string
          suspend_on_expire: boolean
          updated_at: string
          video_type: string
          video_url: string | null
        }
        Insert: {
          abacatepay_active?: boolean
          abacatepay_api_key?: string | null
          abacatepay_webhook_secret?: string | null
          auto_activate_plan?: boolean
          created_at?: string
          efi_active?: boolean
          efi_cert_pem?: string | null
          efi_client_id?: string | null
          efi_client_secret?: string | null
          efi_key_pem?: string | null
          efi_pix_key?: string | null
          global_bot_banner_force_reapply_at?: string | null
          global_bot_banner_url?: string | null
          global_bot_status?: string
          id?: string
          master_plan_name?: string
          master_price_cents?: number
          pro_plan_name?: string
          pro_price_cents?: number
          pushinpay_active?: boolean
          pushinpay_api_key?: string | null
          referral_bonus_credits_cents?: number
          referral_bonus_days?: number
          stat_products?: number
          stat_products_label?: string
          stat_sales?: number
          stat_sales_label?: string
          stat_servers?: number
          stat_servers_label?: string
          suspend_on_expire?: boolean
          updated_at?: string
          video_type?: string
          video_url?: string | null
        }
        Update: {
          abacatepay_active?: boolean
          abacatepay_api_key?: string | null
          abacatepay_webhook_secret?: string | null
          auto_activate_plan?: boolean
          created_at?: string
          efi_active?: boolean
          efi_cert_pem?: string | null
          efi_client_id?: string | null
          efi_client_secret?: string | null
          efi_key_pem?: string | null
          efi_pix_key?: string | null
          global_bot_banner_force_reapply_at?: string | null
          global_bot_banner_url?: string | null
          global_bot_status?: string
          id?: string
          master_plan_name?: string
          master_price_cents?: number
          pro_plan_name?: string
          pro_price_cents?: number
          pushinpay_active?: boolean
          pushinpay_api_key?: string | null
          referral_bonus_credits_cents?: number
          referral_bonus_days?: number
          stat_products?: number
          stat_products_label?: string
          stat_sales?: number
          stat_sales_label?: string
          stat_servers?: number
          stat_servers_label?: string
          suspend_on_expire?: boolean
          updated_at?: string
          video_type?: string
          video_url?: string | null
        }
        Relationships: []
      }
      marketplace_items: {
        Row: {
          bought_at: string | null
          bought_by_tenant_id: string | null
          category: string | null
          cost_cents: number
          created_at: string
          delivered: boolean
          delivered_at: string | null
          delivery_content: string | null
          description: string | null
          id: string
          image_url: string | null
          lzt_data: Json | null
          lzt_item_id: number
          payment_id: string | null
          resale_price_cents: number
          status: string
          stock: number
          title: string
          updated_at: string
        }
        Insert: {
          bought_at?: string | null
          bought_by_tenant_id?: string | null
          category?: string | null
          cost_cents?: number
          created_at?: string
          delivered?: boolean
          delivered_at?: string | null
          delivery_content?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          lzt_data?: Json | null
          lzt_item_id: number
          payment_id?: string | null
          resale_price_cents?: number
          status?: string
          stock?: number
          title: string
          updated_at?: string
        }
        Update: {
          bought_at?: string | null
          bought_by_tenant_id?: string | null
          category?: string | null
          cost_cents?: number
          created_at?: string
          delivered?: boolean
          delivered_at?: string | null
          delivery_content?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          lzt_data?: Json | null
          lzt_item_id?: number
          payment_id?: string | null
          resale_price_cents?: number
          status?: string
          stock?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_items_bought_by_tenant_id_fkey"
            columns: ["bought_by_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          affiliate_id: string | null
          checkout_thread_id: string | null
          coupon_id: string | null
          created_at: string
          discord_user_id: string
          discord_username: string | null
          field_id: string | null
          id: string
          order_number: number
          payment_id: string | null
          payment_provider: string | null
          product_id: string | null
          product_name: string
          status: Database["public"]["Enums"]["order_status"]
          tenant_id: string
          total_cents: number
          updated_at: string
        }
        Insert: {
          affiliate_id?: string | null
          checkout_thread_id?: string | null
          coupon_id?: string | null
          created_at?: string
          discord_user_id: string
          discord_username?: string | null
          field_id?: string | null
          id?: string
          order_number?: number
          payment_id?: string | null
          payment_provider?: string | null
          product_id?: string | null
          product_name: string
          status?: Database["public"]["Enums"]["order_status"]
          tenant_id: string
          total_cents?: number
          updated_at?: string
        }
        Update: {
          affiliate_id?: string | null
          checkout_thread_id?: string | null
          coupon_id?: string | null
          created_at?: string
          discord_user_id?: string
          discord_username?: string | null
          field_id?: string | null
          id?: string
          order_number?: number
          payment_id?: string | null
          payment_provider?: string | null
          product_id?: string | null
          product_name?: string
          status?: Database["public"]["Enums"]["order_status"]
          tenant_id?: string
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "product_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_providers: {
        Row: {
          active: boolean
          api_key_encrypted: string | null
          created_at: string
          efi_cert_pem: string | null
          efi_key_pem: string | null
          efi_pix_key: string | null
          id: string
          provider_key: string
          secret_key_encrypted: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          api_key_encrypted?: string | null
          created_at?: string
          efi_cert_pem?: string | null
          efi_key_pem?: string | null
          efi_pix_key?: string | null
          id?: string
          provider_key: string
          secret_key_encrypted?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          api_key_encrypted?: string | null
          created_at?: string
          efi_cert_pem?: string | null
          efi_key_pem?: string | null
          efi_pix_key?: string | null
          id?: string
          provider_key?: string
          secret_key_encrypted?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_providers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_fields: {
        Row: {
          banner_url: string | null
          compare_price_cents: number | null
          created_at: string
          delivery_quantity: number
          description: string | null
          emoji: string | null
          enable_credits: boolean
          enable_instructions: boolean
          icon_url: string | null
          id: string
          is_subscription: boolean
          max_quantity: number | null
          min_quantity: number | null
          name: string
          post_purchase_messages: Json
          pre_purchase_messages: Json
          price_cents: number
          product_id: string
          require_role_id: string | null
          show_sold: boolean
          show_stock: boolean
          sort_order: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          compare_price_cents?: number | null
          created_at?: string
          delivery_quantity?: number
          description?: string | null
          emoji?: string | null
          enable_credits?: boolean
          enable_instructions?: boolean
          icon_url?: string | null
          id?: string
          is_subscription?: boolean
          max_quantity?: number | null
          min_quantity?: number | null
          name: string
          post_purchase_messages?: Json
          pre_purchase_messages?: Json
          price_cents?: number
          product_id: string
          require_role_id?: string | null
          show_sold?: boolean
          show_stock?: boolean
          sort_order?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          compare_price_cents?: number | null
          created_at?: string
          delivery_quantity?: number
          description?: string | null
          emoji?: string | null
          enable_credits?: boolean
          enable_instructions?: boolean
          icon_url?: string | null
          id?: string
          is_subscription?: boolean
          max_quantity?: number | null
          min_quantity?: number | null
          name?: string
          post_purchase_messages?: Json
          pre_purchase_messages?: Json
          price_cents?: number
          product_id?: string
          require_role_id?: string | null
          show_sold?: boolean
          show_stock?: boolean
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_fields_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_fields_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_hooks: {
        Row: {
          active: boolean
          config: Json
          created_at: string
          hook_type: Database["public"]["Enums"]["hook_type"]
          id: string
          product_id: string
          sort_order: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          config?: Json
          created_at?: string
          hook_type: Database["public"]["Enums"]["hook_type"]
          id?: string
          product_id: string
          sort_order?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          config?: Json
          created_at?: string
          hook_type?: Database["public"]["Enums"]["hook_type"]
          id?: string
          product_id?: string
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_hooks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_hooks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_messages: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          message_id: string
          product_id: string
          tenant_id: string
          webhook_id: string | null
          webhook_token: string | null
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          message_id: string
          product_id: string
          tenant_id: string
          webhook_id?: string | null
          webhook_token?: string | null
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          message_id?: string
          product_id?: string
          tenant_id?: string
          webhook_id?: string | null
          webhook_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_messages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock_items: {
        Row: {
          content: string
          created_at: string
          delivered: boolean
          delivered_at: string | null
          delivered_to: string | null
          field_id: string | null
          id: string
          product_id: string | null
          tenant_id: string
        }
        Insert: {
          content: string
          created_at?: string
          delivered?: boolean
          delivered_at?: string | null
          delivered_to?: string | null
          field_id?: string | null
          id?: string
          product_id?: string | null
          tenant_id: string
        }
        Update: {
          content?: string
          created_at?: string
          delivered?: boolean
          delivered_at?: string | null
          delivered_to?: string | null
          field_id?: string | null
          id?: string
          product_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_items_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "product_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          auto_delivery: boolean
          banner_url: string | null
          button_style: string | null
          category_id: string | null
          compare_price_cents: number | null
          created_at: string
          description: string | null
          embed_config: Json
          enable_credits: boolean
          enable_instructions: boolean
          icon_url: string | null
          id: string
          name: string
          price_cents: number
          role_id: string | null
          show_sold: boolean
          show_stock: boolean
          stock: number | null
          tenant_id: string
          type: Database["public"]["Enums"]["product_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          auto_delivery?: boolean
          banner_url?: string | null
          button_style?: string | null
          category_id?: string | null
          compare_price_cents?: number | null
          created_at?: string
          description?: string | null
          embed_config?: Json
          enable_credits?: boolean
          enable_instructions?: boolean
          icon_url?: string | null
          id?: string
          name: string
          price_cents?: number
          role_id?: string | null
          show_sold?: boolean
          show_stock?: boolean
          stock?: number | null
          tenant_id: string
          type?: Database["public"]["Enums"]["product_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          auto_delivery?: boolean
          banner_url?: string | null
          button_style?: string | null
          category_id?: string | null
          compare_price_cents?: number | null
          created_at?: string
          description?: string | null
          embed_config?: Json
          enable_credits?: boolean
          enable_instructions?: boolean
          icon_url?: string | null
          id?: string
          name?: string
          price_cents?: number
          role_id?: string | null
          show_sold?: boolean
          show_stock?: boolean
          stock?: number | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["product_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          discord_user_id: string | null
          discord_username: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          discord_user_id?: string | null
          discord_username?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          discord_user_id?: string | null
          discord_username?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      protection_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          module_key: string
          target_user_id: string | null
          target_username: string | null
          tenant_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          module_key: string
          target_user_id?: string | null
          target_username?: string | null
          tenant_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          module_key?: string
          target_user_id?: string | null
          target_username?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "protection_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      protection_settings: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          id: string
          module_key: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          module_key: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          module_key?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "protection_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      protection_whitelist: {
        Row: {
          created_at: string
          discord_id: string
          id: string
          label: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          created_at?: string
          discord_id: string
          id?: string
          label?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          created_at?: string
          discord_id?: string
          id?: string
          label?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "protection_whitelist_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_embeds: {
        Row: {
          created_at: string
          embed_data: Json
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          embed_data?: Json
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          embed_data?: Json
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_embeds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_ticket_presets: {
        Row: {
          created_at: string
          id: string
          name: string
          preset_data: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          preset_data?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          preset_data?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_ticket_presets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      store_configs: {
        Row: {
          auto_delivery_global: boolean
          created_at: string
          customer_role_id: string | null
          delivery_instructions: string | null
          embed_color: string
          id: string
          logs_channel_id: string | null
          payment_timeout_minutes: number
          purchase_embed_color: string | null
          purchase_embed_description: string | null
          purchase_embed_footer: string | null
          purchase_embed_image_url: string | null
          purchase_embed_thumbnail_url: string | null
          purchase_embed_title: string | null
          sales_channel_id: string | null
          store_banner_url: string | null
          store_description: string | null
          store_logo_url: string | null
          store_title: string | null
          tenant_id: string
          ticket_channel_id: string | null
          ticket_embed_button_label: string | null
          ticket_embed_button_style: string | null
          ticket_embed_color: string | null
          ticket_embed_description: string | null
          ticket_embed_footer: string | null
          ticket_embed_image_url: string | null
          ticket_embed_thumbnail_url: string | null
          ticket_embed_title: string | null
          ticket_logs_channel_id: string | null
          ticket_message_id: string | null
          ticket_staff_role_id: string | null
          updated_at: string
        }
        Insert: {
          auto_delivery_global?: boolean
          created_at?: string
          customer_role_id?: string | null
          delivery_instructions?: string | null
          embed_color?: string
          id?: string
          logs_channel_id?: string | null
          payment_timeout_minutes?: number
          purchase_embed_color?: string | null
          purchase_embed_description?: string | null
          purchase_embed_footer?: string | null
          purchase_embed_image_url?: string | null
          purchase_embed_thumbnail_url?: string | null
          purchase_embed_title?: string | null
          sales_channel_id?: string | null
          store_banner_url?: string | null
          store_description?: string | null
          store_logo_url?: string | null
          store_title?: string | null
          tenant_id: string
          ticket_channel_id?: string | null
          ticket_embed_button_label?: string | null
          ticket_embed_button_style?: string | null
          ticket_embed_color?: string | null
          ticket_embed_description?: string | null
          ticket_embed_footer?: string | null
          ticket_embed_image_url?: string | null
          ticket_embed_thumbnail_url?: string | null
          ticket_embed_title?: string | null
          ticket_logs_channel_id?: string | null
          ticket_message_id?: string | null
          ticket_staff_role_id?: string | null
          updated_at?: string
        }
        Update: {
          auto_delivery_global?: boolean
          created_at?: string
          customer_role_id?: string | null
          delivery_instructions?: string | null
          embed_color?: string
          id?: string
          logs_channel_id?: string | null
          payment_timeout_minutes?: number
          purchase_embed_color?: string | null
          purchase_embed_description?: string | null
          purchase_embed_footer?: string | null
          purchase_embed_image_url?: string | null
          purchase_embed_thumbnail_url?: string | null
          purchase_embed_title?: string | null
          sales_channel_id?: string | null
          store_banner_url?: string | null
          store_description?: string | null
          store_logo_url?: string | null
          store_title?: string | null
          tenant_id?: string
          ticket_channel_id?: string | null
          ticket_embed_button_label?: string | null
          ticket_embed_button_style?: string | null
          ticket_embed_color?: string | null
          ticket_embed_description?: string | null
          ticket_embed_footer?: string | null
          ticket_embed_image_url?: string | null
          ticket_embed_thumbnail_url?: string | null
          ticket_embed_title?: string | null
          ticket_logs_channel_id?: string | null
          ticket_message_id?: string | null
          ticket_staff_role_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          metadata: Json | null
          paid_at: string | null
          payer_email: string | null
          payer_name: string | null
          payment_id: string | null
          payment_provider: string
          period_end: string | null
          period_start: string | null
          plan: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payment_id?: string | null
          payment_provider?: string
          period_end?: string | null
          period_start?: string | null
          plan?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payment_id?: string | null
          payment_provider?: string
          period_end?: string | null
          period_start?: string | null
          plan?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_channels: {
        Row: {
          about: string
          action_text: string
          active: boolean
          bottom_color: string
          bottom_text: string
          created_at: string
          id: string
          initial: string
          name: string
          role: string
          secondary_action_text: string | null
          sort_order: number | null
          status: string
          status_color: string
          updated_at: string
          url: string
        }
        Insert: {
          about?: string
          action_text?: string
          active?: boolean
          bottom_color?: string
          bottom_text?: string
          created_at?: string
          id?: string
          initial?: string
          name: string
          role?: string
          secondary_action_text?: string | null
          sort_order?: number | null
          status?: string
          status_color?: string
          updated_at?: string
          url?: string
        }
        Update: {
          about?: string
          action_text?: string
          active?: boolean
          bottom_color?: string
          bottom_text?: string
          created_at?: string
          id?: string
          initial?: string
          name?: string
          role?: string
          secondary_action_text?: string | null
          sort_order?: number | null
          status?: string
          status_color?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      tenant_audit_logs: {
        Row: {
          action: string
          actor_discord_id: string | null
          actor_name: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          tenant_id: string
        }
        Insert: {
          action: string
          actor_discord_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          tenant_id: string
        }
        Update: {
          action?: string
          actor_discord_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_credits: {
        Row: {
          created_at: string
          credits_remaining: number
          daily_limit: number
          id: string
          last_reset_at: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_remaining?: number
          daily_limit?: number
          id?: string
          last_reset_at?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_remaining?: number
          daily_limit?: number
          id?: string
          last_reset_at?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_permissions: {
        Row: {
          can_change_server: boolean
          can_manage_app: boolean
          can_manage_bot_appearance: boolean
          can_manage_ecloud: boolean
          can_manage_permissions: boolean
          can_manage_products: boolean
          can_manage_protection: boolean
          can_manage_resources: boolean
          can_manage_stock: boolean
          can_manage_store: boolean
          can_view: boolean
          created_at: string
          discord_avatar_url: string | null
          discord_display_name: string | null
          discord_user_id: string
          discord_username: string | null
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          can_change_server?: boolean
          can_manage_app?: boolean
          can_manage_bot_appearance?: boolean
          can_manage_ecloud?: boolean
          can_manage_permissions?: boolean
          can_manage_products?: boolean
          can_manage_protection?: boolean
          can_manage_resources?: boolean
          can_manage_stock?: boolean
          can_manage_store?: boolean
          can_view?: boolean
          created_at?: string
          discord_avatar_url?: string | null
          discord_display_name?: string | null
          discord_user_id: string
          discord_username?: string | null
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          can_change_server?: boolean
          can_manage_app?: boolean
          can_manage_bot_appearance?: boolean
          can_manage_ecloud?: boolean
          can_manage_permissions?: boolean
          can_manage_products?: boolean
          can_manage_protection?: boolean
          can_manage_resources?: boolean
          can_manage_stock?: boolean
          can_manage_store?: boolean
          can_view?: boolean
          created_at?: string
          discord_avatar_url?: string | null
          discord_display_name?: string | null
          discord_user_id?: string
          discord_username?: string | null
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_roles: {
        Row: {
          can_change_server: boolean
          can_manage_app: boolean
          can_manage_bot_appearance: boolean
          can_manage_ecloud: boolean
          can_manage_permissions: boolean
          can_manage_products: boolean
          can_manage_protection: boolean
          can_manage_resources: boolean
          can_manage_stock: boolean
          can_manage_store: boolean
          can_view: boolean
          color: string
          created_at: string
          discord_role_id: string | null
          id: string
          name: string
          synced: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          can_change_server?: boolean
          can_manage_app?: boolean
          can_manage_bot_appearance?: boolean
          can_manage_ecloud?: boolean
          can_manage_permissions?: boolean
          can_manage_products?: boolean
          can_manage_protection?: boolean
          can_manage_resources?: boolean
          can_manage_stock?: boolean
          can_manage_store?: boolean
          can_view?: boolean
          color?: string
          created_at?: string
          discord_role_id?: string | null
          id?: string
          name: string
          synced?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          can_change_server?: boolean
          can_manage_app?: boolean
          can_manage_bot_appearance?: boolean
          can_manage_ecloud?: boolean
          can_manage_permissions?: boolean
          can_manage_products?: boolean
          can_manage_protection?: boolean
          can_manage_resources?: boolean
          can_manage_stock?: boolean
          can_manage_store?: boolean
          can_view?: boolean
          color?: string
          created_at?: string
          discord_role_id?: string | null
          id?: string
          name?: string
          synced?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          affiliate_active: boolean
          banner_url: string | null
          bot_avatar_url: string | null
          bot_banner_url: string | null
          bot_client_id: string | null
          bot_name: string | null
          bot_prefix: string | null
          bot_status: string | null
          bot_status_interval: number | null
          bot_token_encrypted: string | null
          created_at: string
          discord_guild_id: string | null
          ecloud_custom_url: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          owner_discord_id: string | null
          owner_discord_username: string | null
          pix_key: string | null
          pix_key_type: string | null
          plan: string | null
          plan_expires_at: string | null
          plan_started_at: string | null
          primary_color: string | null
          referral_code: string | null
          referral_credits_cents: number
          referred_by_tenant_id: string | null
          secondary_color: string | null
          updated_at: string
          verify_button_label: string | null
          verify_button_style: string | null
          verify_channel_id: string | null
          verify_description: string | null
          verify_embed_color: string | null
          verify_enabled: boolean | null
          verify_image_url: string | null
          verify_logs_channel_id: string | null
          verify_redirect_url: string | null
          verify_role_id: string | null
          verify_slug: string | null
          verify_title: string | null
          whatsapp: string | null
        }
        Insert: {
          affiliate_active?: boolean
          banner_url?: string | null
          bot_avatar_url?: string | null
          bot_banner_url?: string | null
          bot_client_id?: string | null
          bot_name?: string | null
          bot_prefix?: string | null
          bot_status?: string | null
          bot_status_interval?: number | null
          bot_token_encrypted?: string | null
          created_at?: string
          discord_guild_id?: string | null
          ecloud_custom_url?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_discord_id?: string | null
          owner_discord_username?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          plan?: string | null
          plan_expires_at?: string | null
          plan_started_at?: string | null
          primary_color?: string | null
          referral_code?: string | null
          referral_credits_cents?: number
          referred_by_tenant_id?: string | null
          secondary_color?: string | null
          updated_at?: string
          verify_button_label?: string | null
          verify_button_style?: string | null
          verify_channel_id?: string | null
          verify_description?: string | null
          verify_embed_color?: string | null
          verify_enabled?: boolean | null
          verify_image_url?: string | null
          verify_logs_channel_id?: string | null
          verify_redirect_url?: string | null
          verify_role_id?: string | null
          verify_slug?: string | null
          verify_title?: string | null
          whatsapp?: string | null
        }
        Update: {
          affiliate_active?: boolean
          banner_url?: string | null
          bot_avatar_url?: string | null
          bot_banner_url?: string | null
          bot_client_id?: string | null
          bot_name?: string | null
          bot_prefix?: string | null
          bot_status?: string | null
          bot_status_interval?: number | null
          bot_token_encrypted?: string | null
          created_at?: string
          discord_guild_id?: string | null
          ecloud_custom_url?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_discord_id?: string | null
          owner_discord_username?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          plan?: string | null
          plan_expires_at?: string | null
          plan_started_at?: string | null
          primary_color?: string | null
          referral_code?: string | null
          referral_credits_cents?: number
          referred_by_tenant_id?: string | null
          secondary_color?: string | null
          updated_at?: string
          verify_button_label?: string | null
          verify_button_style?: string | null
          verify_channel_id?: string | null
          verify_description?: string | null
          verify_embed_color?: string | null
          verify_enabled?: boolean | null
          verify_image_url?: string | null
          verify_logs_channel_id?: string | null
          verify_redirect_url?: string | null
          verify_role_id?: string | null
          verify_slug?: string | null
          verify_title?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_referred_by_tenant_id_fkey"
            columns: ["referred_by_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          discord_channel_id: string | null
          discord_user_id: string
          discord_username: string | null
          id: string
          order_id: string | null
          product_name: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          discord_channel_id?: string | null
          discord_user_id: string
          discord_username?: string | null
          id?: string
          order_id?: string | null
          product_name?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          discord_channel_id?: string | null
          discord_user_id?: string
          discord_username?: string | null
          id?: string
          order_id?: string | null
          product_name?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorials: {
        Row: {
          active: boolean
          cover_url: string | null
          created_at: string
          id: string
          sort_order: number | null
          title: string
          updated_at: string
          video_type: string
          video_url: string | null
        }
        Insert: {
          active?: boolean
          cover_url?: string | null
          created_at?: string
          id?: string
          sort_order?: number | null
          title: string
          updated_at?: string
          video_type?: string
          video_url?: string | null
        }
        Update: {
          active?: boolean
          cover_url?: string | null
          created_at?: string
          id?: string
          sort_order?: number | null
          title?: string
          updated_at?: string
          video_type?: string
          video_url?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      verified_members: {
        Row: {
          access_token_encrypted: string | null
          created_at: string
          discord_avatar: string | null
          discord_user_id: string
          discord_username: string | null
          id: string
          last_restore_at: string | null
          nickname: string | null
          refresh_token_encrypted: string | null
          roles_backup: Json | null
          tenant_id: string
          token_expires_at: string | null
          updated_at: string
          verified_at: string
        }
        Insert: {
          access_token_encrypted?: string | null
          created_at?: string
          discord_avatar?: string | null
          discord_user_id: string
          discord_username?: string | null
          id?: string
          last_restore_at?: string | null
          nickname?: string | null
          refresh_token_encrypted?: string | null
          roles_backup?: Json | null
          tenant_id: string
          token_expires_at?: string | null
          updated_at?: string
          verified_at?: string
        }
        Update: {
          access_token_encrypted?: string | null
          created_at?: string
          discord_avatar?: string | null
          discord_user_id?: string
          discord_username?: string | null
          id?: string
          last_restore_at?: string | null
          nickname?: string | null
          refresh_token_encrypted?: string | null
          roles_backup?: Json | null
          tenant_id?: string
          token_expires_at?: string | null
          updated_at?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verified_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount_cents: number
          created_at: string
          description: string | null
          id: string
          pix_key: string | null
          status: string
          tenant_id: string
          type: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          description?: string | null
          id?: string
          pix_key?: string | null
          status?: string
          tenant_id: string
          type: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string | null
          id?: string
          pix_key?: string | null
          status?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance_cents: number
          created_at: string
          id: string
          tenant_id: string
          total_earned_cents: number
          total_withdrawn_cents: number
          updated_at: string
        }
        Insert: {
          balance_cents?: number
          created_at?: string
          id?: string
          tenant_id: string
          total_earned_cents?: number
          total_withdrawn_cents?: number
          updated_at?: string
        }
        Update: {
          balance_cents?: number
          created_at?: string
          id?: string
          tenant_id?: string
          total_earned_cents?: number
          total_withdrawn_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string
          event_type: string | null
          id: string
          payload: Json
          provider_key: string
          result: Json | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          event_type?: string | null
          id?: string
          payload?: Json
          provider_key: string
          result?: Json | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          event_type?: string | null
          id?: string
          payload?: Json
          provider_key?: string
          result?: Json | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      welcome_configs: {
        Row: {
          auto_role_enabled: boolean
          auto_role_id: string | null
          channel_enabled: boolean
          channel_id: string | null
          content: string | null
          created_at: string
          dm_content: string | null
          dm_embed_data: Json
          dm_enabled: boolean
          embed_data: Json
          enabled: boolean
          goodbye_channel_id: string | null
          goodbye_content: string | null
          goodbye_embed_data: Json
          goodbye_enabled: boolean
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          auto_role_enabled?: boolean
          auto_role_id?: string | null
          channel_enabled?: boolean
          channel_id?: string | null
          content?: string | null
          created_at?: string
          dm_content?: string | null
          dm_embed_data?: Json
          dm_enabled?: boolean
          embed_data?: Json
          enabled?: boolean
          goodbye_channel_id?: string | null
          goodbye_content?: string | null
          goodbye_embed_data?: Json
          goodbye_enabled?: boolean
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          auto_role_enabled?: boolean
          auto_role_id?: string | null
          channel_enabled?: boolean
          channel_id?: string | null
          content?: string | null
          created_at?: string
          dm_content?: string | null
          dm_embed_data?: Json
          dm_enabled?: boolean
          embed_data?: Json
          enabled?: boolean
          goodbye_channel_id?: string | null
          goodbye_content?: string | null
          goodbye_embed_data?: Json
          goodbye_enabled?: boolean
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "welcome_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "support" | "super_admin"
      coupon_type: "percent" | "fixed"
      hook_type:
        | "add_role"
        | "remove_role"
        | "send_dm"
        | "send_channel_message"
        | "call_webhook"
      order_status:
        | "pending_payment"
        | "paid"
        | "delivering"
        | "delivered"
        | "canceled"
        | "refunded"
      product_type: "digital_auto" | "service" | "hybrid"
      ticket_status: "open" | "in_progress" | "delivered" | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "support", "super_admin"],
      coupon_type: ["percent", "fixed"],
      hook_type: [
        "add_role",
        "remove_role",
        "send_dm",
        "send_channel_message",
        "call_webhook",
      ],
      order_status: [
        "pending_payment",
        "paid",
        "delivering",
        "delivered",
        "canceled",
        "refunded",
      ],
      product_type: ["digital_auto", "service", "hybrid"],
      ticket_status: ["open", "in_progress", "delivered", "closed"],
    },
  },
} as const
