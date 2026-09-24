"use client";

import { TestOrdersListView } from "@/components/test-orders/TestOrdersListView";

/** Demandes d'examen d'anatomie pathologique — écran partagé avec la biologie. */
export default function TestOrdersPage() {
  return <TestOrdersListView discipline="PATHOLOGY" />;
}
