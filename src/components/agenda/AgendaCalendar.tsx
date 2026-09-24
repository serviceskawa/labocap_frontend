"use client";

/**
 * Calendrier de l'agenda — FullCalendar v6, chargé côté client uniquement
 * (`next/dynamic` avec `ssr: false` dans la page) : la librairie mesure le DOM
 * et injecte sa feuille de style à l'import, deux choses qui n'ont pas de sens
 * pendant le rendu serveur.
 *
 * La barre d'outils native de FullCalendar est désactivée (`headerToolbar`
 * à false) au profit d'une barre bâtie avec les boutons du kit : les boutons
 * `.fc-button` ont leur propre style (angles, couleurs, focus) qui détonnerait
 * à côté du reste de l'application. Elle pilote le calendrier par son API
 * (`calendarRef.current.getApi()`).
 *
 * CSP : FullCalendar crée un `<style data-fullcalendar>` à l'import et y pose
 * le nonce lu dans `<meta name="csp-nonce">` (cf. src/app/layout.tsx). Les
 * couleurs, elles, passent par les variables `--fc-*` redéfinies dans
 * globals.css sur les jetons de la palette.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin, {
  type DateClickArg,
} from "@fullcalendar/interaction";
import frLocale from "@fullcalendar/core/locales/fr";
import type {
  DatesSetArg,
  EventClickArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/utils";
import type { AppointmentCalendarEvent } from "@/lib/api/appointments";

type ViewName = "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek";

const VIEWS: { name: ViewName; label: string }[] = [
  { name: "dayGridMonth", label: "Mois" },
  { name: "timeGridWeek", label: "Semaine" },
  { name: "timeGridDay", label: "Jour" },
  { name: "listWeek", label: "Liste" },
];

/**
 * Classe de priorité (définie dans globals.css) à partir de la classe Laravel
 * que renvoie le backend (`randColor()` : bg-info / bg-warning / bg-danger).
 * La classe Bootstrap d'origine n'est jamais posée telle quelle : elle ne
 * correspond à rien dans ce design system.
 */
function priorityClass(className?: string | null): string {
  switch (className) {
    case "bg-danger":
      return "agenda-event--tres-urgent";
    case "bg-warning":
      return "agenda-event--urgent";
    default:
      return "agenda-event--normal";
  }
}

interface AgendaCalendarProps {
  events: AppointmentCalendarEvent[];
  /** Clic sur une case vide → création pré-remplie (absent : pas de création). */
  onCreateAt?: (date: Date, allDay: boolean) => void;
  /** Clic sur un rendez-vous → fiche en édition / consultation. */
  onOpen: (id: string) => void;
  /**
   * Glisser-déposer d'un rendez-vous (absent : les rendez-vous sont figés).
   * Doit rejeter en cas d'échec : l'évènement est alors remis à sa place.
   */
  onMove?: (id: string, start: Date) => Promise<void>;
}

export default function AgendaCalendar({
  events,
  onCreateAt,
  onOpen,
  onMove,
}: AgendaCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [title, setTitle] = useState("");
  const [view, setView] = useState<ViewName>("dayGridMonth");

  const api = () => calendarRef.current?.getApi();

  const fcEvents = useMemo<EventInput[]>(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title?.trim() || "Rendez-vous",
        start: e.start,
        classNames: ["agenda-event", priorityClass(e.className)],
      })),
    [events],
  );

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setTitle(arg.view.title);
    setView(arg.view.type as ViewName);
  }, []);

  const handleDateClick = useCallback(
    (arg: DateClickArg) => {
      // En vue mois, un clic sur un jour vise la journée : on propose 08:00,
      // l'heure d'ouverture que retenait l'agenda LabPro.
      const date = new Date(arg.date);
      if (arg.allDay) date.setHours(8, 0, 0, 0);
      onCreateAt?.(date, arg.allDay);
    },
    [onCreateAt],
  );

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      arg.jsEvent.preventDefault();
      onOpen(arg.event.id);
    },
    [onOpen],
  );

  const handleEventDrop = useCallback(
    (arg: EventDropArg) => {
      const start = arg.event.start;
      if (!onMove || !start) {
        arg.revert();
        return;
      }
      // Déposé sur une journée entière (vue mois) : on garde l'heure d'origine.
      const target = new Date(start);
      if (arg.event.allDay && arg.oldEvent.start) {
        target.setHours(
          arg.oldEvent.start.getHours(),
          arg.oldEvent.start.getMinutes(),
          0,
          0,
        );
      }
      onMove(arg.event.id, target).catch(() => arg.revert());
    },
    [onMove],
  );

  return (
    <div className="space-y-4">
      {/* Barre d'outils — boutons du kit, pilotant l'API FullCalendar. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <IconButton
            variant="secondary"
            icon={<ChevronLeft className="h-4 w-4" />}
            title="Précédent"
            aria-label="Précédent"
            onClick={() => api()?.prev()}
          />
          <IconButton
            variant="secondary"
            icon={<ChevronRight className="h-4 w-4" />}
            title="Suivant"
            aria-label="Suivant"
            onClick={() => api()?.next()}
          />
          <Button variant="secondary" size="sm" onClick={() => api()?.today()}>
            Aujourd&apos;hui
          </Button>
        </div>

        <h2 className="text-[1.0625rem] font-semibold capitalize tracking-[-0.01em] text-gray-900">
          {title}
        </h2>

        <div
          role="group"
          aria-label="Affichage"
          className="inline-flex gap-1 self-start rounded-[var(--radius-control)] bg-gray-100 p-1 md:self-auto"
        >
          {VIEWS.map((v) => (
            <Button
              key={v.name}
              size="sm"
              variant={view === v.name ? "primary" : "secondary"}
              aria-pressed={view === v.name}
              className={cn(
                view !== v.name && "border-transparent bg-transparent shadow-none",
              )}
              onClick={() => api()?.changeView(v.name)}
            >
              {v.label}
            </Button>
          ))}
        </div>
      </div>

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        locale={frLocale}
        initialView="dayGridMonth"
        headerToolbar={false}
        // Hauteur fixe + défilement interne : en vue semaine/jour, `auto`
        // déroulerait les 24 heures. On ouvre la grille sur 08:00 sans masquer
        // les heures extrêmes, où un rendez-vous resterait sinon invisible.
        contentHeight={680}
        scrollTime="08:00:00"
        navLinks
        dayMaxEvents
        nowIndicator
        // Le backend ne connaît qu'une heure de début : pas de durée à étirer.
        eventDurationEditable={false}
        eventStartEditable={!!onMove}
        selectable={false}
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        noEventsText="Aucun rendez-vous sur cette période"
        events={fcEvents}
        datesSet={handleDatesSet}
        dateClick={onCreateAt ? handleDateClick : undefined}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
      />
    </div>
  );
}
