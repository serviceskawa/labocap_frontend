"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { LimitedSelect as Select } from "@/components/ui/LimitedSelect";
import { RemoteSelectField } from "@/components/ui/RemoteSelectField";
import {
  doctorToOption,
  hospitalToOption,
  loadDoctorOptions,
  loadHospitalOptions,
  loadPatientOptions,
  loadTestOrderOptions,
  patientToOption,
  type TestOrderOption,
} from "@/lib/api/optionLoaders";
import type { AxiosError } from "axios";

import { UserPlus, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { AlertBox } from "@/components/ui/AlertBox";
import { Button } from "@/components/ui/Button";
import { FormToggle } from "@/components/ui/FormToggle";
import { CrudModal } from "@/components/common/CrudModal";
import { FormField } from "@/components/ui/FormField";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { testOrdersApi, type TestOrderRequest } from "@/lib/api/testOrders";
import { patientsApi, type PatientRequest } from "@/lib/api/patients";
import { doctorsApi } from "@/lib/api/doctors";
import { hospitalsApi } from "@/lib/api/hospitals";
import { openDocFile } from "@/lib/api/docs";
import { typeOrdersApi, type TypeOrder } from "@/lib/api/examens";
import { usersApi } from "@/lib/api/users";
import type { User } from "@/types/auth";
import type { ApiError as ApiErrorType, Discipline } from "@/types/api";
import apiClient from "@/lib/api/client";
import { generatePatientCode, nomComplet } from "@/lib/utils";
import { INPUT_CLASS as inputClass } from "@/lib/ui/inputClass";
import { TEST_ORDER_DISCIPLINES, orderQueryKey } from "./discipline";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContractOption {
  id: string;
  name: string;
  status?: string;
}

interface CashboxStatus {
  isOpen: boolean;
}

/** Recherche des demandes d'examen (toutes) pour la référence Immuno Interne. */
const loadTestOrderReferences = loadTestOrderOptions();

/** « Affecter à » = utilisateur ayant le rôle docteur (signataire), comme Laravel. */
function isDoctorRole(name?: string): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return (
    n.includes("docteur") ||
    n.includes("doctor") ||
    n.includes("medecin") ||
    n.includes("médecin") ||
    n.includes("anapath") ||
    n.includes("anatomopath")
  );
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createOrderSchema = z.object({
  typeOrderId: z.string().min(1, "Le type d'examen est requis"),
  contratId: z.string().min(1, "Le contrat est requis"),
  patientId: z.string().min(1, "Le patient est requis"),
  // Le médecin traitant peut être renseigné plus tard.
  //
  // Au comptoir, le bon arrive parfois sans que le prescripteur soit
  // identifiable sur-le-champ — écriture illisible, médecin absent de la liste,
  // patient qui ne sait plus. L'exiger ici obligeait à inventer un nom pour
  // pouvoir enregistrer, et un nom inventé ne se corrige jamais. Le serveur ne
  // l'a jamais exigé ; seul ce formulaire le faisait.
  doctorId: z.string().optional(),
  hospitalId: z.string().min(1, "L'hôpital est requis"),
  referenceHopital: z.string().optional(),
  examenReferenceInput: z.string().optional(),
  examenReferenceOrderId: z.string().optional(),
  prelevementDate: z.string().min(1, "La date de prélèvement est requise"),
  isUrgent: z.boolean(),
  option: z.boolean().optional(),
});

const editOrderSchema = z.object({
  // Mêmes champs obligatoires que le formulaire d'ajout.
  typeOrderId: z.string().min(1, "Le type d'examen est requis"),
  contratId: z.string().min(1, "Le contrat est requis"),
  patientId: z.string().min(1, "Le patient est requis"),
  // Facultatif, comme à la création : une demande enregistrée sans médecin
  // doit pouvoir être rouverte et complétée. L'exiger ici aurait rendu
  // impossible la correction même des demandes qu'on venait d'autoriser.
  doctorId: z.string().optional(),
  hospitalId: z.string().min(1, "L'hôpital est requis"),
  referenceHopital: z.string().optional(),
  examenReferenceInput: z.string().optional(),
  examenReferenceOrderId: z.string().optional(),
  prelevementDate: z.string().min(1, "La date de prélèvement est requise"),
  isUrgent: z.boolean(),
  // « Affecter à » (docteur signataire) et « Option d'envoi des résultats ».
  attribuateDoctorId: z.string().optional(),
  option: z.string().optional(), // "0" = Appel, "1" = SMS
});

/**
 * Biologie : aucun type de bon. Le backend refuse un `typeOrderId` sur un bon
 * de biologie ; le champ n'est ni affiché ni exigé. Le reste est identique.
 */
const biologyCreateSchema = createOrderSchema.extend({
  typeOrderId: z.string().optional(),
});
const biologyEditSchema = editOrderSchema.extend({
  typeOrderId: z.string().optional(),
});

/**
 * Valeurs du formulaire — surensemble des deux schémas. `option` est un booléen
 * à la création (jamais saisi) et "0"/"1" en modification.
 */
interface OrderFormData {
  typeOrderId?: string;
  contratId: string;
  patientId: string;
  doctorId?: string;
  hospitalId: string;
  referenceHopital?: string;
  examenReferenceInput?: string;
  examenReferenceOrderId?: string;
  prelevementDate: string;
  isUrgent: boolean;
  attribuateDoctorId?: string;
  option?: boolean | string;
}

// Zod schema for the quick patient modal
const quickPatientSchema = z.object({
  firstname: z.string().min(1, "Le prénom est requis"),
  lastname: z.string().min(1, "Le nom est requis"),
  genre: z.enum(["M", "F"]).optional(),
  age: z.string().optional(),
  yearOrMonth: z.boolean().optional(),
  // Facultatif et sans format imposé, à la demande du client (cf. le formulaire
  // patient, qui porte la même règle). Ni le backend ni la base ne l'exigeaient.
  telephone1: z.string().optional(),
  telephone2: z.string().optional(),
  profession: z.string().optional(),
  adresse: z.string().optional(),
});

type QuickPatientFormData = z.infer<typeof quickPatientSchema>;

// ---------------------------------------------------------------------------
// Déduplication des options react-select par libellé
// ---------------------------------------------------------------------------
// Les données de référence (types d'examen, hôpitaux, médecins) contiennent des
// doublons (même nom, ids différents) hérités de la base migrée. On garde la
// première occurrence de chaque libellé pour que chaque nom soit unique dans la
// liste déroulante.
interface SelectOption {
  value: string;
  label: string;
}

function dedupeByLabel(options: SelectOption[]): SelectOption[] {
  const seen = new Set<string>();
  return options.filter((opt) => {
    const key = opt.label?.trim().toLowerCase() ?? "";
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// ---------------------------------------------------------------------------
// Formulaire
// ---------------------------------------------------------------------------

export type TestOrderFormProps =
  | { discipline: Discipline; mode: "create" }
  | { discipline: Discipline; mode: "edit"; orderId: string };

/**
 * Formulaire d'une demande d'examen, en création ou en modification.
 *
 * Anatomie pathologique : les écrans d'origine (`/test-orders/create`,
 * `/test-orders/[id]/edit`), inchangés — mêmes champs, mêmes règles, mêmes
 * charges envoyées.
 *
 * Biologie : sans « Type d'examen » (le bon envoie `typeOrderId: null`) ni les
 * champs de l'examen de référence Immuno, et avec `discipline: "BIOLOGY"`. Les
 * analyses s'ajoutent ensuite sur la page détails, comme en anatomie
 * pathologique.
 */
export function TestOrderForm(props: TestOrderFormProps) {
  const { discipline, mode } = props;
  const orderId = props.mode === "edit" ? props.orderId : "";
  const isEdit = mode === "edit";
  const isBiology = discipline === "BIOLOGY";
  const config = TEST_ORDER_DISCIPLINES[discipline];

  const router = useRouter();
  const queryClient = useQueryClient();

  // Modal state (création uniquement)
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);

  // Libellé des valeurs posées hors du menu (entité créée à la volée) : les
  // listes n'étant plus préchargées, le select ne peut pas le retrouver seul.
  const [patientOption, setPatientOption] = useState<SelectOption | null>(null);
  const [doctorOption, setDoctorOption] = useState<SelectOption | null>(null);
  const [hospitalOption, setHospitalOption] = useState<SelectOption | null>(
    null
  );
  const [referenceOrderOption, setReferenceOrderOption] =
    useState<TestOrderOption | null>(null);

  // Pièce jointe (équivalent examen_file de Laravel) : téléversée après
  // création / mise à jour. En modification, le fichier déjà attaché est lu
  // depuis order.archive.
  const [examenFile, setExamenFile] = useState<File | null>(null);

  const schema = isBiology
    ? isEdit
      ? biologyEditSchema
      : biologyCreateSchema
    : isEdit
      ? editOrderSchema
      : createOrderSchema;

  // Main form
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OrderFormData>({
    resolver: zodResolver(schema) as unknown as Resolver<OrderFormData>,
    defaultValues: {
      isUrgent: false,
    },
  });

  // Quick patient form
  const {
    register: registerPatient,
    handleSubmit: handleSubmitPatient,
    control: controlPatient,
    reset: resetPatient,
    formState: { errors: patientErrors },
  } = useForm<QuickPatientFormData>({
    resolver: zodResolver(quickPatientSchema),
    defaultValues: {
      yearOrMonth: true,
    },
  });

  // Watch type d'examen pour les champs conditionnels Immuno
  const selectedTypeOrderId = watch("typeOrderId");

  // --- Query : demande existante (modification)
  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: orderQueryKey(discipline, "test-order", orderId),
    queryFn: () => testOrdersApi.findById(orderId).then((r) => r.data),
    enabled: isEdit && !!orderId,
  });

  // Préremplir le formulaire dès que la demande est chargée
  useEffect(() => {
    if (!isEdit || !order) return;
    reset({
      typeOrderId: order.typeOrderId ?? "",
      contratId: order.contratId ?? "",
      patientId: order.patientId,
      doctorId: order.doctorId ?? "",
      hospitalId: order.hospitalId ?? "",
      referenceHopital: order.referenceHopital ?? "",
      // Examen de référence pré-rempli depuis test_affiliate, pour externe (texte)
      // comme interne (le select affiche la valeur enregistrée, modifiable).
      examenReferenceInput: order.testAffiliate ?? "",
      examenReferenceOrderId: order.testAffiliate ?? "",
      prelevementDate: order.prelevementDate ?? "",
      isUrgent: order.isUrgent,
      attribuateDoctorId: order.attribuateDoctorId ?? order.assignedToUserId ?? "",
      option: order.option == null ? "" : order.option ? "1" : "0",
    });
    // Interne : amorce l'option affichée du select avec la référence enregistrée
    // (test_affiliate = code). Le champ montre donc la valeur courante, et
    // rechoisir une demande la remplace.
    setReferenceOrderOption(
      order.testAffiliate
        ? ({
            value: order.testAffiliate,
            label: order.testAffiliate,
            order: { code: order.testAffiliate },
          } as unknown as TestOrderOption)
        : null
    );
  }, [isEdit, order, reset]);

  // --- Options déjà sélectionnées à l'ouverture (modification) : les listes
  // (patients, médecins, hôpitaux) sont trop grandes pour être préchargées, on
  // reconstruit le libellé depuis la demande elle-même.
  const initialPatientOption: SelectOption | null = order
    ? {
        value: order.patientId,
        label: `${order.patientFirstname} ${order.patientLastname}`.trim(),
      }
    : null;

  const initialDoctorOption: SelectOption | null =
    order?.doctorId && order.doctorName
      ? { value: order.doctorId, label: order.doctorName }
      : null;

  const initialHospitalOption: SelectOption | null =
    order?.hospitalId && order.hospitalName
      ? { value: order.hospitalId, label: order.hospitalName }
      : null;

  // --- Queries
  const { data: cashboxStatus } = useQuery<CashboxStatus>({
    queryKey: ["cashbox-status"],
    queryFn: async () => {
      try {
        const res = await apiClient.get<CashboxStatus>("/cashbox/status");
        return res.data;
      } catch {
        return { isOpen: true };
      }
    },
    enabled: !isEdit,
  });

  const { data: contractsData } = useQuery<ContractOption[]>({
    queryKey: ["contracts-active"],
    queryFn: async () => {
      const res = await apiClient.get<{ content: ContractOption[] }>(
        "/contracts",
        { params: { size: 1000, status: "ACTIF" } }
      );
      return res.data.content;
    },
  });

  // Types de bon : anatomie pathologique uniquement.
  const { data: typeOrdersData } = useQuery<TypeOrder[]>({
    queryKey: ["type-orders"],
    queryFn: () => typeOrdersApi.findAll().then((r) => r.data),
    enabled: !isBiology,
  });

  // Utilisateurs ayant le rôle docteur → select « Affecter à » (signataire).
  const { data: doctorUsersData } = useQuery({
    queryKey: ["users-doctors"],
    queryFn: () =>
      usersApi.findAll({ size: 500 }).then((r) => r.data.content as User[]),
    enabled: isEdit,
  });
  const doctorUserOptions =
    (doctorUsersData ?? [])
      .filter((u) => (u.roles ?? []).some((r) => isDoctorRole(r.name)))
      .map((u) => ({
        value: u.id,
        label: nomComplet(u.lastname, u.firstname),
      })) ?? [];

  // Détecter le titre du type sélectionné
  const selectedTypeOrder = typeOrdersData?.find(
    (t) => t.id === selectedTypeOrderId
  );
  // Détection robuste : insensible à la casse et aux accents
  const normalizedTypeTitle = normalizeTitle(selectedTypeOrder?.title ?? "");
  const isImmunoExterne =
    !isBiology && normalizedTypeTitle.includes("immuno externe");
  const isImmunoInterne =
    !isBiology && normalizedTypeTitle.includes("immuno interne");

  // Options React Select
  const contractOptions =
    contractsData?.map((c) => ({
      value: c.id,
      label: c.name,
    })) ?? [];

  // Types d'examens — exclut l'id == "1" ; dédoublonnés par libellé à l'ajout
  // (comme l'écran d'ajout d'origine), tels quels en modification.
  const rawTypeOrderOptions =
    typeOrdersData
      ?.filter((t) => t.id !== "1")
      .map((t) => ({
        value: t.id,
        label: t.title,
      })) ?? [];
  const typeOrderOptions = isEdit
    ? rawTypeOrderOptions
    : dedupeByLabel(rawTypeOrderOptions);

  // --- Mutation création commande
  const createMutation = useMutation({
    mutationFn: (data: TestOrderRequest) => testOrdersApi.create(data),
    onSuccess: async (res) => {
      // Téléverser la pièce jointe si un fichier a été choisi (le bon doit
      // exister pour recevoir son archive).
      if (examenFile) {
        try {
          await testOrdersApi.uploadArchive(res.data.id, examenFile);
        } catch {
          toast.error("Demande créée, mais échec de l'envoi de la pièce jointe");
        }
      }
      toast.success(
        isBiology
          ? "Demande d'analyses créée avec succès"
          : "Demande d'examen créée avec succès"
      );
      router.push(config.routes.details(res.data.id));
    },
    onError: (err: AxiosError<ApiErrorType>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la création"
      );
    },
  });

  // --- Mutation mise à jour
  const updateMutation = useMutation({
    mutationFn: (data: TestOrderRequest) => testOrdersApi.update(orderId, data),
    onSuccess: async () => {
      // Téléverser la nouvelle pièce jointe si un fichier a été choisi.
      if (examenFile) {
        try {
          await testOrdersApi.uploadArchive(orderId, examenFile);
        } catch {
          toast.error("Demande mise à jour, mais échec de l'envoi de la pièce jointe");
        }
      }
      // La page détails lit la demande depuis le cache react-query : sans
      // invalidation elle affichait l'ancienne version (pièce jointe absente)
      // jusqu'à un rechargement manuel. On attend le refetch avant de naviguer
      // pour que la page s'ouvre déjà à jour.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orderQueryKey(discipline, "test-order", orderId),
        }),
        queryClient.invalidateQueries({
          queryKey: orderQueryKey(discipline, "test-order-images", orderId),
        }),
        queryClient.invalidateQueries({ queryKey: ["test-orders"] }),
      ]);
      toast.success("Demande mise à jour avec succès");
      router.push(config.routes.details(orderId));
    },
    onError: (err: AxiosError<ApiErrorType>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la mise à jour"
      );
    },
  });

  // --- Mutation création rapide patient
  const createPatientMutation = useMutation({
    mutationFn: (data: PatientRequest) => patientsApi.create(data),
    onSuccess: async (res) => {
      toast.success("Patient créé avec succès");
      // Sélectionner automatiquement le nouveau patient (option fournie au
      // select : il ne peut plus la retrouver dans une liste préchargée).
      setPatientOption(patientToOption(res.data));
      setValue("patientId", res.data.id);
      // Fermer et réinitialiser le modal
      setIsPatientModalOpen(false);
      resetPatient();
    },
    onError: (err: AxiosError<ApiErrorType>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la création du patient"
      );
    },
  });

  // --- Création à la volée d'un médecin depuis le select (si absent de la liste)
  const createDoctorMutation = useMutation({
    mutationFn: (name: string) => doctorsApi.create({ name }),
    onSuccess: (res) => {
      toast.success("Médecin ajouté");
      setDoctorOption(doctorToOption(res.data));
      setValue("doctorId", res.data.id);
    },
    onError: (err: AxiosError<ApiErrorType>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de l'ajout du médecin");
    },
  });

  // --- Création à la volée d'un hôpital depuis le select (si absent de la liste)
  const createHospitalMutation = useMutation({
    mutationFn: (name: string) => hospitalsApi.create({ name }),
    onSuccess: (res) => {
      toast.success("Hôpital ajouté");
      setHospitalOption(hospitalToOption(res.data));
      setValue("hospitalId", res.data.id);
    },
    onError: (err: AxiosError<ApiErrorType>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de l'ajout de l'hôpital");
    },
  });

  const onSubmitCreate = (data: OrderFormData) => {
    const payload: TestOrderRequest = {
      patientId: data.patientId,
      prelevementDate: data.prelevementDate,
      isUrgent: data.isUrgent,
      // Biologie : pas de type de bon — `null` explicite, que le backend exige.
      typeOrderId: isBiology ? null : data.typeOrderId,
      contratId: data.contratId,
      // Omis plutôt qu'envoyé vide : une chaîne vide n'est pas un identifiant,
      // et le serveur la refuserait au lieu de comprendre « pas encore connu ».
      ...(data.doctorId ? { doctorId: data.doctorId } : {}),
      hospitalId: data.hospitalId,
      // Anatomie pathologique : rien d'envoyé, le backend retombe sur PATHOLOGY.
      ...(isBiology ? { discipline } : {}),
    };

    if (data.referenceHopital) payload.referenceHopital = data.referenceHopital;
    if (typeof data.option === "boolean") payload.option = data.option;
    // Examen de référence → colonne test_affiliate côté backend. Externe : texte
    // libre. Interne : code de la demande référencée (comme Laravel).
    if (isImmunoExterne && data.examenReferenceInput)
      payload.testAffiliate = data.examenReferenceInput;
    if (isImmunoInterne)
      payload.testAffiliate =
        referenceOrderOption?.order.code ?? referenceOrderOption?.label ?? "";

    createMutation.mutate(payload);
  };

  const onSubmitEdit = (data: OrderFormData) => {
    const payload: TestOrderRequest = {
      patientId: data.patientId,
      prelevementDate: data.prelevementDate,
      isUrgent: data.isUrgent,
    };

    if (isBiology) payload.typeOrderId = null;
    else if (data.typeOrderId) payload.typeOrderId = data.typeOrderId;
    if (data.contratId) payload.contratId = data.contratId;
    if (data.doctorId) payload.doctorId = data.doctorId;
    if (data.hospitalId) payload.hospitalId = data.hospitalId;
    if (data.referenceHopital) payload.referenceHopital = data.referenceHopital;
    // « Affecter à » → docteur signataire (le backend aligne attribuateDoctorId
    // ET assignedToUserId sur cet utilisateur).
    if (data.attribuateDoctorId)
      payload.assignedToUserId = data.attribuateDoctorId;
    // Option d'envoi des résultats : "0" = Appel (false), "1" = SMS (true).
    if (data.option === "0" || data.option === "1")
      payload.option = data.option === "1";
    // Examen de référence → colonne test_affiliate. Externe : texte. Interne :
    // code de la demande nouvellement choisie, sinon on conserve la valeur existante.
    if (isImmunoExterne && data.examenReferenceInput)
      payload.testAffiliate = data.examenReferenceInput;
    if (isImmunoInterne)
      payload.testAffiliate =
        referenceOrderOption?.order.code ?? order?.testAffiliate ?? "";

    // Le PUT remplace l'intégralité de la demande, examens compris.
    // On réinjecte donc les examens existants pour ne pas les effacer
    // (ils sont gérés sur la page "détails", pas dans ce formulaire).
    if (order?.details?.length) {
      payload.details = order.details.map((d) => ({
        labTestId: d.labTestId,
        price: d.price,
        discount: d.discount,
      }));
    }
    // La discipline ne change pas après création : le backend n'accepte que
    // celle du bon. L'anatomie pathologique ne l'envoie pas.
    if (isBiology) payload.discipline = discipline;

    updateMutation.mutate(payload);
  };

  const onSubmitPatient = (data: QuickPatientFormData) => {
    const payload: PatientRequest = {
      code: generatePatientCode(),
      firstname: data.firstname,
      lastname: data.lastname,
      genre: data.genre ?? "M",
      langue: "fr",
      // Champ vide → absent du payload, comme `telephone2` plus bas : on
      // enregistre l'absence de numéro, pas une chaîne vide.
      telephone1: data.telephone1 || undefined,
      adresse: data.adresse ?? "",
    };

    if (data.age && data.age.trim() !== "") payload.age = Number(data.age);
    if (data.yearOrMonth !== undefined) payload.yearOrMonth = data.yearOrMonth;
    if (data.telephone2) payload.telephone2 = data.telephone2;
    if (data.profession) payload.profession = data.profession;

    createPatientMutation.mutate(payload);
  };

  const isCaisseOuverte = cashboxStatus?.isOpen !== false;

  if (isEdit && orderLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isEdit ? (
        <PageHeader
          title={config.labels.editTitle}
          breadcrumbs={[
            ...config.rootCrumbs,
            { label: config.labels.list, href: config.routes.list },
            { label: `Modifier #${order?.code ?? orderId}` },
          ]}
        />
      ) : (
        <PageHeader
          title={config.labels.createTitle}
          breadcrumbs={[
            ...config.rootCrumbs,
            { label: config.labels.list, href: config.routes.list },
            { label: config.labels.createCrumb },
          ]}
        />
      )}

      {/* Alerte caisse fermée */}
      {!isEdit && !isCaisseOuverte && (
        <AlertBox
          type="warning"
          title="Caisse fermée"
          message="Caisse fermée - Veuillez ouvrir la caisse avant de procéder à l'encaissement."
        />
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <form
          onSubmit={handleSubmit(isEdit ? onSubmitEdit : onSubmitCreate)}
          className="space-y-6"
        >
          {/* Disposition alignée sur Laravel : 2 colonnes en grand écran (md+),
              empilé en petit écran. */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* 1. Type d'examen — anatomie pathologique uniquement */}
            {!isBiology && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  Type d&apos;examen <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="typeOrderId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      instanceId="order-type"
                      inputId="typeOrderId"
                      options={typeOrderOptions}
                      placeholder="Sélectionner un type..."
                      value={
                        typeOrderOptions.find((o) => o.value === field.value) ??
                        null
                      }
                      onChange={(opt) => field.onChange(opt?.value ?? "")}
                      isClearable
                      classNamePrefix="react-select"
                    />
                  )}
                />
                {errors.typeOrderId && (
                  <p className="text-xs text-red-500">
                    {errors.typeOrderId.message}
                  </p>
                )}
              </div>
            )}

            {/* 2. Contrat — colonne droite de la 1re ligne (comme Laravel) */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Contrat <span className="text-red-500">*</span>
              </label>
              <Controller
                name="contratId"
                control={control}
                render={({ field }) => (
                  <Select
                    instanceId="order-contract"
                    inputId="contratId"
                    options={contractOptions}
                    placeholder="Sélectionner un contrat..."
                    value={
                      contractOptions.find((o) => o.value === field.value) ??
                      null
                    }
                    onChange={(opt) => field.onChange(opt?.value ?? "")}
                    isClearable
                    classNamePrefix="react-select"
                  />
                )}
              />
              {errors.contratId && (
                <p className="text-xs text-red-500">
                  {errors.contratId.message}
                </p>
              )}
            </div>

            {/* Examen de référence (conditionnel Immuno) — pleine largeur sous la
                ligne Type/Contrat, exactement comme Laravel (col-md-12). */}
            {isImmunoExterne && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 md:col-span-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">
                    Examen de Référence
                  </label>
                  <input
                    type="text"
                    {...register("examenReferenceInput")}
                    placeholder="Référence de l'examen externe..."
                    className={inputClass}
                  />
                  {errors.examenReferenceInput && (
                    <p className="text-xs text-red-500">
                      {errors.examenReferenceInput.message}
                    </p>
                  )}
                </div>
              </div>
            )}

            {isImmunoInterne && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 md:col-span-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">
                    Demande d&apos;examen de référence
                  </label>
                  <Controller
                    name="examenReferenceOrderId"
                    control={control}
                    render={({ field }) => (
                      <RemoteSelectField
                        id="examenReferenceOrderId"
                        loadOptions={loadTestOrderReferences}
                        value={field.value || null}
                        onChange={(v, opt) => {
                          field.onChange(v ?? "");
                          setReferenceOrderOption(opt);
                        }}
                        selectedOption={referenceOrderOption}
                        placeholder="Rechercher une demande de référence (code, patient)..."
                        isClearable
                      />
                    )}
                  />
                  {errors.examenReferenceOrderId && (
                    <p className="text-xs text-red-500">
                      {errors.examenReferenceOrderId.message}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 3. Patient */}
            <div className="flex flex-col gap-1">
              {isEdit ? (
                <label className="text-sm font-medium text-gray-700">
                  Patient <span className="text-red-500">*</span>
                </label>
              ) : (
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Patient <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsPatientModalOpen(true)}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Nouveau patient
                  </button>
                </div>
              )}
              <Controller
                name="patientId"
                control={control}
                render={({ field }) => (
                  <RemoteSelectField
                    id="patientId"
                    loadOptions={loadPatientOptions}
                    value={field.value || null}
                    onChange={(v) => field.onChange(v ?? "")}
                    selectedOption={isEdit ? initialPatientOption : patientOption}
                    placeholder="Rechercher un patient (nom, code, téléphone)..."
                    isClearable
                  />
                )}
              />
              {errors.patientId && (
                <p className="text-xs text-red-500">
                  {errors.patientId.message}
                </p>
              )}
            </div>

            {/* 4. Médecin traitant */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Médecin traitant{" "}
                <span className="font-normal text-gray-500">
                  — peut être renseigné plus tard
                </span>
              </label>
              <Controller
                name="doctorId"
                control={control}
                render={({ field }) =>
                  isEdit ? (
                    <RemoteSelectField
                      id="doctorId"
                      loadOptions={loadDoctorOptions}
                      value={field.value || null}
                      onChange={(v) => field.onChange(v ?? "")}
                      selectedOption={initialDoctorOption}
                      placeholder="Rechercher un médecin..."
                      isClearable
                    />
                  ) : (
                    <RemoteSelectField
                      id="doctorId"
                      loadOptions={loadDoctorOptions}
                      value={field.value || null}
                      onChange={(v) => field.onChange(v ?? "")}
                      selectedOption={doctorOption}
                      placeholder="Rechercher ou ajouter un médecin..."
                      creatable
                      onCreateOption={(name) => createDoctorMutation.mutate(name)}
                      formatCreateLabel={(name) => `Ajouter le médecin « ${name} »`}
                      isDisabled={createDoctorMutation.isPending}
                      isClearable
                    />
                  )
                }
              />
              {!isEdit && errors.doctorId && (
                <p className="text-xs text-red-500">
                  {errors.doctorId.message}
                </p>
              )}
            </div>

            {/* 5. Hôpital de provenance */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Hôpital de provenance <span className="text-red-500">*</span>
              </label>
              <Controller
                name="hospitalId"
                control={control}
                render={({ field }) =>
                  isEdit ? (
                    <RemoteSelectField
                      id="hospitalId"
                      loadOptions={loadHospitalOptions}
                      value={field.value || null}
                      onChange={(v) => field.onChange(v ?? "")}
                      selectedOption={initialHospitalOption}
                      placeholder="Rechercher un hôpital..."
                      isClearable
                    />
                  ) : (
                    <RemoteSelectField
                      id="hospitalId"
                      loadOptions={loadHospitalOptions}
                      value={field.value || null}
                      onChange={(v) => field.onChange(v ?? "")}
                      selectedOption={hospitalOption}
                      placeholder="Rechercher ou ajouter un hôpital..."
                      creatable
                      onCreateOption={(name) => createHospitalMutation.mutate(name)}
                      formatCreateLabel={(name) => `Ajouter l'hôpital « ${name} »`}
                      isDisabled={createHospitalMutation.isPending}
                      isClearable
                    />
                  )
                }
              />
              {!isEdit && errors.hospitalId && (
                <p className="text-xs text-red-500">
                  {errors.hospitalId.message}
                </p>
              )}
            </div>

            {/* 6. Référence hôpital */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Référence hôpital
              </label>
              <input
                type="text"
                {...register("referenceHopital")}
                placeholder="Numéro de référence..."
                className={inputClass}
              />
            </div>

            {/* 7. Date prélèvement */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Date prélèvement <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                {...register("prelevementDate")}
                className={inputClass}
              />
              {errors.prelevementDate && (
                <p className="text-xs text-red-500">
                  {errors.prelevementDate.message}
                </p>
              )}
            </div>

            {/* Pièce jointe — colonne droite de « Date prélèvement », comme Laravel. */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Pièce jointe
              </label>
              {isEdit && order?.archive && (
                <button
                  type="button"
                  onClick={() => openDocFile(order.archive!)}
                  className="mb-1 inline-flex w-fit items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                >
                  Pièce jointe actuelle — ouvrir
                </button>
              )}
              <input
                type="file"
                onChange={(e) => setExamenFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[.9rem] file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {isEdit && order?.archive && (
                <p className="text-xs text-gray-400">
                  Choisir un fichier remplace la pièce jointe actuelle.
                </p>
              )}
            </div>

            {/* 8. Cas urgent — ligne dédiée, colonne gauche (comme Laravel). */}
            <div className="flex flex-col gap-2 md:col-start-1">
              <label className="text-sm font-medium text-gray-700">
                Cas urgent
              </label>
              <Controller
                name="isUrgent"
                control={control}
                render={({ field }) => (
                  <FormToggle
                    id={isEdit ? "isUrgent-edit" : "isUrgent-create"}
                    label={field.value ? "Urgent" : "Normal"}
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>

            {isEdit && (
              <>
                {/* Affecter à (docteur signataire) — calque Laravel edit.blade */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">
                    Affecter à
                  </label>
                  <Controller
                    name="attribuateDoctorId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        instanceId="order-signataire"
                        inputId="attribuateDoctorId"
                        options={doctorUserOptions}
                        placeholder="Sélectionnez un docteur signataire"
                        value={
                          doctorUserOptions.find((o) => o.value === field.value) ??
                          null
                        }
                        onChange={(opt) => field.onChange(opt?.value ?? "")}
                        isClearable
                        classNamePrefix="react-select"
                      />
                    )}
                  />
                </div>

                {/* Option d'envoi des résultats — Appel / SMS */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">
                    Option d&apos;envoi des résultats
                  </label>
                  <NativeSelect
                    value={(watch("option") as string | undefined) ?? ""}
                    onChange={(e) => setValue("option", e.target.value)}
                    placeholder="Sélectionner une option d'envoi"
                  >
                    <option value="">Sélectionner une option d&apos;envoi</option>
                    <option value="0">Appel</option>
                    <option value="1">SMS</option>
                  </NativeSelect>
                </div>
              </>
            )}
          </div>

          {/* Boutons */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Annuler
            </button>
            {isEdit ? (
              <Button type="submit" loading={updateMutation.isPending}>
                Mettre à jour
              </Button>
            ) : (
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {config.labels.createButton}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Modal création rapide patient (ajout uniquement)                    */}
      {/* ------------------------------------------------------------------ */}
      {!isEdit && (
        <CrudModal
          isOpen={isPatientModalOpen}
          onClose={() => {
            setIsPatientModalOpen(false);
            resetPatient();
          }}
          title="Nouveau patient"
          size="xl"
          onSubmit={() => void handleSubmitPatient(onSubmitPatient)()}
          submitLabel="Créer le patient"
          isSubmitting={createPatientMutation.isPending}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Nom d'abord, comme sur le bon d'examen qu'on recopie et comme sur
                le compte rendu qui sortira. Saisir dans un ordre et relire dans
                l'autre est la façon la plus sûre d'intervertir les deux. */}
            <FormField
              label="Nom"
              required
              error={patientErrors.lastname?.message}
            >
              <input
                type="text"
                {...registerPatient("lastname")}
                placeholder="Nom du patient..."
                className={inputClass}
              />
            </FormField>

            <FormField
              label="Prénom"
              required
              error={patientErrors.firstname?.message}
            >
              <input
                type="text"
                {...registerPatient("firstname")}
                placeholder="Prénom du patient..."
                className={inputClass}
              />
            </FormField>

            {/* Genre */}
            <FormField label="Genre" error={patientErrors.genre?.message}>
              <Controller
                name="genre"
                control={controlPatient}
                render={({ field }) => (
                  <NativeSelect
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? undefined : e.target.value
                      )
                    }
                  >
                    <option value="">Sélectionner...</option>
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                  </NativeSelect>
                )}
              />
            </FormField>

            {/* Age + unité */}
            <FormField label="Âge" error={patientErrors.age?.message}>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  {...registerPatient("age")}
                  placeholder="Âge..."
                  className={inputClass}
                />
                <Controller
                  name="yearOrMonth"
                  control={controlPatient}
                  render={({ field }) => (
                    <NativeSelect
                      className="w-28"
                      value={field.value === false ? "mois" : "ans"}
                      onChange={(e) =>
                        field.onChange(e.target.value === "ans")
                      }
                    >
                      <option value="ans">Ans</option>
                      <option value="mois">Mois</option>
                    </NativeSelect>
                  )}
                />
              </div>
            </FormField>

            {/* Téléphone 1 */}
            <FormField label="Téléphone" error={patientErrors.telephone1?.message}>
              {/* `text` et non `tel` : sur mobile, `tel` ouvre un pavé numérique
                  d'où lettres et « + » ne se saisissent pas. */}
              <input
                type="text"
                {...registerPatient("telephone1")}
                placeholder="+229..."
                className={inputClass}
              />
            </FormField>

            {/* Téléphone 2 */}
            <FormField
              label="Téléphone 2"
              error={patientErrors.telephone2?.message}
            >
              <input
                type="text"
                {...registerPatient("telephone2")}
                placeholder="Numéro secondaire (optionnel)..."
                className={inputClass}
              />
            </FormField>

            {/* Profession */}
            <FormField
              label="Profession"
              error={patientErrors.profession?.message}
            >
              <input
                type="text"
                {...registerPatient("profession")}
                placeholder="Profession..."
                className={inputClass}
              />
            </FormField>

            {/* Adresse */}
            <FormField
              label="Adresse"
              error={patientErrors.adresse?.message}
              className="md:col-span-2"
            >
              <textarea
                {...registerPatient("adresse")}
                rows={2}
                placeholder="Adresse du patient..."
                className={inputClass}
              />
            </FormField>
          </div>
        </CrudModal>
      )}
    </div>
  );
}
