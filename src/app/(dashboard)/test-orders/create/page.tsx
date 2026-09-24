"use client";

import { TestOrderForm } from "@/components/test-orders/TestOrderForm";

/** Nouvelle demande d'examen d'anatomie pathologique. */
export default function TestOrderCreatePage() {
  return <TestOrderForm discipline="PATHOLOGY" mode="create" />;
}
