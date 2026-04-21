import { useEffect, useState } from "react";
import {
  Repeat,
  Calendar,
  Clock,
  User,
  Scissors,
  Pause,
  Play,
  Trash2,
  RefreshCw,
  Plus,
} from "lucide-react";
import {
  getMyRecurring,
  toggleRecurring,
  deleteRecurring,
  regenerateRecurring,
} from "../api/endpoints";

interface RecurringItem {
  id: number;
  professional_name: string;
  service_name: string;
  interval_days: number;
  weekday: number;
  start_time: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  next_date: string;
  generated_count: number;
}

const WEEKDAY_NAMES = [
  "",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];
const INTERVAL_LABELS: Record<number, string> = {
  7: "Toda semana",
  14: "A cada 2 semanas",
  21: "A cada 3 semanas",
  28: "A cada 4 semanas (mensal)",
};

interface MyRecurringProps {
  onNewRecurring: () => void;
}

export default function MyRecurring({ onNewRecurring }: MyRecurringProps) {
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    getMyRecurring().then((data) => {
      setItems(data || []);
      setLoading(false);
    });
  }, [refreshKey]);

  const handleToggle = async (id: number) => {
    const result = await toggleRecurring(id);
    if (result) setRefreshKey((k) => k + 1);
  };

  const handleDelete = async (id: number) => {
    if (
      !confirm(
        "Cancelar esta recorrência? Os próximos agendamentos também serão cancelados.",
      )
    )
      return;
    const result = await deleteRecurring(id, true);
    if (result) {
      alert(
        `Recorrência cancelada. ${result.future_appointments_cancelled} agendamentos futuros cancelados.`,
      );
      setRefreshKey((k) => k + 1);
    }
  };

  const handleRegenerate = async (id: number) => {
    const result = await regenerateRecurring(id);
    if (result) {
      alert("Agendamentos regenerados!");
      setRefreshKey((k) => k + 1);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Repeat className="w-7 h-7 text-emerald-500" />
            Agendamentos Recorrentes
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Agende automaticamente em intervalos programados
          </p>
        </div>
        <button
          onClick={onNewRecurring}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nova Recorrência
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
          <Repeat className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-white font-medium mb-2">
            Nenhuma recorrência configurada
          </p>
          <p className="text-slate-500 text-sm mb-6">
            Configure uma recorrência para agendar automaticamente
          </p>
          <button
            onClick={onNewRecurring}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition"
          >
            Criar Primeira Recorrência
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`bg-slate-900 border rounded-2xl p-5 ${
                item.is_active
                  ? "border-slate-800"
                  : "border-slate-800 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                        item.is_active
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      {item.is_active ? "Ativa" : "Pausada"}
                    </div>
                    <p className="text-white font-semibold">
                      {INTERVAL_LABELS[item.interval_days]}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-500" />
                      <span className="text-slate-300">
                        {item.professional_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-slate-500" />
                      <span className="text-slate-300">
                        {item.service_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      <span className="text-slate-300">
                        {WEEKDAY_NAMES[item.weekday]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <span className="text-slate-300">
                        {item.start_time.slice(0, 5)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-800 flex items-center gap-4 text-xs text-slate-500">
                    <span>
                      <strong className="text-slate-400">
                        {item.generated_count}
                      </strong>{" "}
                      agendamentos gerados
                    </span>
                    {item.next_date && (
                      <span>
                        Próximo:{" "}
                        <strong className="text-emerald-400">
                          {new Date(
                            item.next_date + "T12:00:00",
                          ).toLocaleDateString("pt-BR")}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleToggle(item.id)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                    title={item.is_active ? "Pausar" : "Reativar"}
                  >
                    {item.is_active ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                  {item.is_active && (
                    <button
                      onClick={() => handleRegenerate(item.id)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition"
                      title="Regenerar agendamentos"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition"
                    title="Cancelar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
