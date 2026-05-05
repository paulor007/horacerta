import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Clock, LogIn, CalendarPlus, KeyRound, X, Mail } from "lucide-react";
import { api } from "../api/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Forgot password modal state ──
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const ok = await login(email, password, remember);
    setLoading(false);

    if (ok) {
      navigate("/painel");
    } else {
      setError("Email ou senha incorretos.");
    }
  };

  const openForgotModal = () => {
    setForgotEmail(email); // pre-popula com email do form se já digitado
    setForgotMessage("");
    setShowForgot(true);
  };

  const closeForgotModal = () => {
    setShowForgot(false);
    setForgotMessage("");
    setForgotEmail("");
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setForgotLoading(true);
    setForgotMessage("");

    const result = await api.postWithError<{ message: string }>(
      "/auth/forgot-password",
      { email: forgotEmail.trim() },
    );

    setForgotLoading(false);

    if (result.ok && result.data) {
      setForgotMessage(result.data.message);
    } else {
      setForgotMessage(
        result.error ||
          "Erro ao processar. Tente novamente em alguns instantes.",
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600/20 mb-4">
            <Clock className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold text-white">HoraCerta</h1>
          <p className="text-slate-400 mt-2">Acesse sua conta</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                required
              />
            </div>

            {/* Lembrar de mim + Esqueci senha */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                />
                <span className="text-slate-400 text-sm">Lembrar de mim</span>
              </label>

              <button
                type="button"
                onClick={openForgotModal}
                className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition flex items-center gap-1"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Esqueci minha senha
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Entrar
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800 text-center">
            <p className="text-slate-500 text-sm mb-3">
              Quer agendar um horário?
            </p>
            <a
              href="/agendar"
              className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-medium transition"
            >
              <CalendarPlus className="w-4 h-4" />
              Agendar online
            </a>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Desenvolvido por Paulo Lavarini
        </p>
      </div>

      {/* ── Forgot Password Modal ── */}
      {showForgot && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={closeForgotModal}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Recuperar senha
                  </h2>
                  <p className="text-xs text-slate-400">
                    Vamos enviar uma nova senha por email
                  </p>
                </div>
              </div>
              <button
                onClick={closeForgotModal}
                className="text-slate-500 hover:text-slate-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!forgotMessage ? (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">
                    Email da sua conta
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                    required
                    autoFocus
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Enviaremos uma senha temporária. Você pode alterar depois
                    nas configurações do perfil.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-medium py-3 rounded-xl transition flex items-center justify-center gap-2"
                >
                  {forgotLoading ? (
                    <div className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Enviar nova senha
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-sm text-emerald-300 leading-relaxed">
                      {forgotMessage}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 text-center">
                  Não esquece de checar a pasta de spam!
                </p>
                <button
                  onClick={closeForgotModal}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 rounded-xl transition"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
