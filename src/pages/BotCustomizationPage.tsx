import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenant } from "@/contexts/TenantContext";
import { Bot, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import EditBotProfileModal from "@/components/settings/EditBotProfileModal";

const BotCustomizationPage = () => {
  const { tenant, tenantId, refetch } = useTenant();
  const [editOpen, setEditOpen] = useState(false);

  if (!tenant) return <Skeleton className="h-64" />;

  const botName = tenant.bot_name || "Drika Bot";
  const botAvatar = tenant.bot_avatar_url;
  
  const botId = (tenant as any).discord_bot_id || tenant.id;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Personalização</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure o <strong className="text-foreground">{botName}</strong> para o seu estilo.
        </p>
      </div>

      {/* Hero Card */}
      <div className="relative rounded-2xl overflow-hidden border border-border bg-card">
        <div className="flex flex-col items-center py-8 gap-3">
          {/* Avatar */}
          <div className="relative">
            {botAvatar ? (
              <img
                src={botAvatar}
                alt="Bot avatar"
                className="h-24 w-24 rounded-full object-cover border-4 border-border shadow-lg"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-muted border-4 border-border shadow-lg flex items-center justify-center">
                <Bot className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            <div className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-emerald-500 border-[3px] border-card" />
          </div>

          {/* Name */}
          <h2 className="text-xl font-bold text-foreground">{botName}</h2>

          {/* Edit Button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 mt-1"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar Perfil
          </Button>
        </div>
      </div>

      {/* Informações Card */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-base font-bold text-foreground">Informações</h3>
          <p className="text-xs text-muted-foreground">Dados da aplicação.</p>
        </div>
        <div className="divide-y divide-border">
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-muted-foreground">Nome da Aplicação</span>
            <span className="text-sm font-semibold text-foreground">{botName}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-muted-foreground">ID da Aplicação</span>
            <span className="text-sm font-mono text-foreground">{botId}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-muted-foreground">Status</span>
            <span className="text-sm font-semibold text-emerald-400">Online</span>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <EditBotProfileModal
        open={editOpen}
        onOpenChange={setEditOpen}
        tenant={tenant}
        tenantId={tenantId}
        refetchTenant={refetch}
      />
    </div>
  );
};

export default BotCustomizationPage;
