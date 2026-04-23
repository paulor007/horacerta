import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Search,
  Filter,
  X,
  Check,
  XCircle,
  Clock,
  User,
  Scissors,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import {
  completeAppointment,
  noshowAppointment,
  cancelAppointment,
  getServices,
} from "../api/endpoints";
import type { Appointment, Service } from "../types";

interface ProfessionalListItem {
  id: number;
  name: string;
  email: string;
  specialty?: string;
}

type StatusFilter = "all" | "scheduled" | "completed" | "cancelled" | "no_show";
type PeriodFilter = "today" | "week" | "month" | "custom";

const STATUS_LABELS: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  scheduled: {
    label: "Agendado",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  completed: {
    label: "Concluído",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  cancelled: {
    label: "Cancelado",
    color: "text-slate-400",
    bg: "bg-slate-500/10 border-slate-500/20",
  },
  no_show: {
    label: "Falta",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
  },
};

export default function Agenda() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadKey, setLoadKey] = useState(0);

  // Filtros
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [professionalFilter, setProfessionalFilter] = useState<number | "all">(
    "all",
  );
  const [serviceFilter, setServiceFilter] = useState<number | "all">("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("week");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Dados para filtros
  const [professionals, setProfessionals] = useState<ProfessionalListItem[]>(
    [],
  );
  const [services, setServices] = useState<Service[]>([]);

  // Carrega lista de profissionais (só admin) e serviços
  useEffect(() => {
    if (isAdmin) {
      api
        .get<ProfessionalListItem[]>("/api/v1/reports/professionals-with-names")
        .then((data) => {
          if (data) setProfessionals(data);
        });
    }
    getServices().then((data) => {
      if (data) setServices(data);
    });
  }, [isAdmin]);

  // Calcula período baseado no filtro
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    const end = new Date(today);

    if (periodFilter === "today") {
      // start e end = hoje
    } else if (periodFilter === "week") {
      start.setDate(today.getDate() - 3);
      end.setDate(today.getDate() + 7);
    } else if (periodFilter === "month") {
      start.setDate(today.getDate() - 15);
      end.setDate(today.getDate() + 30);
    } else if (periodFilter === "custom") {
      return {
        startDate: customStart || today.toISOString().split("T")[0],
        endDate: customEnd || today.toISOString().split("T")[0],
      };
    }

    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  }, [periodFilter, customStart, customEnd]);

  // Dispara novo load quando filtros de período mudam
  useEffect(() => {
    setLoadKey((k) => k + 1);
  }, [startDate, endDate]);

  // Busca agendamentos — padrão loadKey (mesmo do Dashboard/YearlyHistory)
  useEffect(() => {
    if (loadKey === 0) return;
    let cancelled = false;
    const fetchData = async () => {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      let data = await api.get<Appointment[]>(
        `/api/v1/appointments/agenda?${params.toString()}`,
      );
      if (!data) {
        // Fallback pro endpoint antigo se o /agenda ainda não estiver implantado
        data = await api.get<Appointment[]>(
          `/api/v1/appointments/today?date=${startDate}`,
        );
      }
      if (!cancelled) {
        setAppointments(data || []);
        setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey]);

  // Aplica filtros client-side
  const filtered = useMemo(() => {
    return appointments.filter((apt) => {
      if (searchText.trim()) {
        const q = searchText.toLowerCase().trim();
        const clientMatch = (apt.client_name || "").toLowerCase().includes(q);
        const serviceMatch = (apt.service_name || "").toLowerCase().includes(q);
        const profMatch = (apt.professional_name || "")
          .toLowerCase()
          .includes(q);
        if (!clientMatch && !serviceMatch && !profMatch) return false;
      }
      if (statusFilter !== "all" && apt.status !== statusFilter) return false;
      if (
        professionalFilter !== "all" &&
        apt.professional_id !== professionalFilter
      )
        return false;
      if (serviceFilter !== "all" && apt.service_id !== serviceFilter)
        return false;
      return true;
    });
  }, [
    appointments,
    searchText,
    statusFilter,
    professionalFilter,
    serviceFilter,
  ]);

  // Agrupa por data
  const grouped = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const apt of filtered) {
      const key = apt.date;
      if (!map[key]) map[key] = [];
      map[key].push(apt);
    }
    Object.values(map).forEach((list) =>
      list.sort((a, b) => a.start_time.localeCompare(b.start_time)),
    );
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // Contadores por status
  const statusCounts = useMemo(() => {
    const counts = {
      all: appointments.length,
      scheduled: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
    };
    for (const apt of appointments) {
      if (apt.status in counts) {
        counts[apt.status as keyof typeof counts]++;
      }
    }
    return counts;
  }, [appointments]);

  const handleComplete = async (id: number) => {
    const result = await completeAppointment(id);
    if (result) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "completed" } : a)),
      );
    } else {
      alert("Erro ao marcar como concluído.");
    }
  };

  const handleNoShow = async (id: number) => {
    if (!confirm("Marcar como falta?")) return;
    const result = await noshowAppointment(id);
    if (result) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "no_show" } : a)),
      );
    } else {
      alert("Erro ao marcar falta.");
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm("Cancelar este agendamento?")) return;
    const result = await cancelAppointment(id);
    if (result) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "cancelled" } : a)),
      );
    } else {
      alert("Erro ao cancelar agendamento.");
    }
  };

  const clearAllFilters = () => {
    setSearchText("");
    setStatusFilter("all");
    setProfessionalFilter("all");
    setServiceFilter("all");
    setPeriodFilter("week");
    setCustomStart("");
    setCustomEnd("");
  };

  const activeFiltersCount = [
    searchText.trim() !== "",
    statusFilter !== "all",
    professionalFilter !== "all",
    serviceFilter !== "all",
    periodFilter !== "week",
  ].filter(Boolean).length;

  const canChangeStatus = (status: string) => status === "scheduled";

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <CalendarDays className="w-7 h-7 text-emerald-500" />
            {isAdmin ? "Agenda Geral" : "Minha Agenda"}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {filtered.length} de {appointments.length} agendamentos
          </p>
        </div>

        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
            showFilters || activeFiltersCount > 0
              ? "bg-emerald-600/15 text-emerald-400 border border-emerald-500/30"
              : "bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-600"
          }`}
        >
          <Filter className="w-4 h-4" />
          Filtros
          {activeFiltersCount > 0 && (
            <span className="bg-emerald-500 text-slate-950 rounded-full w-5 h-5 text-xs font-bold flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Busca */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Buscar por cliente, serviço ou profissional..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-11 pr-10 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
        />
        {searchText && (
          <button
            onClick={() => setSearchText("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Abas de status */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {(
          [
            "all",
            "scheduled",
            "completed",
            "cancelled",
            "no_show",
          ] as StatusFilter[]
        ).map((s) => {
          const count = statusCounts[s];
          const label = s === "all" ? "Todos" : STATUS_LABELS[s]?.label || s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition flex items-center gap-2 ${
                statusFilter === s
                  ? "bg-emerald-600/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {label}
              <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Painel de filtros avançados */}
      {showFilters && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isAdmin && (
              <div>
                <label className="block text-slate-400 text-sm mb-1.5">
                  Profissional
                </label>
                <select
                  value={professionalFilter}
                  onChange={(e) =>
                    setProfessionalFilter(
                      e.target.value === "all" ? "all" : Number(e.target.value),
                    )
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="all">Todos os profissionais</option>
                  {professionals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-slate-400 text-sm mb-1.5">
                Serviço
              </label>
              <select
                value={serviceFilter}
                onChange={(e) =>
                  setServiceFilter(
                    e.target.value === "all" ? "all" : Number(e.target.value),
                  )
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              >
                <option value="all">Todos os serviços</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-2">Período</label>
            <div className="flex flex-wrap gap-2">
              {(["today", "week", "month", "custom"] as PeriodFilter[]).map(
                (p) => (
                  <button
                    key={p}
                    onClick={() => setPeriodFilter(p)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                      periodFilter === p
                        ? "bg-emerald-600/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    {p === "today" && "Hoje"}
                    {p === "week" && "Semana"}
                    {p === "month" && "Mês"}
                    {p === "custom" && "Personalizado"}
                  </button>
                ),
              )}
            </div>

            {periodFilter === "custom" && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-slate-500 text-xs mb-1">
                    De
                  </label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 text-xs mb-1">
                    Até
                  </label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>
            )}
          </div>

          {activeFiltersCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-slate-400 hover:text-emerald-400 transition flex items-center gap-2"
            >
              <X className="w-4 h-4" /> Limpar todos os filtros
            </button>
          )}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center text-slate-500">
          Carregando agendamentos...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-white font-medium mb-1">
            Nenhum agendamento encontrado
          </p>
          <p className="text-slate-500 text-sm">
            {activeFiltersCount > 0
              ? "Tente ajustar ou limpar os filtros"
              : "Não há agendamentos no período selecionado"}
          </p>
          {activeFiltersCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <h2 className="text-slate-400 text-sm font-medium mb-3 sticky top-0 bg-slate-950 py-2">
                {formatDateHeader(date)} · {items.length}{" "}
                {items.length === 1 ? "agendamento" : "agendamentos"}
              </h2>
              <div className="space-y-2">
                {items.map((apt) => (
                  <AppointmentCard
                    key={apt.id}
                    apt={apt}
                    isAdmin={isAdmin || user?.role === "professional"}
                    onComplete={handleComplete}
                    onNoShow={handleNoShow}
                    onCancel={handleCancel}
                    canChangeStatus={canChangeStatus(apt.status)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Card do agendamento
// ─────────────────────────────────────────────────────────────

interface AppointmentCardProps {
  apt: Appointment;
  isAdmin: boolean;
  onComplete: (id: number) => void;
  onNoShow: (id: number) => void;
  onCancel: (id: number) => void;
  canChangeStatus: boolean;
}

function AppointmentCard({
  apt,
  isAdmin,
  onComplete,
  onNoShow,
  onCancel,
  canChangeStatus,
}: AppointmentCardProps) {
  const status = STATUS_LABELS[apt.status] || STATUS_LABELS.scheduled;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span className="text-white font-semibold">
                {apt.start_time.slice(0, 5)} — {apt.end_time.slice(0, 5)}
              </span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-lg text-xs font-medium border ${status.bg} ${status.color}`}
            >
              {status.label}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-300 truncate">
                {apt.client_name || "Cliente"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Scissors className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-300 truncate">
                {apt.service_name || "Serviço"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-400 truncate text-xs">
                {apt.professional_name || "Profissional"}
              </span>
            </div>
          </div>
        </div>

        {isAdmin && canChangeStatus && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onComplete(apt.id)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 transition"
              title="Marcar como concluído"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNoShow(apt.id)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition"
              title="Marcar falta"
            >
              <AlertCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => onCancel(apt.id)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Cancelar"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatDateHeader(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso + "T00:00:00");

  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  const dayName = d.toLocaleDateString("pt-BR", { weekday: "long" });
  const shortDate = d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });

  if (diffDays === 0) return `Hoje · ${shortDate}`;
  if (diffDays === 1) return `Amanhã · ${shortDate}`;
  if (diffDays === -1) return `Ontem · ${shortDate}`;
  return `${capitalize(dayName)} · ${shortDate}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
