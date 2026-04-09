import { useEffect, useState } from "react";
import { ListChecks, X } from "lucide-react";
import Loading from "../components/ui/Loading";
import { getMyAppointments, cancelAppointment } from "../api/endpoints";
import type { Appointment } from "../types";

const statusConfig: Record<string, { label: string; bg: string }> = {
  scheduled: { label: "Agendado", bg: "bg-blue-500/15 text-blue-400" },
  confirmed: { label: "Confirmado", bg: "bg-emerald-500/15 text-emerald-400" },
  completed: { label: "Concluído", bg: "bg-green-500/15 text-green-400" },
  cancelled: { label: "Cancelado", bg: "bg-slate-500/15 text-slate-400" },
  no_show: { label: "Falta", bg: "bg-red-500/15 text-red-400" },
};

export default function MyAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    getMyAppointments().then((data: Appointment[] | null) => {
      setAppointments(data || []);
      setLoading(false);
    });
  }, []);

  const handleCancel = async (id: number) => {
    if (!confirm("Tem certeza que deseja cancelar este agendamento?")) return;

    const result = await cancelAppointment(id);
    if (result) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "cancelled" } : a)),
      );
    } else {
      alert("Erro ao cancelar. Pode estar fora do prazo de 2h.");
    }
  };

  if (loading) return <Loading />;

  const filtered =
    filter === "all"
      ? appointments
      : appointments.filter((a) => a.status === filter);

  // Separar futuros e passados
  const today = new Date().toISOString().split("T")[0];
  const upcoming = filtered.filter(
    (a) => a.date >= today && a.status !== "cancelled",
  );
  const past = filtered.filter(
    (a) => a.date < today || a.status === "cancelled",
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <ListChecks className="w-7 h-7 text-emerald-500" />
          Meus Agendamentos
        </h1>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: "all", label: "Todos" },
          { key: "scheduled", label: "Agendados" },
          { key: "completed", label: "Concluídos" },
          { key: "cancelled", label: "Cancelados" },
          { key: "no_show", label: "Faltas" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filter === f.key
                ? "bg-emerald-600/15 text-emerald-400 border border-emerald-500/20"
                : "bg-slate-800/50 text-slate-400 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Próximos */}
      {upcoming.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-400 uppercase mb-3">
            Próximos
          </h2>
          <div className="space-y-3">
            {upcoming.map((apt) => (
              <AppointmentCard
                key={apt.id}
                apt={apt}
                onCancel={handleCancel}
                showCancel
              />
            ))}
          </div>
        </div>
      )}

      {/* Passados */}
      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase mb-3">
            Histórico
          </h2>
          <div className="space-y-3">
            {past.map((apt) => (
              <AppointmentCard key={apt.id} apt={apt} onCancel={handleCancel} />
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
          <p className="text-slate-400">Nenhum agendamento encontrado.</p>
        </div>
      )}

      <p className="text-slate-600 text-xs text-center mt-6">
        Total: {appointments.length} agendamentos
      </p>
    </div>
  );
}

function AppointmentCard({
  apt,
  onCancel,
  showCancel,
}: {
  apt: Appointment;
  onCancel: (id: number) => void;
  showCancel?: boolean;
}) {
  const cfg = statusConfig[apt.status] || statusConfig.scheduled;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <p className="text-white font-medium">{apt.service_name}</p>
            <span className={`text-xs px-2.5 py-1 rounded-lg ${cfg.bg}`}>
              {cfg.label}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-slate-400 text-sm">👤 {apt.professional_name}</p>
            <p className="text-slate-400 text-sm">
              📅 {new Date(apt.date + "T12:00:00").toLocaleDateString("pt-BR")}{" "}
              • ⏰ {apt.start_time.slice(0, 5)} - {apt.end_time.slice(0, 5)}
            </p>
            {apt.service_price && (
              <p className="text-emerald-400 text-sm font-medium">
                R$ {Number(apt.service_price).toFixed(2)}
              </p>
            )}
          </div>
        </div>

        {showCancel &&
          (apt.status === "scheduled" || apt.status === "confirmed") && (
            <button
              onClick={() => onCancel(apt.id)}
              className="w-9 h-9 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-400 transition"
              title="Cancelar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
      </div>
    </div>
  );
}
