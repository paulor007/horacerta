import { useState, useEffect } from "react";
import { X, MessageCircle, Copy, CheckCircle2, Info } from "lucide-react";

interface WhatsAppPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: number;
  kind?: "confirmation" | "reminder" | "new_booking";
}

interface PreviewData {
  kind: string;
  title: string;
  to_phone: string;
  to_name: string;
  whatsapp_text: string;
}

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function WhatsAppPreviewModal({
  isOpen,
  onClose,
  appointmentId,
  kind = "confirmation",
}: WhatsAppPreviewModalProps) {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !appointmentId) return;

    setLoading(true);
    fetch(
      `${API_BASE}/api/v1/notifications/preview/${appointmentId}?kind=${kind}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setPreview(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isOpen, appointmentId, kind]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!preview) return;
    navigator.clipboard.writeText(preview.whatsapp_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatPhone = (phone: string): string => {
    if (!phone) return "+55 11 9 9999-9999";
    return phone;
  };

  // Renderiza texto com asteriscos como negrito (estilo WhatsApp)
  const renderWhatsAppText = (text: string) => {
    return text.split("\n").map((line, i) => {
      const parts = line.split(/(\*[^*]+\*)/g);
      return (
        <div key={i} style={{ minHeight: line === "" ? "0.5em" : "auto" }}>
          {parts.map((part, j) => {
            if (part.startsWith("*") && part.endsWith("*")) {
              return <strong key={j}>{part.slice(1, -1)}</strong>;
            }
            const italicMatch = part.match(/^_(.+)_$/);
            if (italicMatch) {
              return <em key={j}>{italicMatch[1]}</em>;
            }
            return <span key={j}>{part}</span>;
          })}
        </div>
      );
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-white text-sm font-medium">Preview WhatsApp</p>
              <p className="text-slate-500 text-xs">
                {preview?.title || "Mensagem que seria enviada"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Carregando preview...
          </div>
        ) : !preview ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Não foi possível carregar o preview.
          </div>
        ) : (
          <div className="p-4">
            {/* Aviso */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4 flex gap-2">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-blue-300 text-xs leading-relaxed">
                <strong>Modo demo:</strong> em produção esta mensagem seria
                enviada via WhatsApp Business API (Twilio, Evolution API). Aqui
                mostramos o conteúdo exato que o cliente receberia.
              </p>
            </div>

            {/* Conversa simulada */}
            <div className="bg-[#0b141a] rounded-xl overflow-hidden">
              {/* Header da conversa */}
              <div className="bg-[#202c33] px-3 py-2.5 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                  HC
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[13px] font-medium truncate">
                    HoraCerta
                  </p>
                  <p className="text-emerald-400 text-[11px]">online</p>
                </div>
              </div>

              {/* Conversa */}
              <div className="p-3 min-h-[200px] bg-[#0b141a]">
                <div className="flex justify-end mb-2">
                  <div className="bg-[#005c4b] text-white text-[13px] px-3 py-2 rounded-lg max-w-[90%] whitespace-pre-line shadow leading-relaxed">
                    {renderWhatsAppText(preview.whatsapp_text)}
                    <div className="text-[10px] text-emerald-300/70 text-right mt-1 -mb-1">
                      agora ✓✓
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Destinatário */}
            <div className="mt-4 bg-slate-800/50 rounded-xl p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Para:</span>
                <span className="text-white font-medium">
                  {preview.to_name}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-slate-400">WhatsApp:</span>
                <span className="text-white font-mono">
                  {formatPhone(preview.to_phone)}
                </span>
              </div>
            </div>

            {/* Botão copiar */}
            <button
              onClick={handleCopy}
              className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-sm"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Mensagem copiada!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar mensagem
                </>
              )}
            </button>

            <p className="text-slate-500 text-[11px] text-center mt-3 leading-relaxed">
              Você também receberá a confirmação por <strong>email</strong>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
