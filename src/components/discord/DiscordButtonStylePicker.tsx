import { Label } from "@/components/ui/label";

export type DiscordButtonStyle = "primary" | "secondary" | "success" | "danger" | "link" | "glass";

interface ButtonStyleOption {
  value: DiscordButtonStyle;
  label: string;
  bgColor: string;
  textColor: string;
  description: string;
}

const buttonStyles: ButtonStyleOption[] = [
  {
    value: "primary",
    label: "Primário",
    bgColor: "#5865F2",
    textColor: "#FFFFFF",
    description: "Azul Discord",
  },
  {
    value: "secondary",
    label: "Secundário",
    bgColor: "#4f545c",
    textColor: "#FFFFFF",
    description: "Cinza",
  },
  {
    value: "success",
    label: "Sucesso",
    bgColor: "#248046",
    textColor: "#FFFFFF",
    description: "Verde",
  },
  {
    value: "danger",
    label: "Perigo",
    bgColor: "#da373c",
    textColor: "#FFFFFF",
    description: "Vermelho",
  },
  {
    value: "link",
    label: "Link",
    bgColor: "transparent",
    textColor: "#00AFF4",
    description: "Texto azul",
  },
  {
    value: "glass",
    label: "Transparente",
    bgColor: "rgba(255,255,255,0.1)",
    textColor: "#FFFFFF",
    description: "Efeito vidro",
  },
];

interface DiscordButtonStylePickerProps {
  value: DiscordButtonStyle;
  onChange: (style: DiscordButtonStyle) => void;
  label?: string;
}

export const DiscordButtonStylePicker = ({ value, onChange, label = "Estilo do Botão" }: DiscordButtonStylePickerProps) => {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-bold">{label}</Label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {buttonStyles.map((style) => {
          const isSelected = value === style.value;
          const isGlass = style.value === "glass";
          const isLink = style.value === "link";

          return (
            <button
              key={style.value}
              type="button"
              onClick={() => onChange(style.value)}
              className={`
                relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all
                ${isSelected 
                  ? "border-primary bg-primary/10" 
                  : "border-border hover:border-muted-foreground/50 bg-muted/50"
                }
              `}
            >
              {/* Preview button */}
              <div
                className={`
                  px-4 py-1.5 rounded text-xs font-medium transition-all
                  ${isGlass 
                    ? "bg-white/10 backdrop-blur-sm border border-white/20 text-white" 
                    : isLink 
                      ? "bg-transparent underline" 
                      : ""
                  }
                `}
                style={{
                  backgroundColor: isGlass || isLink ? undefined : style.bgColor,
                  color: style.textColor,
                }}
              >
                Botão
              </div>

              {/* Label */}
              <div className="text-center">
                <p className="text-xs font-semibold text-foreground">{style.label}</p>
                <p className="text-[10px] text-muted-foreground">{style.description}</p>
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Helper to get button styles for preview
export const getDiscordButtonStyles = (style: DiscordButtonStyle) => {
  const found = buttonStyles.find((s) => s.value === style);
  if (!found) return buttonStyles[2]; // default to success
  return found;
};
