import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Star, Clock, Check, AlertCircle } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";
interface ReviewInfo {
  already_reviewed: boolean;
  rating?: number;
  message?: string;
  client_name?: string;
  professional_name?: string;
  service_name?: string;
  date?: string;
}

export default function PublicReview() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [info, setInfo] = useState<ReviewInfo | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/v1/public/review?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        setInfo(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  const handleSubmit = async () => {
    if (!rating || !token) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(
        `${API_BASE}/api/v1/public/review?token=${token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating, comment: comment.trim() || null }),
        },
      );

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.detail || "Erro ao enviar avaliação.");
      }
    } catch {
      setError("Erro de conexão.");
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Link inválido</h2>
          <p className="text-slate-400">Este link de avaliação não é válido.</p>
        </div>
      </div>
    );
  }

  if (info?.already_reviewed || submitted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {submitted ? "Avaliação Enviada!" : "Já Avaliado"}
          </h2>
          <div className="flex justify-center gap-1 mb-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`w-8 h-8 ${i <= (submitted ? rating : info?.rating || 0) ? "text-yellow-400 fill-yellow-400" : "text-slate-600"}`}
              />
            ))}
          </div>
          <p className="text-slate-400 mb-6">Obrigado pela sua avaliação!</p>
          <a
            href="/agendar"
            className="text-emerald-400 hover:text-emerald-300 text-sm font-medium"
          >
            Agendar novo horário
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold">HoraCerta</h1>
            <p className="text-xs text-slate-500">Avaliação de Atendimento</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold mb-2">Como foi seu atendimento?</h2>
          <p className="text-slate-400 text-sm">
            {info?.service_name} com {info?.professional_name}
            {info?.date &&
              ` • ${new Date(info.date + "T12:00:00").toLocaleDateString("pt-BR")}`}
          </p>
        </div>

        {/* Stars */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              onClick={() => setRating(i)}
              onMouseEnter={() => setHoveredRating(i)}
              onMouseLeave={() => setHoveredRating(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={`w-12 h-12 transition-colors ${
                  i <= (hoveredRating || rating)
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-slate-600 hover:text-slate-500"
                }`}
              />
            </button>
          ))}
        </div>

        {rating > 0 && (
          <p className="text-center text-sm text-yellow-400 mb-6">
            {rating === 1 && "Muito ruim"}
            {rating === 2 && "Ruim"}
            {rating === 3 && "Regular"}
            {rating === 4 && "Bom"}
            {rating === 5 && "Excelente!"}
          </p>
        )}

        {/* Comment */}
        <div className="mb-6">
          <label className="text-slate-400 text-sm mb-2 block">
            Comentário (opcional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Conte como foi sua experiência..."
            rows={3}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!rating || submitting}
          className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black font-semibold py-3.5 rounded-xl transition flex items-center justify-center gap-2"
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          ) : (
            <>
              <Star className="w-5 h-5" />
              Enviar Avaliação
            </>
          )}
        </button>
      </div>
    </div>
  );
}
