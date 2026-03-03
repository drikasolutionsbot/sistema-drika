import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "idle" | "loading" | "success" | "error";

const VerifyPage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>("idle");
  const [tenantName, setTenantName] = useState("");
  const [username, setUsername] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const tenantId = searchParams.get("tenant_id");
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");

  useEffect(() => {
    // If we have a code and state, process the callback
    if (code && stateParam) {
      processCallback();
    } else if (tenantId) {
      fetchTenantInfo();
    }
  }, [code, stateParam, tenantId]);

  const fetchTenantInfo = async () => {
    if (!tenantId) return;
    const { data } = await supabase.functions.invoke("get-tenant", {
      body: { tenant_id: tenantId },
    });
    if (data?.name) setTenantName(data.name);
  };

  const processCallback = async () => {
    setStatus("loading");
    try {
      let tid = tenantId;
      if (stateParam) {
        try {
          const stateData = JSON.parse(atob(stateParam));
          tid = stateData.tenant_id;
        } catch {}
      }

      if (!tid || !code) throw new Error("Dados inválidos");

      const { data, error } = await supabase.functions.invoke("verify-member", {
        body: { action: "callback", code, tenant_id: tid },
      });

      if (error || data?.error) throw new Error(data?.error || "Erro na verificação");

      setUsername(data.username);
      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro desconhecido");
      setStatus("error");
    }
  };

  const handleVerify = () => {
    if (!tenantId) return;
    // Redirect to the edge function which will redirect to Discord
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    window.location.href = `${supabaseUrl}/functions/v1/verify-member?tenant_id=${tenantId}`;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary" />
          </div>
        </div>

        {status === "idle" && (
          <>
            <div>
              <h1 className="text-2xl font-bold font-display">Verificação de Membro</h1>
              {tenantName && (
                <p className="text-muted-foreground mt-2">
                  Verifique-se no servidor <span className="font-semibold text-foreground">{tenantName}</span>
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-3">
                Ao verificar, seus cargos serão salvos automaticamente como backup. 
                Se você sair do servidor, eles poderão ser restaurados.
              </p>
            </div>
            <Button onClick={handleVerify} size="lg" className="w-full gap-2" disabled={!tenantId}>
              <Shield className="h-5 w-5" />
              Verificar com Discord
            </Button>
          </>
        )}

        {status === "loading" && (
          <div className="space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Processando verificação...</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
            <h2 className="text-xl font-bold">Verificado com sucesso!</h2>
            <p className="text-muted-foreground">
              Bem-vindo, <span className="font-semibold text-foreground">{username}</span>! 
              Seus cargos foram salvos como backup.
            </p>
            <p className="text-xs text-muted-foreground">Você pode fechar esta página.</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <XCircle className="h-12 w-12 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold">Erro na Verificação</h2>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyPage;
