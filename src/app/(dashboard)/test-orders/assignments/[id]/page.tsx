"use client";

import { use } from "react";
import { AssignmentDetailsView } from "@/components/assignments/AssignmentDetailsView";

interface Props { params: Promise<{ id: string }> }

/** Détails d'un lot d'anatomie pathologique — écran partagé avec la biologie. */
export default function AssignmentDetailsPage({ params }: Props) {
  const { id } = use(params);
  return <AssignmentDetailsView assignmentId={id} discipline="PATHOLOGY" />;
}
