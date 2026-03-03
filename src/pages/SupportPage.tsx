import { useState } from "react";
import { MessageCircle, Headphones, Mail, ExternalLink, X } from "lucide-react";
import "./SupportPage.css";

interface SupportContact {
  id: string;
  name: string;
  role: string;
  status: string;
  statusColor: string;
  action: string;
  actionIcon: string;
  secondaryAction: string;
  about: string;
  bottomText: string;
  bottomColor: string;
  url: string;
  initial: string;
}

const defaultContacts: SupportContact[] = [
  {
    id: "1",
    name: "Suporte Discord",
    role: "Atendimento",
    status: "Online",
    statusColor: "#6aff6a",
    action: "＋ Abrir Ticket",
    actionIcon: "💬",
    secondaryAction: "📞 Chamar",
    about: "Atendimento rápido via Discord. Tire suas dúvidas e resolva problemas em tempo real.",
    bottomText: "Disponível 24/7",
    bottomColor: "pink",
    url: "https://discord.com/users/868872675110551592",
    initial: "D",
  },
  {
    id: "2",
    name: "Suporte Técnico",
    role: "Especialista",
    status: "Disponível",
    statusColor: "#6aff6a",
    action: "＋ Contatar",
    actionIcon: "🛠",
    secondaryAction: "📧 E-mail",
    about: "Suporte técnico especializado para configurações avançadas e integrações.",
    bottomText: "Resposta em até 1h",
    bottomColor: "gold",
    url: "https://discord.com/users/868872675110551592",
    initial: "T",
  },
  {
    id: "3",
    name: "Vendas & Parcerias",
    role: "Comercial",
    status: "Horário comercial",
    statusColor: "#ffb86a",
    action: "＋ Falar",
    actionIcon: "🤝",
    secondaryAction: "📋 Proposta",
    about: "Interessado em planos especiais, parcerias ou revenda? Fale com nosso comercial.",
    bottomText: "Seg–Sex 9h–18h",
    bottomColor: "blue",
    url: "https://discord.com/users/868872675110551592",
    initial: "V",
  },
];

const SupportPage = () => {
  const [selectedContact, setSelectedContact] = useState<SupportContact | null>(null);

  const handleContactClick = (contact: SupportContact) => {
    setSelectedContact(contact);
  };

  const handleGoToSupport = () => {
    if (selectedContact) {
      window.open(selectedContact.url, "_blank");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Suporte</h1>
        <p className="text-muted-foreground">
          Escolha um canal de atendimento para receber ajuda.
        </p>
      </div>

      <div className="support-cards-grid">
        {defaultContacts.map((contact) => (
          <div
            key={contact.id}
            className="support-card"
            onClick={() => handleContactClick(contact)}
          >
            <div className="support-card-top">
              <div className="support-card-glass" />
              <div className="support-card-meta">
                <span>{contact.role}</span>
                <span>{contact.status}</span>
              </div>
              <div className="support-card-user">
                <div className="support-card-avatar">
                  <span className="support-card-avatar-initial">{contact.initial}</span>
                </div>
                <div className="support-card-info">
                  <div className="support-card-name">{contact.name}</div>
                  <div className="support-card-status">
                    <span className="support-card-dot" style={{ background: contact.statusColor }} />
                    {contact.status}
                  </div>
                </div>
              </div>
              <div className="support-card-actions">
                <div className="support-card-btn">{contact.action}</div>
                <div className="support-card-btn secondary">{contact.secondaryAction}</div>
              </div>
            </div>
            <div className="support-card-expand">
              <div className="support-card-section">
                <div className="support-card-title">Sobre</div>
                <div className="support-card-text">{contact.about}</div>
              </div>
            </div>
            <div className={`support-card-bottom ${contact.bottomColor}`}>
              {contact.bottomText}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {selectedContact && (
        <div className="support-modal-overlay" onClick={() => setSelectedContact(null)}>
          <div className="support-modal" onClick={(e) => e.stopPropagation()}>
            <button className="support-modal-close" onClick={() => setSelectedContact(null)}>
              <X className="h-4 w-4" />
            </button>

            <div className="support-modal-header">
              <div className="support-card-avatar large">
                <span className="support-card-avatar-initial">{selectedContact.initial}</span>
              </div>
              <div>
                <h3 className="support-modal-name">{selectedContact.name}</h3>
                <div className="support-card-status">
                  <span className="support-card-dot" style={{ background: selectedContact.statusColor }} />
                  {selectedContact.status}
                </div>
              </div>
            </div>

            <div className="support-modal-body">
              <div className="support-modal-role">{selectedContact.role}</div>
              <p className="support-modal-about">{selectedContact.about}</p>
            </div>

            <div className="support-modal-actions">
              <button className="support-modal-btn primary" onClick={handleGoToSupport}>
                <ExternalLink className="h-4 w-4" />
                Ir para o suporte
              </button>
              <button className="support-modal-btn" onClick={() => setSelectedContact(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportPage;
