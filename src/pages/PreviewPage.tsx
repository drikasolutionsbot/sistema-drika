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

/* ──────────────── Mock Dashboard Component ──────────────── */
const MockDashboard = () => (
  <div className="flex h-[540px] bg-[#0c0c0e] text-white text-[11px] overflow-hidden select-none">
    {/* Sidebar */}
    <div className="w-[180px] bg-[#0a0a0c] border-r border-white/5 flex flex-col p-3 gap-1 shrink-0">
      <div className="flex items-center gap-2 px-2 py-3 mb-2">
        <img src={drikaLogo} className="h-5 w-5" alt="" />
        <span className="font-bold text-xs text-pink-400">DRIKA HUB</span>
      </div>
      <p className="text-[9px] text-white/30 font-semibold uppercase tracking-wider px-2 mb-1">Principal</p>
      {[
        { label: "Visão Geral", active: true },
        { label: "Gerador IA", active: false },
      ].map((item) => (
        <div key={item.label} className={`px-2 py-1.5 rounded-lg text-[10px] ${item.active ? "bg-pink-500/15 text-pink-400 font-semibold" : "text-white/40"}`}>
          {item.label}
        </div>
      ))}
      <p className="text-[9px] text-white/30 font-semibold uppercase tracking-wider px-2 mt-3 mb-1">Gerenciamento</p>
      {["Finanças", "Aprovações", "Afiliados"].map((label) => (
        <div key={label} className="px-2 py-1.5 rounded-lg text-[10px] text-white/40">{label}</div>
      ))}
      <p className="text-[9px] text-white/30 font-semibold uppercase tracking-wider px-2 mt-3 mb-1">Bot</p>
      {["Servidor", "Recursos", "Personalização"].map((label) => (
        <div key={label} className="px-2 py-1.5 rounded-lg text-[10px] text-white/40">{label}</div>
      ))}
      <p className="text-[9px] text-white/30 font-semibold uppercase tracking-wider px-2 mt-3 mb-1">Configurações</p>
      {["Canais", "Cargos", "Verificação", "Loja", "Proteção", "Tickets", "Sorteios"].map((label) => (
        <div key={label} className="px-2 py-1.5 rounded-lg text-[10px] text-white/40">{label}</div>
      ))}
    </div>

    {/* Main */}
    <div className="flex-1 p-4 overflow-hidden">
      {/* TopBar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5 text-white/30 text-[10px] w-48">
          🔍 Buscar...
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-pink-500/20 text-pink-400 text-[9px] font-bold">Pro</span>
          <span className="text-[10px] text-white/40">BR</span>
          <div className="w-6 h-6 rounded-full bg-pink-500/30" />
        </div>
      </div>

      {/* Title */}
      <div className="mb-4">
        <h2 className="text-sm font-bold">Visão Geral</h2>
        <p className="text-[10px] text-white/30">Resumo do seu servidor e vendas</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: "Receita Total", value: "R$ 327,30", icon: "💰", color: "text-emerald-400", change: "+12%" },
          { label: "Total de Pedidos", value: "47", icon: "🛒", color: "text-blue-400", change: "+8%" },
          { label: "Ticket Médio", value: "R$ 46,90", icon: "📊", color: "text-pink-400", change: "+5%" },
          { label: "Clientes Únicos", value: "34", icon: "👥", color: "text-amber-400", change: "+15%" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-white/40">{stat.label}</span>
              <span className="text-sm">{stat.icon}</span>
            </div>
            <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
            <span className="text-[9px] text-emerald-400">↑ {stat.change}</span>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-3">
        {/* Revenue Chart Mock */}
        <div className="col-span-2 bg-white/[0.03] border border-white/5 rounded-xl p-3">
          <p className="text-[10px] font-semibold mb-2">Receita ao longo do tempo</p>
          <div className="h-28 flex items-end gap-[3px]">
            {[20, 35, 25, 40, 30, 55, 45, 60, 50, 70, 55, 80, 65, 75, 85, 70, 90, 75, 95, 80, 100, 85, 90, 95, 88, 92, 78, 85, 90, 95].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-gradient-to-t from-pink-500/30 to-pink-500/60 transition-all"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        {/* Status Pie Mock */}
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
          <p className="text-[10px] font-semibold mb-2">Status dos Pedidos</p>
          <div className="flex items-center justify-center h-24">
            <div className="relative w-20 h-20">
              <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray="55 45" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#3b82f6" strokeWidth="4" strokeDasharray="20 80" strokeDashoffset="-55" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#ef4444" strokeWidth="4" strokeDasharray="15 85" strokeDashoffset="-75" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#eab308" strokeWidth="4" strokeDasharray="10 90" strokeDashoffset="-90" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold">47</span>
                <span className="text-[7px] text-white/30">Total</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 mt-1">
            {[
              { label: "Entregue", color: "bg-emerald-500" },
              { label: "Pago", color: "bg-blue-500" },
              { label: "Cancelado", color: "bg-red-500" },
              { label: "Pendente", color: "bg-yellow-500" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
                <span className="text-[8px] text-white/40">{s.label}</span>
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
  <div className="flex h-[540px] bg-[#0c0c0e] text-white text-[11px] overflow-hidden select-none">
    {/* Sidebar */}
    <div className="w-[180px] bg-[#0a0a0c] border-r border-white/5 flex flex-col p-3 gap-1 shrink-0">
      <div className="flex items-center gap-2 px-2 py-3 mb-2">
        <img src={drikaLogo} className="h-5 w-5" alt="" />
        <span className="font-bold text-xs text-pink-400">DRIKA HUB</span>
      </div>
      <p className="text-[9px] text-white/30 font-semibold uppercase tracking-wider px-2 mb-1">Configurações</p>
      {["Canais", "Cargos", "Verificação"].map((l) => (
        <div key={l} className="px-2 py-1.5 rounded-lg text-[10px] text-white/40">{l}</div>
      ))}
      <div className="px-2 py-1.5 rounded-lg text-[10px] bg-pink-500/15 text-pink-400 font-semibold">Loja</div>
      {["Proteção", "Tickets", "Sorteios"].map((l) => (
        <div key={l} className="px-2 py-1.5 rounded-lg text-[10px] text-white/40">{l}</div>
      ))}
    </div>

    {/* Main */}
    <div className="flex-1 p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold">Loja</h2>
          <p className="text-[10px] text-white/30">Gerencie produtos, estoque e configurações</p>
        </div>
        <button className="px-3 py-1.5 rounded-lg bg-pink-500 text-white text-[10px] font-semibold border-none">
          + Novo Produto
        </button>
      </div>

      {/* Categories */}
      <div className="flex gap-2 mb-4">
        {["Todos", "Minecraft", "Contas", "Assinaturas"].map((cat, i) => (
          <span key={cat} className={`px-3 py-1 rounded-full text-[10px] border ${i === 0 ? "bg-pink-500/15 border-pink-500/30 text-pink-400" : "border-white/5 text-white/40"}`}>
            {cat}
          </span>
        ))}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { name: "MINECRAFT FULL ACESSO", price: "R$ 46,90", stock: 23, status: "Ativo", emoji: "⛏️" },
          { name: "NETFLIX PREMIUM", price: "R$ 19,90", stock: 15, status: "Ativo", emoji: "🎬" },
          { name: "SPOTIFY PREMIUM", price: "R$ 12,90", stock: 8, status: "Ativo", emoji: "🎵" },
          { name: "DISNEY+ CONTA", price: "R$ 14,90", stock: 5, status: "Ativo", emoji: "🏰" },
          { name: "HBO MAX PREMIUM", price: "R$ 16,90", stock: 0, status: "Sem estoque", emoji: "🎭" },
          { name: "XBOX GAME PASS", price: "R$ 29,90", stock: 12, status: "Ativo", emoji: "🎮" },
        ].map((product) => (
          <div key={product.name} className="bg-white/[0.03] border border-white/5 rounded-xl p-3 hover:border-white/10 transition-all">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{product.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold truncate">{product.name}</p>
                <p className="text-[9px] text-white/30">Entrega automática</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs font-bold text-pink-400">{product.price}</span>
              <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${product.stock > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
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
    <div className="min-h-screen bg-[#08080a] text-white overflow-x-hidden">
      {/* ─── Nav ─── */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#08080a]/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 bg-transparent border-none cursor-pointer">
            <img src={drikaLogo} alt="Drika Hub" className="h-8 w-8" />
            <span className="text-lg font-bold bg-gradient-to-r from-pink-400 to-pink-600 bg-clip-text text-transparent">
              DRIKA HUB
            </span>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white bg-transparent border-none cursor-pointer transition-colors"
            >
              Início
            </button>
            <button
              onClick={() => navigate("/")}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white border-none cursor-pointer transition-all shadow-lg shadow-pink-500/20"
            >
              Começar Agora
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative pt-16 pb-8 px-6 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-pink-500/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <p className="text-white/40 text-sm mb-3">
            Gerencie produtos, pedidos, clientes e configurações da sua loja.
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-4">
            Conheça o{" "}
            <span className="bg-gradient-to-r from-pink-400 to-pink-600 bg-clip-text text-transparent">
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
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium border-none cursor-pointer transition-all ${
                    activeTab === tab.key
                      ? "bg-pink-500 text-white shadow-lg shadow-pink-500/25"
                      : "bg-transparent text-white/50 hover:text-white/70"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Browser Frame */}
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0d0d0d] shadow-2xl shadow-black/50">
            {/* Title bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.03] border-b border-white/5">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/80" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <span className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-lg bg-white/5 text-[11px] text-white/30 font-mono">
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
            <span className="text-xs font-semibold text-pink-400 uppercase tracking-widest">Funcionalidades</span>
            <h2 className="text-2xl font-bold mt-2">Tudo em um só lugar</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="group p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/10 transition-all">
                <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-3 shadow-lg`}>
                  <f.icon className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-sm font-bold mb-1">{f.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Extra Resources ─── */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-xs font-semibold text-pink-400 uppercase tracking-widest">E muito mais</span>
            <h2 className="text-2xl font-bold mt-2">Recursos adicionais</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {[
              { label: "Sorteios automáticos", icon: "🎁" },
              { label: "Verificação de membros", icon: "✅" },
              { label: "Boas-vindas personalizadas", icon: "👋" },
              { label: "Proteção anti-raid", icon: "🛡️" },
              { label: "Gerador IA de textos", icon: "🤖" },
              { label: "Sistema de afiliados", icon: "🤝" },
              { label: "Cargos automáticos", icon: "👑" },
              { label: "Backup na nuvem (eCloud)", icon: "☁️" },
              { label: "Marketplace integrado", icon: "🏪" },
              { label: "Logs de auditoria", icon: "📋" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <span className="text-base">{item.icon}</span>
                <span className="text-xs font-medium text-white/60">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden p-10 text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 via-transparent to-purple-500/10 border border-white/[0.06] rounded-3xl" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[200px] bg-pink-500/15 rounded-full blur-[80px]" />
            <div className="relative">
              <h2 className="text-2xl font-bold mb-3">Pronto para começar?</h2>
              <p className="text-white/40 text-sm mb-6 max-w-md mx-auto">
                Monte sua loja no Discord em minutos. Sem complicação, sem código.
              </p>
              <button
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white border-none cursor-pointer transition-all shadow-xl shadow-pink-500/25"
              >
                Começar Agora
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/5 py-6 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={drikaLogo} alt="" className="h-5 w-5 opacity-40" />
            <span className="text-[10px] text-white/25">© 2026 Drika Hub. Todos os direitos reservados.</span>
          </div>
          <button onClick={() => navigate("/")} className="text-[10px] text-white/25 hover:text-white/50 bg-transparent border-none cursor-pointer transition-colors">
            Voltar ao início
          </button>
        </div>
      </footer>
    </div>
  );
};

export default PreviewPage;
