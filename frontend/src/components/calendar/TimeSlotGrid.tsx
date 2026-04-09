import type { TimeSlot } from "../../types";

interface Props {
  slots: TimeSlot[];
  selectedTime: string | null;
  onSelect: (time: string) => void;
}

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

  return (
    <div>
      <p className="text-sm text-slate-400 mb-3">
        Selecione um horário ({slots.filter((s) => s.available).length}{" "}
        disponíveis):
      </p>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {slots.map((slot) => {
          const isSelected = selectedTime === slot.time;
          const timeDisplay = slot.time.slice(0, 5); // "09:00:00" → "09:00"

          if (!slot.available) {
            return (
              <button
                key={slot.time}
                disabled
                className="px-3 py-2.5 rounded-xl text-sm bg-slate-800/50 text-slate-600 cursor-not-allowed line-through"
              >
                {timeDisplay}
              </button>
            );
          }

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
        })}
      </div>
    </div>
  );
}
