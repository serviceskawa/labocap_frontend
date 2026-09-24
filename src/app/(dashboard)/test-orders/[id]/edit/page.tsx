"use client";

import { use } from "react";
import { TestOrderForm } from "@/components/test-orders/TestOrderForm";

interface EditPageProps {
  params: Promise<{ id: string }>;
}

/** Modification d'une demande d'examen d'anatomie pathologique. */
export default function TestOrderEditPage({ params }: EditPageProps) {
  const { id } = use(params);
  return <TestOrderForm discipline="PATHOLOGY" mode="edit" orderId={id} />;
}
