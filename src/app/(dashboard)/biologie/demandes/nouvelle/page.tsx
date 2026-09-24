"use client";

import { TestOrderForm } from "@/components/test-orders/TestOrderForm";

/** Nouvelle demande d'analyses de biologie — formulaire partagé, sans type de bon. */
export default function BiologieNouvelleDemandePage() {
  return <TestOrderForm discipline="BIOLOGY" mode="create" />;
}
