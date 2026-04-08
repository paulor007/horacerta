import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Layout from "./components/layout/Layout";
import BookAppointment from "./pages/BookAppointment";
import MyAppointments from "./pages/MyAppointments";
import Agenda from "./pages/Agenda";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";

function AppContent() {
  return (
    <Layout>
      {(activePage) => {
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
          default:
            return <BookAppointment />;
        }
      }}
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppContent />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
