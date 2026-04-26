import { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";

interface ExportButtonProps {
  onExportCSV: () => void;
  onExportPDF: () => void;
  disabled?: boolean;
  label?: string;
}

export default function ExportButton({
  onExportCSV,
  onExportPDF,
  disabled = false,
  label = "Exportar",
}: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download className="w-4 h-4" />
        {label}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <button
            onClick={() => {
              onExportCSV();
              setOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition text-left"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="font-medium">CSV</p>
              <p className="text-xs text-slate-500">Excel, Google Sheets</p>
            </div>
          </button>
          <button
            onClick={() => {
              onExportPDF();
              setOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition text-left border-t border-slate-800"
          >
            <FileText className="w-4 h-4 text-red-400" />
            <div>
              <p className="font-medium">PDF</p>
              <p className="text-xs text-slate-500">Impressão, compartilhar</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
