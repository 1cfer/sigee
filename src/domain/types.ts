export type Priority = 'baja' | 'media' | 'alta';
export type FindingStatus = 'abierto' | 'en progreso' | 'cerrado';
export type ReviewStatus = 'registrado' | 'pendiente de revisión';

export interface Installation {
  id: string;
  name: string;
  location: string;
}
export interface Asset {
  id: string;
  code: string;
  name: string;
  installationId: string;
  type: string;
  nominalVoltage: string;
  administrativeStatus: 'registrado' | 'en revisión';
}
export interface Finding {
  id: string;
  code: string;
  assetId: string;
  title: string;
  description: string;
  priority: Priority;
  status: FindingStatus;
  responsible: string;
  createdAt: string;
  dueDate: string;
  closedAt?: string;
}
export interface FindingEvent {
  id: string;
  findingId: string;
  at: string;
  kind: 'creación' | 'cambio' | 'comentario';
  text: string;
  changes?: { field: string; before: string; after: string }[];
}
export interface PPEItem {
  id: string;
  code: string;
  type: string;
  reference: string;
  total: number;
  available: number;
  unavailable: number;
  nextInspection: string;
  inspectionStatus: 'registrada' | 'pendiente';
  notes: string;
}
export interface PPEAssignment {
  id: string;
  ppeId: string;
  assetId: string;
  quantity: number;
  assignedAt: string;
}
export interface ArcFlashStudy {
  id: string;
  reference: string;
  assetId: string;
  studyDate: string;
  nextReview: string;
  version: string;
  responsible: string;
  status: ReviewStatus;
}
export interface DocumentRecord {
  id: string;
  code: string;
  title: string;
  type: string;
  assetId?: string;
  version: string;
  responsible: string;
  reviewDate: string;
  status: ReviewStatus;
}
export interface DerivedAlert {
  id: string;
  sourceType: 'hallazgo' | 'epp' | 'estudio' | 'documento';
  sourceId: string;
  severity: 'prioritaria' | 'atención';
  title: string;
  description: string;
  relevantDate: string;
  path: string;
  assetId?: string;
}
export interface DemoDatabase {
  installations: Installation[];
  assets: Asset[];
  findings: Finding[];
  findingEvents: FindingEvent[];
  ppe: PPEItem[];
  assignments: PPEAssignment[];
  studies: ArcFlashStudy[];
  documents: DocumentRecord[];
}
export type FindingInput = Pick<
  Finding,
  'assetId' | 'title' | 'description' | 'priority' | 'status' | 'responsible' | 'dueDate'
>;
