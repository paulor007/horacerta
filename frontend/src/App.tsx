import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Layout from "./components/layout/Layout";
import BookAppointment from "./pages/BookAppointment";
import MyAppointments from "./pages/MyAppointments";
import Agenda from "./pages/Agenda";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import PublicBooking from "./pages/PublicBooking";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/agendar" replace />;
  return <>{children}</>;
}

function AppContent() {
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
          case "settings":
            return <Settings onBack={() => setActivePage("my-appointments")} />;
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
