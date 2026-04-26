/**
 * Módulo de exportação reutilizável — CSV e PDF.
 *
 * Uso:
 *   exportToCSV("agenda", headers, rows);
 *   exportToPDF({ title, subtitle, headers, rows, kpis });
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─────────────────────────────────────────────────────────────
// CSV
// ─────────────────────────────────────────────────────────────

export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const csvLines: string[] = [];

  // BOM UTF-8 para Excel abrir com acentos corretos
  csvLines.push("\uFEFF" + headers.map(escapeCsvCell).join(";"));

  for (const row of rows) {
    csvLines.push(row.map((c) => escapeCsvCell(String(c ?? ""))).join(";"));
  }

  const csv = csvLines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}_${timestamp()}.csv`);
}

function escapeCsvCell(value: string): string {
  // Se contém ponto-e-vírgula, aspas ou quebra de linha, envolve em aspas
  if (/[";\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ─────────────────────────────────────────────────────────────
// PDF
// ─────────────────────────────────────────────────────────────

export interface PdfKpi {
  label: string;
  value: string;
}

export interface PdfExportOptions {
  filename: string;
  title: string;
  subtitle?: string;
  kpis?: PdfKpi[];
  headers: string[];
  rows: (string | number)[][];
  orientation?: "portrait" | "landscape";
}

export function exportToPDF(opts: PdfExportOptions) {
  const doc = new jsPDF({
    orientation: opts.orientation || "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let cursorY = 15;

  // ── Header ──
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 0, pageWidth, 8, "F");

  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont("helvetica", "bold");
  doc.text("HoraCerta", 15, cursorY);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.setFont("helvetica", "normal");
  doc.text("Sistema de Agendamento Inteligente", 15, cursorY + 5);

  // Data de geração no canto direito
  const now = new Date().toLocaleString("pt-BR");
  doc.setFontSize(9);
  doc.text(`Gerado em ${now}`, pageWidth - 15, cursorY, { align: "right" });

  cursorY += 15;

  // ── Título ──
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text(opts.title, 15, cursorY);
  cursorY += 6;

  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(opts.subtitle, 15, cursorY);
    cursorY += 6;
  }

  cursorY += 3;

  // ── KPIs (cards) ──
  if (opts.kpis && opts.kpis.length > 0) {
    const kpiWidth =
      (pageWidth - 30 - (opts.kpis.length - 1) * 3) / opts.kpis.length;
    let x = 15;

    opts.kpis.forEach((kpi) => {
      doc.setFillColor(241, 245, 249); // slate-100
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.roundedRect(x, cursorY, kpiWidth, 18, 2, 2, "FD");

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "normal");
      doc.text(kpi.label, x + 3, cursorY + 6);

      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.text(kpi.value, x + 3, cursorY + 13);

      x += kpiWidth + 3;
    });

    cursorY += 24;
  }

  // ── Tabela ──
  autoTable(doc, {
    startY: cursorY,
    head: [opts.headers],
    body: opts.rows.map((r) => r.map((c) => String(c ?? ""))),
    theme: "grid",
    headStyles: {
      fillColor: [16, 185, 129],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 15, right: 15 },
  });

  // ── Footer em todas as páginas ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" },
    );
  }

  doc.save(`${opts.filename}_${timestamp()}.pdf`);
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "_" +
    pad(d.getHours()) +
    pad(d.getMinutes())
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
