import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Server,
  Palette,
  Package,
  Hash,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  ExternalLink,
} from "lucide-react";

const DISCORD_CLIENT_ID = "1477916070508757092";
const BOT_PERMISSIONS = "8"; // Administrator

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
}

interface DiscordChannel {
  id: string;
  name: string;
  parent_id: string | null;
  position: number;
}

interface DiscordCategory {
  id: string;
  name: string;
  position: number;
}

const STEPS = [
  { icon: Server, label: "Servidor" },
  { icon: Palette, label: "Loja" },
  { icon: Hash, label: "Canais" },
  { icon: Package, label: "Produto" },
];

const CHANNEL_MAPPINGS = [
  { key: "logs_sales", label: "Logs de Vendas", description: "Canal para registrar todas as vendas" },
  { key: "welcome", label: "Boas-vindas", description: "Canal de boas-vindas para novos membros" },
  { key: "support_tickets", label: "Suporte / Tickets", description: "Canal para tickets de suporte" },
  { key: "logs_moderation_bans", label: "Moderação", description: "Canal de logs de moderação" },
];

const OnboardingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 0 - Discord Server (via bot auth redirect)
  const [selectedGuild, setSelectedGuild] = useState<DiscordGuild | null>(null);
  const [guildLoading, setGuildLoading] = useState(false);

  // Step 1 - Store Info
  const [storeName, setStoreName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#FF69B4");
  const [secondaryColor, setSecondaryColor] = useState("#FFD700");

  // Step 2 - Channel Mapping
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [categories, setCategories] = useState<DiscordCategory[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelSelections, setChannelSelections] = useState<Record<string, string>>({});

  // Step 3 - First Product
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productDesc, setProductDesc] = useState("");

  // Tenant created
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Check for guild_id from Discord bot authorization redirect
  useEffect(() => {
    const guildId = searchParams.get("guild_id");
    if (guildId) {
      fetchGuildInfo(guildId);
    }
  }, [searchParams]);

  const fetchGuildInfo = async (guildId: string) => {
    setGuildLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("discord-guild-info", {
        body: { guild_id: guildId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSelectedGuild(data);
      setStep(1); // Auto-advance to store setup
    } catch (err: any) {
      console.error("Error fetching guild info:", err);
      toast({ title: "Erro ao buscar servidor", description: err.message, variant: "destructive" });
    } finally {
      setGuildLoading(false);
    }
  };

  const handleAddBot = () => {
    const url = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&permissions=${BOT_PERMISSIONS}&scope=bot%20applications.commands`;
    window.location.href = url;
  };

  const fetchChannels = async (guildId: string) => {
    setChannelsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("discord-channels", {
        body: { guild_id: guildId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setChannels(data?.channels || []);
      setCategories(data?.categories || []);
    } catch (err: any) {
      console.error("Error fetching channels:", err);
      toast({ title: "Erro ao buscar canais", description: err.message, variant: "destructive" });
    } finally {
      setChannelsLoading(false);
    }
  };

  const handleCreateTenant = async () => {
    if (!selectedGuild || !storeName.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-tenant", {
        body: {
          name: storeName.trim(),
          discord_guild_id: selectedGuild.id,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTenantId(data.tenant.id);
      toast({ title: "Loja criada com sucesso! 🎉" });
      fetchChannels(selectedGuild.id);
      setStep(2);
    } catch (err: any) {
      toast({ title: "Erro ao criar loja", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChannels = async () => {
    if (!tenantId) {
      setStep(3);
      return;
    }
    setLoading(true);
    try {
      const entries = Object.entries(channelSelections).filter(([, v]) => v);
      if (entries.length > 0) {
        const inserts = entries.map(([channel_key, discord_channel_id]) => ({
          tenant_id: tenantId,
          channel_key,
          discord_channel_id,
        }));
        const { error } = await (supabase as any).from("channel_configs").insert(inserts);
        if (error) throw error;
        toast({ title: "Canais configurados! 📡" });
      }
      setStep(3);
    } catch (err: any) {
      toast({ title: "Erro ao salvar canais", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async () => {
    if (!tenantId || !productName.trim()) {
      handleFinish();
      return;
    }
    setLoading(true);
    try {
      const priceCents = Math.round(parseFloat(productPrice || "0") * 100);
      const { error } = await supabase.from("products").insert({
        tenant_id: tenantId,
        name: productName.trim(),
        price_cents: priceCents,
        description: productDesc || null,
        type: "digital_auto",
      } as any);
      if (error) throw error;
      toast({ title: "Produto criado! 📦" });
      handleFinish();
    } catch (err: any) {
      toast({ title: "Erro ao criar produto", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    navigate("/dashboard");
  };

  // Group channels by category
  const groupedChannels = categories
    .map((cat) => ({
      category: cat,
      channels: channels.filter((ch) => ch.parent_id === cat.id),
    }))
    .filter((g) => g.channels.length > 0);

  const uncategorized = channels.filter((ch) => !ch.parent_id);

  const canProceedStep1 = !!storeName.trim();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-secondary/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-2xl space-y-6">
        {/* Stepper */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                  i < step
                    ? "gradient-pink text-primary-foreground"
                    : i === step
                    ? "border-2 border-primary text-primary"
                    : "border border-border text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`hidden h-0.5 w-8 sm:block ${i < step ? "gradient-pink" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-lg animate-fade-in">
          {/* Step 0: Add Bot to Server */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold">Adicione o bot ao servidor</h2>
                <p className="text-muted-foreground mt-1">
                  Clique no botão abaixo para adicionar o bot e selecionar seu servidor diretamente no Discord
                </p>
              </div>

              {guildLoading ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-muted-foreground">Conectando ao servidor...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#5865F2]/10">
                    <Server className="h-10 w-10 text-[#5865F2]" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center max-w-sm">
                    Você será redirecionado para o Discord para escolher o servidor e autorizar o bot
                  </p>
                  <Button
                    onClick={handleAddBot}
                    className="gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-6"
                    size="lg"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Adicionar ao Discord
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Store Setup */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold">Configure sua loja</h2>
                <p className="text-muted-foreground mt-1">
                  Personalize o nome e as cores da sua loja
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="storeName">Nome da Loja *</Label>
                  <Input
                    id="storeName"
                    placeholder="Ex: Minha Loja Discord"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="primaryColor">Cor Primária</Label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="color"
                        id="primaryColor"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="h-10 w-10 cursor-pointer rounded border-none bg-transparent"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="secondaryColor">Cor Secundária</Label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="color"
                        id="secondaryColor"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="h-10 w-10 cursor-pointer rounded border-none bg-transparent"
                      />
                      <Input
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Preview card */}
                <div className="rounded-xl border border-border p-4 space-y-2">
                  <p className="text-xs text-muted-foreground">Preview</p>
                  <div className="flex items-center gap-3">
                    {selectedGuild?.icon ? (
                      <img src={selectedGuild.icon} alt="" className="h-12 w-12 rounded-full" />
                    ) : (
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full text-white font-bold"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {(storeName || "L")[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-bold" style={{ color: primaryColor }}>
                        {storeName || "Nome da Loja"}
                      </p>
                      <p className="text-xs text-muted-foreground">{selectedGuild?.name}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(0)} className="gap-2">
                  <ChevronLeft className="h-4 w-4" /> Voltar
                </Button>
                <Button
                  onClick={handleCreateTenant}
                  disabled={!canProceedStep1 || loading}
                  className="gap-2 gradient-pink text-primary-foreground"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Criar Loja <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Channel Mapping */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold">Configure os canais</h2>
                <p className="text-muted-foreground mt-1">
                  Selecione os canais do Discord para cada função — você pode alterar depois
                </p>
              </div>

              {channelsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-14 rounded-xl" />
                  ))}
                </div>
              ) : channels.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground">
                    Nenhum canal encontrado. Verifique se o bot tem permissão no servidor.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {CHANNEL_MAPPINGS.map((mapping) => (
                    <div key={mapping.key} className="space-y-1.5">
                      <Label>{mapping.label}</Label>
                      <p className="text-xs text-muted-foreground">{mapping.description}</p>
                      <Select
                        value={channelSelections[mapping.key] || ""}
                        onValueChange={(v) =>
                          setChannelSelections((prev) => ({ ...prev, [mapping.key]: v }))
                        }
                      >
                        <SelectTrigger className="bg-muted border-none">
                          <SelectValue placeholder="Selecionar canal..." />
                        </SelectTrigger>
                        <SelectContent>
                          {uncategorized.map((ch) => (
                            <SelectItem key={ch.id} value={ch.id}>
                              # {ch.name}
                            </SelectItem>
                          ))}
                          {groupedChannels.map((group) => (
                            <div key={group.category.id}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                {group.category.name}
                              </div>
                              {group.channels.map((ch) => (
                                <SelectItem key={ch.id} value={ch.id}>
                                  # {ch.name}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(3)} className="text-muted-foreground">
                  Pular
                </Button>
                <Button
                  onClick={handleSaveChannels}
                  disabled={loading}
                  className="gap-2 gradient-pink text-primary-foreground"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Salvar Canais <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: First Product (optional) */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold">Crie seu primeiro produto</h2>
                <p className="text-muted-foreground mt-1">
                  Opcional — você pode pular e fazer isso depois
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="productName">Nome do Produto</Label>
                  <Input
                    id="productName"
                    placeholder="Ex: VIP Mensal"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="productPrice">Preço (R$)</Label>
                  <Input
                    id="productPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="29.90"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="productDesc">Descrição</Label>
                  <Input
                    id="productDesc"
                    placeholder="Descrição curta do produto"
                    value={productDesc}
                    onChange={(e) => setProductDesc(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={handleFinish} className="text-muted-foreground">
                  Pular
                </Button>
                <Button
                  onClick={handleCreateProduct}
                  disabled={!productName.trim() || loading}
                  className="gap-2 gradient-pink text-primary-foreground"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Criar e Finalizar <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
