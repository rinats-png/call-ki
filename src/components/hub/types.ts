export type TicketRow = {
  id: string;
  category: string | null;
  urgency: string;
  summary: string | null;
  status: string;
  createdAt: string;
  appointmentStart: string | null;
  calendarEventId: string | null;
  messageCount: number;
  customer: { id: string; name: string | null; companyName: string | null; phone: string; postalCode: string | null; customerType: string; status: string };
  assignedEmployee: { id: string; name: string; role: string } | null;
};

export type EmployeeRow = {
  id: string;
  name: string;
  role: string;
  email: string | null;
  servicePostalCodes: string;
  directPhone: string | null;
  active: boolean;
  openTickets: number;
};

export type DashboardData = {
  stats: {
    callsToday: number;
    todayCount: number;
    escalatedOpen: number;
    pendingCount: number;
    plannedToday: number;
    newCustomersToday: number;
    totalCustomers: number;
    minutesThisMonth: number;
    minuteLimit: number | null;
    automationRate: number | null;
  };
  week: { date: string; total: number; critical: number }[];
  tickets: TicketRow[];
  employees: EmployeeRow[];
  integrations: { phone: boolean; voice: boolean; outlook: boolean; email: boolean; sms: boolean };
  serverTime: string;
};

export type MessageRow = { id: string; channel: string; recipient: string; subject: string | null; purpose: string; status: string; error: string | null; createdAt: string };

export type TicketDetail = Omit<TicketRow, "customer" | "assignedEmployee" | "messageCount"> & {
  transcript: string | null;
  notes: string | null;
  appointmentEnd: string | null;
  customer: TicketRow["customer"] & { email: string | null; address: string | null };
  assignedEmployee: EmployeeRow | null;
  assignedEmployeeId: string | null;
  call: { id: string; startedAt: string; durationSec: number | null; recordingUrl: string | null; endReason: string | null } | null;
  messages: MessageRow[];
};
