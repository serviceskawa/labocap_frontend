"use client";

import { AssignmentsListView } from "@/components/assignments/AssignmentsListView";

/** Lots d'affectation d'anatomie pathologique — écran partagé avec la biologie. */
export default function AssignmentsPage() {
  return <AssignmentsListView discipline="PATHOLOGY" />;
}
