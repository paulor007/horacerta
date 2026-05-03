import type { TimeSlot } from "../../types";

interface Props {
  slots: TimeSlot[];
  selectedTime: string | null;
  onSelect: (time: string) => void;
}

/**
 * Grade de horários com visibilidade de slots ocupados.
 *
 * Comportamento por reason:
 * - undefined / livre: botão verde clicável "09:00"
 * - "mine": vermelho "VOCÊ JÁ TEM 09:00" (cliente próprio)
 * - "busy" sem client_name: cinza "OCUPADO 09:00" (privacidade)
 * - "busy" com client_name: amarelo "Carlos Silva - 09:00" (admin/profissional)
 */
export default function TimeSlotGrid({ slots, selectedTime, onSelect }: Props) {
  if (slots.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-6 text-center">
        <p className="text-slate-400 text-sm">
          Nenhum horário disponível nesta data.
        </p>
      </div>
    );
  }

  // Pega só o primeiro nome para encurtar exibição
  const firstName = (full?: string | null): string => {
    if (!full) return "";
    return full.trim().split(" ")[0];
  };

  const availableCount = slots.filter((s) => s.available).length;

  return (
    <div>
      <p className="text-sm text-slate-400 mb-3">
        Selecione um horário ({availableCount} disponíveis):
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {slots.map((slot) => {
          const isSelected = selectedTime === slot.time;
          const timeDisplay = slot.time.slice(0, 5); // "09:00:00" → "09:00"

          // ── Slot livre: verde clicável ──
          if (slot.available) {
            return (
              <button
                key={slot.time}
                onClick={() => onSelect(slot.time)}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isSelected
                    ? "bg-emerald-600 text-white ring-2 ring-emerald-400"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                }`}
              >
                {timeDisplay}
              </button>
            );
          }

          // ── Slot ocupado pelo PRÓPRIO cliente logado ──
          if (slot.reason === "mine") {
            return (
              <button
                key={slot.time}
                disabled
                title="Você já tem agendamento neste horário"
                className="px-2 py-2.5 rounded-xl text-xs bg-red-500/10 text-red-400 border border-red-500/20 cursor-not-allowed"
              >
                <div className="font-bold">{timeDisplay}</div>
                <div className="text-[10px] opacity-80">VOCÊ JÁ TEM</div>
              </button>
            );
          }

          // ── Slot ocupado com NOME do cliente (admin/profissional) ──
          if (slot.client_name) {
            const name = firstName(slot.client_name);
            return (
              <button
                key={slot.time}
                disabled
                title={`Ocupado por ${slot.client_name}`}
                className="px-2 py-2.5 rounded-xl text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20 cursor-not-allowed overflow-hidden"
              >
                <div className="font-bold truncate">{name}</div>
                <div className="text-[10px] opacity-80">{timeDisplay}</div>
              </button>
            );
          }

          // ── Slot ocupado por OUTRO cliente (privacidade — cinza) ──
          return (
            <button
              key={slot.time}
              disabled
              title="Horário ocupado"
              className="px-2 py-2.5 rounded-xl text-xs bg-slate-800/50 text-slate-500 border border-slate-700/50 cursor-not-allowed"
            >
              <div className="font-bold">{timeDisplay}</div>
              <div className="text-[10px] opacity-80">OCUPADO</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
