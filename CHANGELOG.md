# Historial de cambios

## 2.0.0 · 2026-10-19

Evolución de V1 en la rama `feat/sigee-v2`, conservando las rutas, identidad visual, relaciones, configuración Vercel y conjunto inicial.

- Persistencia transaccional en IndexedDB para registros y archivos; migración V1 con respaldo, recuperación validada, límites de archivos y detección de escrituras desde pestañas desactualizadas.
- Gestión de instalaciones y activos con creación, edición, estado operativo declarado independiente, archivo y ficha 360°.
- Inventario por movimientos: recepción no disponible, inspección, reinspección, corrección, cambio de estado, baja, asignación y devolución con condición. Conservación de asignaciones históricas y motivos de no disponibilidad.
- Fichas documentales con contenido ilustrativo, PDF reales de ejemplo, carga/descarga/visualización, versiones y revisiones formales con fechas independientes.
- Hallazgos con verificación, acción correctiva, cierre justificado, evidencias, comentarios e historial conservado al archivar o reabrir.
- Alertas activas, reconocidas y resueltas, con generación/reactivación determinística e historial.
- Dashboard con cuatro vistas, filtros compartidos, cifras explicables, barras mensuales, pendientes históricos y trazabilidad de los registros de cada selección.
- Informes PDF vectoriales y Excel de diez hojas generados a partir de los datos guardados y filtrados.
- Búsqueda global, actividad transversal, ayuda, recorrido opcional, preferencias de tablas, calidad de datos y protección de formularios.
- Pruebas ampliadas de dominio, almacenamiento, transacciones, exportación, componentes, flujos de navegador, accesibilidad y producción.
- Documentación técnica actualizada y guion de exposición de cinco minutos.

## 0.1.0 · V1

MVP de seis módulos, flujo hallazgo → alerta → indicador → cierre, inventario y asignaciones, relaciones de activos, metadatos documentales y persistencia en localStorage. Build estático y rutas SPA preparados para Vercel. Identidad pública del proyecto: `1cfer`.
