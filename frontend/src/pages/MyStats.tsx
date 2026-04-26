import { useEffect, useState } from "react";
import {
  BarChart3,
  Calendar,
  DollarSign,
  Star,
  AlertTriangle,
  TrendingUp,
  Users,
  Award,
  Mail,
  User as UserIcon,
  Info,
  CalendarClock,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { getProfessionalStats } from "../api/endpoints";
import ExportButton from "../components/ExportButton";
import { exportToCSV, exportToPDF } from "../utils/exportUtils";

interface ProfessionalStats {
  professional: {
    id: number;
    name: string;
    email: string;
    avatar_url: string | null;
  };
  period: {
    start: string;
    end: string;
    days: number;
  };
  totals: {
    appointments_total: number;
    appointments_completed: number;
    appointments_cancelled: number;
    appointments_no_show: number;
    appointments_scheduled: number;
    revenue: number;
    completion_rate: number;
    cancellation_rate: number;
    no_show_rate: number;
  };
  ratings: {
    count: number;
    average: number;
    distribution: Record<string, number>;
  };
  revenue_by_month: {
    month: string;
    month_label: string;
    revenue: number;
    appointments: number;
  }[];
  top_services: {
    service_name: string;
    count: number;
    revenue: number;
  }[];
  top_clients: {
    client_name: string;
    appointments: number;
    revenue: number;
  }[];
}

interface ProfessionalListItem {
  id: number;
  name: string;
  email: string;
  specialty?: string;
}

const PERIOD_OPTIONS = [
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "1 ano" },
];

export default function MyStats() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [stats, setStats] = useState<ProfessionalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [professionals, setProfessionals] = useState<ProfessionalListItem[]>(
    [],
  );
  const [selectedProfId, setSelectedProfId] = useState<number | null>(null);
  const [periodDays, setPeriodDays] = useState(90);

  useEffect(() => {
    if (!isAdmin) return;
    api
      .get<ProfessionalListItem[]>("/api/v1/reports/professionals-with-names")
      .then((data) => {
        if (data) {
          setProfessionals(data);
          if (data.length > 0 && selectedProfId === null) {
            setSelectedProfId(data[0].id);
          }
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && !selectedProfId) return;

    setLoading(true);
    setError(null);

    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - periodDays);

    const params: {
      professional_id?: number;
      start_date?: string;
      end_date?: string;
    } = {
      start_date: start.toISOString().split("T")[0],
      end_date: today.toISOString().split("T")[0],
    };
    if (isAdmin && selectedProfId) params.professional_id = selectedProfId;

    getProfessionalStats(params)
      .then((data) => {
        if (data) {
          setStats(data as ProfessionalStats);
        } else {
          setError("Erro ao carregar estatísticas");
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Erro ao carregar estatísticas");
        setLoading(false);
      });
  }, [selectedProfId, periodDays, isAdmin]);

  const ratingDistData = stats
    ? [5, 4, 3, 2, 1].map((star) => ({
        star: `${star} ★`,
        count: stats.ratings.distribution[String(star)] || 0,
      }))
    : [];

  const starColors: Record<string, string> = {
    "5 ★": "#10b981",
    "4 ★": "#84cc16",
    "3 ★": "#eab308",
    "2 ★": "#f97316",
    "1 ★": "#ef4444",
  };

  const hasNoCompletedData =
    stats !== null && stats.totals.appointments_completed === 0;

  // ── Exportação ──
  const handleExportCSV = () => {
    if (!stats) return;
    const filename = `estatisticas_${slugify(stats.professional.name)}`;

    // Monta várias "seções" em um CSV único
    const rows: (string | number)[][] = [];

    rows.push(["RELATÓRIO DO PROFISSIONAL"]);
    rows.push(["Nome", stats.professional.name]);
    rows.push(["Email", stats.professional.email]);
    rows.push([
      "Período",
      `${formatDateBR(stats.period.start)} até ${formatDateBR(stats.period.end)}`,
    ]);
    rows.push([]);

    rows.push(["TOTAIS"]);
    rows.push(["Atendimentos no período", stats.totals.appointments_total]);
    rows.push(["Concluídos", stats.totals.appointments_completed]);
    rows.push(["Cancelados", stats.totals.appointments_cancelled]);
    rows.push(["Faltas", stats.totals.appointments_no_show]);
    rows.push(["Agendados (em aberto)", stats.totals.appointments_scheduled]);
    rows.push(["Faturamento", `R$ ${stats.totals.revenue.toFixed(2)}`]);
    rows.push(["Taxa de conclusão (%)", stats.totals.completion_rate]);
    rows.push(["Taxa de cancelamento (%)", stats.totals.cancellation_rate]);
    rows.push(["Taxa de falta (%)", stats.totals.no_show_rate]);
    rows.push([]);

    rows.push(["AVALIAÇÕES"]);
    rows.push(["Total de avaliações", stats.ratings.count]);
    rows.push(["Média", stats.ratings.average]);
    rows.push([]);

    if (stats.revenue_by_month.length > 0) {
      rows.push(["FATURAMENTO POR MÊS"]);
      rows.push(["Mês", "Atendimentos", "Faturamento"]);
      stats.revenue_by_month.forEach((m) => {
        rows.push([
          m.month_label,
          m.appointments,
          `R$ ${m.revenue.toFixed(2)}`,
        ]);
      });
      rows.push([]);
    }

    if (stats.top_services.length > 0) {
      rows.push(["TOP SERVIÇOS"]);
      rows.push(["#", "Serviço", "Atendimentos", "Faturamento"]);
      stats.top_services.forEach((s, i) => {
        rows.push([
          i + 1,
          s.service_name,
          s.count,
          `R$ ${s.revenue.toFixed(2)}`,
        ]);
      });
      rows.push([]);
    }

    if (stats.top_clients.length > 0) {
      rows.push(["TOP CLIENTES"]);
      rows.push(["#", "Cliente", "Atendimentos", "Faturamento"]);
      stats.top_clients.forEach((c, i) => {
        rows.push([
          i + 1,
          c.client_name,
          c.appointments,
          `R$ ${c.revenue.toFixed(2)}`,
        ]);
      });
    }

    exportToCSV(filename, ["Campo", "Valor", "Valor 2", "Valor 3"], rows);
  };

  const handleExportPDF = () => {
    if (!stats) return;

    // Monta linhas combinando top serviços e clientes em uma tabela
    const rows: (string | number)[][] = [];

    if (stats.revenue_by_month.length > 0) {
      stats.revenue_by_month.forEach((m) => {
        rows.push([
          "Faturamento mensal",
          m.month_label,
          String(m.appointments),
          `R$ ${m.revenue.toFixed(2)}`,
        ]);
      });
    }

    if (stats.top_services.length > 0) {
      stats.top_services.forEach((s, i) => {
        rows.push([
          `Top serviço #${i + 1}`,
          s.service_name,
          `${s.count} atend.`,
          `R$ ${s.revenue.toFixed(2)}`,
        ]);
      });
    }

    if (stats.top_clients.length > 0) {
      stats.top_clients.forEach((c, i) => {
        rows.push([
          `Top cliente #${i + 1}`,
          c.client_name,
          `${c.appointments} atend.`,
          `R$ ${c.revenue.toFixed(2)}`,
        ]);
      });
    }

    if (rows.length === 0) {
      rows.push(["—", "Sem dados no período", "—", "—"]);
    }

    exportToPDF({
      filename: `estatisticas_${slugify(stats.professional.name)}`,
      title: `Relatório de ${stats.professional.name}`,
      subtitle: `${formatDateBR(stats.period.start)} até ${formatDateBR(stats.period.end)} · ${stats.period.days} dias`,
      kpis: [
        {
          label: "Concluídos",
          value: String(stats.totals.appointments_completed),
        },
        { label: "Faturamento", value: formatMoney(stats.totals.revenue) },
        {
          label: "Avaliação",
          value: stats.ratings.average > 0 ? `${stats.ratings.average} ★` : "—",
        },
        { label: "Taxa de falta", value: `${stats.totals.no_show_rate}%` },
      ],
      headers: ["Categoria", "Item", "Quantidade", "Valor"],
      rows,
      orientation: "portrait",
    });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-emerald-500" />
            {isAdmin ? "Estatísticas do Profissional" : "Minhas Estatísticas"}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Desempenho, faturamento e avaliações no período
          </p>
        </div>

        {stats && (
          <ExportButton
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
            disabled={loading}
          />
        )}
      </div>

      {/* Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          {isAdmin && (
            <div className="flex-1 min-w-60">
              <label className="block text-slate-400 text-sm mb-1.5">
                Profissional
              </label>
              <select
                value={selectedProfId ?? ""}
                onChange={(e) => setSelectedProfId(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              >
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.specialty ? ` — ${p.specialty}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-slate-400 text-sm mb-1.5">
              Período
            </label>
            <div className="flex gap-2 flex-wrap">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => setPeriodDays(opt.days)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                    periodDays === opt.days
                      ? "bg-emerald-600/15 text-emerald-400 border border-emerald-500/30"
                      : "bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl mb-6">
          {error}
        </div>
      )}

      {loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center text-slate-500">
          Carregando estatísticas...
        </div>
      )}

      {!loading && stats && (
        <>
          <div className="bg-linear-to-r from-emerald-600/20 to-emerald-700/10 border border-emerald-500/20 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-4">
              <ProfessionalAvatar
                name={stats.professional.name}
                avatarUrl={stats.professional.avatar_url}
              />
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {stats.professional.name}
                </h2>
                <p className="text-slate-300 text-sm flex items-center gap-1.5 mt-1">
                  <Mail className="w-3.5 h-3.5" />
                  {stats.professional.email}
                </p>
                <p className="text-slate-400 text-xs mt-2">
                  {formatDateBR(stats.period.start)} a{" "}
                  {formatDateBR(stats.period.end)} · {stats.period.days} dias
                </p>
              </div>
            </div>
          </div>

          {hasNoCompletedData && stats.totals.appointments_scheduled > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 mb-6 flex gap-3">
              <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-blue-300 font-medium mb-1">
                  Ainda sem atendimentos concluídos no período
                </p>
                <p className="text-slate-400">
                  Existem{" "}
                  <strong className="text-white">
                    {stats.totals.appointments_scheduled}
                  </strong>{" "}
                  agendamentos em aberto. As estatísticas de faturamento e
                  avaliações começam a aparecer quando eles são marcados como{" "}
                  <strong className="text-emerald-400">Concluídos</strong> na
                  Agenda.
                </p>
              </div>
            </div>
          )}

          {hasNoCompletedData &&
            stats.totals.appointments_scheduled === 0 &&
            stats.totals.appointments_total === 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-6 text-center">
                <CalendarClock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-white font-medium mb-1">
                  Nenhum agendamento no período
                </p>
                <p className="text-slate-500 text-sm">
                  Tente aumentar o período ou selecionar outro profissional.
                </p>
              </div>
            )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Atendimentos concluídos"
              value={String(stats.totals.appointments_completed)}
              subtitle={`${stats.totals.appointments_total} agendamentos no total${
                stats.totals.appointments_scheduled > 0
                  ? ` · ${stats.totals.appointments_scheduled} em aberto`
                  : ""
              }`}
              icon={<Calendar className="w-5 h-5" />}
              accent="emerald"
            />
            <StatCard
              label="Faturamento"
              value={formatMoney(stats.totals.revenue)}
              subtitle={
                stats.totals.appointments_completed > 0
                  ? `Média ${formatMoney(
                      stats.totals.revenue /
                        stats.totals.appointments_completed,
                    )}/atendimento`
                  : "Nenhum atendimento concluído ainda"
              }
              icon={<DollarSign className="w-5 h-5" />}
              accent="green"
            />
            <StatCard
              label="Avaliação média"
              value={
                stats.ratings.average > 0 ? `${stats.ratings.average} ★` : "—"
              }
              subtitle={
                stats.ratings.count === 0
                  ? "Sem avaliações no período"
                  : `${stats.ratings.count} ${
                      stats.ratings.count === 1 ? "avaliação" : "avaliações"
                    }`
              }
              icon={<Star className="w-5 h-5" />}
              accent="yellow"
            />
            <StatCard
              label="Taxa de falta"
              value={`${stats.totals.no_show_rate}%`}
              subtitle={`${stats.totals.appointments_no_show} no-shows`}
              icon={<AlertTriangle className="w-5 h-5" />}
              accent={stats.totals.no_show_rate > 10 ? "red" : "slate"}
            />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Faturamento por mês
            </h3>
            {stats.revenue_by_month.length === 0 ? (
              <p className="text-center text-slate-500 py-12 text-sm">
                Sem dados de faturamento no período
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.revenue_by_month}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="month_label"
                    stroke="#64748b"
                    style={{ fontSize: 12 }}
                  />
                  <YAxis
                    stroke="#64748b"
                    style={{ fontSize: 12 }}
                    tickFormatter={(v) => `R$ ${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: "0.75rem",
                      color: "#e2e8f0",
                    }}
                    formatter={(value) => [
                      formatMoney(Number(value)),
                      "Faturamento",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ fill: "#10b981", r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-emerald-400" />
                Distribuição de avaliações
              </h3>
              {stats.ratings.count === 0 ? (
                <p className="text-center text-slate-500 py-12 text-sm">
                  Nenhuma avaliação recebida no período
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ratingDistData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      type="number"
                      stroke="#64748b"
                      style={{ fontSize: 12 }}
                    />
                    <YAxis
                      dataKey="star"
                      type="category"
                      stroke="#64748b"
                      width={50}
                      style={{ fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #1e293b",
                        borderRadius: "0.75rem",
                        color: "#e2e8f0",
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {ratingDistData.map((entry) => (
                        <Cell key={entry.star} fill={starColors[entry.star]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" />
                Top serviços
              </h3>
              {stats.top_services.length === 0 ? (
                <p className="text-center text-slate-500 py-12 text-sm">
                  Nenhum atendimento concluído no período
                </p>
              ) : (
                <div className="space-y-2">
                  {stats.top_services.map((s, i) => (
                    <div
                      key={s.service_name}
                      className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-sm">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-white text-sm font-medium">
                            {s.service_name}
                          </p>
                          <p className="text-slate-500 text-xs">
                            {s.count}{" "}
                            {s.count === 1 ? "atendimento" : "atendimentos"}
                          </p>
                        </div>
                      </div>
                      <span className="text-emerald-400 font-semibold text-sm">
                        {formatMoney(s.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              Top clientes frequentes
            </h3>
            {stats.top_clients.length === 0 ? (
              <p className="text-center text-slate-500 py-12 text-sm">
                Nenhum cliente com atendimento concluído no período
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left py-2 px-3 text-slate-500 font-medium">
                        #
                      </th>
                      <th className="text-left py-2 px-3 text-slate-500 font-medium">
                        Cliente
                      </th>
                      <th className="text-right py-2 px-3 text-slate-500 font-medium">
                        Atendimentos
                      </th>
                      <th className="text-right py-2 px-3 text-slate-500 font-medium">
                        Faturamento
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.top_clients.map((c, i) => (
                      <tr
                        key={c.client_name}
                        className="border-b border-slate-800/50 hover:bg-slate-800/30"
                      >
                        <td className="py-3 px-3 text-slate-500 font-medium">
                          {i + 1}
                        </td>
                        <td className="py-3 px-3 text-white font-medium">
                          {c.client_name}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-300">
                          {c.appointments}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-emerald-400">
                          {formatMoney(c.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MiniStat
              label="Taxa de conclusão"
              value={`${stats.totals.completion_rate}%`}
              accent="emerald"
            />
            <MiniStat
              label="Taxa de cancelamento"
              value={`${stats.totals.cancellation_rate}%`}
              accent="yellow"
            />
            <MiniStat
              label="Taxa de falta"
              value={`${stats.totals.no_show_rate}%`}
              accent="red"
            />
          </div>
        </>
      )}
    </div>
  );
}

function ProfessionalAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="w-20 h-20 rounded-full object-cover border-2 border-emerald-500/30"
      />
    );
  }
  const initial = name?.charAt(0).toUpperCase() || "?";
  return (
    <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-emerald-500/30 flex items-center justify-center">
      {name ? (
        <span className="text-white text-2xl font-bold">{initial}</span>
      ) : (
        <UserIcon className="w-8 h-8 text-slate-400" />
      )}
    </div>
  );
}

type Accent = "emerald" | "green" | "yellow" | "red" | "slate";

interface StatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  accent: Accent;
}

function StatCard({ label, value, subtitle, icon, accent }: StatCardProps) {
  const accents: Record<Accent, { iconBg: string; iconText: string }> = {
    emerald: { iconBg: "bg-emerald-500/10", iconText: "text-emerald-400" },
    green: { iconBg: "bg-green-500/10", iconText: "text-green-400" },
    yellow: { iconBg: "bg-yellow-500/10", iconText: "text-yellow-400" },
    red: { iconBg: "bg-red-500/10", iconText: "text-red-400" },
    slate: { iconBg: "bg-slate-700/40", iconText: "text-slate-400" },
  };
  const a = accents[accent];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-slate-400 text-sm">{label}</p>
        <div className={`${a.iconBg} ${a.iconText} p-2 rounded-lg`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {subtitle && <p className="text-slate-500 text-xs mt-2">{subtitle}</p>}
    </div>
  );
}

interface MiniStatProps {
  label: string;
  value: string;
  accent: "emerald" | "yellow" | "red";
}

function MiniStat({ label, value, accent }: MiniStatProps) {
  const accents = {
    emerald: "bg-emerald-500/5 border-emerald-500/20 text-emerald-400",
    yellow: "bg-yellow-500/5 border-yellow-500/20 text-yellow-400",
    red: "bg-red-500/5 border-red-500/20 text-red-400",
  };
  return (
    <div className={`rounded-2xl border p-4 ${accents[accent]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function formatMoney(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
