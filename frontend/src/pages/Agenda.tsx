import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff,
} from "lucide-react";
import Loading from "../components/ui/Loading";
import DayView from "../components/calendar/DayView";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  getTodayAppointments,
  getProfessionals,
  completeAppointment,
  noshowAppointment,
} from "../api/endpoints";
import type { Appointment, Professional } from "../types";

export default function Agenda() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Para admin: selecionar profissional
  const [selectedProfId, setSelectedProfId] = useState<number | null>(null);

  // Encontrar profissional do usuário logado (se for professional)
  const [myProfId, setMyProfId] = useState<number | null>(null);

  // WebSocket — conecta com o ID do profissional
  const wsProf = user?.role === "admin" ? undefined : (myProfId ?? undefined);
  const { lastEvent, connected } = useWebSocket(wsProf, user?.role);

  // Carregar profissionais
  useEffect(() => {
    getProfessionals().then((data: Professional[] | null) => {
      const profs = data || [];
      setProfessionals(profs);

      // Se for professional, encontrar seu ID
      if (user?.role === "professional") {
        // O professional.user_name tem o mesmo nome do user
        const myProf = profs.find((p) => p.user_name === user.name);
        if (myProf) setMyProfId(myProf.id);
      }

      // Se for admin, selecionar o primeiro por padrão
      if (user?.role === "admin" && profs.length > 0) {
        setSelectedProfId(profs[0].id);
      }
    });
  }, [user]);

  // Carregar agenda quando muda data
  useEffect(() => {
    getTodayAppointments(currentDate).then((data: Appointment[] | null) => {
      setAppointments(data || []);
      setLoading(false);
    });
  }, [currentDate]);

  // Recarregar quando recebe evento WebSocket
  useEffect(() => {
    if (lastEvent) {
      getTodayAppointments(currentDate).then((data: Appointment[] | null) => {
        setAppointments(data || []);
      });
    }
  }, [lastEvent, currentDate]);

  const handleComplete = async (id: number) => {
    const result = await completeAppointment(id);
    if (result) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "completed" } : a)),
      );
    }
  };

  const handleNoShow = async (id: number) => {
    if (!confirm("Marcar como falta?")) return;
    const result = await noshowAppointment(id);
    if (result) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "no_show" } : a)),
      );
    }
  };

  // Navegação de data
  const changeDate = (days: number) => {
    const d = new Date(currentDate + "T12:00:00");
    d.setDate(d.getDate() + days);
    setCurrentDate(d.toISOString().split("T")[0]);
  };

  const isToday = currentDate === new Date().toISOString().split("T")[0];

  // Filtrar agendamentos por profissional selecionado (admin)
  const filteredAppointments =
    user?.role === "admin" && selectedProfId
      ? appointments.filter((a) => a.professional_id === selectedProfId)
      : appointments;

  // Determinar horário de trabalho
  const currentProf =
    user?.role === "admin"
      ? professionals.find((p) => p.id === selectedProfId)
      : professionals.find((p) => p.id === myProfId);

  const workStart = currentProf?.work_start || "08:00";
  const workEnd = currentProf?.work_end || "20:00";

  // Contadores
  const scheduled = filteredAppointments.filter(
    (a) => a.status === "scheduled" || a.status === "confirmed",
  ).length;
  const completed = filteredAppointments.filter(
    (a) => a.status === "completed",
  ).length;
  const revenue = filteredAppointments
    .filter((a) => a.status === "completed")
    .reduce((acc, a) => acc + (Number(a.service_price) || 0), 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <CalendarDays className="w-7 h-7 text-emerald-500" />
            {user?.role === "admin" ? "Agenda Geral" : "Minha Agenda"}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {user?.role === "professional" && currentProf
              ? `${currentProf.user_name} • ${currentProf.specialty}`
              : "Visualize e gerencie os agendamentos"}
          </p>
        </div>

        {/* WebSocket status */}
        <div className="flex items-center gap-2">
          {connected ? (
            <span className="flex items-center gap-1.5 text-emerald-400 text-xs">
              <Wifi className="w-3.5 h-3.5" /> Tempo real
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-slate-500 text-xs">
              <WifiOff className="w-3.5 h-3.5" /> Offline
            </span>
          )}
        </div>
      </div>

      {/* Seletor de profissional (admin) */}
      {user?.role === "admin" && professionals.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {professionals.map((prof) => (
            <button
              key={prof.id}
              onClick={() => setSelectedProfId(prof.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                selectedProfId === prof.id
                  ? "bg-emerald-600/15 text-emerald-400 border border-emerald-500/20"
                  : "bg-slate-800/50 text-slate-400 hover:text-white"
              }`}
            >
              {prof.user_name}
            </button>
          ))}
        </div>
      )}

      {/* Navegação de data */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => changeDate(-1)}
          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <p className="text-white font-semibold">
            {new Date(currentDate + "T12:00:00").toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
          {isToday && (
            <span className="text-emerald-400 text-xs font-medium">Hoje</span>
          )}
        </div>

        <button
          onClick={() => changeDate(1)}
          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{scheduled}</p>
          <p className="text-slate-500 text-xs">Agendados</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{completed}</p>
          <p className="text-slate-500 text-xs">Concluídos</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">
            R$ {revenue.toFixed(0)}
          </p>
          <p className="text-slate-500 text-xs">Faturamento</p>
        </div>
      </div>

      {/* Agenda do dia */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        {loading ? (
          <Loading />
        ) : (
          <DayView
            appointments={filteredAppointments}
            workStart={workStart}
            workEnd={workEnd}
            onComplete={handleComplete}
            onNoShow={handleNoShow}
          />
        )}
      </div>

      {/* Rodapé */}
      <p className="text-slate-600 text-xs text-center mt-4">
        {filteredAppointments.length} agendamentos neste dia
      </p>
    </div>
  );
}
