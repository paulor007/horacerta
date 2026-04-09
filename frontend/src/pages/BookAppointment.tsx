import { useEffect, useState } from "react";
import { CalendarPlus, ChevronRight, Check, ArrowLeft } from "lucide-react";
import Loading from "../components/ui/Loading";
import TimeSlotGrid from "../components/calendar/TimeSlotGrid";
import {
  getProfessionals,
  getServices,
  getAvailability,
  createAppointment,
} from "../api/endpoints";
import type { Professional, Service, TimeSlot } from "../types";

type Step =
  | "professional"
  | "service"
  | "date"
  | "time"
  | "confirm"
  | "success";

export default function BookAppointment() {
  const [step, setStep] = useState<Step>("professional");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Dados da API
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);

  // Seleções do usuário
  const [selectedProf, setSelectedProf] = useState<Professional | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Carregar profissionais e serviços
  useEffect(() => {
    Promise.all([getProfessionals(), getServices()]).then(([p, s]) => {
      setProfessionals(p || []);
      setServices(s || []);
      setLoading(false);
    });
  }, []);

  // Carregar slots quando muda profissional, serviço ou data
  useEffect(() => {
    if (selectedProf && selectedService && selectedDate) {
      getAvailability(selectedProf.id, selectedDate, selectedService.id).then(
        (data) => {
          setSlots(data?.slots || []);
          setSelectedTime(null);
        },
      );
    }
  }, [selectedProf, selectedService, selectedDate]);

  // Gerar próximos 14 dias
  const getNext14Days = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push({
        value: d.toISOString().split("T")[0],
        label: d.toLocaleDateString("pt-BR", {
          weekday: "short",
          day: "2-digit",
          month: "short",
        }),
        weekday: d.getDay(), // 0=dom
      });
    }
    return days;
  };

  const handleSubmit = async () => {
    if (!selectedProf || !selectedService || !selectedDate || !selectedTime)
      return;

    setSubmitting(true);
    setError("");

    // Formatar time: "09:00" → "09:00:00"
    const timeFormatted =
      selectedTime.length === 5 ? selectedTime + ":00" : selectedTime;

    const result = await createAppointment({
      professional_id: selectedProf.id,
      service_id: selectedService.id,
      date: selectedDate,
      start_time: timeFormatted,
    });

    setSubmitting(false);

    if (result) {
      setStep("success");
    } else {
      setError("Erro ao agendar. Horário pode já estar ocupado.");
    }
  };

  const reset = () => {
    setStep("professional");
    setSelectedProf(null);
    setSelectedService(null);
    setSelectedDate("");
    setSelectedTime(null);
    setError("");
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <CalendarPlus className="w-7 h-7 text-emerald-500" />
          Agendar Horário
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Selecione profissional, serviço, data e horário
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-8">
        {["Profissional", "Serviço", "Data", "Horário", "Confirmar"].map(
          (label, i) => {
            const stepOrder: Step[] = [
              "professional",
              "service",
              "date",
              "time",
              "confirm",
            ];
            const currentIndex = stepOrder.indexOf(step);
            const isActive = i <= currentIndex;
            const isCurrent = i === currentIndex;
            return (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    isCurrent
                      ? "bg-emerald-600 text-white"
                      : isActive
                        ? "bg-emerald-600/30 text-emerald-400"
                        : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`text-xs hidden sm:block ${isActive ? "text-slate-300" : "text-slate-600"}`}
                >
                  {label}
                </span>
                {i < 4 && <ChevronRight className="w-4 h-4 text-slate-600" />}
              </div>
            );
          },
        )}
      </div>

      {/* ── Step 1: Profissional ── */}
      {step === "professional" && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">
            Escolha o profissional
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {professionals.map((prof) => (
              <button
                key={prof.id}
                onClick={() => {
                  setSelectedProf(prof);
                  setStep("service");
                }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left hover:border-emerald-500/30 hover:bg-slate-800/50 transition"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center text-emerald-400 font-bold">
                    {prof.user_name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <p className="text-white font-medium">{prof.user_name}</p>
                    <p className="text-emerald-400 text-xs">{prof.specialty}</p>
                  </div>
                </div>
                <p className="text-slate-500 text-xs">{prof.bio}</p>
                <p className="text-slate-600 text-xs mt-2">
                  {prof.work_start.slice(0, 5)} - {prof.work_end.slice(0, 5)}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 2: Serviço ── */}
      {step === "service" && (
        <div>
          <button
            onClick={() => setStep("professional")}
            className="flex items-center gap-1 text-slate-400 text-sm mb-4 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <h2 className="text-lg font-semibold text-white mb-4">
            Escolha o serviço
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {services.map((svc) => (
              <button
                key={svc.id}
                onClick={() => {
                  setSelectedService(svc);
                  setStep("date");
                }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left hover:border-emerald-500/30 hover:bg-slate-800/50 transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white font-medium">{svc.name}</p>
                  <span className="text-emerald-400 font-bold">
                    R$ {Number(svc.price).toFixed(2)}
                  </span>
                </div>
                <p className="text-slate-500 text-xs">{svc.description}</p>
                <p className="text-slate-600 text-xs mt-2">
                  ⏱ {svc.duration_min} minutos
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 3: Data ── */}
      {step === "date" && (
        <div>
          <button
            onClick={() => setStep("service")}
            className="flex items-center gap-1 text-slate-400 text-sm mb-4 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <h2 className="text-lg font-semibold text-white mb-4">
            Escolha a data
          </h2>

          {/* Resumo até aqui */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
            <p className="text-slate-400 text-xs">
              👤 {selectedProf?.user_name} • 📋 {selectedService?.name} (R${" "}
              {Number(selectedService?.price).toFixed(2)})
            </p>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-2">
            {getNext14Days().map((day) => {
              const isWeekend = day.weekday === 0; // domingo
              if (isWeekend) {
                return (
                  <div
                    key={day.value}
                    className="px-3 py-3 rounded-xl text-center bg-slate-800/30 text-slate-600 text-xs cursor-not-allowed"
                  >
                    {day.label}
                  </div>
                );
              }
              return (
                <button
                  key={day.value}
                  onClick={() => {
                    setSelectedDate(day.value);
                    setStep("time");
                  }}
                  className="px-3 py-3 rounded-xl text-center bg-slate-900 border border-slate-800 text-slate-300 text-xs hover:border-emerald-500/30 hover:bg-slate-800/50 transition"
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Step 4: Horário ── */}
      {step === "time" && (
        <div>
          <button
            onClick={() => setStep("date")}
            className="flex items-center gap-1 text-slate-400 text-sm mb-4 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <h2 className="text-lg font-semibold text-white mb-4">
            Escolha o horário
          </h2>

          {/* Resumo */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
            <p className="text-slate-400 text-xs">
              👤 {selectedProf?.user_name} • 📋 {selectedService?.name} • 📅{" "}
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR")}
            </p>
          </div>

          {slots.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <TimeSlotGrid
                slots={slots}
                selectedTime={selectedTime}
                onSelect={(t) => setSelectedTime(t)}
              />

              {selectedTime && (
                <button
                  onClick={() => setStep("confirm")}
                  className="mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-3 rounded-xl transition flex items-center gap-2"
                >
                  Continuar <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Step 5: Confirmação ── */}
      {step === "confirm" && (
        <div>
          <button
            onClick={() => setStep("time")}
            className="flex items-center gap-1 text-slate-400 text-sm mb-4 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <h2 className="text-lg font-semibold text-white mb-6">
            Confirmar Agendamento
          </h2>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Profissional</span>
                <span className="text-white font-medium">
                  {selectedProf?.user_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Serviço</span>
                <span className="text-white font-medium">
                  {selectedService?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Duração</span>
                <span className="text-white">
                  {selectedService?.duration_min} min
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Data</span>
                <span className="text-white font-medium">
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString(
                    "pt-BR",
                    {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                    },
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Horário</span>
                <span className="text-white font-medium">
                  {selectedTime?.slice(0, 5)}
                </span>
              </div>
              <div className="border-t border-slate-800 pt-4 flex justify-between">
                <span className="text-slate-400 font-medium">Total</span>
                <span className="text-emerald-400 font-bold text-lg">
                  R$ {Number(selectedService?.price).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium py-3.5 rounded-xl transition flex items-center justify-center gap-2"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-5 h-5" />
                Confirmar Agendamento
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Sucesso ── */}
      {step === "success" && (
        <div className="text-center py-10">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Agendamento Confirmado!
          </h2>
          <p className="text-slate-400 mb-2">
            {selectedService?.name} com {selectedProf?.user_name}
          </p>
          <p className="text-slate-400 mb-6">
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR")}{" "}
            às {selectedTime?.slice(0, 5)}
          </p>
          <p className="text-slate-500 text-sm mb-8">
            Você receberá um lembrete 24h antes por email e WhatsApp.
          </p>
          <button
            onClick={reset}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-3 rounded-xl transition"
          >
            Agendar Outro
          </button>
        </div>
      )}
    </div>
  );
}
