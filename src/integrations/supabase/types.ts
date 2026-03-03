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
      affiliates: {
        Row: {
          active: boolean
          code: string
          commission_percent: number
          created_at: string
          id: string
          name: string
          tenant_id: string
          total_revenue_cents: number
          total_sales: number
        }
        Insert: {
          active?: boolean
          code: string
          commission_percent?: number
          created_at?: string
          id?: string
          name: string
          tenant_id: string
          total_revenue_cents?: number
          total_sales?: number
        }
        Update: {
          active?: boolean
          code?: string
          commission_percent?: number
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          total_revenue_cents?: number
          total_sales?: number
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
      orders: {
        Row: {
          affiliate_id: string | null
          coupon_id: string | null
          created_at: string
          discord_user_id: string
          discord_username: string | null
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
          coupon_id?: string | null
          created_at?: string
          discord_user_id: string
          discord_username?: string | null
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
          coupon_id?: string | null
          created_at?: string
          discord_user_id?: string
          discord_username?: string | null
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
          compare_price_cents: number | null
          created_at: string
          description: string | null
          emoji: string | null
          enable_credits: boolean
          enable_instructions: boolean
          id: string
          is_subscription: boolean
          max_quantity: number | null
          min_quantity: number | null
          name: string
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
          compare_price_cents?: number | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          enable_credits?: boolean
          enable_instructions?: boolean
          id?: string
          is_subscription?: boolean
          max_quantity?: number | null
          min_quantity?: number | null
          name: string
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
          compare_price_cents?: number | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          enable_credits?: boolean
          enable_instructions?: boolean
          id?: string
          is_subscription?: boolean
          max_quantity?: number | null
          min_quantity?: number | null
          name?: string
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
      product_stock_items: {
        Row: {
          content: string
          created_at: string
          delivered: boolean
          delivered_at: string | null
          delivered_to: string | null
          field_id: string
          id: string
          tenant_id: string
        }
        Insert: {
          content: string
          created_at?: string
          delivered?: boolean
          delivered_at?: string | null
          delivered_to?: string | null
          field_id: string
          id?: string
          tenant_id: string
        }
        Update: {
          content?: string
          created_at?: string
          delivered?: boolean
          delivered_at?: string | null
          delivered_to?: string | null
          field_id?: string
          id?: string
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
          category_id: string | null
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          name: string
          price_cents: number
          stock: number | null
          tenant_id: string
          type: Database["public"]["Enums"]["product_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          auto_delivery?: boolean
          banner_url?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          name: string
          price_cents?: number
          stock?: number | null
          tenant_id: string
          type?: Database["public"]["Enums"]["product_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          auto_delivery?: boolean
          banner_url?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          name?: string
          price_cents?: number
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
          banner_url: string | null
          bot_client_id: string | null
          bot_prefix: string | null
          bot_status: string | null
          bot_status_interval: number | null
          bot_token_encrypted: string | null
          created_at: string
          discord_guild_id: string | null
          ecloud_custom_url: string | null
          id: string
          logo_url: string | null
          name: string
          pix_key: string | null
          pix_key_type: string | null
          plan: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string
          verify_enabled: boolean | null
          verify_redirect_url: string | null
          verify_role_id: string | null
        }
        Insert: {
          banner_url?: string | null
          bot_client_id?: string | null
          bot_prefix?: string | null
          bot_status?: string | null
          bot_status_interval?: number | null
          bot_token_encrypted?: string | null
          created_at?: string
          discord_guild_id?: string | null
          ecloud_custom_url?: string | null
          id?: string
          logo_url?: string | null
          name: string
          pix_key?: string | null
          pix_key_type?: string | null
          plan?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          verify_enabled?: boolean | null
          verify_redirect_url?: string | null
          verify_role_id?: string | null
        }
        Update: {
          banner_url?: string | null
          bot_client_id?: string | null
          bot_prefix?: string | null
          bot_status?: string | null
          bot_status_interval?: number | null
          bot_token_encrypted?: string | null
          created_at?: string
          discord_guild_id?: string | null
          ecloud_custom_url?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          pix_key?: string | null
          pix_key_type?: string | null
          plan?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          verify_enabled?: boolean | null
          verify_redirect_url?: string | null
          verify_role_id?: string | null
        }
        Relationships: []
      }
      tickets: {
        Row: {
          created_at: string
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
          created_at?: string
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
          created_at?: string
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
      vip_members: {
        Row: {
          active: boolean
          created_at: string
          discord_user_id: string
          discord_username: string | null
          expires_at: string
          id: string
          plan_id: string
          started_at: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          discord_user_id: string
          discord_username?: string | null
          expires_at: string
          id?: string
          plan_id: string
          started_at?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          discord_user_id?: string
          discord_username?: string | null
          expires_at?: string
          id?: string
          plan_id?: string
          started_at?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vip_members_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "vip_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vip_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vip_plans: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          discord_role_id: string | null
          duration_days: number
          id: string
          name: string
          price_cents: number
          sort_order: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          discord_role_id?: string | null
          duration_days?: number
          id?: string
          name: string
          price_cents?: number
          sort_order?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          discord_role_id?: string | null
          duration_days?: number
          id?: string
          name?: string
          price_cents?: number
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vip_plans_tenant_id_fkey"
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
