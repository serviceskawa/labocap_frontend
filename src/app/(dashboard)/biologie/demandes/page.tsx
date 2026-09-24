"use client";

import { TestOrdersListView } from "@/components/test-orders/TestOrdersListView";

/** Demandes d'analyses de biologie — même écran que l'anatomie pathologique. */
export default function BiologieDemandesPage() {
  return <TestOrdersListView discipline="BIOLOGY" />;
}
