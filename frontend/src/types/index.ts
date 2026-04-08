export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: "admin" | "professional" | "client";
  is_active: boolean;
}

export interface Professional {
  id: number;
  user_id: number;
  specialty: string | null;
  bio: string | null;
  is_active: boolean;
  work_start: string;
  work_end: string;
  work_days: string;
  user_name: string | null;
}

export interface Service {
  id: number;
  name: string;
  duration_min: number;
  price: number;
  description: string | null;
  is_active: boolean;
}

export interface Appointment {
  id: number;
  client_id: number;
  professional_id: number;
  service_id: number;
  date: string;
  start_time: string;
  end_time: string;
  status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  client_name: string | null;
  professional_name: string | null;
  service_name: string | null;
  service_price: number | null;
  service_duration: number | null;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface AvailabilityResponse {
  professional_id: number;
  professional_name: string;
  date: string;
  slots: TimeSlot[];
}

export interface DashboardData {
  today_appointments: number;
  completed_month: number;
  revenue_month: number;
  noshows_month: number;
  cancelled_month: number;
  occupancy_rate: number;
}

export interface RevenueByProfessional {
  professional_id: number;
  name: string;
  appointments: number;
  revenue: number;
}

export interface WebSocketEvent {
  event: "new" | "cancelled" | "completed" | "no_show" | "rescheduled";
  professional_id: number;
  data: Record<string, unknown>;
}
