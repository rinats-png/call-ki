export type TicketRow = {
  id: string;
  pestType: string | null;
  urgency: string;
  summary: string | null;
  status: string;
  createdAt: string;
  outlookEventId: string | null;
  outlookDraftId: string | null;
  customer: { id: string; name: string | null; companyName: string | null; phone: string; postalCode: string | null; customerType: string; status: string };
  assignedEmployee: { id: string; name: string; role: string } | null;
};

export type EmployeeRow = {
  id: string;
  name: string;
  role: string;
  microsoftUpn: string;
  servicePostalCodes: string;
  directPhone: string | null;
  openTickets: number;
};

export type DashboardData = {
  stats: {
    todayCount: number;
    escalatedOpen: number;
    pendingCount: number;
    processedToday: number;
    outlookSyncedToday: number;
    newCustomersToday: number;
    totalCustomers: number;
    automationRate: number | null;
  };
  week: { date: string; total: number; critical: number }[];
  tickets: TicketRow[];
  employees: EmployeeRow[];
  integrations: { voiceProvider: string; voiceConfigured: boolean; twilioConfigured: boolean; graphConfigured: boolean };
  serverTime: string;
};

export type TicketDetail = Omit<TicketRow, "customer" | "assignedEmployee"> & {
  transcript: string | null;
  customer: TicketRow["customer"] & { email: string | null; address: string | null };
  assignedEmployee: EmployeeRow | null;
  assignedEmployeeId: string | null;
};
