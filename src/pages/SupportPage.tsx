import "./SupportPage.css";

const SupportPage = () => {
  const handleSupport = () => {
    window.open("https://discord.com/users/868872675110551592", "_blank");
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Suporte</h1>
        <p className="text-muted-foreground">
          Precisa de ajuda? Clique no botão abaixo para ser direcionado ao suporte.
        </p>
      </div>

      <div className="flex items-center justify-center py-16">
        <button className="support-button" onClick={handleSupport}>
          <div className="lid">
            <span className="side top" />
            <span className="side front" />
            <span className="side back" />
            <span className="side left" />
            <span className="side right" />
          </div>
          <div className="panels">
            <div className="panel-1">
              <div className="panel-2">
                <div className="btn-trigger">
                  <span className="btn-trigger-1" />
                  <span className="btn-trigger-2" />
                </div>
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

export default SupportPage;
