import { addDays, format, parseISO } from 'date-fns';
import type { DemoDatabase } from './types';

// Fecha de referencia fija: no cambia al recargar ni al restaurar la demostración.
export const DEMO_DATE = '2026-10-16';
const day = (offset: number) => format(addDays(parseISO(DEMO_DATE), offset), 'yyyy-MM-dd');
const people = ['Valentina Ríos', 'Mateo Salazar', 'Camila Torres', 'Andrés Molina'];
const titles = [
  'Actualizar identificación del tablero',
  'Revisar trazabilidad del estudio documental',
  'Completar registro de inspección',
  'Actualizar señalización de referencia',
  'Verificar disponibilidad del registro de EPP',
  'Consolidar observaciones de campo',
  'Registrar revisión de etiquetas',
  'Completar inventario documental',
  'Actualizar responsable de seguimiento',
  'Revisar fecha del documento asociado',
  'Completar ficha administrativa',
  'Organizar evidencia de inspección',
  'Actualizar referencia de plano',
  'Registrar cierre de observación',
];

export function createDemoDatabase(): DemoDatabase {
  const installations = [
    { id: 'inst-1', name: 'Estación Aurora', location: 'Zona norte · Ficticia' },
    { id: 'inst-2', name: 'Estación Horizonte', location: 'Zona centro · Ficticia' },
    { id: 'inst-3', name: 'Estación Alborada', location: 'Zona sur · Ficticia' },
  ];
  const names = [
    'Tablero de distribución principal',
    'Centro de control de motores',
    'Tablero de servicios auxiliares',
    'Celda de distribución A',
    'Transformador de servicios',
    'Tablero de distribución B',
    'Celda de distribución B',
    'Centro de control auxiliar',
    'Tablero de iluminación',
    'Gabinete de distribución',
  ];
  const assets = names.map((name, i) => ({
    id: `asset-${i + 1}`,
    code: `ACT-${String(i + 1).padStart(3, '0')}`,
    name,
    installationId: `inst-${(i % 3) + 1}`,
    type: [
      'Tablero',
      'Centro de control',
      'Tablero',
      'Celda',
      'Transformador',
      'Tablero',
      'Celda',
      'Centro de control',
      'Tablero',
      'Gabinete',
    ][i]!,
    nominalVoltage: [
      '480 V',
      '480 V',
      '208 V',
      '13,2 kV',
      '13,2 kV / 208 V',
      '480 V',
      '13,2 kV',
      '480 V',
      '208 V',
      '208 V',
    ][i]!,
    administrativeStatus: i === 1 ? ('en revisión' as const) : ('registrado' as const),
  }));
  const findings = titles.map((title, i) => ({
    id: `finding-${i + 1}`,
    code: `HAL-${String(i + 1).padStart(3, '0')}`,
    assetId: `asset-${(i % 8) + 1}`,
    title,
    description:
      'Observación ficticia para demostrar el registro y seguimiento administrativo. Requiere revisión del responsable asignado.',
    priority: (['alta', 'media', 'baja'] as const)[i % 3]!,
    status: (['abierto', 'en progreso', 'abierto', 'cerrado'] as const)[i % 4]!,
    responsible: people[i % people.length]!,
    createdAt: `${day(-150 + i * 10)}T14:00:00.000Z`,
    dueDate: day(i % 4 === 0 ? -4 - i : 7 + i),
    ...(i % 4 === 3 ? { closedAt: `${day(-2)}T16:00:00.000Z` } : {}),
  }));
  const ppeTypes = [
    'Guantes aislantes',
    'Protector facial',
    'Casco de protección',
    'Chaqueta de protección',
    'Pantalla facial',
    'Sobreguantes de cuero',
    'Mangas de protección',
    'Calzado de protección',
    'Protector auditivo',
    'Pantalón de protección',
    'Gafas de protección',
    'Capucha de protección',
  ];
  return {
    installations,
    assets,
    findings,
    findingEvents: findings.map((f) => ({
      id: `event-${f.id}`,
      findingId: f.id,
      at: f.createdAt,
      kind: 'creación',
      text: 'Hallazgo de demostración registrado.',
    })),
    ppe: ppeTypes.map((type, i) => ({
      id: `ppe-${i + 1}`,
      code: `EPP-${String(i + 1).padStart(3, '0')}`,
      type,
      reference: `REF-DEMO-${i + 1}`,
      total: 8 + i,
      available: i === 0 ? 5 : 6 + i,
      unavailable: 2,
      nextInspection: day(i < 3 ? -5 - i : 15 + i),
      inspectionStatus: i < 3 ? 'pendiente' : 'registrada',
      notes: 'Inventario ficticio. El registro no determina idoneidad ni autoriza su uso.',
    })),
    assignments: [
      {
        id: 'assignment-1',
        ppeId: 'ppe-1',
        assetId: 'asset-1',
        quantity: 1,
        assignedAt: `${day(-5)}T14:00:00.000Z`,
      },
    ],
    studies: assets.map((a, i) => ({
      id: `study-${i + 1}`,
      reference: `EST-${String(i + 1).padStart(3, '0')}`,
      assetId: a.id,
      studyDate: day(-240 - i),
      nextReview: day(i < 2 ? -10 : 90 + i),
      version: '1.0',
      responsible: people[i % 4]!,
      status: i < 2 ? 'pendiente de revisión' : 'registrado',
    })),
    documents: Array.from({ length: 15 }, (_, i) => ({
      id: `doc-${i + 1}`,
      code: `DOC-${String(i + 1).padStart(3, '0')}`,
      title: [
        'Ficha de identificación',
        'Registro de inspección',
        'Inventario de referencias',
        'Registro de seguimiento',
        'Índice documental',
      ][i % 5]!,
      type: ['Ficha', 'Registro', 'Inventario'][i % 3]!,
      ...(i < 13 ? { assetId: `asset-${(i % 10) + 1}` } : {}),
      version: '1.0',
      responsible: people[i % 4]!,
      reviewDate: day(i < 3 ? -6 : 45 + i),
      status: i < 3 ? 'pendiente de revisión' : 'registrado',
    })),
  };
}
