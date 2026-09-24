"use client";

import { use } from "react";
import { TestOrderDetailsView } from "@/components/test-orders/TestOrderDetailsView";

interface Props { params: Promise<{ id: string }> }

/** Détails d'une demande d'analyses de biologie — même écran que l'anatomie pathologique. */
export default function BiologieDemandeDetailsPage({ params }: Props) {
  const { id } = use(params);
  return <TestOrderDetailsView orderId={id} discipline="BIOLOGY" />;
}
