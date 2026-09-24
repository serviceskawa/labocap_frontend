"use client";

import { use } from "react";
import { TestOrderDetailsView } from "@/components/test-orders/TestOrderDetailsView";

interface Props { params: Promise<{ id: string }> }

/** Détails d'une demande d'examen d'anatomie pathologique. */
export default function TestOrderDetailsPage({ params }: Props) {
  const { id } = use(params);
  return <TestOrderDetailsView orderId={id} discipline="PATHOLOGY" />;
}
