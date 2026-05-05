import { useMemo, useState } from "react";

interface AvatarProps {
  /** URL da imagem (do Cloudinary, por exemplo). Se vazia/null, mostra iniciais. */
  src?: string | null;
  /** Nome completo do usuário — usado para gerar iniciais e cor de fundo */
  name: string;
  /** Tamanho do avatar em pixels (default: 40) */
  size?: number;
  /** Classes Tailwind extras (opcional) */
  className?: string;
  /** Se true, mostra borda colorida ao redor */
  bordered?: boolean;
}

/**
 * Componente Avatar reutilizável.
 *
 * - Se `src` for fornecido: mostra a imagem (com fallback automático em caso de erro)
 * - Se não: gera iniciais (1-2 letras) com cor de fundo consistente baseada no nome
 *
 * Cores são determinísticas: mesmo nome sempre gera a mesma cor.
 */
export default function Avatar({
  src,
  name,
  size = 40,
  className = "",
  bordered = false,
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const initials = useMemo(() => getInitials(name), [name]);
  const bgColor = useMemo(() => getColorFromName(name), [name]);

  const sizeStyle = {
    width: `${size}px`,
    height: `${size}px`,
    fontSize: `${Math.floor(size * 0.4)}px`,
  };

  const borderClass = bordered
    ? "ring-2 ring-emerald-500/30 ring-offset-2 ring-offset-slate-900"
    : "";

  // Tem foto e não deu erro? Mostra imagem
  if (src && !imageError) {
    return (
      <img
        src={src}
        alt={name}
        style={sizeStyle}
        className={`rounded-full object-cover shrink-0 ${borderClass} ${className}`}
        onError={() => setImageError(true)}
      />
    );
  }

  // Fallback: iniciais com cor de fundo
  return (
    <div
      style={{ ...sizeStyle, backgroundColor: bgColor }}
      className={`rounded-full flex items-center justify-center text-white font-semibold shrink-0 select-none ${borderClass} ${className}`}
      title={name}
    >
      {initials}
    </div>
  );
}

/**
 * Pega 1-2 iniciais do nome.
 * "Paulo Lavarini" → "PL"
 * "Paulo" → "P"
 * "" → "?"
 */
function getInitials(name: string): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Gera cor consistente baseada no hash do nome.
 * Mesmo nome → mesma cor sempre.
 */
function getColorFromName(name: string): string {
  const colors = [
    "#dc2626", // red-600
    "#ea580c", // orange-600
    "#d97706", // amber-600
    "#65a30d", // lime-600
    "#059669", // emerald-600
    "#0891b2", // cyan-600
    "#2563eb", // blue-600
    "#7c3aed", // violet-600
    "#c026d3", // fuchsia-600
    "#db2777", // pink-600
  ];

  if (!name?.trim()) return colors[0];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}
