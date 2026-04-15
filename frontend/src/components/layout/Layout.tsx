import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children: (
    activePage: string,
    setActivePage: (page: string) => void,
  ) => React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user } = useAuth();

  const defaultPage =
    user?.role === "client"
      ? "my-appointments"
      : user?.role === "professional"
        ? "agenda"
        : "dashboard";

  const [activePage, setActivePage] = useState(defaultPage);

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar active={activePage} onNavigate={setActivePage} />
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children(activePage, setActivePage)}</div>
      </main>
    </div>
  );
}
