import apiClient from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Ticket {
  id: string;
  ticketCode?: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedToId?: string;
  userId: string;
  userName?: string;
  branchId?: string;
  createdAt: string;
}

export interface TicketRequest {
  title: string;
  description: string;
  priority?: TicketPriority;
}

export interface TicketUpdateRequest {
  title: string;
  description: string;
  priority?: TicketPriority;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  content: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface Refund {
  id: string;
  invoiceId: string;
  amount: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  invoice?: { id: string };
  requestedBy?: { firstname: string; lastname: string };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const supportApi = {
  getTickets: (params?: Record<string, unknown>) =>
    apiClient.get<{ content: Ticket[]; totalElements: number; totalPages: number }>(
      "/tickets",
      { params }
    ),
  createTicket: (data: TicketRequest) =>
    apiClient.post<Ticket>("/tickets", data),

  /** Badge « Signaler un problème » : tickets encore ouverts. */
  countOpen: () => apiClient.get<{ count: number }>("/tickets/count-open"),
  updateTicket: (id: string, data: TicketUpdateRequest) =>
    apiClient.put<Ticket>(`/tickets/${id}`, data),
  closeTicket: (id: string) =>
    apiClient.patch(`/tickets/${id}/status`, null, { params: { status: 'CLOSED' } }),
  updateStatus: (id: string, status: TicketStatus) =>
    apiClient.patch(`/tickets/${id}/status`, null, { params: { status } }),

  getComments: (ticketId: string) =>
    apiClient.get<TicketComment[]>(`/tickets/${ticketId}/comments`),
  addComment: (ticketId: string, data: { content: string }) =>
    apiClient.post<TicketComment>(`/tickets/${ticketId}/comments`, data),
};
