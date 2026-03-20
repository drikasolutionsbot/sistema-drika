import EmbedBuilder from "@/components/customization/EmbedBuilder";

const EmbedsPage = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative rounded-2xl overflow-hidden p-6 pb-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/5" />
        <div className="absolute inset-0 border border-primary/10 rounded-2xl" />
        <div className="relative">
          <h1 className="font-display text-2xl font-bold">Embeds</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Crie e gerencie embeds personalizados com templates prontos
          </p>
        </div>
      </div>
      <EmbedBuilder />
    </div>
  );
};

export default EmbedsPage;
