import { useEffect, useState } from "react";
import { Repeat, ArrowLeft, Calendar, Clock, Check } from "lucide-react";
import {
  getProfessionals,
  getServices,
  createRecurring,
} from "../api/endpoints";
import type { Professional, Service } from "../types";

interface NewRecurringProps {
  onBack: () => void;
  onDone: () => void;
}

const WEEKDAYS = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

const INTERVALS = [
  { value: 7, label: "Toda semana", desc: "A cada 7 dias" },
  { value: 14, label: "A cada 2 semanas", desc: "Quinzenal" },
  { value: 21, label: "A cada 3 semanas", desc: "A cada 21 dias" },
  { value: 28, label: "Mensal", desc: "A cada 28 dias" },
];

export default function NewRecurring({ onBack, onDone }: NewRecurringProps) {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [profId, setProfId] = useState<number | null>(null);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [interval, setInterval] = useState(14);
  const [weekday, setWeekday] = useState(6);
  const [startTime, setStartTime] = useState("10:00");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getProfessionals(), getServices()]).then(([profs, svcs]) => {
      setProfessionals(profs || []);
      setServices(svcs || []);
      // Default start date = amanhã
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setStartDate(tomorrow.toISOString().split("T")[0]);
      setLoading(false);
    });
  }, []);

  const handleSubmit = async () => {
    if (!profId || !serviceId) {
      setError("Selecione profissional e serviço");
      return;
    }
    setError("");
    setSubmitting(true);

    const result = await createRecurring({
      professional_id: profId,
      service_id: serviceId,
      interval_days: interval,
      weekday,
      start_time: startTime + ":00",
      start_date: startDate,
      end_date: endDate || null,
    });

    setSubmitting(false);

    if (result) {
      alert(
        "Recorrência criada! Agendamentos foram gerados para os próximos 3 meses.",
      );
      onDone();
    } else {
      setError(
        "Erro ao criar recorrência. Verifique se o profissional trabalha no dia escolhido.",
      );
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
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-slate-400 text-sm mb-6 hover:text-white transition"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <h1 className="text-2xl font-bold text-white flex items-center gap-3 mb-2">
        <Repeat className="w-7 h-7 text-emerald-500" />
        Nova Recorrência
      </h1>
      <p className="text-slate-400 text-sm mb-8">
        Configure agendamentos automáticos em intervalos regulares
      </p>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 max-w-2xl">
        {/* Profissional */}
        <div>
          <label className="block text-slate-400 text-sm mb-2">
            Profissional
          </label>
          <select
            value={profId || ""}
            onChange={(e) => setProfId(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
          >
            <option value="">Selecione...</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.user_name} — {p.specialty}
              </option>
            ))}
          </select>
        </div>

        {/* Serviço */}
        <div>
          <label className="block text-slate-400 text-sm mb-2">Serviço</label>
          <select
            value={serviceId || ""}
            onChange={(e) => setServiceId(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
          >
            <option value="">Selecione...</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — R$ {Number(s.price).toFixed(2)}
              </option>
            ))}
          </select>
        </div>

        {/* Frequência */}
        <div>
          <label className="block text-slate-400 text-sm mb-2">
            Frequência
          </label>
          <div className="grid grid-cols-2 gap-2">
            {INTERVALS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setInterval(opt.value)}
                className={`p-3 rounded-xl border text-left transition ${
                  interval === opt.value
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                }`}
              >
                <div className="font-medium text-sm">{opt.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Dia da semana */}
        <div>
          <label className="block text-slate-400 text-sm mb-2">
            Dia da semana
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {WEEKDAYS.map((w) => (
              <button
                key={w.value}
                onClick={() => setWeekday(w.value)}
                className={`py-2.5 rounded-xl border text-xs font-medium transition ${
                  weekday === w.value
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {/* Horário */}
        <div>
          <label className="text-slate-400 text-sm mb-2 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" /> Horário
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Datas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-slate-400 text-sm mb-2 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" /> Começar em
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="text-slate-400 text-sm mb-2 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" /> Até (opcional)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 text-sm text-slate-300">
          <p className="font-medium text-emerald-400 mb-1">Resumo</p>
          <p>
            {INTERVALS.find((i) => i.value === interval)?.label.toLowerCase()},{" "}
            toda{" "}
            <strong>
              {WEEKDAYS.find((w) => w.value === weekday)?.label.toLowerCase()}
            </strong>{" "}
            às <strong>{startTime}</strong>
          </p>
          <p className="text-slate-500 text-xs mt-2">
            Serão gerados os próximos 3 meses de agendamentos automaticamente.
            Conflitos são pulados.
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || !profId || !serviceId}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition flex items-center justify-center gap-2"
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Check className="w-4 h-4" />
              Criar Recorrência
            </>
          )}
        </button>
      </div>
    </div>
  );
}
