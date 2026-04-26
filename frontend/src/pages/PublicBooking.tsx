import { useEffect, useState } from "react";
import {
  ChevronRight,
  Check,
  ArrowLeft,
  Clock,
  User,
  Phone,
  Mail,
  Shield,
} from "lucide-react";

interface Professional {
  id: number;
  user_name: string | null;
  specialty: string | null;
  bio: string | null;
  work_start: string;
  work_end: string;
}

interface Service {
  id: number;
  name: string;
  duration_min: number;
  price: number;
  description: string | null;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

type Step =
  | "info"
  | "professional"
  | "service"
  | "date"
  | "time"
  | "confirm"
  | "success";

const STEP_LIST: { key: Step; label: string; short: string }[] = [
  { key: "info", label: "Seus Dados", short: "Dados" },
  { key: "professional", label: "Profissional", short: "Prof." },
  { key: "service", label: "Serviço", short: "Serviço" },
  { key: "date", label: "Data", short: "Data" },
  { key: "time", label: "Horário", short: "Hora" },
  { key: "confirm", label: "Confirmar", short: "OK" },
];

const API_BASE = import.meta.env.VITE_API_URL || "";

async function apiFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T | null> {
  try {
    const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
    const res = await fetch(fullUrl, options);
    if (!res.ok) {
      console.error(`[API] ${url} → ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[API] ${url} erro:`, err);
    return null;
  }
}

export default function PublicBooking() {
  const [step, setStep] = useState<Step>("info");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [empresaName, setEmpresaName] = useState("");

  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [waitlistMsg, setWaitlistMsg] = useState("");
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [slotsKey, setSlotsKey] = useState(0);

  const [selectedProf, setSelectedProf] = useState<Professional | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  const [bookingResult, setBookingResult] = useState<{
    professional_name: string;
    service_name: string;
    date: string;
    start_time: string;
    end_time: string;
  } | null>(null);

  // Carregar tudo na montagem
  useEffect(() => {
    apiFetch<{ name: string }>("/api/v1/public/info").then((data) => {
      if (data) setEmpresaName(data.name);
    });

    apiFetch<Professional[]>("/api/v1/public/professionals").then((data) => {
      setProfessionals(data || []);
    });

    apiFetch<Service[]>("/api/v1/public/services").then((data) => {
      setServices(data || []);
    });
  }, []);

  // Carregar slots quando muda seleção
  useEffect(() => {
    if (selectedProf && selectedService && selectedDate) {
      apiFetch<{ slots: TimeSlot[] }>(
        `/api/v1/public/availability?professional_id=${selectedProf.id}&date=${selectedDate}&service_id=${selectedService.id}`,
      ).then((data) => {
        setSlots(data?.slots || []);
        setSelectedTime(null);
        setLoadingSlots(false);
      });
    }
  }, [selectedProf, selectedService, selectedDate, slotsKey]);

  const getNext14Days = () => {
    const days = [];
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push({
        value: d.toISOString().split("T")[0],
        label: d.toLocaleDateString("pt-BR", {
          weekday: "short",
          day: "2-digit",
          month: "short",
        }),
        weekday: d.getDay(),
      });
    }
    return days;
  };

  const handleSubmit = async () => {
    if (!selectedProf || !selectedService || !selectedDate || !selectedTime)
      return;
    if (!clientName.trim() || !clientPhone.trim() || !clientEmail.trim()) {
      setError("Preencha todos os campos");
      return;
    }

    setSubmitting(true);
    setError("");

    const timeFormatted =
      selectedTime.length === 5 ? selectedTime + ":00" : selectedTime;

    const result = await apiFetch<{
      id: number;
      professional_name: string;
      service_name: string;
      date: string;
      start_time: string;
      end_time: string;
      message: string;
    }>("/api/v1/public/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: clientName.trim(),
        client_phone: clientPhone.trim(),
        client_email: clientEmail.trim(),
        professional_id: selectedProf.id,
        service_id: selectedService.id,
        date: selectedDate,
        start_time: timeFormatted,
      }),
    });

    setSubmitting(false);

    if (result) {
      setBookingResult(result);
      setStep("success");
    } else {
      setError("Erro ao agendar. Horário pode já estar ocupado.");
    }
  };

  const stepIndex = STEP_LIST.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-4 sm:px-6 sm:py-5">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{empresaName || "HoraCerta"}</h1>
            <p className="text-xs text-slate-500">Agendamento Online</p>
          </div>
          <a
            href="/login"
            className="ml-auto text-slate-400 hover:text-emerald-400 text-sm font-medium transition flex items-center gap-1.5"
          >
            Já tem conta? <span className="text-emerald-400">Entrar</span>
          </a>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Step indicator — compacto, sem scroll */}
        {step !== "success" && (
          <div className="flex items-center justify-between mb-8 bg-slate-900/50 rounded-xl p-3">
            {STEP_LIST.map((s, i) => {
              const isActive = i <= stepIndex;
              const isCurrent = i === stepIndex;
              const isDone = i < stepIndex;
              return (
                <div
                  key={s.key}
                  className="flex items-center gap-1 flex-1 last:flex-initial"
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                      isCurrent
                        ? "bg-emerald-600 text-white"
                        : isDone
                          ? "bg-emerald-600/30 text-emerald-400"
                          : "bg-slate-800 text-slate-600"
                    }`}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span
                    className={`text-xs hidden sm:block ${isActive ? "text-slate-300" : "text-slate-600"}`}
                  >
                    {s.label}
                  </span>
                  {i < STEP_LIST.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-1 rounded ${isDone ? "bg-emerald-600/40" : "bg-slate-800"}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Step 1: Dados do cliente ── */}
        {step === "info" && (
          <div>
            <h2 className="text-lg font-semibold mb-1">Seus Dados</h2>
            <p className="text-slate-500 text-sm mb-6">
              Precisamos das suas informações para confirmar o agendamento.
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-slate-400 text-sm mb-1.5 flex items-center gap-2">
                  <User className="w-3.5 h-3.5" /> Nome completo
                </label>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm mb-1.5 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" /> Telefone (WhatsApp)
                </label>
                <input
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="(31) 99999-0000"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm mb-1.5 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" /> Email
                </label>
                <input
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  type="email"
                  placeholder="seu@email.com"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                onClick={() => {
                  const name = clientName.trim();
                  const phone = clientPhone.trim();
                  const email = clientEmail.trim();

                  if (!name || !phone || !email) {
                    setError("Preencha todos os campos");
                    return;
                  }
                  if (name.length < 3 || /^[0-9]+$/.test(name)) {
                    setError("Informe um nome válido (mínimo 3 letras)");
                    return;
                  }
                  if (!/^[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(email)) {
                    setError("Informe um email válido");
                    return;
                  }
                  if (
                    !/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(
                      phone.replace(/\s/g, ""),
                    )
                  ) {
                    setError("Informe um telefone válido. Ex: (31) 99999-0000");
                    return;
                  }
                  setError("");
                  setStep("professional");
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl transition flex items-center justify-center gap-2"
              >
                Continuar <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-6 text-slate-600 text-xs">
              <Shield className="w-3.5 h-3.5" />
              <span>
                Seus dados são usados apenas para o agendamento e lembretes.
              </span>
            </div>
          </div>
        )}

        {/* ── Step 2: Profissional ── */}
        {step === "professional" && (
          <div>
            <button
              onClick={() => setStep("info")}
              className="flex items-center gap-1 text-slate-400 text-sm mb-4 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <h2 className="text-lg font-semibold mb-4">
              Escolha o profissional
            </h2>
            {professionals.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : (
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
                        <p className="text-white font-medium">
                          {prof.user_name}
                        </p>
                        <p className="text-emerald-400 text-xs">
                          {prof.specialty}
                        </p>
                      </div>
                    </div>
                    <p className="text-slate-500 text-xs">{prof.bio}</p>
                    <p className="text-slate-600 text-xs mt-2">
                      {prof.work_start?.slice(0, 5)} -{" "}
                      {prof.work_end?.slice(0, 5)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Serviço ── */}
        {step === "service" && (
          <div>
            <button
              onClick={() => setStep("professional")}
              className="flex items-center gap-1 text-slate-400 text-sm mb-4 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <h2 className="text-lg font-semibold mb-4">Escolha o serviço</h2>
            {services.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : (
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
            )}
          </div>
        )}

        {/* ── Step 4: Data ── */}
        {step === "date" && (
          <div>
            <button
              onClick={() => setStep("service")}
              className="flex items-center gap-1 text-slate-400 text-sm mb-4 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <h2 className="text-lg font-semibold mb-4">Escolha a data</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
              <p className="text-slate-400 text-xs">
                👤 {selectedProf?.user_name} • 📋 {selectedService?.name} (R${" "}
                {Number(selectedService?.price).toFixed(2)})
              </p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-2">
              {getNext14Days().map((day) => {
                if (day.weekday === 0) {
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
                      setLoadingSlots(true);
                      setSlotsKey((k) => k + 1);
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

        {/* ── Step 5: Horário ── */}
        {step === "time" && (
          <div>
            <button
              onClick={() => setStep("date")}
              className="flex items-center gap-1 text-slate-400 text-sm mb-4 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <h2 className="text-lg font-semibold mb-4">Escolha o horário</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
              <p className="text-slate-400 text-xs">
                👤 {selectedProf?.user_name} • 📋 {selectedService?.name} • 📅{" "}
                {new Date(selectedDate + "T12:00:00").toLocaleDateString(
                  "pt-BR",
                )}
              </p>
            </div>
            {loadingSlots ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : slots.length === 0 || slots.every((s) => !s.available) ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                <p className="text-white font-medium mb-2">
                  Horários esgotados nesta data
                </p>
                <p className="text-slate-400 text-sm mb-5">
                  Todos os horários estão ocupados. Entre na lista de espera e
                  te avisaremos se uma vaga abrir.
                </p>
                {waitlistMsg ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-emerald-400 text-sm mb-4">
                    {waitlistMsg}
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      setJoiningWaitlist(true);
                      try {
                        const res = await fetch(
                          `${API_BASE}/api/v1/waitlist/public/join`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              client_name: clientName,
                              client_email: clientEmail,
                              client_phone: clientPhone,
                              professional_id: selectedProf?.id,
                              service_id: selectedService?.id,
                              date: selectedDate,
                            }),
                          },
                        );
                        const data = await res.json();
                        setWaitlistMsg(
                          data.message || "Você entrou na lista de espera!",
                        );
                      } catch {
                        setWaitlistMsg(
                          "Erro ao entrar na fila. Tente novamente.",
                        );
                      }
                      setJoiningWaitlist(false);
                    }}
                    disabled={joiningWaitlist}
                    className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black font-semibold px-6 py-3 rounded-xl transition mb-4"
                  >
                    {joiningWaitlist
                      ? "Entrando..."
                      : "🔔 Entrar na Lista de Espera"}
                  </button>
                )}
                <button
                  onClick={() => {
                    setStep("date");
                    setWaitlistMsg("");
                  }}
                  className="block mx-auto mt-2 text-slate-400 text-sm hover:text-white transition"
                >
                  Escolher outra data
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-400 mb-3">
                  Selecione um horário (
                  {slots.filter((s) => s.available).length} disponíveis):
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {slots.map((slot) => {
                    const timeDisplay = slot.time.slice(0, 5);
                    if (!slot.available) {
                      return (
                        <button
                          key={slot.time}
                          disabled
                          className="px-3 py-2.5 rounded-xl text-sm bg-slate-800/50 text-slate-600 cursor-not-allowed line-through"
                        >
                          {timeDisplay}
                        </button>
                      );
                    }
                    const isSelected = selectedTime === slot.time;
                    return (
                      <button
                        key={slot.time}
                        onClick={() => setSelectedTime(slot.time)}
                        className={`px-3 py-2.5 rounded-xl text-sm font-medium transition ${isSelected ? "bg-emerald-600 text-white ring-2 ring-emerald-400" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"}`}
                      >
                        {timeDisplay}
                      </button>
                    );
                  })}
                </div>
                {selectedTime && (
                  <button
                    onClick={() => setStep("confirm")}
                    className="mt-6 w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-3 rounded-xl transition flex items-center justify-center gap-2"
                  >
                    Continuar <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Step 6: Confirmação ── */}
        {step === "confirm" && (
          <div>
            <button
              onClick={() => setStep("time")}
              className="flex items-center gap-1 text-slate-400 text-sm mb-4 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <h2 className="text-lg font-semibold mb-6">
              Confirmar Agendamento
            </h2>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6 space-y-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Cliente</span>
                <span className="text-white font-medium">{clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Telefone</span>
                <span className="text-white">{clientPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Email</span>
                <span className="text-white">{clientEmail}</span>
              </div>
              <div className="border-t border-slate-800" />
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
                    { weekday: "long", day: "2-digit", month: "long" },
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
                  <Check className="w-5 h-5" /> Confirmar Agendamento
                </>
              )}
            </button>
          </div>
        )}

        {/* ── Sucesso ── */}
        {step === "success" && bookingResult && (
          <div className="text-center py-10">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Agendamento Confirmado!</h2>
            <p className="text-slate-400 mb-2">
              {bookingResult.service_name} com {bookingResult.professional_name}
            </p>
            <p className="text-slate-400 mb-6">
              {new Date(bookingResult.date + "T12:00:00").toLocaleDateString(
                "pt-BR",
              )}{" "}
              às {bookingResult.start_time.slice(0, 5)}
            </p>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 max-w-md mx-auto">
              <p className="text-slate-300 text-sm mb-2">
                Enviamos sua senha de acesso para:
              </p>
              <p className="text-white text-sm font-medium">📧 {clientEmail}</p>
              {clientPhone && (
                <p className="text-white text-sm font-medium">
                  📱 {clientPhone}
                </p>
              )}
              <p className="text-slate-500 text-xs mt-3">
                Use seu email e a senha recebida para acompanhar e gerenciar
                seus agendamentos.
              </p>
            </div>
            <button
              onClick={() => {
                // Limpa sessão anterior (se existir) antes de ir pro login
                localStorage.removeItem("horacerta_token");
                localStorage.removeItem("horacerta_user");
                window.location.href = "/login";
              }}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-8 py-3.5 rounded-xl transition"
            >
              <User className="w-4 h-4" /> Entrar na Minha Conta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
