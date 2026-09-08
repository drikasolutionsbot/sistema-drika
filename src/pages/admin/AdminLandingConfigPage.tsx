import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Users, TrendingUp, Package, Video, Save, Upload, Link, Loader2, Crown, Sparkles, Gem, Eye, EyeOff } from "lucide-react";
import { logAudit } from "@/lib/auditLog";

const AdminLandingConfigPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [proPriceInput, setProPriceInput] = useState("12.99");
  const [proQuarterlyPriceInput, setProQuarterlyPriceInput] = useState("34.90");
  const [proSemiannualPriceInput, setProSemiannualPriceInput] = useState("59.90");

  const [masterPriceInput, setMasterPriceInput] = useState("26.99");
  const [masterQuarterlyPriceInput, setMasterQuarterlyPriceInput] = useState("72.90");
  const [masterSemiannualPriceInput, setMasterSemiannualPriceInput] = useState("129.90");

  const [form, setForm] = useState({
    stat_servers: 120,
    stat_servers_label: "Servidores ativos",
    stat_sales: 500,
    stat_sales_label: "Vendas processadas",
    stat_products: 1200,
    stat_products_label: "Produtos entregues",
    video_url: "",
    video_type: "url" as "url" | "file",
    pro_price_cents: 1299,
    pro_quarterly_price_cents: 3490,
    pro_semiannual_price_cents: 5990,
    master_price_cents: 2699,
    master_quarterly_price_cents: 7290,
    master_semiannual_price_cents: 12990,
    pro_plan_name: "Básico",
    master_plan_name: "Master",
    show_pro_plan: true,
    show_master_plan: true,
    show_trial: true,
    allow_customization_on_trial: false,
    is_free_system: false,
  });

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("landing_config")
        .select("*")
        .limit(1)
        .single();
      if (data) {
        setConfigId(data.id);
        setForm({
          stat_servers: data.stat_servers,
          stat_servers_label: data.stat_servers_label,
          stat_sales: data.stat_sales,
          stat_sales_label: data.stat_sales_label,
          stat_products: data.stat_products,
          stat_products_label: data.stat_products_label,
          video_url: data.video_url || "",
          video_type: (data.video_type as "url" | "file") || "url",
          pro_price_cents: data.pro_price_cents || 1299,
          pro_quarterly_price_cents: (data as any).pro_quarterly_price_cents || 3490,
          pro_semiannual_price_cents: (data as any).pro_semiannual_price_cents || 5990,
          master_price_cents: (data as any).master_price_cents || 2699,
          master_quarterly_price_cents: (data as any).master_quarterly_price_cents || 7290,
          master_semiannual_price_cents: (data as any).master_semiannual_price_cents || 12990,
          pro_plan_name: (data as any).pro_plan_name || "Básico",
          master_plan_name: (data as any).master_plan_name || "Master",
          show_pro_plan: (data as any).show_pro_plan !== false,
          show_master_plan: (data as any).show_master_plan !== false,
          show_trial: (data as any).show_trial !== false,
          allow_customization_on_trial: (data as any).allow_customization_on_trial === true,
          is_free_system: (data as any).is_free_system === true,
        });
        setProPriceInput(((data.pro_price_cents || 1299) / 100).toFixed(2));
        setProQuarterlyPriceInput((((data as any).pro_quarterly_price_cents || 3490) / 100).toFixed(2));
        setProSemiannualPriceInput((((data as any).pro_semiannual_price_cents || 5990) / 100).toFixed(2));

        setMasterPriceInput((((data as any).master_price_cents || 2699) / 100).toFixed(2));
        setMasterQuarterlyPriceInput((((data as any).master_quarterly_price_cents || 7290) / 100).toFixed(2));
        setMasterSemiannualPriceInput((((data as any).master_semiannual_price_cents || 12990) / 100).toFixed(2));
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSave = async () => {
    if (!configId) return;
    setSaving(true);
    const { error } = await supabase
      .from("landing_config")
      .update({
        stat_servers: form.stat_servers,
        stat_servers_label: form.stat_servers_label,
        stat_sales: form.stat_sales,
        stat_sales_label: form.stat_sales_label,
        stat_products: form.stat_products,
        stat_products_label: form.stat_products_label,
        video_url: form.video_url || null,
        video_type: form.video_type,
        pro_price_cents: form.pro_price_cents,
        pro_quarterly_price_cents: form.pro_quarterly_price_cents,
        pro_semiannual_price_cents: form.pro_semiannual_price_cents,
        master_price_cents: form.master_price_cents,
        master_quarterly_price_cents: form.master_quarterly_price_cents,
        master_semiannual_price_cents: form.master_semiannual_price_cents,
        pro_plan_name: form.pro_plan_name,
        master_plan_name: form.master_plan_name,
        show_pro_plan: form.show_pro_plan,
        show_master_plan: form.show_master_plan,
        show_trial: form.show_trial,
        allow_customization_on_trial: form.allow_customization_on_trial,
        is_free_system: form.is_free_system,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", configId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar configurações");
      console.error(error);
    } else {
      await logAudit("config_updated", "config", configId, "Landing Page", { fields: Object.keys(form) });
      toast.success("Configurações da landing page salvas!");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `landing/video_${Date.now()}.${ext}`;
    
    const { error } = await supabase.storage
      .from("tenant-assets")
      .upload(path, file, { upsert: true });
    
    if (error) {
      toast.error("Erro ao fazer upload do vídeo");
      console.error(error);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("tenant-assets")
      .getPublicUrl(path);
    
    const newUrl = urlData.publicUrl;
    setForm((prev) => ({ ...prev, video_url: newUrl, video_type: "file" }));
    
    if (configId) {
      const { error: updateError } = await supabase
        .from("landing_config")
        .update({
          video_url: newUrl,
          video_type: "file",
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", configId);
      
      if (updateError) {
        toast.error("Vídeo enviado, mas erro ao salvar no banco");
        console.error(updateError);
      } else {
        toast.success("Vídeo enviado e salvo com sucesso!");
      }
    }
    
    setUploading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Landing Page</h1>
        <p className="text-muted-foreground">Configure os dados exibidos na página inicial</p>
      </div>

      {/* Plans Configuration */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            Planos — Nome e Preço
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-xs text-muted-foreground">
            Personalize o nome e o valor mensal dos planos. Esses dados serão exibidos na landing page e cobrados no checkout via gateway de pagamento configurado.
          </p>

          {/* Trial Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-white/5 p-5 bg-background/40 backdrop-blur-sm hover:bg-background/60 hover:border-white/10 transition-all shadow-sm">
            <div className="space-y-1.5 pr-4">
              <Label className="text-sm font-bold text-foreground">Exibir Plano Trial (Gratuito)</Label>
              <p className="text-xs font-medium text-muted-foreground">
                Se ativado, o plano Trial (4 dias grátis) e o botão de cadastro gratuito serão exibidos na landing page. Se desativado, apenas os planos pagos (Pro e Master) serão mostrados.
              </p>
            </div>
            <Switch
              checked={form.show_trial}
              onCheckedChange={(checked) => setForm((p) => ({ ...p, show_trial: checked }))}
            />
          </div>

          {/* Customization on Trial Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-white/5 p-5 bg-background/40 backdrop-blur-sm hover:bg-background/60 hover:border-white/10 transition-all shadow-sm">
            <div className="space-y-1.5 pr-4">
              <Label className="text-sm font-bold text-foreground">Liberar Todas as Abas no Teste Grátis</Label>
              <p className="text-xs font-medium text-muted-foreground">
                Se ativado, os clientes poderão acessar todas as telas bloqueadas durante os 4 dias de teste. Se desativado, as telas premium (como Recursos, Loja, etc) ficarão bloqueadas exigindo plano Pro/Master.
              </p>
            </div>
            <Switch
              checked={form.allow_customization_on_trial}
              onCheckedChange={(checked) => setForm((p) => ({ ...p, allow_customization_on_trial: checked }))}
            />
          </div>

          {/* Is Free System Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-white/5 p-5 bg-background/40 backdrop-blur-sm hover:bg-background/60 hover:border-white/10 transition-all shadow-sm">
            <div className="space-y-1.5 pr-4">
              <Label className="text-sm font-bold text-foreground">Sistema 100% Gratuito</Label>
              <p className="text-xs font-medium text-muted-foreground">
                Se ativado, o sistema será 100% gratuito. Contas não terão prazo de validade ou teste de trial, não precisarão assinar plano Pro/Master, e todas as rotas estarão liberadas.
              </p>
            </div>
            <Switch
              checked={form.is_free_system}
              onCheckedChange={(checked) => setForm((p) => ({ ...p, is_free_system: checked }))}
            />
          </div>

          {/* Básico Plan */}
          <div className="relative rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6 space-y-6 overflow-hidden group transition-all hover:bg-cyan-500/10 hover:border-cyan-500/40">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full blur-[80px] pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cyan-500/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                  <Gem className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-cyan-400">💎 Plano Básico</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
                      Entrada
                    </span>
                  </div>
                  <p className="text-xs text-cyan-500/70 font-medium">Configuração de valores e visibilidade na Landing Page</p>
                </div>
              </div>

              {/* Visibility Switch */}
              <div className="flex items-center gap-3 bg-background/50 border border-cyan-500/20 rounded-xl px-4 py-2">
                <div className="text-right">
                  <p className="text-xs font-semibold text-foreground">Visibilidade</p>
                  <p className="text-[10px] text-muted-foreground">{form.show_pro_plan ? "Visível aos clientes" : "Oculto na Landing"}</p>
                </div>
                <Switch
                  checked={form.show_pro_plan}
                  onCheckedChange={(checked) => setForm((p) => ({ ...p, show_pro_plan: checked }))}
                />
              </div>
            </div>

            {/* Plan Name */}
            <div className="relative z-10 max-w-sm space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome exibido do Plano</Label>
              <Input
                value={form.pro_plan_name}
                onChange={(e) => setForm((p) => ({ ...p, pro_plan_name: e.target.value }))}
                placeholder="Básico"
                className="bg-background/50 border-cyan-500/20 focus-visible:ring-cyan-500/50"
              />
            </div>

            {/* 3 Billing Cycles */}
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Mensal */}
              <div className="p-4 rounded-xl border border-cyan-500/20 bg-background/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Ciclo Mensal</span>
                  <span className="text-[10px] text-muted-foreground font-mono">30 dias</span>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Valor em R$</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={proPriceInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(",", ".");
                      if (/^\d*\.?\d{0,2}$/.test(val) || val === "") {
                        setProPriceInput(val);
                        const num = parseFloat(val || "0");
                        if (!isNaN(num)) setForm((p) => ({ ...p, pro_price_cents: Math.round(num * 100) }));
                      }
                    }}
                    placeholder="12.99"
                    className="bg-background/60 border-cyan-500/30"
                  />
                </div>
                <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/25 px-3 py-2 text-xs font-bold text-cyan-400 text-center">
                  R$ {(form.pro_price_cents / 100).toFixed(2).replace(".", ",")}/mês
                </div>
              </div>

              {/* Trimestral */}
              <div className="p-4 rounded-xl border border-cyan-500/20 bg-background/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Ciclo Trimestral</span>
                  <span className="text-[10px] text-muted-foreground font-mono">90 dias</span>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Valor em R$</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={proQuarterlyPriceInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(",", ".");
                      if (/^\d*\.?\d{0,2}$/.test(val) || val === "") {
                        setProQuarterlyPriceInput(val);
                        const num = parseFloat(val || "0");
                        if (!isNaN(num)) setForm((p) => ({ ...p, pro_quarterly_price_cents: Math.round(num * 100) }));
                      }
                    }}
                    placeholder="34.90"
                    className="bg-background/60 border-cyan-500/30"
                  />
                </div>
                <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/25 px-3 py-2 text-xs font-bold text-cyan-400 text-center">
                  R$ {(form.pro_quarterly_price_cents / 100).toFixed(2).replace(".", ",")} (~R$ {(form.pro_quarterly_price_cents / 300).toFixed(2).replace(".", ",")}/mês)
                </div>
              </div>

              {/* Semestral */}
              <div className="p-4 rounded-xl border border-cyan-500/20 bg-background/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Ciclo Semestral</span>
                  <span className="text-[10px] text-muted-foreground font-mono">180 dias</span>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Valor em R$</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={proSemiannualPriceInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(",", ".");
                      if (/^\d*\.?\d{0,2}$/.test(val) || val === "") {
                        setProSemiannualPriceInput(val);
                        const num = parseFloat(val || "0");
                        if (!isNaN(num)) setForm((p) => ({ ...p, pro_semiannual_price_cents: Math.round(num * 100) }));
                      }
                    }}
                    placeholder="59.90"
                    className="bg-background/60 border-cyan-500/30"
                  />
                </div>
                <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/25 px-3 py-2 text-xs font-bold text-cyan-400 text-center">
                  R$ {(form.pro_semiannual_price_cents / 100).toFixed(2).replace(".", ",")} (~R$ {(form.pro_semiannual_price_cents / 600).toFixed(2).replace(".", ",")}/mês)
                </div>
              </div>
            </div>
          </div>

          {/* Master Plan */}
          <div className="relative rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 space-y-6 overflow-hidden group transition-all hover:bg-amber-500/10 hover:border-amber-500/40">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-full blur-[80px] pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                  <Crown className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-amber-400">👑 Plano Master</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
                      Premium
                    </span>
                  </div>
                  <p className="text-xs text-amber-500/70 font-medium">Acesso total, capa personalizada e IA ilimitada</p>
                </div>
              </div>

              {/* Visibility Switch */}
              <div className="flex items-center gap-3 bg-background/50 border border-amber-500/20 rounded-xl px-4 py-2">
                <div className="text-right">
                  <p className="text-xs font-semibold text-foreground">Visibilidade</p>
                  <p className="text-[10px] text-muted-foreground">{form.show_master_plan ? "Visível aos clientes" : "Oculto na Landing"}</p>
                </div>
                <Switch
                  checked={form.show_master_plan}
                  onCheckedChange={(checked) => setForm((p) => ({ ...p, show_master_plan: checked }))}
                />
              </div>
            </div>

            {/* Plan Name */}
            <div className="relative z-10 max-w-sm space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome exibido do Plano</Label>
              <Input
                value={form.master_plan_name}
                onChange={(e) => setForm((p) => ({ ...p, master_plan_name: e.target.value }))}
                placeholder="Master"
                className="bg-background/50 border-amber-500/20 focus-visible:ring-amber-500/50"
              />
            </div>

            {/* 3 Billing Cycles */}
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Mensal */}
              <div className="p-4 rounded-xl border border-amber-500/20 bg-background/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Ciclo Mensal</span>
                  <span className="text-[10px] text-muted-foreground font-mono">30 dias</span>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Valor em R$</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={masterPriceInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(",", ".");
                      if (/^\d*\.?\d{0,2}$/.test(val) || val === "") {
                        setMasterPriceInput(val);
                        const num = parseFloat(val || "0");
                        if (!isNaN(num)) setForm((p) => ({ ...p, master_price_cents: Math.round(num * 100) }));
                      }
                    }}
                    placeholder="26.99"
                    className="bg-background/60 border-amber-500/30"
                  />
                </div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-xs font-bold text-amber-400 text-center">
                  R$ {(form.master_price_cents / 100).toFixed(2).replace(".", ",")}/mês
                </div>
              </div>

              {/* Trimestral */}
              <div className="p-4 rounded-xl border border-amber-500/20 bg-background/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Ciclo Trimestral</span>
                  <span className="text-[10px] text-muted-foreground font-mono">90 dias</span>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Valor em R$</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={masterQuarterlyPriceInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(",", ".");
                      if (/^\d*\.?\d{0,2}$/.test(val) || val === "") {
                        setMasterQuarterlyPriceInput(val);
                        const num = parseFloat(val || "0");
                        if (!isNaN(num)) setForm((p) => ({ ...p, master_quarterly_price_cents: Math.round(num * 100) }));
                      }
                    }}
                    placeholder="72.90"
                    className="bg-background/60 border-amber-500/30"
                  />
                </div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-xs font-bold text-amber-400 text-center">
                  R$ {(form.master_quarterly_price_cents / 100).toFixed(2).replace(".", ",")} (~R$ {(form.master_quarterly_price_cents / 300).toFixed(2).replace(".", ",")}/mês)
                </div>
              </div>

              {/* Semestral */}
              <div className="p-4 rounded-xl border border-amber-500/20 bg-background/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Ciclo Semestral</span>
                  <span className="text-[10px] text-muted-foreground font-mono">180 dias</span>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Valor em R$</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={masterSemiannualPriceInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(",", ".");
                      if (/^\d*\.?\d{0,2}$/.test(val) || val === "") {
                        setMasterSemiannualPriceInput(val);
                        const num = parseFloat(val || "0");
                        if (!isNaN(num)) setForm((p) => ({ ...p, master_semiannual_price_cents: Math.round(num * 100) }));
                      }
                    }}
                    placeholder="129.90"
                    className="bg-background/60 border-amber-500/30"
                  />
                </div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-xs font-bold text-amber-400 text-center">
                  R$ {(form.master_semiannual_price_cents / 100).toFixed(2).replace(".", ",")} (~R$ {(form.master_semiannual_price_cents / 600).toFixed(2).replace(".", ",")}/mês)
                </div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" /> Inclui capa pessoal do bot por loja e créditos de IA ilimitados.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Social Proof Stats */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Prova Social — Estatísticas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stat 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Número</Label>
                <Input
                  type="number"
                  value={form.stat_servers}
                  onChange={(e) => setForm((p) => ({ ...p, stat_servers: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Label</Label>
              <Input
                value={form.stat_servers_label}
                onChange={(e) => setForm((p) => ({ ...p, stat_servers_label: e.target.value }))}
              />
            </div>
          </div>

          {/* Stat 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Número</Label>
                <Input
                  type="number"
                  value={form.stat_sales}
                  onChange={(e) => setForm((p) => ({ ...p, stat_sales: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Label</Label>
              <Input
                value={form.stat_sales_label}
                onChange={(e) => setForm((p) => ({ ...p, stat_sales_label: e.target.value }))}
              />
            </div>
          </div>

          {/* Stat 3 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Número</Label>
                <Input
                  type="number"
                  value={form.stat_products}
                  onChange={(e) => setForm((p) => ({ ...p, stat_products: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Label</Label>
              <Input
                value={form.stat_products_label}
                onChange={(e) => setForm((p) => ({ ...p, stat_products_label: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Video Config */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Video className="h-4 w-4 text-primary" />
            Vídeo — "Veja o bot funcionando"
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Cole um link de vídeo (YouTube, etc.) ou faça upload de um arquivo de vídeo. Esse vídeo será exibido em um modal na landing page.
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Link className="h-3 w-3" /> Link do vídeo (YouTube, MP4, etc.)
            </Label>
            <Input
              placeholder="https://www.youtube.com/watch?v=..."
              value={form.video_url}
              onChange={(e) => setForm((p) => ({ ...p, video_url: e.target.value, video_type: "url" }))}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <Upload className="h-3 w-3" /> Upload de arquivo de vídeo
            </Label>
            <label className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              {uploading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Enviando...</span>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Clique para selecionar um vídeo</span>
                </>
              )}
            </label>
            <p className="text-[10px] text-muted-foreground mt-1">Sem restrição de tamanho. Formatos: MP4, MOV, WebM, etc.</p>
          </div>

          {form.video_url && (
            <div className="p-3 rounded-lg border border-border bg-muted/30">
              <Label className="text-xs text-muted-foreground mb-1 block">URL configurada:</Label>
              <p className="text-xs text-foreground break-all font-mono">{form.video_url}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
};

export default AdminLandingConfigPage;
