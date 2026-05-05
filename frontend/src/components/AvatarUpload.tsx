import { useRef, useState } from "react";
import { Camera, Loader2, Trash2, Check } from "lucide-react";
import Avatar from "./Avatar";

interface AvatarUploadProps {
  /** URL atual do avatar (null se não tiver) */
  currentUrl: string | null;
  /** Nome do usuário (para fallback de iniciais) */
  userName: string;
  /** Callback após upload bem-sucedido — recebe nova URL */
  onUploaded: (url: string) => Promise<void>;
  /** Callback ao remover avatar atual */
  onRemoved: () => Promise<void>;
  /** Tamanho do avatar (default 120) */
  size?: number;
}

/**
 * Componente de upload de foto de perfil.
 *
 * Faz upload direto pro Cloudinary (sem passar pelo backend).
 * Após upload, chama `onUploaded(url)` para o backend salvar a URL.
 *
 * REQUER 2 variáveis de ambiente no Vercel/`.env`:
 * - VITE_CLOUDINARY_CLOUD_NAME (ex: "dxvkz9m4p")
 * - VITE_CLOUDINARY_UPLOAD_PRESET (ex: "horacerta_avatars")
 */
export default function AvatarUpload({
  currentUrl,
  userName,
  onUploaded,
  onRemoved,
  size = 120,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const handlePickFile = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validação client-side
    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxBytes) {
      setFeedback({ type: "error", msg: "Imagem muito grande. Máx 5MB." });
      return;
    }
    if (!file.type.startsWith("image/")) {
      setFeedback({
        type: "error",
        msg: "Selecione uma imagem (JPG, PNG, WEBP).",
      });
      return;
    }

    if (!cloudName || !uploadPreset) {
      setFeedback({
        type: "error",
        msg: "Cloudinary não configurado. Adicione VITE_CLOUDINARY_* no .env.",
      });
      return;
    }

    setUploading(true);
    setFeedback(null);

    try {
      // Upload direto pro Cloudinary
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!res.ok) {
        throw new Error(`Upload falhou (${res.status})`);
      }

      const data = await res.json();
      const url: string = data.secure_url;

      // Avisa o backend pra salvar a URL
      await onUploaded(url);

      setFeedback({ type: "success", msg: "Foto atualizada!" });

      // Limpa input pra permitir re-upload do mesmo arquivo
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      console.error(err);
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Erro ao enviar foto.",
      });
    } finally {
      setUploading(false);
      // Auto-dismiss feedback
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleRemove = async () => {
    if (!confirm("Remover sua foto de perfil?")) return;
    setRemoving(true);
    setFeedback(null);
    try {
      await onRemoved();
      setFeedback({ type: "success", msg: "Foto removida." });
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Erro ao remover.",
      });
    } finally {
      setRemoving(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const busy = uploading || removing;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar com botão sobreposto */}
      <div className="relative">
        <Avatar src={currentUrl} name={userName} size={size} bordered />

        {/* Botão "câmera" sobreposto */}
        <button
          onClick={handlePickFile}
          disabled={busy}
          className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg disabled:opacity-50 transition"
          title="Trocar foto"
          aria-label="Trocar foto"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Camera className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Input file oculto */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Botão remover (se tem foto) */}
      {currentUrl && !uploading && (
        <button
          onClick={handleRemove}
          disabled={busy}
          className="text-sm text-slate-400 hover:text-red-400 inline-flex items-center gap-1 transition disabled:opacity-50"
        >
          {removing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Trash2 className="w-3 h-3" />
          )}
          Remover foto
        </button>
      )}

      {/* Feedback */}
      {feedback && (
        <div
          className={`text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 ${
            feedback.type === "success"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : "bg-red-500/15 text-red-400 border border-red-500/30"
          }`}
        >
          {feedback.type === "success" && <Check className="w-3.5 h-3.5" />}
          {feedback.msg}
        </div>
      )}

      {/* Hint */}
      {!feedback && (
        <p className="text-xs text-slate-500 text-center max-w-xs">
          JPG, PNG ou WEBP até 5MB
        </p>
      )}
    </div>
  );
}
