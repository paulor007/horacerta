import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Calendar,
  User as UserIcon,
  Scissors,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface ActionResult {
  status: string;
  message: string;
  appointment?: {
    id: number;
    client_name: string;
    service_name: string;
    professional_name: string;
    date: string;
    start_time: string;
    status: string;
  };
}

export default function ConfirmAppointment() {
  const [params] = useSearchParams();
  const token = params.get("token");

  const [result, setResult] = useState<ActionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    if (!token) {
      setError("Token não fornecido. Use o link enviado por email.");
      setLoading(false);
      return;
    }
    setLoadKey((k) => k + 1);
  }, [token]);

  useEffect(() => {
    if (loadKey === 0 || !token) return;
    let cancelled = false;
    const confirmAction = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/v1/public-actions/confirm?token=${encodeURIComponent(token)}`,
          { method: "POST" },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) {
            setError(
              data.detail || "Não foi possível confirmar o agendamento.",
            );
            setLoading(false);
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setResult(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Erro de conexão. Tente novamente em alguns segundos.");
          setLoading(false);
        }
      }
    };
    confirmAction();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600/20 mb-4">
            <Clock className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold text-white">HoraCerta</h1>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          {loading && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-emerald-500 mx-auto animate-spin mb-4" />
              <p className="text-slate-300">Confirmando seu agendamento...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-4">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">
                Não foi possível confirmar
              </h2>
              <p className="text-slate-400 text-sm mb-6">{error}</p>
              <Link
                to="/login"
                className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-3 rounded-xl transition"
              >
                Acessar plataforma
              </Link>
            </div>
          )}

          {result && !error && (
            <div className="text-center py-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">
                {result.status === "already_confirmed"
                  ? "Já confirmado!"
                  : "Presença confirmada!"}
              </h2>
              <p className="text-slate-400 text-sm mb-6">{result.message}</p>

              {result.appointment && (
                <div className="bg-slate-800/50 rounded-xl p-4 text-left space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-slate-300">
                      {formatDate(result.appointment.date)} às{" "}
                      <strong>{result.appointment.start_time}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Scissors className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-slate-300">
                      {result.appointment.service_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <UserIcon className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-slate-300">
                      com {result.appointment.professional_name}
                    </span>
                  </div>
                </div>
              )}

              <Link
                to="/login"
                className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-3 rounded-xl transition"
              >
                Acessar minha conta
              </Link>
            </div>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          HoraCerta — Sistema de Agendamento
        </p>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
