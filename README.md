# SIGEE

Sistema Integrado de Gestión de Seguridad Eléctrica. Prototipo independiente para demostrar cómo conectar registros, indicadores y acciones de seguimiento. **Todos los datos son ficticios. No es una aplicación oficial ni una solución validada por ISA.**

> Prototipo demostrativo con datos simulados. No apto para decisiones operativas de seguridad eléctrica.

## Qué incluye

- **Centro de control**: seis indicadores calculados, tendencia mensual de creación/cierre, distribución por estado, prioridad e instalación, alertas y actividad.
- **Activos eléctricos**: búsqueda, filtros y ordenación; fichas con relaciones por ID a estudios, documentos, asignaciones EPP, hallazgos, avisos y eventos.
- **Hallazgos**: crear, consultar, editar, cambiar estado, asignar responsable, comentar y eliminar con confirmación explícita del historial que también se elimina. Exportación CSV del listado filtrado.
- **Inventario EPP**: editar cantidades y metadatos, registrar asignaciones ficticias, devolver unidades y seguir inspecciones.
- **Estudios y documentos**: dos pestañas con búsqueda, pendientes, detalle y edición de metadatos. Sin archivos técnicos ficticios ni certificaciones.
- **Alertas**: reglas derivadas del estado, filtros por origen y severidad y enlace directo al registro que las genera.

Los seis módulos comparten un único store. Los cambios persisten en el navegador; las alertas y métricas se recalculan, no se guardan por separado. La aplicación abre en `/dashboard`, sin inicio de sesión ficticio.

## Tecnologías y requisitos

React, TypeScript estricto, Vite, React Router, Tailwind CSS y tokens CSS, Radix Dialog, Lucide, Recharts, React Hook Form, Zod, Zustand y date-fns. Inter se sirve desde los archivos instalados; la demostración no necesita APIs, fuentes remotas ni servicios corporativos.

Node **24.x** y npm, tanto localmente como en Vercel. Para E2E se necesita Chromium. Las versiones exactas están en `package-lock.json`.

## Instalación y ejecución

Desde la raíz del repositorio:

```sh
npm ci
npm run dev
```

En esta nube el repositorio está en `/workspace/sigee`; utiliza `npm ci --cache /workspace/.cache/npm` si la caché de usuario no es escribible. Vite escucha en el puerto 5173 por defecto. El servidor no tiene autenticación; úsalo solo en tu entorno de desarrollo.

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run preview -- --port 4173
```

Playwright inicia Vite automáticamente, o reutiliza el servidor de desarrollo existente fuera de CI. En esta nube usa `/usr/bin/chromium`. En otro equipo, define `SIGEE_CHROMIUM_PATH` con la ruta a un Chromium compatible. Las trazas y capturas de fallos quedan en `test-results/`, que no se versiona. `npm run format:check` verifica el formato.

`dist/` contiene la compilación. Un servidor de producción debe redirigir rutas de la SPA a `index.html`. Publicar o desplegar requiere una acción separada; iniciar Vite no publica el proyecto.

## Despliegue en Vercel

El proyecto es una SPA estática. `vercel.json` define el framework Vite, instalación con `npm ci`, compilación con `npm run build`, salida `dist` y la reescritura de las rutas de React Router a `/index.html`. Vite utiliza `base: '/'`; los archivos compilados están en `/assets/`. No se necesitan variables de entorno, secretos, funciones de servidor ni una base de datos para la demostración.

1. En Vercel, crea un proyecto e importa el repositorio de GitHub **`1cfer/sigee`**.
2. Selecciona la rama **`feat/vercel-production`** para esta versión. Si posteriormente se integra en otra rama, selecciona esa rama como **Production Branch** en la configuración Git del proyecto.
3. Usa estos valores; el archivo `vercel.json` proporciona los comandos y el directorio de salida:

| Ajuste                | Valor                      |
| --------------------- | -------------------------- |
| Root Directory        | Raíz del repositorio (`.`) |
| Framework Preset      | Vite                       |
| Node.js Version       | 24.x                       |
| Install Command       | `npm ci`                   |
| Build Command         | `npm run build`            |
| Output Directory      | `dist`                     |
| Environment Variables | Ninguna                    |

4. Despliega y abre la URL HTTPS que genere Vercel en Chrome o Edge. La ruta `/` abre el dashboard.
5. Abre y recarga directamente `/dashboard`, `/activos/asset-1`, `/hallazgos`, `/epp`, `/estudios-documentos` y `/alertas`. También deben conservarse los enlaces con query, como `/hallazgos?registro=finding-1`.
6. Repite el guion de demostración del final de este README. Comprueba en las herramientas del navegador que los recursos JS, CSS, las fuentes y `favicon.svg` responden correctamente.

No configures `/workspace/sigee` como Root Directory en Vercel: esa ruta solo pertenece al entorno de desarrollo en la nube. `dist`, `node_modules` y `.vercel` no se versionan; Vercel los genera a partir del código y el lockfile.

Para verificar el mismo build antes de publicarlo:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run preview -- --port 4173 --strictPort
```

En otra terminal, ejecuta la suite completa contra los archivos compilados:

```sh
SIGEE_BASE_URL=http://127.0.0.1:4173 npm run test:e2e
```

La prueba de producción abre y recarga todas las rutas, comprueba enlaces a registros, verifica los recursos compilados y sus tipos MIME, y detecta errores de consola y peticiones fallidas. La suite también ejecuta el recorrido de creación y cierre de hallazgos. Esta validación local no sustituye la comprobación de la URL real después del primer despliegue en Vercel.

Cada dominio y navegador conserva sus propios datos de demostración. Los cambios guardados en localhost no aparecen en el dominio de Vercel; el nuevo dominio inicia su propio dataset. Un redeploy en el mismo origen conserva localStorage mientras su versión siga siendo compatible. El aviso de datos simulados y las limitaciones operativas siguen aplicándose a la versión pública.

## Organización

```text
src/
  domain/       Tipos, dataset, validación, reglas, selectores y CSV
  store/        Estado único y persistencia versionada
  components/   Layout, controles, diálogos y editor de hallazgos
  pages/        Seis módulos y ficha de activo
  test/         Preparación de Testing Library
  styles.css    Tokens, composición y responsive
e2e/            Recorridos Playwright
AGENTS.md       Contrato técnico y visual para próximas tareas
```

La lógica pura del dominio, las mutaciones del store, la presentación y los recorridos son puntos de extensión suficientes para futuras skills de diseño, calidad e integridad. No hay infraestructura multiagente ni abstracciones de plugins en el MVP.

## Modelo e integridad

`DemoDatabase` agrupa `Installation`, `Asset`, `Finding`, `FindingEvent`, `PPEItem`, `PPEAssignment`, `ArcFlashStudy` y `DocumentRecord`. `DerivedAlert` es una proyección calculada. Cada entidad persistida tiene un ID estable; las relaciones usan esos IDs.

El inventario aplica **total = disponibles + no disponibles + asignadas**. Una asignación resta disponibilidad; devolverla la recupera. Las operaciones inválidas y las referencias inexistentes se rechazan antes de modificar el store. Cerrar un hallazgo registra la fecha de cierre; reabrirlo la elimina. El historial conserva cambios de estado, responsable y fecha objetivo, además de otros campos editados y comentarios.

El dataset tiene 3 instalaciones ficticias, 10 activos, 14 hallazgos, 12 referencias EPP, 10 estudios, 15 documentos y 14 eventos iniciales. `DEMO_DATE = 2026-10-16` es su ancla fija; las fechas de ejemplo no cambian al recargar. Los vencimientos y las fechas de calendario usan la zona `America/Bogota`, por lo que los contadores evolucionan con el tiempo sin confundir el día local con el día UTC. Las pruebas del dataset usan la fecha de referencia explícita. Para renovar la demostración en una fecha futura, actualizar el ancla conscientemente y revisar los casos de prueba.

## Reglas de alertas

| Regla | Condición                                             | Resultado               |
| ----- | ----------------------------------------------------- | ----------------------- |
| R1    | Hallazgo de prioridad alta no cerrado                 | Seguimiento prioritario |
| R2    | Hallazgo no cerrado con fecha objetivo anterior a hoy | Aviso de vencimiento    |
| R3    | Inspección EPP con fecha anterior a hoy               | Aviso de inspección     |
| R4    | Revisión de documento o estudio anterior a hoy        | Aviso documental        |
| R5    | Cantidades de inventario inconsistentes o negativas   | Operación bloqueada     |

Los IDs incluyen la regla y el origen; una causa no duplica la misma alerta. Un hallazgo puede tener R1 y R2, porque son causas diferentes. Cerrar el registro elimina ambas. Un estado administrativo pendiente puede aparecer en los contadores de revisiones aunque aún no corresponda una alerta por vencimiento. Marcar un documento como registrado no elimina un aviso si su fecha sigue vencida.

## Persistencia y restauración

La clave `sigee-demo` de localStorage guarda `{ version, state: { db } }`. El esquema completo y las referencias se validan al recuperar. Una versión incompatible o datos dañados provocan un reinicio controlado con aviso; el MVP no intenta adivinar migraciones. Si el navegador impide escribir, se muestra un aviso de persistencia y el estado sigue en memoria.

Para restaurar, pulsa **Restaurar datos de demostración** en la navegación y confirma **Restaurar datos**. Recupera el dataset original y elimina tus cambios, comentarios y asignaciones. Cancelar conserva el estado.

Los datos pertenecen a ese navegador y origen. No hay sincronización entre usuarios, transacciones entre pestañas, servidor, respaldo remoto ni auditoría inmutable. No introducir información sensible. Borrar los datos del navegador elimina la demostración local.

## Verificación y calidad

Vitest comprueba conteos, prioridades, vencimientos, alertas y su eliminación al cerrar, integridad, inventario, transacciones, restauración, persistencia y recuperación. Testing Library comprueba formularios y protección de borradores. Playwright ejecuta el caso estrella y comprueba EPP, metadatos documentales, las seis secciones, responsive y datos corruptos. Las comprobaciones de accesibilidad automatizadas son un apoyo, no una certificación.

Las convenciones completas están en [AGENTS.md](AGENTS.md). No hay cálculos de energía incidente, selección de EPP, SCADA, control eléctrico, certificaciones ni afirmaciones de cumplimiento NFPA 70E, IEEE 1584 o RETIE. No se generan estudios técnicos. Los avisos no autorizan trabajos ni determinan condiciones seguras de operación.

## Guion de demostración · 90 segundos

1. **0–15 s:** abre Centro de control. Señala el aviso de datos simulados, los hallazgos abiertos y los de prioridad alta.
2. **15–30 s:** entra en Activos eléctricos → ACT-001. Muestra documentos, estudios y avisos conectados por activo.
3. **30–50 s:** pulsa Crear hallazgo, escribe una observación ficticia, elige prioridad alta, asigna responsable y fecha objetivo. Guarda y verifica el registro en la ficha.
4. **50–65 s:** vuelve al dashboard: aumentan abiertos y prioridad alta. En Alertas, abre el nuevo aviso y edita el hallazgo para cerrarlo.
5. **65–80 s:** comprueba que desapareció la alerta y bajaron los indicadores. Recarga para mostrar la persistencia del cierre y su historial.
6. **80–90 s:** muestra brevemente EPP y Estudios y documentos. Restaura el dataset con confirmación para dejar la siguiente demo preparada.
