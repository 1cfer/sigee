import type {
  Asset,
  Installation,
  Finding,
  FindingInput,
  PPEItem,
  PPEAssignment,
  ArcFlashStudy,
  DocumentRecord,
  DemoDatabase,
  DerivedAlert,
} from './types';
export type Provenance = 'demostración' | 'sesión' | 'migrado';
export type EntityKind =
  'installation' | 'asset' | 'finding' | 'ppe' | 'study' | 'document' | 'alert';
export type Common = {
  createdAt: string;
  updatedAt: string;
  provenance: Provenance;
  archived?: boolean;
};
export type InstallationV2 = Installation &
  Common & { code: string; description: string; responsible: string };
export type AssetV2 = Asset &
  Common & {
    description: string;
    operationalStatus:
      'sin verificar' | 'registrado en servicio' | 'registrado fuera de servicio' | 'retirado';
    responsible: string;
  };
export type FindingV2 = Finding &
  Common & {
    installationId?: string;
    correctiveAction: string;
    closureJustification: string;
    closedBy?: string;
  };
export type FindingDraft = FindingInput & {
  correctiveAction?: string;
  closureJustification?: string;
  closedBy?: string;
};
export const UNAVAILABLE_REASONS = [
  'pendiente de inspección',
  'en inspección',
  'deteriorado',
  'en cuarentena',
  'retirado temporalmente',
  'dado de baja',
] as const;
export type UnavailableReason = (typeof UNAVAILABLE_REASONS)[number];
export type PPEV2 = PPEItem &
  Common & {
    category: string;
    manufacturer: string;
    description: string;
    location: string;
    installationId?: string;
    lastInspection?: string;
  };
export type AssignmentV2 = PPEAssignment & {
  responsible: string;
  activity: string;
  expectedReturn?: string;
  returnedAt?: string;
  notes: string;
};
export interface InventoryMovement {
  id: string;
  ppeId: string;
  type:
    | 'saldo inicial'
    | 'entrada'
    | 'asignación'
    | 'devolución'
    | 'inspección'
    | 'cambio de estado'
    | 'corrección'
    | 'baja';
  at: string;
  quantity: number;
  availableDelta: number;
  assignedDelta: number;
  unavailableDelta: Partial<Record<UnavailableReason, number>>;
  responsible: string;
  source: string;
  notes: string;
  assignmentId?: string;
}
export type DocumentState =
  'borrador' | 'en revisión' | 'aprobado administrativamente' | 'archivado';
export type StudyV2 = ArcFlashStudy &
  Common & {
    title: string;
    objective: string;
    scope: string;
    observations: string;
    documentState: DocumentState;
    uploadedAt?: string;
    lastReviewedAt?: string;
    technical: {
      nominalVoltage: string;
      shortCircuitCurrent: string;
      workingDistance: string;
      incidentEnergy: string;
      arcBoundary: string;
      methodology: string;
      assumptions: string;
      conclusions: string;
    };
    originalDate: string;
  };
export type DocumentV2 = DocumentRecord &
  Common & {
    installationId?: string;
    findingId?: string;
    originalDate: string;
    uploadedAt?: string;
    lastReviewedAt?: string;
    documentState: DocumentState;
    description: string;
  };
export interface AuditEvent {
  id: string;
  entityType: EntityKind;
  entityId: string;
  action: string;
  at: string;
  actor: string;
  description: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}
export interface Attachment {
  id: string;
  entityType: 'study' | 'document' | 'finding' | 'ppe';
  entityId: string;
  name: string;
  mime: string;
  size: number;
  uploadedAt: string;
  version: string;
  notes: string;
}
export interface RecordVersion {
  id: string;
  entityType: 'study' | 'document';
  entityId: string;
  version: string;
  attachmentId: string;
  at: string;
  notes: string;
}
export interface ReviewRecord {
  id: string;
  entityType: 'study' | 'document';
  entityId: string;
  at: string;
  responsible: string;
  notes: string;
  nextReview: string;
  version: string;
}
export type AlertHistory = DerivedAlert & {
  generatedAt: string;
  status: 'activa' | 'reconocida' | 'resuelta';
  acknowledgedAt?: string;
  resolvedAt?: string;
  action: string;
};
export interface DatabaseV2 extends Omit<
  DemoDatabase,
  'assets' | 'installations' | 'findings' | 'ppe' | 'assignments' | 'studies' | 'documents'
> {
  schemaVersion: 2;
  revision?: number;
  installations: InstallationV2[];
  assets: AssetV2[];
  findings: FindingV2[];
  ppe: PPEV2[];
  assignments: AssignmentV2[];
  studies: StudyV2[];
  documents: DocumentV2[];
  events: AuditEvent[];
  movements: InventoryMovement[];
  attachments: Attachment[];
  versions: RecordVersion[];
  reviews: ReviewRecord[];
  alertHistory: AlertHistory[];
}
export function entityPath(kind: EntityKind, id: string): string {
  return kind === 'asset'
    ? `/activos/${id}`
    : kind === 'installation'
      ? `/activos?instalacionDetalle=${id}&vista=instalaciones`
      : kind === 'finding'
        ? `/hallazgos?registro=${id}`
        : kind === 'ppe'
          ? `/epp?registro=${id}`
          : kind === 'alert'
            ? '/alertas'
            : `/estudios-documentos?tipo=${kind === 'study' ? 'estudios' : 'documentos'}&registro=${id}`;
}
