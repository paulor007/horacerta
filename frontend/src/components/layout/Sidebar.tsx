import { useAuth } from "../../context/AuthContext";
import {
  Clock,
  CalendarPlus,
  CalendarDays,
  LayoutDashboard,
  Users,
  LogOut,
  ListChecks,
  Settings,
  Repeat,
  History,
  BarChart3,
} from "lucide-react";

interface SidebarProps {
  active: string;
  onNavigate: (page: string) => void;
}

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();

  const links: { id: string; icon: React.ElementType; label: string }[] = [];

  if (user?.role === "client") {
    links.push(
      { id: "my-appointments", icon: ListChecks, label: "Meus Agendamentos" },
      { id: "book", icon: CalendarPlus, label: "Novo Agendamento" },
      { id: "recurring", icon: Repeat, label: "Recorrências" },
    );
  }

  if (user?.role === "professional") {
    links.push(
      { id: "agenda", icon: CalendarDays, label: "Minha Agenda" },
      { id: "stats", icon: BarChart3, label: "Estatísticas" },
    );
  }

  if (user?.role === "admin") {
    links.push(
      { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { id: "agenda", icon: CalendarDays, label: "Agenda Geral" },
      { id: "stats", icon: BarChart3, label: "Estatísticas" },
      { id: "history", icon: History, label: "Histórico Anual" },
      { id: "admin", icon: Users, label: "Admin" },
    );
  }

  const handleLogout = () => {
    logout();
    window.location.href = "/agendar";
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">HoraCerta</h1>
            <p className="text-xs text-slate-500">Agendamento Inteligente</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = active === link.id;
          return (
            <button
              key={link.id}
              onClick={() => onNavigate(link.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                isActive
                  ? "bg-emerald-600/15 text-emerald-400 border border-emerald-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Icon className="w-5 h-5" />
              {link.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={() => onNavigate("settings")}
          className={`w-full flex items-center gap-3 mb-3 px-2 py-2 rounded-xl transition ${
            active === "settings"
              ? "bg-emerald-600/15 border border-emerald-500/20"
              : "hover:bg-slate-800"
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-white text-sm font-bold">
            {user?.name?.charAt(0) || "U"}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm text-white font-medium truncate">
              {user?.name}
            </p>
            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
          </div>
          <Settings className="w-4 h-4 text-slate-500" />
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
