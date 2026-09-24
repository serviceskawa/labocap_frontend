"use client";

import { use } from "react";
import { TestOrderForm } from "@/components/test-orders/TestOrderForm";

interface Props {
  params: Promise<{ id: string }>;
}

/** Modification d'une demande d'analyses de biologie. */
export default function BiologieModifierDemandePage({ params }: Props) {
  const { id } = use(params);
  return <TestOrderForm discipline="BIOLOGY" mode="edit" orderId={id} />;
}
