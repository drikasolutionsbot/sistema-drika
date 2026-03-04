import "./lego-loader.css";

interface LegoLoaderProps {
  title?: string;
  description?: string;
}

const LegoLoader = ({ title = "Em manutenção", description = "Estamos construindo algo incrível! Volte em breve." }: LegoLoaderProps) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8">
      <div className="relative w-[400px] h-[300px]">
        <div className="legos">
          <div className="lego blue" />
          <div className="lego red" />
          <div className="lego yellow" />
        </div>
      </div>
      <div className="text-center space-y-2 mt-4">
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <p className="text-muted-foreground text-sm max-w-md">{description}</p>
      </div>
    </div>
  );
};

export default LegoLoader;
