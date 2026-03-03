import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import "./SupportPage.css";

interface SupportContact {
  id: string;
  name: string;
  role: string;
  status: string;
  status_color: string;
  action_text: string;
  secondary_action_text: string;
  about: string;
  bottom_text: string;
  bottom_color: string;
  url: string;
  initial: string;
}

const SupportPage = () => {
  const [contacts, setContacts] = useState<SupportContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("support_channels")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (data && data.length > 0) {
        setContacts(data as any);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold">Suporte</h1>
          <p className="text-muted-foreground">Nenhum canal de suporte disponível no momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Suporte</h1>
        <p className="text-muted-foreground">
          Escolha um canal de atendimento para receber ajuda.
        </p>
      </div>

      <div className="support-cards-grid">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="support-card"
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
                    <span className="support-card-dot" style={{ background: contact.status_color }} />
                    {contact.status}
                  </div>
                </div>
              </div>
              <div className="support-card-actions">
                <div className="support-card-btn" onClick={() => { if (contact.url) window.open(contact.url, "_blank"); }}>{contact.action_text}</div>
                {contact.secondary_action_text && (
                  <div className="support-card-btn secondary" onClick={() => { if (contact.url) window.open(contact.url, "_blank"); }}>{contact.secondary_action_text}</div>
                )}
              </div>
            </div>
            <div className="support-card-expand">
              <div className="support-card-section">
                <div className="support-card-title">Sobre</div>
                <div className="support-card-text">{contact.about}</div>
              </div>
            </div>
            <div className={`support-card-bottom ${contact.bottom_color}`}>
              {contact.bottom_text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SupportPage;
