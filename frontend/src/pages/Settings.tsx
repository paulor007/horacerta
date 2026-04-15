import { useState } from "react";
import {
  Settings as SettingsIcon,
  User,
  Lock,
  Phone,
  Mail,
  ArrowLeft,
  Check,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { changePassword, updateProfile } from "../api/endpoints";

interface SettingsProps {
  onBack: () => void;
}

export default function Settings({ onBack }: SettingsProps) {
  const { user, refreshUser } = useAuth();

  // Profile
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileMsg("");
    setProfileError("");

    const result = await updateProfile({ name, phone, email });
    setSavingProfile(false);

    if (result) {
      setProfileMsg("Perfil atualizado com sucesso!");
      refreshUser(result);
    } else {
      setProfileError("Erro ao atualizar perfil.");
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
      setPwdMsg("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setPwdError("Senha atual incorreta.");
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

          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="text-slate-600 text-xs">
              Role:{" "}
              <span className="text-slate-400 capitalize">{user?.role}</span>
            </p>
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
                placeholder="Sua senha atual"
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
                placeholder="Repita a nova senha"
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

          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="text-slate-500 text-xs">
              Se você recebeu uma senha automática ao agendar, recomendamos
              alterá-la aqui.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
