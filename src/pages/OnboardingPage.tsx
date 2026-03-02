import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  Server,
  Palette,
  Package,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
}

const STEPS = [
  { icon: Server, label: "Servidor" },
  { icon: Palette, label: "Loja" },
  { icon: Package, label: "Produto" },
  { icon: CreditCard, label: "Pagamento" },
];

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { user, providerToken } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1 - Discord Server
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [guildsLoading, setGuildsLoading] = useState(true);
  const [selectedGuild, setSelectedGuild] = useState<DiscordGuild | null>(null);

  // Step 2 - Store Info
  const [storeName, setStoreName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#FF69B4");
  const [secondaryColor, setSecondaryColor] = useState("#FFD700");

  // Step 3 - First Product
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productDesc, setProductDesc] = useState("");

  // Step 4 - Payment (optional)
  const [paymentProvider, setPaymentProvider] = useState("mercadopago");

  // Tenant created
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    fetchGuilds();
  }, []);

  const fetchGuilds = async () => {
    if (!providerToken) {
      setGuildsLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("discord-guilds", {
        body: { provider_token: providerToken },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setGuilds(data || []);
    } catch (err: any) {
      console.error("Error fetching guilds:", err);
      toast({ title: "Erro ao buscar servidores", description: err.message, variant: "destructive" });
    } finally {
      setGuildsLoading(false);
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
      setStep(2);
    } catch (err: any) {
      toast({ title: "Erro ao criar loja", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async () => {
    if (!tenantId || !productName.trim()) {
      setStep(3);
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
      setStep(3);
    } catch (err: any) {
      toast({ title: "Erro ao criar produto", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    navigate("/dashboard");
  };

  const canProceedStep0 = !!selectedGuild;
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
          {/* Step 0: Select Server */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold">Selecione seu servidor</h2>
                <p className="text-muted-foreground mt-1">
                  Escolha o servidor Discord que será vinculado à sua loja
                </p>
              </div>

              {!providerToken ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                  <p className="text-muted-foreground">
                    Token do Discord expirado. Faça login novamente.
                  </p>
                  <Button onClick={() => navigate("/login")} variant="outline">
                    Voltar ao Login
                  </Button>
                </div>
              ) : guildsLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-xl" />
                  ))}
                </div>
              ) : guilds.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground">
                    Nenhum servidor encontrado onde você é administrador.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 max-h-80 overflow-y-auto">
                  {guilds.map((guild) => (
                    <button
                      key={guild.id}
                      onClick={() => setSelectedGuild(guild)}
                      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all hover:border-primary/50 hover:bg-muted/50 ${
                        selectedGuild?.id === guild.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border"
                      }`}
                    >
                      {guild.icon ? (
                        <img
                          src={guild.icon}
                          alt={guild.name}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold">
                          {guild.name[0]}
                        </div>
                      )}
                      <span className="text-sm font-medium truncate">{guild.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={() => setStep(1)} disabled={!canProceedStep0} className="gap-2 gradient-pink text-primary-foreground">
                  Continuar <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
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

          {/* Step 2: First Product (optional) */}
          {step === 2 && (
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
                <Button variant="ghost" onClick={() => setStep(3)} className="text-muted-foreground">
                  Pular
                </Button>
                <Button
                  onClick={handleCreateProduct}
                  disabled={!productName.trim() || loading}
                  className="gap-2 gradient-pink text-primary-foreground"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Criar Produto <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Payment Setup (info only) */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold">Tudo pronto! 🎉</h2>
                <p className="text-muted-foreground mt-1">
                  Sua loja foi configurada. Configure pagamentos e mais opções no painel.
                </p>
              </div>

              <div className="rounded-xl border border-border p-6 space-y-4 text-center">
                <div className="flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full gradient-pink">
                    <Check className="h-8 w-8 text-primary-foreground" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-lg">{storeName}</p>
                  <p className="text-sm text-muted-foreground">
                    Servidor: {selectedGuild?.name}
                  </p>
                </div>
              </div>

              <div className="flex justify-center">
                <Button onClick={handleFinish} className="gap-2 gradient-pink text-primary-foreground px-8">
                  Ir para o Dashboard <ChevronRight className="h-4 w-4" />
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
