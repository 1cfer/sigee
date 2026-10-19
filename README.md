# SIGEE V2

Sistema Integrado de Gestión de Seguridad Eléctrica. Prototipo independiente de **1cfer** para conectar activos, estudios, hallazgos, inventario e indicadores. Todos los datos iniciales y los PDF de ejemplo son ficticios. No es una aplicación oficial ni validada por ISA o Intercolombia.

> Prototipo demostrativo con datos simulados. No apto para decisiones operativas de seguridad eléctrica.

## Ejecutar

Requiere Node **24.x**, npm y un navegador moderno. Desde la raíz:

```sh
npm ci
npm run dev -- --host 0.0.0.0
```

Abre `http://localhost:5173/dashboard` en Chrome o Edge cuando ejecutes el proyecto en tu computador. En esta nube la carpeta es `/workspace/sigee` y se puede usar `npm ci --cache /workspace/.cache/npm`. La dirección del contenedor no es una URL pública.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview -- --port 4173 --strictPort
```

El build queda en `dist/`. Para probar los archivos compilados, con el servidor anterior en otra terminal:

```sh
SIGEE_BASE_URL=http://127.0.0.1:4173 npm run test:e2e
```

Playwright usa `/usr/bin/chromium` en esta nube. En otro equipo configura `SIGEE_CHROMIUM_PATH` con un Chromium instalado. Sin `SIGEE_BASE_URL`, Playwright inicia Vite automáticamente. `npm run format:check` comprueba Prettier. Capturas y trazas quedan en `test-results/`, sin versionarse.

## Flujos implementados

| Módulo                | Operaciones reales                                                                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Centro de control     | Cuatro vistas, períodos de 3/6/12 meses, mes, trimestre, semestre, año y rango; filtros por instalación, estado y prioridad; indicadores con sus registros exactos; barras de creación/cierre y pendientes históricos; informes PDF y Excel.                                          |
| Activos eléctricos    | Crear y editar instalaciones y activos, separar estado administrativo y operativo declarado, archivar/reactivar sin borrar relaciones, ficha 360° con enlaces a registros asociados e historial.                                                                                      |
| Hallazgos             | Crear, editar, comentar, adjuntar PDF o imágenes, pasar por verificación y cerrar con acción correctiva y justificación. Conservar responsable, fecha de cierre y eventos al reabrir o archivar. CSV complementario del listado filtrado.                                             |
| Inventario EPP        | Crear referencias, adjuntar imágenes, registrar entradas no disponibles, inspecciones y reinspecciones, cambios de estado, correcciones justificadas y bajas. Asignar a activos con responsable y actividad; devolver con condición de recepción y conservar la asignación histórica. |
| Estudios y documentos | Fichas de consulta con pestañas, campos técnicos declarados e ilustrativos, PDF reales, descarga, carga de versiones, revisiones formales, fechas independientes y archivo administrativo.                                                                                            |
| Alertas               | Generación por condición, reconocimiento, resolución automática cuando desaparece la causa, reactivación e historial persistente. Reconocer no elimina ni resuelve el aviso.                                                                                                          |

También incluye búsqueda global, actividad transversal, ayuda de conceptos, recorrido guiado opcional, avisos de calidad de datos y densidad de tablas persistente. Las operaciones confirman el guardado después de que finaliza la transacción de IndexedDB. Los formularios principales protegen borradores; los formularios de operaciones advierten al cerrar o cambiar su sección.

El [guion de demostración](DEMO_GUIDE.md) cubre el recorrido en aproximadamente cinco minutos. [CHANGELOG.md](CHANGELOG.md) resume los cambios y [AGENTS.md](AGENTS.md) establece las convenciones para futuras tareas.

## Arquitectura

React + TypeScript estricto + Vite; React Router conserva las rutas de V1. Zustand mantiene un estado compartido, Zod valida entradas e integridad y React Hook Form gestiona el editor de hallazgos. Radix proporciona diálogos; Inter local, Lucide, Recharts, Tailwind y tokens CSS conservan la identidad visual.

```text
src/
  domain/       Entidades V1/V2, migración, validación, fechas y reglas puras
  persistence/  IndexedDB: metadatos, blobs, recuperación y transacciones
  store/        Mutaciones serializadas, auditoría y confirmación del guardado
  components/   Formularios, archivos, revisiones, filtros, historial e informes
  pages/        Los seis módulos y la ficha 360°
  reports/      PDF vectorial y Excel con datos filtrados
```

Dependencias añadidas: **idb**, **jsPDF**, **jspdf-autotable** y **ExcelJS**; **fake-indexeddb** para pruebas. PDF y Excel cargan sus bibliotecas bajo demanda. ExcelJS genera un fragmento grande; se descarga al exportar Excel. No hay backend, autenticación simulada, API externa ni infraestructura multiagente.

## Persistencia, migración y reglas

- Base IndexedDB `sigee-v2`, versión física 1; esquema de datos `schemaVersion: 2`. `kv` conserva el estado y los respaldos; `files` conserva los blobs. No se guardan PDF en localStorage.
- La primera apertura migra el sobre V1 de `localStorage['sigee-demo']`, valida relaciones y conserva el texto original en `kv['v1-backup']`. El localStorage original no se modifica. Un V1 ilegible se respalda antes de iniciar la demostración.
- Un estado V2 inválido se conserva en `kv['v2-recovery-backup']` antes de recuperar el conjunto demostrativo. Sus archivos anteriores se mantienen. Los respaldos pueden inspeccionarse desde las herramientas del navegador: **Application → IndexedDB → sigee-v2 → kv**.
- Cada escritura valida una copia completa y guarda metadatos y blobs en una sola transacción. Una revisión del estado evita sobrescribir cambios de otra pestaña: si hay un conflicto, se solicita recargar y no se aplica la operación obsoleta.
- EPP: cantidades enteras no negativas; `total = disponibles + asignadas + no disponibles`. Los movimientos explican todos los saldos. El saldo inicial importado es una instantánea; no inventa movimientos anteriores desconocidos.
- Las entradas requieren inspección antes de estar disponibles. Una devolución solo aumenta disponibilidad si se declara expresamente ese destino. Se conserva el registro de asignación y devolución.
- El cierre de un hallazgo requiere acción correctiva, justificación y responsable declarado. Reabrir conserva eventos anteriores y elimina la fecha de cierre actual. El historial permite contar cierres anteriores aunque el hallazgo se reabra.
- Metadatos, carga de un archivo y revisión formal son operaciones diferentes. Aprobar administrativamente no certifica seguridad. Las revisiones próximas, vencidas o sin programación se explican desde las fechas.
- Fechas de calendario en `yyyy-MM-dd`; eventos ISO y agrupación en `America/Bogota`. Hoy no se considera vencido. El dataset conserva la referencia fija `2026-10-16`; sus fechas no avanzan al recargar.
- Se conservan 3 instalaciones, 10 activos, 14 hallazgos, 12 EPP, 10 estudios y 15 documentos. La inicialización añade PDF ilustrativos a tres estudios y dos documentos; DOC-001 incluye una versión anterior adicional. Los registros nuevos se distinguen por procedencia de sesión.

Los datos pertenecen al **origen, navegador y perfil actuales**. No se sincronizan entre computadores ni entre dominios de Vercel. Un despliegue Preview tiene su propio almacenamiento. Borrar los datos del sitio elimina registros y archivos locales. Para la exposición usa el mismo equipo, navegador y URL donde preparaste los datos.

Cada archivo admite hasta **10 MB** y el conjunto hasta **50 MB**, sujeto a la cuota del navegador. PDF para estudios y documentos; PDF/PNG/JPEG para evidencias e imágenes EPP. Se validan tipo, firma y tamaño. Un fallo de cuota o transacción muestra un error y no publica el estado como guardado.

**Restaurar datos de demostración** requiere confirmación y elimina los cambios y archivos actuales para regenerar el conjunto ficticio. Los informes exportados son documentos de consulta, no una copia restaurable de toda la base de datos.

## Interpretación de filtros e informes

El período usa creación de hallazgos, fecha original de estudios/documentos y fecha de movimientos/eventos. Los activos reflejan su instalación actual. El inventario se filtra por la instalación de almacenamiento de cada referencia, incluyendo sus unidades asignadas. Una asignación a un activo de otra instalación no duplica el saldo de la referencia. Estado y prioridad filtran hallazgos. Estas reglas aparecen también en la ayuda de los filtros.

Los pendientes históricos incluyen el arrastre anterior al período y se reconstruyen desde creación, cambios de estado y cierre. Las gráficas usan barras y escalones; el detalle mensual abre los registros exactos. El rango personalizado limita también los creados/cerrados dentro de meses parciales. El promedio de cierre usa registros actualmente cerrados en la selección.

El PDF incluye portada, alcance, resumen calculado, gráficas vectoriales, tablas paginadas y trazabilidad. Se pueden seleccionar secciones. El Excel completo tiene diez hojas: Resumen, Hallazgos, Activos, Instalaciones, Inventario EPP, Movimientos EPP, Estudios, Documentos, Alertas e Historial. Mantiene filtros, encabezados, fechas y IDs. El resumen de contexto permanece en Excel aunque se seleccionen únicamente otras secciones. Los reportes incluyen los cambios guardados durante la sesión.

Los estudios ilustrativos no ejecutan IEEE 1584, no calculan energía incidente, no seleccionan EPP y no afirman cumplimiento NFPA 70E, RETIE ni otra norma. El historial es local y no se presenta como una auditoría inviolable o certificada.

## Publicar V2 en Vercel conservando V1

La rama **`feat/sigee-v2`** conserva el trabajo V2 separado de **`feat/vercel-production`**, que contiene la versión anterior. V2 parte del commit V1 `1b994ee7c2ab7f587cefff56621a7d9afa3d77b8`. La configuración de despliegue no necesita cambios: `base: '/'`, salida `dist`, recursos del mismo origen y reescritura SPA en `vercel.json`.

1. Abre el proyecto conectado a **`1cfer/sigee`** en Vercel.
2. Genera un **Preview Deployment** desde `feat/sigee-v2` para revisar V2 sin cambiar la rama de producción de V1. También puedes importar esa rama en un proyecto independiente.
3. Usa raíz `.`, preset **Vite**, Node **24.x**, instalación `npm ci`, build `npm run build` y salida `dist`. No necesita variables de entorno ni credenciales dentro de la aplicación.
4. Abre la URL HTTPS generada en Chrome o Edge y entra a `/dashboard`.
5. Recarga `/activos/asset-1`, `/hallazgos`, `/epp`, `/estudios-documentos` y `/alertas`; ejecuta el guion de demostración. Una vez revisado, integra la rama mediante GitHub y publica conforme a la rama de producción que hayas elegido.

El build y sus rutas se verifican localmente con `vite preview`. Eso no equivale a un despliegue público. La publicación y comprobación de la URL de Vercel requieren acceso a tu proyecto; este entorno no dispone de sus credenciales y la URL pública existente tiene acceso de red restringido desde la nube.

## Calidad y límites conocidos

Las pruebas cubren integridad, fechas, migración y recuperación, conflictos de pestañas, errores de cuota, saldos/movimientos, versiones, cierre y reapertura, alertas, filtros, históricos, PDF y lectura del Excel generado. Playwright comprueba los flujos completos, persistencia tras recarga, accesibilidad automatizada, escritorio/tablet/móvil, rutas profundas y recursos compilados.

No hay sincronización multiusuario, recuperación remota de archivos ni auditoría certificada. El inventario es por referencia y cantidad, sin trazabilidad de números de serie individuales. El buscador global limita resultados visibles por categoría. El historial de cada ficha muestra hasta 80 eventos recientes; el informe puede incluir el historial completo de su selección. Las series del dashboard muestran hasta 24 meses por legibilidad.

`npm audit --omit=dev` detecta un aviso moderado transitivo de `uuid` en ExcelJS 4.4.0, sin corrección oficial disponible en ese paquete; no detecta avisos altos o críticos en la revisión realizada. SIGEE usa ExcelJS para generar libros y no expone las funciones UUID v3/v5/v6 con buffers señaladas por el aviso. No se han forzado versiones incompatibles ni ocultado los resultados de auditoría.
