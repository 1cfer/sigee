import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useDatabase } from '../store/useDatabase';
import { entityPath, type EntityKind } from '../domain/v2';
import { EmptyState, Modal, SearchInput } from './ui';

export function GlobalSearch() {
  const db = useDatabase((s) => s.db);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState('');
  const groups: {
    title: string;
    kind: EntityKind;
    rows: { id: string; code: string; title: string; related?: string }[];
  }[] = [
    {
      title: 'Instalaciones',
      kind: 'installation',
      rows: db.installations.map((r) => ({ id: r.id, code: r.code, title: r.name })),
    },
    {
      title: 'Activos',
      kind: 'asset',
      rows: db.assets.map((r) => ({
        id: r.id,
        code: r.code,
        title: r.name,
        related: db.installations.find((i) => i.id === r.installationId)?.name,
      })),
    },
    {
      title: 'Hallazgos',
      kind: 'finding',
      rows: db.findings.map((r) => ({
        id: r.id,
        code: r.code,
        title: r.title,
        related: db.assets.find((a) => a.id === r.assetId)?.code,
      })),
    },
    {
      title: 'EPP',
      kind: 'ppe',
      rows: db.ppe.map((r) => ({ id: r.id, code: r.code, title: `${r.type} · ${r.reference}` })),
    },
    {
      title: 'Estudios',
      kind: 'study',
      rows: db.studies.map((r) => ({
        id: r.id,
        code: r.reference,
        title: r.title,
        related: db.assets.find((a) => a.id === r.assetId)?.code,
      })),
    },
    {
      title: 'Documentos',
      kind: 'document',
      rows: db.documents.map((r) => ({
        id: r.id,
        code: r.code,
        title: r.title,
        related: db.assets.find((a) => a.id === r.assetId)?.code,
      })),
    },
  ];
  const results = groups
    .map((g) => ({
      ...g,
      rows: g.rows
        .filter((r) =>
          `${r.code} ${r.title} ${r.related ?? ''}`
            .toLocaleLowerCase('es')
            .includes(query.trim().toLocaleLowerCase('es')),
        )
        .slice(0, 8),
    }))
    .filter((g) => g.rows.length);
  return (
    <>
      <button className="icon-button" aria-label="Buscar en SIGEE" onClick={() => setOpen(true)}>
        <Search size={18} />
      </button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Buscar en SIGEE"
          description="Busca códigos, nombres y relaciones entre los seis módulos."
        >
          <div className="record-body">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Código, nombre, activo o instalación…"
            />
            {query.trim() ? (
              results.map((g) => (
                <section key={g.title}>
                  <h3>{g.title}</h3>
                  <div className="search-results">
                    {g.rows.map((r) => (
                      <Link key={r.id} to={entityPath(g.kind, r.id)} onClick={() => setOpen(false)}>
                        <strong>{r.code}</strong>
                        <span>{r.title}</span>
                        {r.related && <small>{r.related}</small>}
                      </Link>
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <p className="muted">Escribe una referencia, por ejemplo ACT-001 o EST-001.</p>
            )}
            {query.trim() && !results.length && <EmptyState />}
          </div>
        </Modal>
      )}
    </>
  );
}

const steps = [
  {
    title: 'Una visión conectada',
    text: 'Consulta los indicadores y abre una cifra para ver sus registros.',
    path: '/dashboard',
    action: 'Abrir centro de control',
  },
  {
    title: 'Ficha 360° del activo',
    text: 'El activo conecta hallazgos, estudios, documentos y asignaciones.',
    path: '/activos/asset-1',
    action: 'Abrir ACT-001',
  },
  {
    title: 'El contenido documental',
    text: 'Visualiza el PDF ilustrativo y consulta sus versiones y revisiones.',
    path: '/estudios-documentos?tipo=estudios&registro=study-1',
    action: 'Consultar EST-001',
  },
  {
    title: 'Registrar una observación',
    text: 'Crea un hallazgo de prioridad alta desde la ficha del activo. Anota su código para seguirlo.',
    path: '/activos/asset-1',
    action: 'Registrar desde el activo',
  },
  {
    title: 'Una alerta con origen',
    text: 'Busca tu hallazgo. Reconoce el aviso y comprueba que su condición sigue activa.',
    path: '/alertas',
    action: 'Consultar alertas',
  },
  {
    title: 'Indicadores que se explican',
    text: 'Abre Prioridad alta y comprueba que incluye el nuevo registro.',
    path: '/dashboard',
    action: 'Ver indicadores',
  },
  {
    title: 'Entradas con control',
    text: 'Abre una referencia EPP. Registra una entrada: quedará pendiente de inspección.',
    path: '/epp?registro=ppe-1',
    action: 'Abrir inventario',
  },
  {
    title: 'Una historia conservada',
    text: 'Consulta Movimientos e Historial para identificar el responsable y el motivo.',
    path: '/epp?registro=ppe-1',
    action: 'Consultar trazabilidad',
  },
  {
    title: 'Compartir la información',
    text: 'Genera un informe PDF o Excel. Ajusta período, instalación y secciones antes de descargar.',
    path: '/dashboard',
    action: 'Generar un informe',
  },
];
export function DemoGuide() {
  const [active, setActive] = useState(false),
    [index, setIndex] = useState(0);
  const step = steps[index]!;
  return (
    <>
      <button className="reset-button" onClick={() => setActive((v) => !v)}>
        Recorrido de demostración
      </button>
      {active && (
        <aside className="demo-guide" aria-label="Recorrido guiado">
          <div className="section-heading">
            <span className="tiny-label">
              RECORRIDO · {index + 1} / {steps.length}
            </span>
            <button
              className="icon-button"
              aria-label="Cerrar recorrido"
              onClick={() => setActive(false)}
            >
              <X size={16} />
            </button>
          </div>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
          <Link className="text-link" to={step.path}>
            {step.action}
          </Link>
          <div className="detail-actions">
            <button
              className="button secondary"
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
            >
              Anterior
            </button>
            <button
              className="button primary"
              onClick={() => (index === steps.length - 1 ? setActive(false) : setIndex(index + 1))}
            >
              {index === steps.length - 1 ? 'Finalizar' : 'Siguiente'}
            </button>
          </div>
        </aside>
      )}
    </>
  );
}

export function ContextHelp() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="icon-button" aria-label="Ayuda de conceptos" onClick={() => setOpen(true)}>
        ?
      </button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Conceptos de SIGEE"
          description="Ayuda para interpretar los registros de demostración."
        >
          <dl className="record-body concept-list">
            {[
              ['Hallazgo', 'Observación que requiere responsable, fecha objetivo y seguimiento.'],
              [
                'Prioridad',
                'Orden administrativo de atención declarado por quien registra. No representa un cálculo de riesgo.',
              ],
              [
                'Energía incidente',
                'Energía térmica por unidad de superficie. En SIGEE solo se muestran valores declarados e ilustrativos; no se calculan.',
              ],
              [
                'EPP',
                'Elementos de protección personal. Su disponibilidad en inventario no acredita idoneidad para una tarea.',
              ],
              [
                'Estado documental',
                'Situación administrativa del documento. Una aprobación no certifica seguridad.',
              ],
              [
                'Revisión vencida',
                'La fecha programada pasó. Editar el título o cargar un archivo no registra una revisión formal.',
              ],
            ].map(([term, definition]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{definition}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
    </>
  );
}
