import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  User,
  Lock,
  Phone,
  Mail,
  ArrowLeft,
  Check,
  Trash2,
  Clock,
  Shield,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  changePassword,
  updateProfile,
  getSystemSettings,
  updateSystemSettings,
  runCleanupNow,
} from "../api/endpoints";

interface SettingsProps {
  onBack: () => void;
}

const CLEANUP_OPTIONS = [
  { value: 1, label: "Diário" },
  { value: 7, label: "Semanal" },
  { value: 15, label: "Quinzenal" },
  { value: 30, label: "Mensal" },
  { value: 90, label: "90 dias (padrão)" },
];

export default function Settings({ onBack }: SettingsProps) {
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const [cleanupDays, setCleanupDays] = useState(90);
  const [cleanupEnabled, setCleanupEnabled] = useState(false);
  const [lastCleanup, setLastCleanup] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState(0);
  const [systemMsg, setSystemMsg] = useState("");

  useEffect(() => {
    if (user?.role === "admin") {
      getSystemSettings().then((data) => {
        if (data) {
          setCleanupDays(data.cleanup_days);
          setCleanupEnabled(data.cleanup_enabled);
          setLastCleanup(data.last_cleanup_at);
          setLastCount(data.last_cleanup_count);
        }
      });
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileMsg("");
    setProfileError("");
    const result = await updateProfile({ name, phone, email });
    setSavingProfile(false);
    if (result) {
      setProfileMsg("Perfil atualizado!");
      refreshUser(result);
    } else {
      setProfileError("Erro ao atualizar.");
    }
  };

  const handleChangePassword = async () => {
    setPwdMsg("");
    setPwdError("");
    if (newPassword.length < 6) {
      setPwdError("Nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError("As senhas não coincidem.");
      return;
    }
    setSavingPwd(true);
    const result = await changePassword({
      current_password: currentPassword,
      new_password: newPassword,
    });
    setSavingPwd(false);
    if (result) {
      setPwdMsg("Senha alterada!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setPwdError("Senha atual incorreta.");
    }
  };

  const handleSaveSystem = async () => {
    setSystemMsg("");
    const result = await updateSystemSettings({
      cleanup_days: cleanupDays,
      cleanup_enabled: cleanupEnabled,
    });
    if (result) setSystemMsg("Configurações salvas!");
  };

  const handleCleanupNow = async () => {
    if (
      !confirm(
        `Limpar agendamentos com mais de ${cleanupDays} dias? O faturamento será preservado em snapshots mensais.`,
      )
    )
      return;
    const result = await runCleanupNow();
    if (result) {
      setSystemMsg(
        `${result.deleted} agendamentos removidos — faturamento preservado.`,
      );
      setLastCount(result.deleted);
      setLastCleanup(new Date().toISOString());
    }
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-slate-400 text-sm mb-6 hover:text-white transition"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <h1 className="text-2xl font-bold text-white flex items-center gap-3 mb-8">
        <SettingsIcon className="w-7 h-7 text-emerald-500" />
        Configurações
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Perfil */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-5 flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-400" /> Dados Pessoais
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-slate-400 text-sm mb-1.5 flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> Nome
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-slate-400 text-sm mb-1.5 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" /> Telefone
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-slate-400 text-sm mb-1.5 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" /> Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            {profileMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400 text-sm flex items-center gap-2">
                <Check className="w-4 h-4" /> {profileMsg}
              </div>
            )}
            {profileError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
                {profileError}
              </div>
            )}
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition"
            >
              {savingProfile ? "Salvando..." : "Salvar Perfil"}
            </button>
          </div>
        </div>

        {/* Senha */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-5 flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" /> Alterar Senha
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-slate-400 text-sm mb-1.5">
                Senha atual
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-slate-400 text-sm mb-1.5">
                Nova senha
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-slate-400 text-sm mb-1.5">
                Confirmar nova senha
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            {pwdMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400 text-sm flex items-center gap-2">
                <Check className="w-4 h-4" /> {pwdMsg}
              </div>
            )}
            {pwdError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
                {pwdError}
              </div>
            )}
            <button
              onClick={handleChangePassword}
              disabled={savingPwd || !currentPassword || !newPassword}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition"
            >
              {savingPwd ? "Alterando..." : "Alterar Senha"}
            </button>
          </div>
        </div>

        {/* Sistema — só admin */}
        {user?.role === "admin" && (
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-emerald-400" /> Limpeza Automática
              do Histórico
            </h2>

            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 mb-5 flex items-start gap-3">
              <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-emerald-400 font-medium mb-1">
                  Faturamento sempre preservado
                </p>
                <p className="text-slate-400">
                  Antes de apagar agendamentos antigos, o sistema gera um{" "}
                  <strong>snapshot mensal</strong> com faturamento,
                  atendimentos, faltas e cancelamentos. Você consulta esses
                  dados em <strong>Histórico Anual</strong> indefinidamente.
                </p>
              </div>
            </div>

            <p className="text-slate-500 text-sm mb-5">
              Apaga apenas agendamentos concluídos, cancelados ou marcados como
              falta mais antigos que o período escolhido. Agendamentos futuros
              nunca são apagados.
            </p>

            <div className="space-y-5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cleanupEnabled}
                  onChange={(e) => setCleanupEnabled(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-emerald-500"
                />
                <div>
                  <p className="text-white text-sm font-medium">
                    Ativar limpeza automática
                  </p>
                  <p className="text-slate-500 text-xs">
                    Executa diariamente às 3h da manhã (snapshots gerados antes)
                  </p>
                </div>
              </label>

              <div>
                <label className="block text-slate-400 text-sm mb-2">
                  Manter histórico por
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {CLEANUP_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setCleanupDays(opt.value)}
                      className={`py-3 rounded-xl border text-sm font-medium transition ${
                        cleanupDays === opt.value
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                          : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {lastCleanup && (
                <div className="bg-slate-800/50 rounded-xl p-3 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-400">
                    Última limpeza:{" "}
                    {new Date(lastCleanup).toLocaleString("pt-BR")} —{" "}
                    {lastCount} registros removidos
                  </span>
                </div>
              )}

              {systemMsg && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-400 text-sm flex items-center gap-2">
                  <Check className="w-4 h-4" /> {systemMsg}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSaveSystem}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-xl transition"
                >
                  Salvar Configurações
                </button>
                <button
                  onClick={handleCleanupNow}
                  className="flex-1 bg-slate-800 hover:bg-red-500/10 text-slate-300 hover:text-red-400 font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Limpar Agora
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
