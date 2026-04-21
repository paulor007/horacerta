import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Layout from "./components/layout/Layout";
import BookAppointment from "./pages/BookAppointment";
import MyAppointments from "./pages/MyAppointments";
import Agenda from "./pages/Agenda";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import MyRecurring from "./pages/MyRecurring";
import NewRecurring from "./pages/NewRecurring";
import YearlyHistory from "./pages/YearlyHistory";
import PublicBooking from "./pages/PublicBooking";
import PublicReview from "./pages/PublicReview";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/agendar" replace />;
  return <>{children}</>;
}

function AppContent() {
  const [recurringPage, setRecurringPage] = useState<"list" | "new">("list");

  return (
    <Layout>
      {(activePage, setActivePage) => {
        switch (activePage) {
          case "book":
            return <BookAppointment />;
          case "my-appointments":
            return <MyAppointments />;
          case "agenda":
            return <Agenda />;
          case "dashboard":
            return <Dashboard />;
          case "admin":
            return <Admin />;
          case "history":
            return <YearlyHistory onBack={() => setActivePage("dashboard")} />;
          case "settings":
            return <Settings onBack={() => setActivePage("my-appointments")} />;
          case "recurring":
            return recurringPage === "new" ? (
              <NewRecurring
                onBack={() => setRecurringPage("list")}
                onDone={() => setRecurringPage("list")}
              />
            ) : (
              <MyRecurring onNewRecurring={() => setRecurringPage("new")} />
            );
          default:
            return <MyAppointments />;
        }
      }}
    </Layout>
  );
}

function LoginGuard() {
  const { user } = useAuth();
  if (user) return <Navigate to="/painel" replace />;
  return <Login />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/agendar" element={<PublicBooking />} />
          <Route path="/avaliar" element={<PublicReview />} />
          <Route path="/login" element={<LoginGuard />} />
          <Route
            path="/painel"
            element={
              <ProtectedRoute>
                <AppContent />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/agendar" replace />} />
          <Route path="*" element={<Navigate to="/agendar" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
