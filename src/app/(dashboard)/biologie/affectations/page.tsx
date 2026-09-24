"use client";

import { AssignmentsListView } from "@/components/assignments/AssignmentsListView";

/** Lots d'affectation de biologie — même écran que l'anatomie pathologique. */
export default function BiologieAffectationsPage() {
  return <AssignmentsListView discipline="BIOLOGY" />;
}
