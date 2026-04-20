import { api } from "./client";
import type {
  Professional,
  Service,
  Appointment,
  AvailabilityResponse,
  DashboardData,
  RevenueByProfessional,
  User,
} from "../types";

// Profissionais
export const getProfessionals = () =>
  api.get<Professional[]>("/api/v1/professionals");

export const createProfessional = (data: {
  user_id: number;
  specialty?: string;
  bio?: string;
  work_start?: string;
  work_end?: string;
  work_days?: string;
}) => api.post<Professional>("/api/v1/professionals", data);

// Serviços
export const getServices = () => api.get<Service[]>("/api/v1/services");

export const createService = (data: {
  name: string;
  duration_min: number;
  price: number;
  description?: string;
}) => api.post<Service>("/api/v1/services", data);

// Agendamentos
export const getAvailability = (
  profId: number,
  date: string,
  serviceId: number,
) =>
  api.get<AvailabilityResponse>(
    `/api/v1/appointments/available?professional_id=${profId}&date=${date}&service_id=${serviceId}`,
  );

export const createAppointment = (data: {
  professional_id: number;
  service_id: number;
  date: string;
  start_time: string;
}) => api.post<Appointment>("/api/v1/appointments", data);

export const cancelAppointment = (id: number) =>
  api.del<{ message: string }>(`/api/v1/appointments/${id}`);

export const completeAppointment = (id: number) =>
  api.put<Appointment>(`/api/v1/appointments/${id}/complete`);

export const noshowAppointment = (id: number) =>
  api.put<Appointment>(`/api/v1/appointments/${id}/no-show`);

export const getMyAppointments = (status?: string) => {
  const params = status ? `?status=${status}` : "";
  return api.get<Appointment[]>(`/api/v1/appointments/my${params}`);
};

export const getTodayAppointments = (date?: string) => {
  const params = date ? `?date=${date}` : "";
  return api.get<Appointment[]>(`/api/v1/appointments/today${params}`);
};

// Relatórios
export const getDashboard = () =>
  api.get<DashboardData>("/api/v1/reports/dashboard");

export const getRevenue = () =>
  api.get<RevenueByProfessional[]>("/api/v1/reports/revenue");

export const getOccupancy = (days: number = 7) =>
  api.get<{ date: string; total: number; completed: number; rate: number }[]>(
    `/api/v1/reports/occupancy?days=${days}`,
  );

// Admin
export const getUsers = () => api.get<User[]>("/api/v1/users");

export const createUser = (data: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: string;
}) => api.post("/api/v1/users", data);

export const toggleUserActive = (id: number) =>
  api.put<{ message: string }>(`/api/v1/users/${id}/toggle-active`);

// Perfil
export const changePassword = (data: {
  current_password: string;
  new_password: string;
}) => api.put<{ message: string }>("/auth/change-password", data);

export const updateProfile = (data: {
  name?: string;
  phone?: string;
  email?: string;
}) => api.put<User>("/auth/profile", data);

// Lista de espera
export const joinWaitlistPublic = (data: {
  client_name: string;
  client_email: string;
  client_phone: string;
  professional_id: number;
  service_id: number;
  date: string;
}) =>
  fetch("/api/v1/waitlist/public/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => (r.ok ? r.json() : null));

export const joinWaitlist = (data: {
  professional_id: number;
  service_id: number;
  date: string;
}) =>
  api.post<{ message: string; position: number }>(
    "/api/v1/waitlist/join",
    data,
  );

export const getMyWaitlist = () =>
  api.get<
    {
      id: number;
      professional_name: string;
      service_name: string;
      date: string;
      notified: boolean;
    }[]
  >("/api/v1/waitlist/my");

export const leaveWaitlist = (id: number) =>
  api.del<{ message: string }>(`/api/v1/waitlist/${id}`);
