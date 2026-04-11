import { Check, X, User, Clock } from "lucide-react";
import type { Appointment } from "../../types";

interface Props {
  appointments: Appointment[];
  workStart: string;
  workEnd: string;
  onComplete: (id: number) => void;
  onNoShow: (id: number) => void;
}

const statusConfig: Record<string, { color: string; label: string }> = {
  scheduled: { color: "border-blue-500/30 bg-blue-500/10", label: "Agendado" },
  confirmed: {
    color: "border-emerald-500/30 bg-emerald-500/10",
    label: "Confirmado",
  },
  completed: {
    color: "border-green-500/30 bg-green-500/10",
    label: "Concluído",
  },
  cancelled: {
    color: "border-slate-500/30 bg-slate-500/10",
    label: "Cancelado",
  },
  no_show: { color: "border-red-500/30 bg-red-500/10", label: "Falta" },
};

export default function DayView({
  appointments,
  workStart,
  workEnd,
  onComplete,
  onNoShow,
}: Props) {
  // Gerar todas as horas do expediente
  const startHour = parseInt(workStart.slice(0, 2));
  const endHour = parseInt(workEnd.slice(0, 2));
  const hours: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    hours.push(`${String(h).padStart(2, "0")}:00`);
    hours.push(`${String(h).padStart(2, "0")}:30`);
  }

  // Mapear agendamentos por horário
  const getAppointmentAt = (time: string): Appointment | null => {
    return (
      appointments.find((apt) => {
        const aptStart = apt.start_time.slice(0, 5);
        const aptEnd = apt.end_time.slice(0, 5);
        return time >= aptStart && time < aptEnd;
      }) || null
    );
  };

  // Verificar se é o início do agendamento (para mostrar detalhes)
  const isStartOf = (time: string, apt: Appointment): boolean => {
    return apt.start_time.slice(0, 5) === time;
  };

  return (
    <div className="space-y-1">
      {hours.map((time) => {
        const apt = getAppointmentAt(time);

        if (!apt) {
          return (
            <div
              key={time}
              className="flex items-center gap-3 py-2 px-3 rounded-lg"
            >
              <span className="text-slate-600 text-sm font-mono w-12">
                {time}
              </span>
              <div className="flex-1 h-8 bg-slate-800/30 rounded-lg border border-dashed border-slate-800" />
            </div>
          );
        }

        const cfg = statusConfig[apt.status] || statusConfig.scheduled;
        const isStart = isStartOf(time, apt);

        if (!isStart) {
          // Continuação do bloco — barra fina
          return (
            <div
              key={time}
              className="flex items-center gap-3 py-2 px-3 rounded-lg"
            >
              <span className="text-slate-600 text-sm font-mono w-12">
                {time}
              </span>
              <div
                className={`flex-1 h-8 rounded-lg border-l-4 ${cfg.color} opacity-50`}
              />
            </div>
          );
        }

        // Início do agendamento — card com detalhes
        return (
          <div
            key={time}
            className="flex items-start gap-3 py-2 px-3 rounded-lg"
          >
            <span className="text-slate-400 text-sm font-mono w-12 pt-1">
              {time}
            </span>
            <div className={`flex-1 rounded-xl border-l-4 p-4 ${cfg.color}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white font-medium text-sm">
                      {apt.service_name}
                    </p>
                    <span className="text-xs text-slate-400">
                      {apt.start_time.slice(0, 5)} - {apt.end_time.slice(0, 5)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {apt.client_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {apt.service_duration}min
                    </span>
                    {apt.service_price && (
                      <span className="text-emerald-400">
                        R$ {Number(apt.service_price).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ações (só para scheduled/confirmed) */}
                {(apt.status === "scheduled" || apt.status === "confirmed") && (
                  <div className="flex gap-1.5 ml-3">
                    <button
                      onClick={() => onComplete(apt.id)}
                      className="w-8 h-8 rounded-lg bg-green-500/20 hover:bg-green-500/30 flex items-center justify-center text-green-400 transition"
                      title="Marcar concluído"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onNoShow(apt.id)}
                      className="w-8 h-8 rounded-lg bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center text-red-400 transition"
                      title="Marcar falta"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
