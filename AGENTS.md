# Convenciones de SIGEE

SIGEE es un prototipo independiente con datos ficticios para una demostración. El objetivo es mantener un flujo integrado y verificable de hallazgos → indicadores → alertas → cierre, antes de ampliar funciones secundarias. Trabaja en el checkout existente: cada tarea de nube ya está aislada; no crees worktrees sin petición expresa.

## Identidad pública y Git

- La identidad pública del proyecto es **`1cfer`**. Utilizar siempre ese usuario en la autoría, documentación y metadatos del proyecto; no asociarlo con un nombre personal ni un correo privado.
- Antes de crear commits, comprobar que tanto el autor como el confirmador usan el nombre `1cfer` y un correo `noreply` de GitHub para ese usuario. Configurar la identidad local del repositorio; no heredar automáticamente una identidad personal de la máquina.
- Conservar esta preferencia en las próximas tareas. No añadir nombres personales en trailers de autoría, mensajes de commit ni créditos.

## Arquitectura

- React + TypeScript estricto + Vite. React Router para rutas, Tailwind y tokens CSS para diseño, Radix para diálogos accesibles, Lucide para iconos y Recharts para visualizaciones con datos reales del store.
- `src/domain/`: entidades explícitas, esquemas Zod, dataset ficticio, reglas puras, selectores y exportación. No importar React ni el store desde las reglas de negocio.
- `src/store/`: un único store Zustand. Toda mutación valida el resultado completo antes de publicarlo. La persistencia guarda solamente `db`, nunca funciones, métricas ni alertas derivadas.
- `src/components/`: controles reutilizables y editores compartidos. `src/pages/`: composición de los seis módulos. Mantener componentes centrados en una responsabilidad; extraer componentes cuando una vista crezca.
- Entidades relacionadas por ID. Resolver nombres desde el estado compartido; no mantener copias de registros en cada pantalla. Un borrador de formulario sí puede ser local.
- Mantener los límites actuales. No introducir backend, autenticación, microservicios, buses de eventos ni infraestructura de agentes sin una necesidad aprobada.

## TypeScript y datos

- Conservar `strict`, `noUncheckedIndexedAccess` y comprobaciones de código sin uso. Evitar `any`, aserciones inseguras, mutaciones de arrays compartidos y supresiones de errores de tipos.
- Validar entradas con Zod y, en los formularios principales, React Hook Form. Revalidar en el store: los límites HTML no garantizan integridad.
- IDs estables; nunca índices de arrays como identidad. Las fechas de calendario usan `yyyy-MM-dd`; los eventos usan timestamps ISO. Usar `America/Bogota` para fechas de calendario y agrupaciones mensuales; no recortar un timestamp UTC para obtener el día local. Comparar vencimientos por día: hoy no está vencido.
- `total EPP = disponibles + no disponibles + asignadas`. Cantidades enteras no negativas; no sobregirar disponibilidad ni permitir referencias inexistentes. Reservar y devolver unidades de forma atómica.
- Estado cerrado implica `closedAt`; reabrir elimina esa fecha. La fecha objetivo no puede preceder la creación. Registrar estado, responsable y fecha objetivo anteriores y nuevos, fecha del evento y comentarios.
- Las alertas son funciones determinísticas: ID por regla/origen, sin duplicados ni almacenamiento separado. Cerrar un hallazgo elimina sus avisos aplicables.
- Antes de cambiar el esquema persistido, incrementar `STORAGE_VERSION` y definir una migración validada o un reinicio controlado con aviso. Recuperar datos incompatibles sin bloquear el arranque; comunicar fallos de almacenamiento.
- El dataset mantiene 3 instalaciones, 10 activos, 14 hallazgos, 12 EPP, 10 estudios, 15 documentos y al menos 8 eventos. Su fecha de referencia es fija y está documentada en `seed.ts`; no regenerar fechas en cada render.

## UX/UI

- Todo el contenido visible está en español. Tema claro, Inter local, espacios generosos, tipografía sobria, divisores sutiles y radios moderados. Tokens principales: azul `#102C46`, turquesa `#087F8C`, fondo `#F6F8FA`, bordes `#E5EBF0` y ámbar `#D69234`. Rojo reservado para advertencias.
- Mantener sidebar clara y coherencia entre pantallas. El dashboard usa una banda de indicadores con jerarquía, gráficas informativas y seguimiento reciente. Evitar tarjetas gigantes repetitivas, glassmorphism, degradados decorativos, iconos grandes y sombras exageradas.
- Cada botón debe producir una acción real. Búsqueda, filtros, vacíos útiles, confirmación de guardado y errores humanos. Confirmar restauraciones y eliminaciones, explicando qué datos relacionados se eliminan.
- Formularios con labels asociados, errores accesibles, foco visible y validación clara. Diálogos con captura/restauración de foco y teclado. Respetar movimiento reducido. No usar `alert()` como interfaz.
- Revisar escritorio, tablet y móvil. El scroll horizontal debe quedar dentro de la tabla. No ocultar desbordamientos generales para enmascarar errores. Mantener contraste legible; el color no puede ser la única señal de estado.
- No permitir que cerrar un formulario descarte silenciosamente cambios. Evitar enlaces de navegación en borradores sin guardar.

## Seguridad y responsabilidad

- Mantener visibles “Prototipo demostrativo · Datos simulados” y “Prototipo demostrativo con datos simulados. No apto para decisiones operativas de seguridad eléctrica.”
- No usar logos corporativos, instalaciones reales, datos confidenciales ni integraciones corporativas. No presentar SIGEE como aplicación oficial o validada por ISA.
- No calcular energía incidente, seleccionar EPP, simular SCADA o controles eléctricos, generar estudios/PDF técnicos ficticios, certificar documentos ni afirmar cumplimiento NFPA 70E, IEEE 1584 o RETIE.
- Un aviso nunca autoriza trabajos ni determina condiciones seguras de operación. La tensión nominal es una referencia ficticia, no una medición.
- Sin secretos ni datos personales reales en el código, logs o localStorage. localStorage no es un almacén seguro ni una solución multiusuario. React escapa los textos; no usar HTML arbitrario ni `dangerouslySetInnerHTML`.
- Exportar solo información demo y neutralizar fórmulas al generar CSV. No desactivar TLS ni verificaciones de dependencias para instalar.

## Pruebas y calidad

- Instalación reproducible: `npm ci --cache /workspace/.cache/npm` en nube. Conservar `package-lock.json` y usar Node 24.x, igual que el despliegue en Vercel.
- Ejecutar `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` y `npm run build` para cambios que afectan al flujo. No declarar resultados de comandos que no se ejecutaron.
- Vitest: reglas, fechas límite, integridad, inventario, mutaciones, reinicio y almacenamiento corrupto. Testing Library: interacciones y validación accesible, consultando por rol o label.
- Playwright: recorrido estrella, estado compartido, persistencia real tras recarga, restauración confirmada, módulos secundarios y navegación responsive. No reemplazar aserciones de comportamiento por comprobaciones de puertos o capturas.
- En esta nube se utiliza `/usr/bin/chromium`. Configurar `SIGEE_CHROMIUM_PATH` para otro ejecutable. No añadir esperas arbitrarias: usar aserciones que esperen el resultado observable.
- Corregir las causas de los fallos; no desactivar pruebas ni relajar reglas para forzar verde. Mantener distintos los resultados aprobados, fallidos y no ejecutados.
- Formatear con Prettier, conservar componentes y lógica legibles. Actualizar README cuando cambien comandos, alcance o limitaciones. No subir `node_modules`, `dist`, trazas ni datos locales.

## Producción y Vercel

- La aplicación se publica como archivos estáticos en la raíz del dominio. Conservar `base: '/'`, salida `dist` y la reescritura SPA en `vercel.json`; las rutas de React Router deben funcionar al entrar directamente y al recargar.
- No introducir localhost, direcciones del contenedor o rutas `/workspace` en los recursos de producción. JS, CSS, fuentes e iconos deben servirse desde el mismo origen.
- Antes de integrar cambios de despliegue, ejecutar la suite E2E contra `npm run preview` usando `SIGEE_BASE_URL`; incluye la comprobación de rutas profundas y recursos compilados.
- La configuración y un build local verificado no equivalen a un despliegue publicado. Informar la URL pública solo cuando exista un despliegue confirmado y se haya comprobado.
- Conservar `.vercel/` ignorado y no versionar credenciales ni identificadores de una cuenta personal. La demostración no requiere variables de entorno en Vercel.

## Futuras skills especializadas

Esta estructura ya proporciona puntos de revisión sin añadir infraestructura:

- Diseño: `src/styles.css`, `src/components/` y capturas de navegador.
- Integridad de datos: `src/domain/validation.ts`, `selectors.ts` y pruebas del store.
- Pruebas: `src/**/*.test.*` y `e2e/`.
- Revisión funcional: criterios de aceptación y guion en `README.md`.

Cuando se incorpore una skill, documentar su alcance y acceso aquí y mantener estas convenciones como contrato del proyecto. No crear agentes, registros de plugins, configuraciones ficticias o carpetas vacías por anticipado. La primera versión no necesita un sistema multiagente.
