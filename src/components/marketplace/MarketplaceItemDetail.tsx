import { Badge } from "@/components/ui/badge";
import { Check, X, Shield, User, Mail, Gamepad2, Crown, Globe, Calendar, Info } from "lucide-react";

interface LztData {
  minecraft_nickname?: string;
  minecraft_id?: string;
  item_id?: number;
  // Trustworthy info fields (from LZT API)
  canChangeNickname?: boolean;
  canChangeSkin?: boolean;
  optimus?: boolean; // Java edition
  bedrock?: boolean; // Bedrock edition
  dungeons?: boolean; // Minecraft Dungeons
  legends?: boolean; // Minecraft Legends
  capes?: number;
  hypixelBan?: string;
  hypixelRank?: string | boolean;
  emailDomain?: string;
  origin?: string;
  skinUrl?: string;
  // Alternative field names
  can_change_nickname?: boolean;
  has_java?: boolean;
  has_bedrock?: boolean;
  has_dungeons?: boolean;
  has_legends?: boolean;
  cape_count?: number;
  email_domain?: string;
  account_origin?: string;
  skin_url?: string;
  hypixel_ban?: string;
  hypixel_rank?: string | boolean;
  // Registration date
  registeredAt?: string;
  registered_at?: string;
  // Generic item fields
  title?: string;
  title_translated?: string;
  title_en?: string;
  description?: string;
  description_translated?: string;
  descriptionEnPlain?: string;
  extracted_image_url?: string;
  price?: number;
  [key: string]: unknown;
}

interface MarketplaceItemDetailProps {
  title: string;
  description: string | null;
  imageUrl: string | null;
  lztData: LztData | null;
  priceCents: number;
}

const BoolField = ({ label, value, icon }: { label: string; value: boolean | undefined; icon?: React.ReactNode }) => {
  if (value === undefined) return null;
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <span className="text-muted-foreground">{label}</span>
      </div>
      {value ? (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-xs gap-1">
          <Check className="h-3 w-3" /> Sim
        </Badge>
      ) : (
        <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-xs gap-1">
          <X className="h-3 w-3" /> Não
        </Badge>
      )}
    </div>
  );
};

const TextField = ({ label, value, icon }: { label: string; value: string | number | undefined | null; icon?: React.ReactNode }) => {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <span className="text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-medium">{String(value)}</span>
    </div>
  );
};

export const MarketplaceItemDetail = ({ title, description, imageUrl, lztData, priceCents }: MarketplaceItemDetailProps) => {
  const d = lztData || {};

  const username = d.minecraft_nickname || d.minecraft_id || null;
  const hasJava = d.optimus ?? d.has_java;
  const hasBedrock = d.bedrock ?? d.has_bedrock;
  const hasDungeons = d.dungeons ?? d.has_dungeons;
  const hasLegends = d.legends ?? d.has_legends;
  const canChangeNick = d.canChangeNickname ?? d.can_change_nickname;
  const capes = d.capes ?? d.cape_count;
  const emailDomain = d.emailDomain ?? d.email_domain;
  const origin = d.origin ?? d.account_origin;
  const hypixelBan = d.hypixelBan ?? d.hypixel_ban;
  const hypixelRank = d.hypixelRank ?? d.hypixel_rank;
  const skinUrl = d.skinUrl ?? d.skin_url ?? d.extracted_image_url;

  const hasAnyInfo = username || hasJava !== undefined || hasBedrock !== undefined || 
    hasDungeons !== undefined || canChangeNick !== undefined || capes !== undefined || 
    emailDomain || origin || hypixelBan !== undefined;

  const formatBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

  return (
    <div className="space-y-5">
      {/* Image / Skin */}
      {imageUrl && (
        <div className="flex justify-center py-4 bg-muted/30 rounded-xl">
          <img
            src={imageUrl}
            alt={title}
            className="h-48 w-auto object-contain"
            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
          />
        </div>
      )}

      {/* Price */}
      <div className="rounded-xl bg-muted p-4 text-center">
        <p className="text-xs text-muted-foreground mb-1">Valor</p>
        <p className="text-2xl font-bold text-primary">{formatBRL(priceCents)}</p>
      </div>

      {/* Description */}
      {description && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      )}

      {/* Trustworthy Info */}
      {hasAnyInfo && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Informações da Conta
            </p>
          </div>

          <div className="space-y-1">
            <TextField label="Nome de usuário" value={username} icon={<User className="h-3.5 w-3.5 text-muted-foreground" />} />
            <BoolField label="Edição Java" value={hasJava} icon={<Gamepad2 className="h-3.5 w-3.5 text-muted-foreground" />} />
            <BoolField label="Edição Bedrock" value={hasBedrock} icon={<Gamepad2 className="h-3.5 w-3.5 text-muted-foreground" />} />
            <BoolField label="Minecraft Dungeons" value={hasDungeons} icon={<Gamepad2 className="h-3.5 w-3.5 text-muted-foreground" />} />
            <BoolField label="Minecraft Legends" value={hasLegends} icon={<Gamepad2 className="h-3.5 w-3.5 text-muted-foreground" />} />
            <BoolField label="Pode alterar o apelido" value={canChangeNick} icon={<Info className="h-3.5 w-3.5 text-muted-foreground" />} />
            <TextField label="Capas" value={capes} icon={<Crown className="h-3.5 w-3.5 text-muted-foreground" />} />
            <TextField label="Domínio de e-mail" value={emailDomain} icon={<Mail className="h-3.5 w-3.5 text-muted-foreground" />} />
            <TextField label="Origem da conta" value={origin} icon={<Globe className="h-3.5 w-3.5 text-muted-foreground" />} />
            {hypixelBan !== undefined && (
              <TextField
                label="Banido no Hypixel"
                value={!hypixelBan || hypixelBan === "none" ? "Nenhum" : String(hypixelBan)}
                icon={<Shield className="h-3.5 w-3.5 text-muted-foreground" />}
              />
            )}
            {hypixelRank !== undefined && hypixelRank && (
              <TextField
                label="Classificação (Hypixel)"
                value={hypixelRank === true ? "Sim" : String(hypixelRank)}
                icon={<Crown className="h-3.5 w-3.5 text-muted-foreground" />}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
