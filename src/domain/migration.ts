import type { DemoDatabase } from './types';
import type { DatabaseV2, Provenance } from './v2';
const BASE = '2026-10-16T16:00:00.000Z';
export function upgradeDatabase(db: DemoDatabase, provenance: Provenance = 'migrado'): DatabaseV2 {
  const common = { createdAt: BASE, updatedAt: BASE, provenance };
  return {
    ...db,
    schemaVersion: 2,
    installations: db.installations.map((r, i) => ({
      ...common,
      ...r,
      code: `INS-${String(i + 1).padStart(3, '0')}`,
      description: 'Instalación ficticia para la demostración.',
      responsible: 'Usuario de demostración',
    })),
    assets: db.assets.map((r) => ({
      ...common,
      ...r,
      description:
        'Activo ficticio. Los estados son registros administrativos y no autorizan operación.',
      operationalStatus: 'sin verificar',
      responsible: 'Usuario de demostración',
    })),
    findings: db.findings.map((r) => ({
      ...common,
      ...r,
      installationId: db.assets.find((a) => a.id === r.assetId)?.installationId,
      correctiveAction: r.status === 'cerrado' ? 'Seguimiento demostrativo registrado.' : '',
      closureJustification:
        r.status === 'cerrado'
          ? 'Cierre ficticio del conjunto inicial; no acredita una intervención.'
          : '',
      closedBy: r.status === 'cerrado' ? 'Usuario de demostración' : undefined,
    })),
    ppe: db.ppe.map((r) => ({
      ...common,
      ...r,
      category: 'Protección personal',
      manufacturer: '',
      description: r.notes,
      location: 'Almacén demostrativo',
      installationId: 'inst-1',
    })),
    assignments: db.assignments.map((r) => ({
      ...r,
      responsible: 'Usuario de demostración',
      activity: 'Asignación inicial ficticia',
      notes: 'Conservada desde V1.',
    })),
    studies: db.studies.map((r) => ({
      ...common,
      ...r,
      title: `Registro documental ${r.reference}`,
      objective: 'Demostrar la consulta y trazabilidad de información de un estudio.',
      scope:
        'Registro ilustrativo asociado a un activo ficticio; no constituye un estudio de ingeniería.',
      observations: 'Datos simulados. No apto para decisiones operativas.',
      documentState: r.status === 'pendiente de revisión' ? 'en revisión' : 'borrador',
      originalDate: r.studyDate,
      technical: {
        nominalVoltage: db.assets.find((a) => a.id === r.assetId)?.nominalVoltage ?? '',
        shortCircuitCurrent: '12,5 kA · ilustrativo',
        workingDistance: '450 mm · ilustrativo',
        incidentEnergy: '3,2 cal/cm² · ilustrativo',
        arcBoundary: '1,1 m · ilustrativo',
        methodology:
          'IEEE 1584 se menciona como referencia conceptual. SIGEE no ejecuta ese método ni valida sus supuestos.',
        assumptions:
          'Escenario completamente ficticio, sin mediciones ni modelado de una instalación real.',
        conclusions:
          'Este ejemplo permite probar la consulta, el versionado y la revisión de documentos. No permite determinar condiciones seguras ni seleccionar EPP.',
      },
    })),
    documents: db.documents.map((r) => ({
      ...common,
      ...r,
      originalDate: '2026-01-15',
      documentState: r.status === 'pendiente de revisión' ? 'en revisión' : 'borrador',
      description: 'Registro documental demostrativo.',
    })),
    events: db.findingEvents.map((r) => ({
      id: `audit-${r.id}`,
      entityType: 'finding',
      entityId: r.findingId,
      action: r.kind,
      at: r.at,
      actor: 'Usuario de demostración',
      description: r.text,
    })),
    movements: db.ppe
      .filter((r) => r.total > 0)
      .map((r) => ({
        id: `opening-${r.id}`,
        ppeId: r.id,
        type: 'saldo inicial',
        at: BASE,
        quantity: r.total,
        availableDelta: r.available,
        assignedDelta: db.assignments
          .filter((a) => a.ppeId === r.id)
          .reduce((s, a) => s + a.quantity, 0),
        unavailableDelta: { 'pendiente de inspección': r.unavailable },
        responsible: 'Usuario de demostración',
        source: 'Saldo de apertura V1',
        notes: 'Instantánea inicial; no reconstruye movimientos históricos desconocidos.',
      })),
    attachments: [],
    versions: [],
    reviews: [],
    alertHistory: [],
  };
}
