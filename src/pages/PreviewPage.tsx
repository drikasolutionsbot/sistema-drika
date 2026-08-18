import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart, Shield, Users, TrendingUp, Ticket, Bot,
  ArrowRight, Zap, Package, BarChart3, Settings, Crown,
  Check, Sparkles, Lock, Globe, DollarSign, Eye,
  LayoutDashboard, Store, TicketIcon, ChevronRight,
} from "lucide-react";
import drikaLogo from "@/assets/DRIKA_HUB_SEM_FUNDO.png";
import previewFinance from "@/assets/preview-real-finance.jpg";

/* ──────────────── Shared Sidebar Component ──────────────── */
const MockSidebar = ({ activeItem }: { activeItem: string }) => {
  const groups = [
    { label: "PRINCIPAL", items: ["Visão Geral", "Gerador IA"] },
    { label: "GERENCIAMENTO", items: ["Finanças", "Aprovações"] },
    { label: "BOT", items: ["Servidor", "Recursos", "Personalização"] },
    { label: "CONFIGURAÇÕES", items: ["Canais", "Cargos", "Verificação", "Loja", "Proteção", "Tickets", "Sorteios"] },
  ];

  return (
    <div
      className="w-[180px] shrink-0 flex flex-col p-3 gap-0.5"
      style={{ background: "hsl(0 0% 4%)", borderRight: "1px solid hsl(0 0% 14%)" }}
    >
      <div className="flex items-center gap-2 px-2 py-3 mb-2">
        <img src={drikaLogo} className="h-5 w-5" alt="" />
        <span className="font-bold text-xs" style={{ color: "hsl(330 100% 50%)" }}>DRIKA HUB</span>
      </div>
      {groups.map((group) => (
        <div key={group.label}>
          <p
            className="text-[9px] font-semibold uppercase tracking-wider px-2 mt-2.5 mb-1"
            style={{ color: "hsl(330 100% 50%)", opacity: 0.7 }}
          >
            {group.label}
          </p>
          {group.items.map((item) => (
            <div
              key={item}
              className="px-2 py-1.5 rounded-lg text-[10px]"
              style={
                item === activeItem
                  ? { background: "hsl(330 100% 50% / 0.12)", color: "hsl(330 100% 50%)", fontWeight: 600 }
                  : { color: "hsl(0 0% 70%)" }
              }
            >
              {item}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

/* ──────────────── Mock Dashboard Component ──────────────── */
const MockDashboard = () => (
  <div className="flex h-[540px] text-white text-[11px] overflow-hidden select-none" style={{ background: "hsl(0 0% 5%)" }}>
    <MockSidebar activeItem="Visão Geral" />

    {/* Main */}
    <div className="flex-1 p-4 overflow-hidden">
      {/* TopBar */}
      <div className="flex items-center justify-between mb-4">
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] w-48"
          style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 50%)" }}
        >
          🔍 Buscar...
        </div>
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded text-[9px] font-bold"
            style={{ background: "hsl(330 100% 50% / 0.15)", color: "hsl(330 100% 50%)" }}
          >
            Pro
          </span>
          <span className="text-[10px]" style={{ color: "hsl(0 0% 50%)" }}>BR</span>
          <div className="w-6 h-6 rounded-full" style={{ background: "hsl(330 100% 50% / 0.3)" }} />
        </div>
      </div>

      {/* Title */}
      <div className="mb-4">
        <h2 className="text-sm font-bold" style={{ color: "hsl(0 0% 93%)" }}>Visão Geral</h2>
        <p className="text-[10px]" style={{ color: "hsl(0 0% 50%)" }}>Resumo do seu servidor e vendas</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: "Receita Total", value: "R$ 327,30", icon: "💰", color: "hsl(145 63% 49%)", change: "+12%" },
          { label: "Total de Pedidos", value: "47", icon: "🛒", color: "hsl(0 0% 93%)", change: "+8%" },
          { label: "Ticket Médio", value: "R$ 46,90", icon: "📊", color: "hsl(330 100% 50%)", change: "+5%" },
          { label: "Clientes Únicos", value: "34", icon: "👥", color: "hsl(145 63% 49%)", change: "+15%" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-3"
            style={{ background: "hsl(0 0% 8%)", border: "1px solid hsl(0 0% 14%)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px]" style={{ color: "hsl(0 0% 50%)" }}>{stat.label}</span>
              <span className="text-sm">{stat.icon}</span>
            </div>
            <p className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</p>
            <span className="text-[9px]" style={{ color: "hsl(145 63% 49%)" }}>↑ {stat.change}</span>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-3">
        {/* Revenue Chart Mock */}
        <div
          className="col-span-2 rounded-xl p-3"
          style={{ background: "hsl(0 0% 8%)", border: "1px solid hsl(0 0% 14%)" }}
        >
          <p className="text-[10px] font-semibold mb-2" style={{ color: "hsl(0 0% 93%)" }}>Receita ao longo do tempo</p>
          <div className="h-28 flex items-end gap-[3px]">
            {[20, 35, 25, 40, 30, 55, 45, 60, 50, 70, 55, 80, 65, 75, 85, 70, 90, 75, 95, 80, 100, 85, 90, 95, 88, 92, 78, 85, 90, 95].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t transition-all"
                style={{
                  height: `${h}%`,
                  background: "linear-gradient(to top, hsl(330 100% 50% / 0.4), hsl(330 100% 50% / 0.75))",
                }}
              />
            ))}
          </div>
        </div>

        {/* Status Pie Mock */}
        <div
          className="rounded-xl p-3"
          style={{ background: "hsl(0 0% 8%)", border: "1px solid hsl(0 0% 14%)" }}
        >
          <p className="text-[10px] font-semibold mb-2" style={{ color: "hsl(0 0% 93%)" }}>Status dos Pedidos</p>
          <div className="flex items-center justify-center h-24">
            <div className="relative w-20 h-20">
              <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray="55 45" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#3b82f6" strokeWidth="4" strokeDasharray="20 80" strokeDashoffset="-55" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#ef4444" strokeWidth="4" strokeDasharray="15 85" strokeDashoffset="-75" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#eab308" strokeWidth="4" strokeDasharray="10 90" strokeDashoffset="-90" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold" style={{ color: "hsl(0 0% 93%)" }}>47</span>
                <span className="text-[7px]" style={{ color: "hsl(0 0% 50%)" }}>Total</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 mt-1">
            {[
              { label: "Entregue", color: "#10b981" },
              { label: "Pago", color: "#3b82f6" },
              { label: "Cancelado", color: "#ef4444" },
              { label: "Pendente", color: "#eab308" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                <span className="text-[8px]" style={{ color: "hsl(0 0% 50%)" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ──────────────── Mock Store Component ──────────────── */
const MockStore = () => (
  <div className="flex h-[540px] text-white text-[11px] overflow-hidden select-none" style={{ background: "hsl(0 0% 5%)" }}>
    <MockSidebar activeItem="Loja" />

    {/* Main */}
    <div className="flex-1 p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold" style={{ color: "hsl(0 0% 93%)" }}>Loja</h2>
          <p className="text-[10px]" style={{ color: "hsl(0 0% 50%)" }}>Gerencie produtos, estoque e configurações</p>
        </div>
        <button
          className="px-3 py-1.5 rounded-lg text-white text-[10px] font-semibold border-none"
          style={{ background: "hsl(330 100% 50%)" }}
        >
          + Novo Produto
        </button>
      </div>

      {/* Categories */}
      <div className="flex gap-2 mb-4">
        {["Todos", "Minecraft", "Contas", "Assinaturas"].map((cat, i) => (
          <span
            key={cat}
            className="px-3 py-1 rounded-full text-[10px]"
            style={
              i === 0
                ? { background: "hsl(330 100% 50% / 0.12)", border: "1px solid hsl(330 100% 50% / 0.25)", color: "hsl(330 100% 50%)" }
                : { border: "1px solid hsl(0 0% 14%)", color: "hsl(0 0% 50%)" }
            }
          >
            {cat}
          </span>
        ))}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { name: "MINECRAFT FULL ACESSO", price: "R$ 46,90", stock: 23, emoji: "⛏️" },
          { name: "NETFLIX PREMIUM", price: "R$ 19,90", stock: 15, emoji: "🎬" },
          { name: "SPOTIFY PREMIUM", price: "R$ 12,90", stock: 8, emoji: "🎵" },
          { name: "DISNEY+ CONTA", price: "R$ 14,90", stock: 5, emoji: "🏰" },
          { name: "HBO MAX PREMIUM", price: "R$ 16,90", stock: 0, emoji: "🎭" },
          { name: "XBOX GAME PASS", price: "R$ 29,90", stock: 12, emoji: "🎮" },
        ].map((product) => (
          <div
            key={product.name}
            className="rounded-xl p-3 transition-all"
            style={{ background: "hsl(0 0% 8%)", border: "1px solid hsl(0 0% 14%)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{product.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold truncate" style={{ color: "hsl(0 0% 93%)" }}>{product.name}</p>
                <p className="text-[9px]" style={{ color: "hsl(0 0% 50%)" }}>Entrega automática</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs font-bold" style={{ color: "hsl(330 100% 50%)" }}>{product.price}</span>
              <span
                className="text-[8px] px-1.5 py-0.5 rounded-full"
                style={
                  product.stock > 0
                    ? { background: "hsl(145 63% 49% / 0.12)", color: "hsl(145 63% 49%)" }
                    : { background: "hsl(0 72% 51% / 0.12)", color: "hsl(0 72% 51%)" }
                }
              >
                {product.stock > 0 ? `${product.stock} em estoque` : "Sem estoque"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ──────────────── Mock Finance Component ──────────────── */
const MockFinance = () => (
  <div className="h-[540px] overflow-hidden">
    <img
      src={previewFinance}
      alt="Painel de Finanças"
      className="w-full h-full object-cover object-top"
    />
  </div>
);

/* ──────────────── Tab definitions ──────────────── */
const tabs = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, component: MockDashboard },
  { key: "store", label: "Loja", icon: Store, component: MockStore },
  { key: "finance", label: "Finanças", icon: DollarSign, component: MockFinance },
];

/* ──────────────── Features ──────────────── */
const features = [
  {
    icon: ShoppingCart,
    title: "Loja Completa",
    desc: "Produtos, estoque, preços e entrega automática direto no Discord.",
    color: "from-pink-500 to-rose-500",
  },
  {
    icon: BarChart3,
    title: "Dashboard & Finanças",
    desc: "Receita, pedidos, conversão e métricas em tempo real.",
    color: "from-emerald-500 to-teal-500",
  },
  {
    icon: Ticket,
    title: "Sistema de Tickets",
    desc: "Atendimento com categorias, staff e transcrições.",
    color: "from-blue-500 to-indigo-500",
  },
  {
    icon: Shield,
    title: "Proteção Avançada",
    desc: "Anti-raid, anti-spam e verificação de membros.",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: Bot,
    title: "Bot White-Label",
    desc: "Nome e avatar personalizados. Sua marca, seu bot.",
    color: "from-purple-500 to-violet-500",
  },
  {
    icon: Zap,
    title: "Automações",
    desc: "Fluxos automáticos: roles, mensagens e notificações.",
    color: "from-cyan-500 to-sky-500",
  },
];

/* ──────────────── PreviewPage ──────────────── */
const PreviewPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const ActiveComponent = tabs.find((t) => t.key === activeTab)?.component ?? MockDashboard;

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: "hsl(0 0% 3%)" }}>
      {/* ─── Nav ─── */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl" style={{ background: "hsl(0 0% 3% / 0.8)", borderBottom: "1px solid hsl(0 0% 14%)" }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 bg-transparent border-none cursor-pointer">
            <img src={drikaLogo} alt="Drika Hub" className="h-8 w-8" />
            <span className="text-lg font-bold" style={{ background: "linear-gradient(to right, hsl(330 100% 65%), hsl(330 100% 45%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              DRIKA HUB
            </span>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-transparent border-none cursor-pointer transition-colors"
              style={{ color: "hsl(0 0% 60%)" }}
            >
              Início
            </button>
            <button
              onClick={() => navigate("/")}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white border-none cursor-pointer transition-all"
              style={{ background: "linear-gradient(135deg, hsl(330 100% 50%), hsl(340 90% 55%))", boxShadow: "0 8px 24px hsl(330 100% 50% / 0.2)" }}
            >
              Começar Agora
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative pt-16 pb-8 px-6 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[120px] pointer-events-none" style={{ background: "hsl(330 100% 50% / 0.06)" }} />
        <div className="relative max-w-3xl mx-auto">
          <p className="text-sm mb-3" style={{ color: "hsl(0 0% 50%)" }}>
            Gerencie produtos, pedidos, clientes e configurações da sua loja.
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-4">
            Conheça o{" "}
            <span style={{ background: "linear-gradient(to right, hsl(330 100% 65%), hsl(330 100% 45%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Painel Drika Hub
            </span>
          </h1>
        </div>
      </section>

      {/* ─── Tabbed Preview ─── */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          {/* Tabs */}
          <div className="flex justify-center mb-6">
            <div
              className="inline-flex items-center gap-1 p-1 rounded-xl"
              style={{ background: "hsl(0 0% 8%)", border: "1px solid hsl(0 0% 14%)" }}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium border-none cursor-pointer transition-all"
                  style={
                    activeTab === tab.key
                      ? { background: "hsl(330 100% 50%)", color: "white", boxShadow: "0 4px 16px hsl(330 100% 50% / 0.25)" }
                      : { background: "transparent", color: "hsl(0 0% 50%)" }
                  }
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Browser Frame */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid hsl(0 0% 14%)", background: "hsl(0 0% 5%)", boxShadow: "0 25px 60px hsl(0 0% 0% / 0.5)" }}
          >
            {/* Title bar */}
            <div className="flex items-center gap-2 px-4 py-3" style={{ background: "hsl(0 0% 8%)", borderBottom: "1px solid hsl(0 0% 14%)" }}>
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ background: "hsl(0 65% 50% / 0.8)" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "hsl(45 80% 50% / 0.8)" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "hsl(145 60% 45% / 0.8)" }} />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-lg text-[11px] font-mono" style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 40%)" }}>
                  www.drikahub.com/{activeTab}
                </div>
              </div>
            </div>
            {/* Content */}
            <ActiveComponent />
          </div>
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "hsl(330 100% 50%)" }}>Funcionalidades</span>
            <h2 className="text-2xl font-bold mt-2" style={{ color: "hsl(0 0% 93%)" }}>Tudo em um só lugar</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group p-5 rounded-2xl transition-all"
                style={{ background: "hsl(0 0% 6%)", border: "1px solid hsl(0 0% 14%)" }}
              >
                <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-3 shadow-lg`}>
                  <f.icon className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-sm font-bold mb-1" style={{ color: "hsl(0 0% 93%)" }}>{f.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "hsl(0 0% 50%)" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Extra Resources ─── */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "hsl(330 100% 50%)" }}>E muito mais</span>
            <h2 className="text-2xl font-bold mt-2" style={{ color: "hsl(0 0% 93%)" }}>Recursos adicionais</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {[
              { label: "Sorteios automáticos", icon: "🎁" },
              { label: "Verificação de membros", icon: "✅" },
              { label: "Boas-vindas personalizadas", icon: "👋" },
              { label: "Proteção anti-raid", icon: "🛡️" },
              { label: "Gerador IA de textos", icon: "🤖" },
              { label: "Cargos automáticos", icon: "👑" },
              { label: "Backup na nuvem (eCloud)", icon: "☁️" },
              { label: "Marketplace integrado", icon: "🏪" },
              { label: "Logs de auditoria", icon: "📋" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "hsl(0 0% 6%)", border: "1px solid hsl(0 0% 14%)" }}
              >
                <span className="text-base">{item.icon}</span>
                <span className="text-xs font-medium" style={{ color: "hsl(0 0% 65%)" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden p-10 text-center" style={{ border: "1px solid hsl(0 0% 14%)" }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, hsl(330 100% 50% / 0.08), transparent, hsl(270 60% 50% / 0.06))" }} />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[200px] rounded-full blur-[80px]" style={{ background: "hsl(330 100% 50% / 0.12)" }} />
            <div className="relative">
              <h2 className="text-2xl font-bold mb-3" style={{ color: "hsl(0 0% 93%)" }}>Pronto para começar?</h2>
              <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: "hsl(0 0% 50%)" }}>
                Monte sua loja no Discord em minutos. Sem complicação, sem código.
              </p>
              <button
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold text-white border-none cursor-pointer transition-all"
                style={{ background: "linear-gradient(135deg, hsl(330 100% 50%), hsl(340 90% 55%))", boxShadow: "0 12px 32px hsl(330 100% 50% / 0.25)" }}
              >
                Começar Agora
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="py-6 px-6" style={{ borderTop: "1px solid hsl(0 0% 14%)" }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={drikaLogo} alt="" className="h-5 w-5 opacity-40" />
            <span className="text-[10px]" style={{ color: "hsl(0 0% 25%)" }}>© 2026 Drika Hub. Todos os direitos reservados.</span>
          </div>
          <button
            onClick={() => navigate("/")}
            className="text-[10px] bg-transparent border-none cursor-pointer transition-colors"
            style={{ color: "hsl(0 0% 25%)" }}
          >
            Voltar ao início
          </button>
        </div>
      </footer>
    </div>
  );
};

export default PreviewPage;
