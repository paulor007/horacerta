import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  CalendarCheck,
  DollarSign,
  TrendingUp,
  UserX,
  XCircle,
  RefreshCw,
} from "lucide-react";
import Loading from "../components/ui/Loading";
import { getDashboard, getRevenue, getOccupancy } from "../api/endpoints";
import type { DashboardData, RevenueByProfessional } from "../types";

interface OccupancyDay {
  date: string;
  total: number;
  completed: number;
  rate: number;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [revenue, setRevenue] = useState<RevenueByProfessional[]>([]);
  const [occupancy, setOccupancy] = useState<OccupancyDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Carregar dados do dashboard
  useEffect(() => {
    getDashboard().then((d: DashboardData | null) => {
      setData(d);
    });
  }, [refreshKey]);

  // Carregar faturamento por profissional
  useEffect(() => {
    getRevenue().then((r: RevenueByProfessional[] | null) => {
      setRevenue(r || []);
    });
  }, [refreshKey]);

  // Carregar ocupação últimos 7 dias
  useEffect(() => {
    getOccupancy(7).then((o: OccupancyDay[] | null) => {
      setOccupancy((o || []).reverse());
      setLoading(false);
    });
  }, [refreshKey]);

  const handleRefresh = () => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  if (loading || !data) return <Loading />;

  const maxRevenue = Math.max(...revenue.map((r) => r.revenue), 1);
  const maxOccTotal = Math.max(...occupancy.map((o) => o.total), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <LayoutDashboard className="w-7 h-7 text-emerald-500" />
            Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Visão geral do mês atual
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
          title="Atualizar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <KpiCard
          icon={CalendarCheck}
          label="Agendamentos de Hoje"
          value={data.today_appointments}
          color="blue"
        />
        <KpiCard
          icon={CalendarCheck}
          label="Concluídos no Mês"
          value={data.completed_month}
          color="green"
        />
        <KpiCard
          icon={DollarSign}
          label="Faturamento do Mês"
          value={`R$ ${data.revenue_month.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          color="emerald"
        />
        <KpiCard
          icon={TrendingUp}
          label="Taxa de Ocupação"
          value={`${data.occupancy_rate}%`}
          color="purple"
        />
        <KpiCard
          icon={UserX}
          label="Faltas no Mês"
          value={data.noshows_month}
          color="red"
        />
        <KpiCard
          icon={XCircle}
          label="Cancelamentos"
          value={data.cancelled_month}
          color="slate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Professional */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-5">
            Faturamento por Profissional
          </h2>
          {revenue.length === 0 ? (
            <p className="text-slate-500 text-sm">Nenhum dado este mês.</p>
          ) : (
            <div className="space-y-4">
              {revenue.map((r, i) => (
                <div key={r.professional_id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-emerald-600/20 flex items-center justify-center text-emerald-400 text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="text-white text-sm font-medium">
                        {r.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 text-sm font-semibold">
                        R${" "}
                        {r.revenue.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                      <span className="text-slate-500 text-xs ml-2">
                        ({r.appointments} atend.)
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-emerald-600 to-emerald-400 transition-all duration-700"
                      style={{ width: `${(r.revenue / maxRevenue) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Occupancy Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-5">
            Ocupação — Últimos 7 dias
          </h2>
          {occupancy.length === 0 ? (
            <p className="text-slate-500 text-sm">Nenhum dado disponível.</p>
          ) : (
            <div className="space-y-3">
              {occupancy.map((day) => {
                const dateObj = new Date(day.date + "T12:00:00");
                const label = dateObj.toLocaleDateString("pt-BR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                });
                const isToday =
                  day.date === new Date().toISOString().split("T")[0];
                return (
                  <div key={day.date} className="flex items-center gap-3">
                    <span
                      className={`text-xs w-24 font-mono ${isToday ? "text-emerald-400 font-semibold" : "text-slate-400"}`}
                    >
                      {label}
                    </span>
                    <div className="flex-1 bg-slate-800 rounded-full h-5 overflow-hidden relative">
                      <div
                        className="absolute h-full rounded-full bg-slate-700"
                        style={{ width: `${(day.total / maxOccTotal) * 100}%` }}
                      />
                      <div
                        className="absolute h-full rounded-full bg-linear-to-r from-emerald-600 to-emerald-400"
                        style={{
                          width: `${(day.completed / maxOccTotal) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-16 text-right font-mono">
                      {day.completed}/{day.total}{" "}
                      <span className="text-emerald-400">({day.rate}%)</span>
                    </span>
                  </div>
                );
              })}
              <div className="flex gap-4 mt-2 pt-2 border-t border-slate-800">
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="w-3 h-2 rounded-sm bg-emerald-500 inline-block" />{" "}
                  Concluídos
                </span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="w-3 h-2 rounded-sm bg-slate-700 inline-block" />{" "}
                  Total
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-400", icon: "bg-blue-500/20" },
  green: {
    bg: "bg-green-500/10",
    text: "text-green-400",
    icon: "bg-green-500/20",
  },
  emerald: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    icon: "bg-emerald-500/20",
  },
  purple: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    icon: "bg-purple-500/20",
  },
  red: { bg: "bg-red-500/10", text: "text-red-400", icon: "bg-red-500/20" },
  slate: {
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    icon: "bg-slate-500/20",
  },
};

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  const c = colorMap[color] || colorMap.slate;
  return (
    <div className={`${c.bg} border border-slate-800 rounded-2xl p-5`}>
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-9 h-9 rounded-xl ${c.icon} flex items-center justify-center`}
        >
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
        <span className="text-slate-400 text-xs">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
    </div>
  );
}
