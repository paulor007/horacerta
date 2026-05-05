import { useEffect, useState } from "react";
import {
  User as UserIcon,
  Mail,
  Phone,
  Shield,
  Save,
  Loader2,
} from "lucide-react";
import AvatarUpload from "../components/AvatarUpload";
import Loading from "../components/ui/Loading";
import { api } from "../api/client";

interface Me {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  avatar_url: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  professional: "Profissional",
  client: "Cliente",
};

export default function MyProfile() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(1);
  const [savingProfile, setSavingProfile] = useState(false);

  // Form de perfil
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Carrega perfil
  useEffect(() => {
    if (reloadKey === 0) return;
    let cancelled = false;
    const load = async () => {
      const result = await api.getWithError<Me>("/api/v1/users/me");
      if (cancelled) return;
      if (result.ok && result.data) {
        setMe(result.data);
        setEditName(result.data.name);
        setEditPhone(result.data.phone || "");
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Auto-dismiss feedback
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const handleAvatarUploaded = async (url: string) => {
    const result = await api.putWithError<Me>("/api/v1/users/me/avatar", {
      avatar_url: url,
    });
    if (result.ok) {
      setFeedback({ type: "success", message: "Foto atualizada!" });
      setReloadKey((k) => k + 1);
    } else {
      setFeedback({
        type: "error",
        message: result.error || "Erro ao salvar foto.",
      });
    }
  };

  const handleAvatarRemoved = async () => {
    const result = await api.delWithError<Me>("/api/v1/users/me/avatar");
    if (result.ok) {
      setFeedback({ type: "success", message: "Foto removida." });
      setReloadKey((k) => k + 1);
    } else {
      setFeedback({
        type: "error",
        message: result.error || "Erro ao remover foto.",
      });
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setFeedback({ type: "error", message: "Nome não pode ser vazio." });
      return;
    }
    setSavingProfile(true);
    const result = await api.putWithError<Me>("/api/v1/users/me", {
      name: editName.trim(),
      phone: editPhone.trim() || null,
    });
    setSavingProfile(false);
    if (result.ok) {
      setFeedback({ type: "success", message: "Perfil atualizado!" });
      setReloadKey((k) => k + 1);
    } else {
      setFeedback({
        type: "error",
        message: result.error || "Erro ao salvar perfil.",
      });
    }
  };

  if (loading) return <Loading />;
  if (!me)
    return <div className="text-slate-400">Erro ao carregar perfil.</div>;

  const dirty = editName !== me.name || editPhone !== (me.phone || "");

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white flex items-center gap-3 mb-8">
        <UserIcon className="w-7 h-7 text-emerald-500" />
        Meu Perfil
      </h1>

      {feedback && (
        <div
          className={`mb-6 rounded-xl p-3 text-sm border ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Card de Avatar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 mb-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase mb-6 text-center">
          Foto de Perfil
        </h2>
        <div className="flex justify-center">
          <AvatarUpload
            currentUrl={me.avatar_url}
            userName={me.name}
            size={128}
            onUploaded={handleAvatarUploaded}
            onRemoved={handleAvatarRemoved}
          />
        </div>
      </div>

      {/* Card de Dados */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase mb-4">
          Dados Pessoais
        </h2>

        <div className="space-y-4">
          {/* Nome (editável) */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">
              Nome completo
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>

          {/* Telefone (editável) */}
          <div>
            <label className="text-xs text-slate-500 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3 h-3" />
              Telefone (WhatsApp)
            </label>
            <input
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>

          {/* Email (não editável) */}
          <div>
            <label className="text-xs text-slate-500 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3 h-3" />
              Email
            </label>
            <div className="bg-slate-800/50 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-400 text-sm">
              {me.email}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Email não pode ser alterado
            </p>
          </div>

          {/* Role (não editável) */}
          <div>
            <label className="text-xs text-slate-500 mb-1.5 flex items-center gap-1.5">
              <Shield className="w-3 h-3" />
              Tipo de conta
            </label>
            <div className="bg-slate-800/50 border border-slate-800 rounded-xl px-3 py-2.5 text-emerald-400 text-sm">
              {ROLE_LABEL[me.role] || me.role}
            </div>
          </div>
        </div>

        {/* Botão Salvar */}
        <button
          onClick={handleSaveProfile}
          disabled={!dirty || savingProfile}
          className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-sm"
        >
          {savingProfile ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Salvar alterações
        </button>
      </div>
    </div>
  );
}
