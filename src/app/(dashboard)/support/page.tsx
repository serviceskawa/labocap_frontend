"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Send, Ticket as TicketIcon } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";
import type { UseFormReturn } from "react-hook-form";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { DataTableCard } from "@/components/common/DataTableCard";
import { CrudModal } from "@/components/common/CrudModal";
import { FormField } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import { useAuthStore } from "@/stores/auth.store";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";
import {
  supportApi,
  type Ticket,
  type TicketRequest,
  type TicketStatus,
  type TicketComment,
} from "@/lib/api/support";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


// Statut Laravel : ouvert (success) / repondu (info) / fermé (warning). Le
// backend Java a 4 statuts — on les libelle en français avec les mêmes couleurs.
const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: "Ouvert",
  IN_PROGRESS: "Répondu",
  RESOLVED: "Résolu",
  CLOSED: "Fermé",
};

function statusBadge(status: TicketStatus) {
  if (status === "OPEN") return <Badge variant="success">{STATUS_LABEL[status]}</Badge>;
  if (status === "IN_PROGRESS") return <Badge variant="info">{STATUS_LABEL[status]}</Badge>;
  if (status === "RESOLVED") return <Badge variant="success">{STATUS_LABEL[status]}</Badge>;
  return <Badge variant="warning">{STATUS_LABEL[status]}</Badge>;
}

// Format Laravel : date_format($item->created_at, 'y-m-d (H:i)') → « 25-07-09 (16:01) »
function formatTicketDate(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${String(d.getFullYear()).slice(2)}-${p(d.getMonth() + 1)}-${p(d.getDate())} (${p(d.getHours())}:${p(d.getMinutes())})`;
}

function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Panneau détail + discussion (calque de errors_reports/edit.blade)
// ---------------------------------------------------------------------------

function TicketDetailPanel({ ticket, currentUserId }: { ticket: Ticket; currentUserId: string }) {
  const [messageInput, setMessageInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages, refetch, isLoading } = useQuery({
    queryKey: ["ticket-comments", ticket.id],
    queryFn: () => supportApi.getComments(ticket.id).then((r) => r.data),
    refetchInterval: 10000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (content: string) => supportApi.addComment(ticket.id, { content }),
    onSuccess: () => {
      setMessageInput("");
      refetch();
    },
    onError: (err: AxiosError) =>
      toast.error((err.response?.data as { message?: string })?.message ?? "Erreur lors de l'envoi"),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = messageInput.trim();
    if (trimmed) sendMessageMutation.mutate(trimmed);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Détails du ticket */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h5 className="mb-0 text-[.9375rem] font-semibold text-gray-800">
            Ticket : {ticket.ticketCode ?? ""}
          </h5>
          {statusBadge(ticket.status)}
        </div>
        <FormField label="Objet">
          <input type="text" value={ticket.title ?? ""} readOnly className={inputClass} />
        </FormField>
        <div className="mt-4">
          <FormField label="Description">
            <textarea value={ticket.description ?? ""} readOnly rows={6} className={`${inputClass} resize-none`} />
          </FormField>
        </div>
      </div>

      {/* Discussion sur le ticket */}
      <div className="flex flex-col">
        <h5 className="mb-1 text-[.9375rem] font-semibold text-gray-800">Discussion sur le ticket</h5>
        <p className="mb-3 text-xs text-gray-500">
          L&apos;historique des commentaires pour ce ticket sera disponible ici.
        </p>
        <div className="flex-1 space-y-3 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-3 min-h-[220px] max-h-[340px]">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-gray-400">Chargement…</p>
          ) : !messages || messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Aucun commentaire.</p>
          ) : (
            messages.map((msg: TicketComment) => {
              const isMe = msg.userId === currentUserId;
              return (
                <div key={msg.id} className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                  <span className="px-1 text-xs text-gray-400">{msg.userName ?? "Inconnu"}</span>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-[.9rem] ${
                      isMe ? "rounded-br-sm bg-blue-600 text-white" : "rounded-bl-sm bg-white text-gray-800 border border-gray-200"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  <span className="px-1 text-[11px] text-gray-400">{formatDateTime(msg.createdAt)}</span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
        {ticket.status !== "CLOSED" ? (
          <form onSubmit={handleSend} className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Ecrivez un commentaire"
              className="flex-1 rounded-lg border-0 bg-gray-100 px-3 py-2 text-[.9rem] focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Button
              type="submit"
              aria-label="Envoyer"
              disabled={!messageInput.trim()}
              loading={sendMessageMutation.isPending}
              icon={<Send className="h-4 w-4" />}
            />
          </form>
        ) : (
          <p className="mt-3 border-t border-gray-200 pt-3 text-center text-xs text-gray-400">
            Ce ticket est fermé — les réponses sont désactivées.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formulaire de création (calque create_modal.blade : Objet + Description)
// ---------------------------------------------------------------------------

const ticketSchema = z.object({
  title: z.string().min(1, { message: "L'objet est requis" }),
  description: z.string().min(1, { message: "La description est requise" }),
});
type TicketFormValues = z.infer<typeof ticketSchema>;

function TicketForm({ form }: { form: UseFormReturn<TicketFormValues> }) {
  const {
    register,
    formState: { errors },
  } = form;
  return (
    <div className="space-y-4">
      <p className="mb-1 text-right">
        <span className="text-red-500">*</span>champs obligatoires
      </p>
      <FormField label="Objet" required error={errors.title?.message}>
        <input type="text" {...register("title")} placeholder="Entrer une description" className={inputClass} />
      </FormField>
      <FormField label="Description" required error={errors.description?.message}>
        <textarea
          {...register("description")}
          rows={6}
          placeholder="Veillez fournir plus de détails que possible pour nous permettre de mieux vous aider"
          className={`${inputClass} resize-none`}
        />
      </FormField>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SupportPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading } = useQuery({
    queryKey: ["tickets", { page, size: pageSize }],
    queryFn: () => supportApi.getTickets({ page, size: pageSize }).then((r) => r.data),
  });
  const tickets: Ticket[] = data?.content ?? [];

  const createForm = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { title: "", description: "" },
  });

  const createMutation = useMutation({
    mutationFn: (payload: TicketRequest) => supportApi.createTicket(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Ticket enregistré avec succès");
      setCreateOpen(false);
      createForm.reset();
    },
    onError: (err: AxiosError) =>
      toast.error((err.response?.data as { message?: string })?.message ?? "Une erreur est survenue"),
  });

  // ---- Colonnes (calque errors_reports/index : #, Numéro du ticket, Objet, Dernière actualisation, Status) ----
  const columns: ColumnDef<Ticket>[] = [
    {
      header: "#",
      id: "rownum",
      cell: ({ row }) => row.index + 1 + page * pageSize,
    },
    {
      header: "Numéro du ticket",
      id: "code",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setDetailTicket(row.original)}
          className="text-gray-600 hover:text-blue-600 hover:underline"
        >
          {row.original.ticketCode ?? "—"}
        </button>
      ),
    },
    {
      header: "Objet",
      accessorKey: "title",
      cell: ({ row }) => row.original.title ?? "",
    },
    {
      header: "Dernière actualisation",
      id: "updated",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setDetailTicket(row.original)}
          className="text-gray-600 hover:text-blue-600 hover:underline"
        >
          {formatTicketDate(row.original.createdAt)}
        </button>
      ),
    },
    {
      header: "Status",
      id: "status",
      cell: ({ row }) => (
        <button type="button" onClick={() => setDetailTicket(row.original)}>
          {statusBadge(row.original.status)}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tickets"
        action={
          <button
            onClick={() => {
              createForm.reset();
              setCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-[.15rem] bg-blue-600 px-[.9rem] py-[.45rem] text-[.9rem] font-normal text-white transition-[background-color,box-shadow] hover:shadow-[0_2px_6px_0_rgba(114,124,245,0.5)]"
          >
            <TicketIcon className="h-4 w-4" />
            Créer un ticket
          </button>
        }
      />

      <DataTableCard
        title="Liste des Tickets"
        columns={columns}
        data={tickets}
        isLoading={isLoading}
        pageCount={data?.totalPages ?? 0}
        pageIndex={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(0);
        }}
      />

      {/* Modal création (calque create_modal.blade) */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Signaler un problème"
        contentClassName="max-w-[500px]"
        onSubmit={createForm.handleSubmit((v) => createMutation.mutate({ title: v.title, description: v.description }))}
        submitLabel="Créer un ticket"
        isSubmitting={createMutation.isPending}
      >
        <TicketForm form={createForm} />
      </CrudModal>

      {/* Détail + discussion du ticket */}
      {detailTicket && (
        <CrudModal
          isOpen={!!detailTicket}
          onClose={() => setDetailTicket(null)}
          title={`Ticket : ${detailTicket.ticketCode ?? ""}`}
          contentClassName="max-w-[1000px]"
          footer={<></>}
        >
          <TicketDetailPanel ticket={detailTicket} currentUserId={user?.id ?? ""} />
        </CrudModal>
      )}
    </div>
  );
}
