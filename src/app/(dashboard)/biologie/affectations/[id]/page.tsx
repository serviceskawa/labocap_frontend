"use client";

import { use } from "react";
import { AssignmentDetailsView } from "@/components/assignments/AssignmentDetailsView";

interface Props { params: Promise<{ id: string }> }

/**
 * Détails d'un lot de biologie — même écran que l'anatomie pathologique.
 * Le bordereau d'impression reste `/test-orders/assignments/[id]/print`,
 * commun aux deux disciplines.
 */
export default function BiologieAffectationDetailsPage({ params }: Props) {
  const { id } = use(params);
  return <AssignmentDetailsView assignmentId={id} discipline="BIOLOGY" />;
}
