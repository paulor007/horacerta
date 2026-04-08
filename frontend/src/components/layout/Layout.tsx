import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children: (activePage: string) => React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user } = useAuth();

  // Página inicial por role
  const defaultPage =
    user?.role === "client"
      ? "book"
      : user?.role === "professional"
        ? "agenda"
        : "dashboard";

  const [activePage, setActivePage] = useState(defaultPage);

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar active={activePage} onNavigate={setActivePage} />
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children(activePage)}</div>
      </main>
    </div>
  );
}
