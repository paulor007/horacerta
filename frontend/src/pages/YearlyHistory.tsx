import { useEffect, useState } from "react";
import {
  Calendar,
  TrendingUp,
  DollarSign,
  Users,
  RefreshCw,
} from "lucide-react";
import { api } from "../api/client";
import ExportButton from "../components/ExportButton";
import { exportToCSV, exportToPDF } from "../utils/exportUtils";

interface MonthData {
  month: number;
  total_revenue: number;
  total_completed: number;
}

interface YearlyData {
  year: number;
  total_revenue: number;
  total_completed: number;
  months: MonthData[];
}

interface SnapshotItem {
  id: number;
  year: number;
  month: number;
  professional_name: string | null;
  total_completed: number;
  total_cancelled: number;
  total_no_show: number;
  total_revenue: number;
  unique_clients: number;
}

const MONTH_NAMES = [
  "",
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

interface YearlyHistoryProps {
  onBack: () => void;
}

export default function YearlyHistory({ onBack }: YearlyHistoryProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [yearly, setYearly] = useState<YearlyData | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    setLoadKey((k) => k + 1);
  }, [year]);

  useEffect(() => {
    if (loadKey === 0) return;
    let cancelled = false;
    const fetchData = async () => {
      const [y, s] = await Promise.all([
        api.get<YearlyData>(`/api/v1/snapshots/yearly-revenue?year=${year}`),
        api.get<SnapshotItem[]>(`/api/v1/snapshots?year=${year}`),
      ]);
      if (!cancelled) {
        setYearly(y);
        setSnapshots(s || []);
        setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey]);

  const handleRegenerate = async () => {
    if (!confirm("Regenerar snapshots dos meses passados?")) return;
    setRegenerating(true);
    await api.post("/api/v1/snapshots/generate-missing");
    setRegenerating(false);
    setLoadKey((k) => k + 1);
  };

  const maxRevenue = yearly
    ? Math.max(...yearly.months.map((m) => m.total_revenue), 1)
    : 1;

  // ── Exportação ──
  const handleExportCSV = () => {
    if (!yearly) return;

    const rows: (string | number)[][] = [];

    rows.push(["RESUMO ANUAL"]);
    rows.push(["Ano", yearly.year]);
    rows.push(["Faturamento total", `R$ ${yearly.total_revenue.toFixed(2)}`]);
    rows.push(["Atendimentos concluídos", yearly.total_completed]);
    rows.push([
      "Ticket médio",
      yearly.total_completed > 0
        ? `R$ ${(yearly.total_revenue / yearly.total_completed).toFixed(2)}`
        : "R$ 0,00",
    ]);
    rows.push([]);

    rows.push(["FATURAMENTO POR MÊS"]);
    rows.push(["Mês", "Atendimentos", "Faturamento"]);
    yearly.months.forEach((m) => {
      rows.push([
        MONTH_NAMES[m.month],
        m.total_completed,
        `R$ ${m.total_revenue.toFixed(2)}`,
      ]);
    });

    if (snapshots.length > 0) {
      rows.push([]);
      rows.push(["DETALHAMENTO MENSAL"]);
      rows.push([
        "Mês",
        "Concluídos",
        "Cancelados",
        "Faltas",
        "Clientes",
        "Faturamento",
      ]);
      snapshots.forEach((s) => {
        rows.push([
          MONTH_NAMES[s.month],
          s.total_completed,
          s.total_cancelled,
          s.total_no_show,
          s.unique_clients,
          `R$ ${Number(s.total_revenue).toFixed(2)}`,
        ]);
      });
    }

    exportToCSV(
      `historico_anual_${year}`,
      ["Coluna 1", "Coluna 2", "Coluna 3", "Coluna 4", "Coluna 5", "Coluna 6"],
      rows,
    );
  };

  const handleExportPDF = () => {
    if (!yearly) return;

    const ticketMedio =
      yearly.total_completed > 0
        ? yearly.total_revenue / yearly.total_completed
        : 0;

    const rows: (string | number)[][] = [];
    yearly.months.forEach((m) => {
      rows.push([
        MONTH_NAMES[m.month],
        String(m.total_completed),
        `R$ ${m.total_revenue.toFixed(2)}`,
      ]);
    });

    exportToPDF({
      filename: `historico_anual_${year}`,
      title: `Histórico Anual — ${year}`,
      subtitle: "Faturamento consolidado (preservado indefinidamente)",
      kpis: [
        {
          label: "Faturamento anual",
          value: `R$ ${yearly.total_revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        },
        { label: "Atendimentos", value: String(yearly.total_completed) },
        {
          label: "Ticket médio",
          value: `R$ ${ticketMedio.toFixed(2)}`,
        },
      ],
      headers: ["Mês", "Atendimentos concluídos", "Faturamento"],
      rows,
      orientation: "portrait",
    });
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="text-slate-400 text-sm mb-6 hover:text-white transition"
      >
        ← Voltar
      </button>

      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Calendar className="w-7 h-7 text-emerald-500" />
            Histórico Anual
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Faturamento consolidado — preservado mesmo após limpeza de histórico
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {yearly && (
            <ExportButton
              onExportCSV={handleExportCSV}
              onExportPDF={handleExportPDF}
              disabled={loading}
            />
          )}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50"
          >
            {[
              currentYear,
              currentYear - 1,
              currentYear - 2,
              currentYear - 3,
            ].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition"
            title="Regenerar snapshots"
          >
            <RefreshCw
              className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <p className="text-slate-400 text-xs">Faturamento Anual</p>
              </div>
              <p className="text-3xl font-bold text-white">
                R${" "}
                {(yearly?.total_revenue || 0).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <p className="text-slate-400 text-xs">
                  Atendimentos Concluídos
                </p>
              </div>
              <p className="text-3xl font-bold text-white">
                {(yearly?.total_completed || 0).toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <p className="text-slate-400 text-xs">Ticket Médio</p>
              </div>
              <p className="text-3xl font-bold text-white">
                R${" "}
                {yearly && yearly.total_completed > 0
                  ? (yearly.total_revenue / yearly.total_completed).toFixed(2)
                  : "0,00"}
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">
            <h2 className="text-white font-semibold mb-5">
              Faturamento por Mês
            </h2>
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
              {yearly?.months.map((m) => {
                const pct =
                  maxRevenue > 0 ? (m.total_revenue / maxRevenue) * 100 : 0;
                return (
                  <div key={m.month} className="text-center">
                    <div className="h-32 flex items-end mb-2">
                      <div
                        className={`w-full rounded-t-lg transition-all ${
                          m.total_revenue > 0
                            ? "bg-emerald-500/40 border-t-2 border-emerald-500"
                            : "bg-slate-800"
                        }`}
                        style={{ height: `${Math.max(pct, 2)}%` }}
                        title={`R$ ${m.total_revenue.toLocaleString("pt-BR")}`}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      {MONTH_NAMES[m.month]}
                    </p>
                    <p className="text-xs text-emerald-400 font-medium mt-1">
                      {m.total_revenue > 0
                        ? `R$${Math.round(m.total_revenue / 100) / 10}k`
                        : "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-5">
              Detalhamento Mensal
            </h2>
            {snapshots.length === 0 ? (
              <p className="text-slate-500 text-sm">
                Nenhum snapshot encontrado para {year}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-xs border-b border-slate-800">
                      <th className="text-left py-3 font-medium">Mês</th>
                      <th className="text-right py-3 font-medium">
                        Concluídos
                      </th>
                      <th className="text-right py-3 font-medium">
                        Cancelados
                      </th>
                      <th className="text-right py-3 font-medium">Faltas</th>
                      <th className="text-right py-3 font-medium">Clientes</th>
                      <th className="text-right py-3 font-medium">
                        Faturamento
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-slate-800/50 hover:bg-slate-800/30"
                      >
                        <td className="py-3 text-white font-medium">
                          {MONTH_NAMES[s.month]}
                        </td>
                        <td className="py-3 text-right text-emerald-400">
                          {s.total_completed}
                        </td>
                        <td className="py-3 text-right text-slate-400">
                          {s.total_cancelled}
                        </td>
                        <td className="py-3 text-right text-red-400">
                          {s.total_no_show}
                        </td>
                        <td className="py-3 text-right text-slate-300">
                          {s.unique_clients}
                        </td>
                        <td className="py-3 text-right text-white font-semibold">
                          R${" "}
                          {Number(s.total_revenue).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
