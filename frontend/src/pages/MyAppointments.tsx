import { useEffect, useState } from "react";
import { ListChecks, X, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import Loading from "../components/ui/Loading";
import {
  getMyAppointments,
  cancelAppointmentWithError,
  cleanMyHistory,
} from "../api/endpoints";
import type { Appointment } from "../types";

const statusConfig: Record<string, { label: string; bg: string }> = {
  scheduled: { label: "Agendado", bg: "bg-blue-500/15 text-blue-400" },
  confirmed: { label: "Confirmado", bg: "bg-emerald-500/15 text-emerald-400" },
  completed: { label: "Concluído", bg: "bg-green-500/15 text-green-400" },
  cancelled: { label: "Cancelado", bg: "bg-slate-500/15 text-slate-400" },
  no_show: { label: "Falta", bg: "bg-red-500/15 text-red-400" },
};

interface ConfirmDialog {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  variant: "danger" | "warning";
  onConfirm: () => Promise<void>;
}

export default function MyAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [reloadKey, setReloadKey] = useState(1);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cleaningHistory, setCleaningHistory] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [dialog, setDialog] = useState<ConfirmDialog | null>(null);

  // Recarrega a lista do backend (sem cache local) — padrão loadKey
  useEffect(() => {
    if (reloadKey === 0) return;
    let cancelled = false;
    const fetchData = async () => {
      const data = await getMyAppointments();
      if (cancelled) return;
      setAppointments(data || []);
      setLoading(false);
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Auto-dismiss de feedback após 5s
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(t);
  }, [feedback]);

  const triggerReload = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const askCancel = (apt: Appointment) => {
    const dateLabel = new Date(apt.date + "T12:00:00").toLocaleDateString(
      "pt-BR",
    );
    setDialog({
      open: true,
      title: "Cancelar agendamento?",
      message: `Você está prestes a cancelar:\n\n${apt.service_name} com ${apt.professional_name}\n${dateLabel} às ${apt.start_time.slice(0, 5)}\n\nEsta ação não pode ser desfeita.`,
      confirmLabel: "Sim, cancelar",
      variant: "danger",
      onConfirm: async () => {
        await doCancel(apt.id);
      },
    });
  };

  const doCancel = async (id: number) => {
    setCancellingId(id);
    setDialog(null);

    const result = await cancelAppointmentWithError(id);

    setCancellingId(null);

    if (result.ok) {
      setFeedback({
        type: "success",
        message: "Agendamento cancelado com sucesso.",
      });
      // Refetch (não otimista — garante sincronização)
      triggerReload();
    } else {
      setFeedback({
        type: "error",
        message: result.error || "Não foi possível cancelar. Tente novamente.",
      });
    }
  };

  const askCleanHistory = () => {
    const cleanable = appointments.filter((a) =>
      ["completed", "cancelled", "no_show"].includes(a.status),
    );
    if (cleanable.length === 0) {
      setFeedback({
        type: "error",
        message: "Não há agendamentos antigos para limpar.",
      });
      return;
    }
    setDialog({
      open: true,
      title: "Limpar histórico?",
      message: `Serão removidos ${cleanable.length} agendamentos do seu histórico (concluídos, cancelados e faltas).\n\nAgendamentos ativos NÃO serão afetados.\n\nEsta ação não pode ser desfeita.`,
      confirmLabel: "Sim, limpar histórico",
      variant: "warning",
      onConfirm: async () => {
        await doCleanHistory();
      },
    });
  };

  const doCleanHistory = async () => {
    setCleaningHistory(true);
    setDialog(null);

    const result = await cleanMyHistory();

    setCleaningHistory(false);

    if (result.ok && result.data) {
      setFeedback({
        type: "success",
        message: `${result.data.deleted} agendamentos removidos do histórico.`,
      });
      triggerReload();
    } else {
      setFeedback({
        type: "error",
        message: result.error || "Erro ao limpar histórico.",
      });
    }
  };

  if (loading) return <Loading />;

  const filtered =
    filter === "all"
      ? appointments
      : appointments.filter((a) => a.status === filter);

  // CORREÇÃO: cancelados/concluídos/no-show vão TODOS pro histórico,
  // independente da data. Só "scheduled" e "confirmed" futuros vão pra "Próximos".
  const today = new Date().toISOString().split("T")[0];
  const upcoming = filtered.filter(
    (a) =>
      a.date >= today && (a.status === "scheduled" || a.status === "confirmed"),
  );
  const past = filtered.filter(
    (a) =>
      a.date < today ||
      ["cancelled", "completed", "no_show"].includes(a.status),
  );

  const hasHistory = appointments.some((a) =>
    ["completed", "cancelled", "no_show"].includes(a.status),
  );

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <ListChecks className="w-7 h-7 text-emerald-500" />
          Meus Agendamentos
        </h1>

        {hasHistory && (
          <button
            onClick={askCleanHistory}
            disabled={cleaningHistory}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition disabled:opacity-50"
            title="Remove agendamentos concluídos, cancelados e faltas"
          >
            {cleaningHistory ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Limpar histórico
          </button>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`mb-4 rounded-xl p-3 text-sm border ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: "all", label: "Todos" },
          { key: "scheduled", label: "Agendados" },
          { key: "confirmed", label: "Confirmados" },
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
                onCancel={askCancel}
                cancellingId={cancellingId}
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
              <AppointmentCard
                key={apt.id}
                apt={apt}
                onCancel={askCancel}
                cancellingId={cancellingId}
              />
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

      {/* Modal de confirmação */}
      {dialog?.open && (
        <ConfirmModal
          dialog={dialog}
          onClose={() => setDialog(null)}
          onConfirm={dialog.onConfirm}
        />
      )}
    </div>
  );
}

function AppointmentCard({
  apt,
  onCancel,
  cancellingId,
  showCancel,
}: {
  apt: Appointment;
  onCancel: (apt: Appointment) => void;
  cancellingId: number | null;
  showCancel?: boolean;
}) {
  const cfg = statusConfig[apt.status] || statusConfig.scheduled;
  const isCancelling = cancellingId === apt.id;

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
              onClick={() => onCancel(apt)}
              disabled={isCancelling}
              className="w-9 h-9 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-400 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              title="Cancelar"
            >
              {isCancelling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
            </button>
          )}
      </div>
    </div>
  );
}

function ConfirmModal({
  dialog,
  onClose,
  onConfirm,
}: {
  dialog: ConfirmDialog;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  const colorClass =
    dialog.variant === "danger"
      ? "bg-red-600 hover:bg-red-700"
      : "bg-amber-600 hover:bg-amber-700";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              dialog.variant === "danger"
                ? "bg-red-500/20 text-red-400"
                : "bg-amber-500/20 text-amber-400"
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="text-white font-semibold text-lg">{dialog.title}</h3>
        </div>

        <p className="text-slate-300 text-sm whitespace-pre-line mb-6">
          {dialog.message}
        </p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className={`px-4 py-2.5 rounded-xl text-white font-medium transition disabled:opacity-50 inline-flex items-center gap-2 ${colorClass}`}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
