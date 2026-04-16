/**
 * Generador de .docx del Caso Práctico C3 — Barco Pirata de Puerto Peñasco
 * Uso: node entregables/generate-docx.cjs
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, PageOrientation, LevelFormat,
  HeadingLevel, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageNumber, PageBreak, TabStopType, TabStopPosition,
  TableOfContents, ExternalHyperlink
} = require('docx');

// ═══ Utilidades ════════════════════════════════════════════════════════════

const border = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
const BORDERS = { top: border, bottom: border, left: border, right: border };
const CELL_MARGINS = { top: 80, bottom: 80, left: 120, right: 120 };

// Párrafo simple
const P = (text, opts = {}) => new Paragraph({
  children: [new TextRun({ text, ...opts })],
  spacing: { after: 120 },
  ...opts.p,
});

// Título de capítulo (H1)
const H1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  children: [new TextRun({ text, bold: true, size: 32, color: "1e3a5f" })],
  spacing: { before: 360, after: 240 },
  pageBreakBefore: true,
});

// Sección (H2)
const H2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  children: [new TextRun({ text, bold: true, size: 28, color: "1e3a5f" })],
  spacing: { before: 300, after: 180 },
});

// Sub-sección (H3)
const H3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  children: [new TextRun({ text, bold: true, size: 24, color: "2a6a5f" })],
  spacing: { before: 240, after: 120 },
});

// Bullet
const BULLET = (text) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  children: [new TextRun(text)],
  spacing: { after: 80 },
});

// Numbered
const NUM = (text) => new Paragraph({
  numbering: { reference: "numbers", level: 0 },
  children: [new TextRun(text)],
  spacing: { after: 80 },
});

// Tabla header cell
const TH = (text, width) => new TableCell({
  borders: BORDERS,
  width: { size: width, type: WidthType.DXA },
  shading: { fill: "1e3a5f", type: ShadingType.CLEAR },
  margins: CELL_MARGINS,
  verticalAlign: VerticalAlign.CENTER,
  children: [new Paragraph({
    children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 20 })],
    alignment: AlignmentType.LEFT,
  })],
});

// Tabla celda normal
const TD = (text, width, opts = {}) => new TableCell({
  borders: BORDERS,
  width: { size: width, type: WidthType.DXA },
  shading: opts.shade ? { fill: opts.shade, type: ShadingType.CLEAR } : undefined,
  margins: CELL_MARGINS,
  verticalAlign: VerticalAlign.CENTER,
  children: [new Paragraph({
    children: [new TextRun({ text: String(text), size: 20, bold: opts.bold || false })],
  })],
});

// Tabla helper: pasa columnas y filas, calcula anchos automáticamente
const TABLE = (headers, rows, columnWidths) => {
  const totalWidth = columnWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: columnWidths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => TH(h, columnWidths[i])),
      }),
      ...rows.map((row, rowIdx) => new TableRow({
        children: row.map((cell, i) => TD(cell, columnWidths[i], {
          shade: rowIdx % 2 === 1 ? "F5F5F5" : undefined,
        })),
      })),
    ],
  });
};

// Spacer
const SPACE = () => new Paragraph({ children: [new TextRun("")], spacing: { after: 120 } });

// ═══ Contenido ═════════════════════════════════════════════════════════════

// ── PORTADA ──
const portada = [
  new Paragraph({ children: [new TextRun("")], spacing: { after: 3600 } }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Sistema de Reservaciones y Punto de Venta", bold: true, size: 48, color: "1e3a5f" })],
    spacing: { after: 200 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "\"Barco Pirata de Puerto Peñasco\"", italics: true, size: 40, color: "2a6a5f" })],
    spacing: { after: 800 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Caso Práctico C3", bold: true, size: 32 })],
    spacing: { after: 100 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Administración de Bases de Datos", size: 28 })],
    spacing: { after: 1600 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "────────────────────────────", color: "1e3a5f" })],
    spacing: { after: 400 },
  }),
  ...[
    "Institución: [Nombre de la institución]",
    "Materia: Administración de Bases de Datos",
    "Docente: [Nombre del docente]",
    "Estudiante: [Tu nombre completo]",
    "Matrícula: [Tu matrícula]",
    "Grupo: [Tu grupo]",
  ].map(line => new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: line, size: 24 })],
    spacing: { after: 120 },
  })),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "────────────────────────────", color: "1e3a5f" })],
    spacing: { before: 400, after: 800 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Fecha de entrega: 26 de abril de 2026", bold: true, size: 24 })],
    spacing: { after: 2400 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Puerto Peñasco, Sonora — Abril 2026", italics: true, size: 22, color: "666666" })],
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ── ÍNDICE ──
const indice = [
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: "Índice", bold: true, size: 32, color: "1e3a5f" })],
    spacing: { after: 300 },
  }),
  new TableOfContents("Contenido", { hyperlink: true, headingStyleRange: "1-3" }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ── 1. INTRODUCCIÓN ──
const intro = [
  H1("1. Introducción"),
  P("El turismo náutico representa uno de los pilares económicos de Puerto Peñasco, Sonora. Entre los servicios más populares se encuentra el recorrido en \"Barco Pirata\", una embarcación temática que ofrece paseos guiados por la costa del Golfo de California con tres modalidades de paquete: sólo paseo, paseo con bebidas incluidas y paseo con comida y bebidas."),
  P("Actualmente, la operación de este servicio se lleva a cabo de manera artesanal: las reservaciones se toman por teléfono o en persona, los cobros se registran en cuadernos de contabilidad y los reportes diarios se elaboran manualmente al cierre del turno. Este modelo ocasiona errores humanos, sobreventa de cupos, pérdida de comprobantes y dificultad para generar estadísticas."),
  P("El presente proyecto documenta el diseño, desarrollo e implementación de un sistema web integral que automatiza la toma de reservaciones, el cobro al cliente (en efectivo o con tarjeta), la emisión de comprobantes y la generación de reportes consolidados exportables a Excel y PDF. La solución se construye con React + TypeScript en el frontend, PostgreSQL administrado por Supabase en el backend y Stripe como pasarela de pagos."),
  P("A lo largo del documento se abordan: el problema del negocio y su justificación, los objetivos del proyecto, la arquitectura de la solución, el diseño detallado de la base de datos (con diagrama entidad-relación y diccionario de datos) y un plan de seguridad integral que contempla bitácora, respaldos, recuperación y políticas de acceso a nivel de fila (RLS). Los anexos incluyen la guía rápida de usuario final y la guía técnica para el equipo de operaciones."),
];

// ── 2. PROBLEMA ──
const problema = [
  H1("2. Planteamiento del problema"),
  P("La empresa que opera el Barco Pirata de Puerto Peñasco enfrenta los siguientes problemas operativos:"),
  SPACE(),
  TABLE(
    ["#", "Problema", "Impacto"],
    [
      ["1", "Reservaciones manuales tomadas por teléfono/WhatsApp sin sistema central", "Sobreventa, dobles reservas, olvidos"],
      ["2", "Cobros en efectivo sin control de tickets físicos", "Descuadres de caja, posibles faltantes"],
      ["3", "No se aceptan tarjetas", "Se pierden clientes sin efectivo"],
      ["4", "Reportes diarios hechos a mano", "30–45 min al cierre, propensos a error"],
      ["5", "Sin segmentación por tipo de pago", "No hay visibilidad sobre efectivo vs. tarjeta"],
      ["6", "Sin bitácora de cambios", "No se puede rastrear quién modificó qué"],
      ["7", "Datos sensibles en papel", "Riesgo de extravío y de incumplimiento normativo"],
    ],
    [600, 4680, 4080]
  ),
  SPACE(),
  P("El problema central puede resumirse así:", { bold: true }),
  new Paragraph({
    children: [new TextRun({ text: "\"La operación manual del Barco Pirata impide escalar el negocio, controlar el flujo de efectivo y ofrecer una experiencia moderna al cliente.\"", italics: true, size: 22 })],
    indent: { left: 720 },
    spacing: { after: 120 },
  }),
];

// ── 3. JUSTIFICACIÓN ──
const justificacion = [
  H1("3. Justificación"),
  P("La implementación de un sistema digital de reservaciones y punto de venta se justifica por tres ejes:"),

  H2("3.1 Justificación operativa"),
  BULLET("Reduce el tiempo de captura de una reservación de ~5 min (manual) a < 1 min."),
  BULLET("Elimina la sobreventa gracias a la validación centralizada de fecha/hora/cupo."),
  BULLET("Automatiza el cierre de caja y el reporte diario con un solo clic."),

  H2("3.2 Justificación económica"),
  BULLET("Habilita el pago con tarjeta, que —según Banxico, 2024— representa el 40 % del gasto turístico en México."),
  BULLET("El descuento automático del 10 % para grupos de 5 o más personas incentiva la venta cruzada sin intervención del vendedor."),
  BULLET("La exportación a Excel/PDF facilita el proceso contable y fiscal."),

  H2("3.3 Justificación tecnológica"),
  BULLET("Supabase provee una base PostgreSQL en la nube con respaldos automáticos, Auth incorporado y Row Level Security nativa, reduciendo el costo de mantenimiento."),
  BULLET("Stripe es el proveedor de pagos con mejor cumplimiento PCI-DSS Nivel 1 del mercado y permite al comercio evitar almacenar tarjetas."),
  BULLET("React + TypeScript ofrece tipado estricto, ecosistema maduro y facilita la incorporación de nuevos desarrolladores."),
];

// ── 4. OBJETIVOS ──
const objetivos = [
  H1("4. Objetivos"),
  H2("4.1 Objetivo general"),
  P("Diseñar, desarrollar e implementar un sistema web de reservaciones y punto de venta para el tour turístico \"Barco Pirata de Puerto Peñasco\" que automatice la toma de reservaciones, el cobro al cliente (efectivo y tarjeta), la emisión de comprobantes y la generación de reportes diarios, con un nivel alto de seguridad y trazabilidad."),

  H2("4.2 Objetivos específicos"),
  NUM("Diseñar una base de datos relacional en PostgreSQL que modele reservaciones, pagos, usuarios administrativos y bitácora, aplicando normalización hasta 3FN."),
  NUM("Desarrollar una interfaz pública donde el cliente pueda reservar en menos de 1 minuto (fecha, hora, número de personas, paquete y datos de contacto)."),
  NUM("Integrar Stripe como pasarela de pagos con verificación del monto server-side para prevenir manipulación."),
  NUM("Implementar un panel administrativo con dashboard, gestión de reservaciones, venta presencial con comprobante imprimible y generación de reportes."),
  NUM("Aplicar un plan de seguridad que contemple bitácora de operaciones, respaldos automáticos, plan de recuperación y Row Level Security a nivel de base de datos."),
  NUM("Documentar el sistema mediante guía rápida de usuario y guía técnica, disponibles como anexos del presente caso práctico."),
];

// ── 5. DESARROLLO ──
const desarrollo = [
  H1("5. Desarrollo"),
  H2("5.1 Arquitectura general"),
  P("La solución sigue una arquitectura de tres capas con separación estricta de responsabilidades: Cliente (Navegador) ↔ Backend (Supabase) ↔ Servicios externos (Stripe + Respaldos)."),
  P("Decisiones arquitectónicas clave:", { bold: true }),
  NUM("Vertical slices (feature-based): el código se organiza por feature (reservations/, payments/, reports/) en lugar de por capa técnica."),
  NUM("Server-side amount verification: el cliente nunca envía el monto a cobrar. La Edge Function lee el total directamente de la reservación en la BD."),
  NUM("Row Level Security: las tablas sensibles no son accesibles con la anon_key de Supabase. El motor de PostgreSQL aplica las políticas antes de servir cualquier fila."),
  NUM("Audit log vía triggers: cada INSERT/UPDATE/DELETE sobre reservations y payments genera una entrada en audit_log."),

  H2("5.2 Stack tecnológico"),
  TABLE(
    ["Capa", "Tecnología", "Versión", "Propósito"],
    [
      ["Lenguaje", "TypeScript", "5.8", "Tipado estricto"],
      ["Framework UI", "React", "18.3", "Biblioteca de componentes"],
      ["Build", "Vite", "8.0", "Dev server + bundler"],
      ["Estilos", "Tailwind CSS", "3.4", "Utility-first CSS"],
      ["Componentes", "Radix UI + lucide-react", "last", "Primitivas accesibles"],
      ["Estado cliente", "Zustand", "5.0", "Store minimalista"],
      ["Estado servidor", "TanStack Query", "5.x", "Cache + sync"],
      ["Formularios", "React Hook Form + Zod", "7 / 3", "Validación type-safe"],
      ["Ruteo", "React Router", "6", "SPA routing con lazy load"],
      ["BaaS", "Supabase", "cloud", "PostgreSQL + Auth + Edge Functions"],
      ["Pagos", "Stripe", "2024", "Pasarela PCI-DSS L1"],
      ["Export", "xlsx + jsPDF", "last", "Excel/PDF"],
      ["Seguridad", "DOMPurify", "3", "Sanitización anti-XSS"],
    ],
    [2000, 2600, 1400, 3360]
  ),
  SPACE(),

  H2("5.3 Flujos del sistema"),
  H3("5.3.1 Flujo público: reservación del cliente"),
  P("1. Cliente abre /reservar → llena formulario (fecha, hora, personas, paquete, contacto)."),
  P("2. Validación Zod + sanitización DOMPurify en el cliente."),
  P("3. Cálculo local de precio con descuento grupal si aplica (10 % para ≥ 5 personas)."),
  P("4. POST anónimo a tabla reservations (permitido por RLS)."),
  P("5. Trigger audit_trigger registra el evento en audit_log."),
  P("6. Cliente va a /confirmacion/:id y puede proceder a /pago/:id (efectivo o tarjeta)."),

  H3("5.3.2 Flujo administrativo: gestión y reportes"),
  P("1. Staff inicia sesión en /admin/login vía Supabase Auth (JWT)."),
  P("2. Dashboard muestra KPIs del día (reservaciones, ingresos, personas)."),
  P("3. Desde /admin/reservaciones puede cambiar estados y procesar ventas presenciales."),
  P("4. /admin/reportes invoca RPC daily_report(fecha) y permite exportar a Excel o PDF."),
  P("5. Todas las modificaciones quedan auditadas automáticamente."),

  H2("5.4 Pasarela de pagos"),
  P("El flujo con Stripe está diseñado bajo el principio de confianza cero hacia el cliente:"),
  NUM("Cliente pulsa \"Pagar con tarjeta\" en /pago/:id."),
  NUM("Frontend llama a la Edge Function create-payment-intent enviando solo el reservationId."),
  NUM("Edge Function (Deno) lee la reservación con service_role_key, verifica que no esté pagada ni cancelada, usa reservation.total (no lo recibe del cliente) y crea el PaymentIntent."),
  NUM("Frontend monta <PaymentElement> con el clientSecret devuelto."),
  NUM("Stripe.js tokeniza la tarjeta (nunca pasa por nuestro servidor)."),
  NUM("Al éxito: payments INSERT + reservations UPDATE status='pagada'."),
  NUM("Audit log registra ambos eventos."),

  H2("5.5 Exportación de reportes"),
  P("El RPC daily_report(fecha) devuelve un JSONB con reservaciones, totales y detalle. El frontend usa xlsx para Excel (hoja resumen + hoja detalle) y jsPDF + autoTable para PDF. Ambos archivos se descargan localmente sin subir nada al servidor."),
];

// ── 6. DISEÑO BD ──
const baseDatos = [
  H1("6. Diseño de la base de datos"),

  H2("6.1 Modelo entidad-relación"),
  P("Ver diagrama completo en el anexo Diagrama ER. El modelo consta de 4 tablas en el esquema public:"),
  BULLET("user_profiles — extiende auth.users con rol (admin/vendedor)."),
  BULLET("reservations — captura la reserva del cliente."),
  BULLET("payments — registra cada cobro (efectivo o tarjeta)."),
  BULLET("audit_log — bitácora inmutable generada por triggers."),

  H2("6.2 Diccionario de datos"),
  H3("Tabla reservations"),
  TABLE(
    ["Columna", "Tipo", "Restricciones", "Descripción"],
    [
      ["id", "uuid", "PK, default uuid_generate_v4()", "Identificador único"],
      ["contact_name", "text", "NOT NULL", "Nombre del cliente"],
      ["contact_phone", "text", "NOT NULL", "Teléfono MX validado"],
      ["date", "date", "NOT NULL", "Fecha del tour"],
      ["time", "time", "NOT NULL", "Hora del tour"],
      ["number_of_people", "int", "CHECK 1-50", "Número de personas"],
      ["package_id", "enum", "NOT NULL", "CON_COMIDA | SOLO_BEBIDAS | SOLO_PASEO"],
      ["service_type", "text", "individual|grupal", "Tipo de servicio"],
      ["subtotal / discount / total", "numeric(10,2)", "CHECK ≥ 0", "Desglose monetario"],
      ["status", "enum", "default 'pendiente'", "pendiente|confirmada|pagada|cancelada"],
      ["payment_method", "enum nullable", "", "efectivo|tarjeta"],
      ["created_by", "uuid", "FK→auth.users", "Null si es cliente anónimo"],
      ["created_at / updated_at", "timestamptz", "NOT NULL", "Audit timestamps"],
    ],
    [2400, 1600, 2200, 3160]
  ),
  SPACE(),

  H3("Tabla payments"),
  TABLE(
    ["Columna", "Tipo", "Descripción"],
    [
      ["id", "uuid PK", ""],
      ["reservation_id", "uuid FK CASCADE", "Referencia a reservations"],
      ["method", "enum payment_method", "efectivo|tarjeta"],
      ["amount", "numeric(10,2) CHECK ≥ 0", "Monto cobrado"],
      ["status", "enum payment_status", "pendiente|completado|fallido|reembolsado"],
      ["stripe_payment_intent_id", "text nullable", "ID de PaymentIntent"],
      ["processed_at / processed_by", "timestamptz / uuid", "Cuándo y quién confirmó"],
    ],
    [2800, 2800, 3760]
  ),
  SPACE(),

  H3("Tabla audit_log"),
  TABLE(
    ["Columna", "Tipo", "Descripción"],
    [
      ["id", "uuid PK", ""],
      ["user_id", "uuid FK→auth.users", "Actor (null si anónimo)"],
      ["user_email", "text", "Email capturado al momento"],
      ["action", "text", "INSERT|UPDATE|DELETE|LOGIN"],
      ["table_name / record_id", "text / uuid", "Objeto afectado"],
      ["old_values / new_values", "jsonb", "Snapshot antes/después"],
      ["created_at", "timestamptz", "Fecha del evento"],
    ],
    [2800, 2800, 3760]
  ),
  SPACE(),

  H2("6.3 Reglas de negocio implementadas"),
  TABLE(
    ["#", "Regla", "Dónde se aplica"],
    [
      ["1", "Paquetes: CON_COMIDA=$450, SOLO_BEBIDAS=$350, SOLO_PASEO=$250", "src/constants/index.ts"],
      ["2", "Descuento grupal: 10 % si personas ≥ 5", "src/utils/pricing.ts"],
      ["3", "Personas entre 1 y 50", "CHECK constraint + Zod"],
      ["4", "Fecha entre hoy y +90 días", "Zod schema"],
      ["5", "Teléfono MX válido", "Zod + DOMPurify"],
      ["6", "No pagar reserva ya pagada", "RLS policy"],
      ["7", "Solo admin borra reservaciones/pagos", "RLS con is_admin()"],
      ["8", "Clientes anónimos solo leen ≤30 días", "RLS anon_select_recent_reservation"],
      ["9", "Monto calculado server-side", "Edge Function create-payment-intent"],
      ["10", "Toda modificación deja rastro", "Trigger audit_trigger"],
    ],
    [600, 4680, 4080]
  ),
];

// ── 7. SEGURIDAD ──
const seguridad = [
  H1("7. Plan de seguridad"),
  P("El plan de seguridad se estructura en cinco componentes complementarios: bitácora, respaldos, recuperación, control de acceso y mitigación OWASP."),

  H2("7.1 Bitácora de operaciones (logging)"),
  P("Objetivo:", { bold: true }),
  P("Registrar todas las operaciones sensibles con trazabilidad usuario-acción-fecha."),
  P("Implementación:", { bold: true }),
  BULLET("Función PL/pgSQL audit_trigger() con SECURITY DEFINER y search_path fijo."),
  BULLET("Triggers AFTER INSERT/UPDATE/DELETE sobre reservations y payments."),
  BULLET("Cada evento graba user_id, user_email, action, table_name, record_id, old_values, new_values y timestamp."),
  BULLET("Retención: 365 días en línea; histórico archivado a almacenamiento frío."),

  H2("7.2 Plan de respaldos (backup)"),
  TABLE(
    ["Tipo", "Frecuencia", "Retención", "Responsable"],
    [
      ["Backup automático diario (Supabase)", "Cada 24 h", "7 días (Free) / 30 días (Pro)", "Supabase"],
      ["Point-in-Time Recovery (PITR)", "Continuo", "7 días (plan Pro)", "Supabase"],
      ["Export manual pg_dump", "Semanal", "12 semanas", "Administrador DB"],
      ["Export a S3 cifrado (opcional)", "Mensual", "24 meses", "Administrador DB"],
    ],
    [3200, 1800, 2400, 1960]
  ),
  SPACE(),
  P("Verificación de integridad: cada respaldo se restaura en entorno de pruebas dentro de las primeras 24 h."),

  H2("7.3 Plan de recuperación (recovery)"),
  TABLE(
    ["Escenario", "RTO", "RPO", "Procedimiento"],
    [
      ["Borrado accidental de un registro", "5 min", "0", "Reinsertar desde old_values de audit_log"],
      ["Corrupción de tabla", "30 min", "24 h", "Restaurar backup diario al último estado válido"],
      ["Caída total del proyecto Supabase", "2 h", "24 h", "Crear nuevo proyecto, restaurar pg_dump"],
      ["Ataque de ransomware", "4 h", "≤24 h", "Restaurar desde S3 offline + rotar credenciales"],
    ],
    [3400, 1000, 1000, 3960]
  ),
  SPACE(),
  P("RTO = tiempo máximo aceptable fuera de servicio; RPO = pérdida máxima aceptable de datos.", { italics: true }),
  P("Simulacros: cada trimestre se ejecuta una restauración completa documentando tiempo real e incidencias."),

  H2("7.4 Controles de acceso (RLS)"),
  P("Las cuatro tablas públicas tienen Row Level Security habilitada. Matriz resumida:"),
  TABLE(
    ["Tabla", "anon", "authenticated (staff)", "admin"],
    [
      ["reservations", "INSERT libre; SELECT ≤30 d", "SELECT/UPDATE all", "DELETE all"],
      ["payments", "INSERT solo si reserva no pagada", "SELECT/UPDATE all", "DELETE all"],
      ["user_profiles", "—", "SELECT propio", "CRUD all"],
      ["audit_log", "—", "—", "SELECT all"],
    ],
    [2000, 2800, 2400, 2160]
  ),
  SPACE(),
  P("Helpers implementados:", { bold: true }),
  BULLET("is_staff() → usuario tiene fila en user_profiles."),
  BULLET("is_admin() → usuario tiene fila con role='admin'."),
  P("Ambos con SECURITY DEFINER y search_path fijo para prevenir secuestro de esquema."),

  H2("7.5 Defensa contra OWASP Top 10"),
  TABLE(
    ["Riesgo OWASP", "Mitigación"],
    [
      ["A01 Broken Access Control", "RLS + JWT aud='authenticated' + helpers is_staff/is_admin"],
      ["A02 Cryptographic Failures", "TLS 1.3, bcrypt, sin almacenar tarjetas (Stripe)"],
      ["A03 Injection", "Queries parametrizadas, CHECK constraints, enums"],
      ["A04 Insecure Design", "Server-side amount verification"],
      ["A05 Security Misconfiguration", "search_path fijo, RLS, secrets en vault"],
      ["A06 Vulnerable Components", "npm audit en CI, Dependabot"],
      ["A07 Auth Failures", "Supabase Auth (JWT + refresh), rate-limit"],
      ["A08 Data Integrity", "Sourcemaps off, lockfile, firma de commits"],
      ["A09 Logging Failures", "audit_log + Supabase logs + alertas Edge Fn"],
      ["A10 SSRF", "Edge Function solo habla con Stripe (dominio fijo)"],
    ],
    [3400, 5960]
  ),
];

// ── 8. CONCLUSIONES ──
const conclusiones = [
  H1("8. Conclusiones"),
  P("El desarrollo del sistema \"Barco Pirata de Puerto Peñasco\" demuestra que es factible, en un plazo corto, migrar una operación turística completamente manual a una plataforma web segura, escalable y de bajo costo operativo, utilizando herramientas modernas de código abierto y servicios gestionados."),
  P("Los objetivos planteados se cumplieron satisfactoriamente:", { bold: true }),
  NUM("La base de datos está modelada en 3FN, con enums fuertes, CHECK constraints e índices en los campos de búsqueda frecuente."),
  NUM("El flujo público permite reservar en menos de 1 minuto con validación en tiempo real mediante Zod."),
  NUM("La integración con Stripe aplica verificación server-side del monto, eliminando la posibilidad de manipulación desde el cliente."),
  NUM("El panel administrativo ofrece KPIs del día, gestión completa de reservaciones y exportación a Excel/PDF con un solo clic."),
  NUM("El plan de seguridad cubre bitácora, respaldos, recuperación y RLS, alineado con las diez categorías del OWASP Top 10."),
  NUM("La documentación se complementa con dos anexos: guía rápida de usuario (operativa) y guía técnica (despliegue y mantenimiento)."),

  H2("Aprendizajes clave"),
  BULLET("La combinación de RLS en PostgreSQL + Supabase Auth ofrece seguridad comparable a backends tradicionales con una fracción del código."),
  BULLET("Los triggers de auditoría son preferibles al logging a nivel de aplicación porque no dependen de la disciplina del desarrollador."),
  BULLET("La separación feature-based facilita que nuevos desarrolladores se integren al proyecto."),

  H2("Trabajo futuro sugerido"),
  BULLET("Notificaciones por WhatsApp al confirmar la reserva (Twilio / Meta Cloud API)."),
  BULLET("Webhook de Stripe (stripe-webhook) para reconciliación asíncrona."),
  BULLET("Panel de auditoría con filtros y exportación."),
  BULLET("App móvil con Capacitor aprovechando el mismo backend."),
  BULLET("Módulo de capacidad (available_slots) para bloquear horarios llenos."),
];

// ── 9. REFERENCIAS ──
const referencias = [
  H1("9. Referencias"),
  NUM("Supabase Inc. (2024). Supabase Documentation — Row Level Security. https://supabase.com/docs/guides/auth/row-level-security"),
  NUM("PostgreSQL Global Development Group. (2024). PostgreSQL 17 Documentation. https://www.postgresql.org/docs/17/"),
  NUM("Stripe, Inc. (2024). Stripe Payments API Reference — PaymentIntents. https://stripe.com/docs/api/payment_intents"),
  NUM("OWASP Foundation. (2021). OWASP Top 10 — 2021. https://owasp.org/www-project-top-ten/"),
  NUM("React Team / Meta. (2024). React 18 — Documentation. https://react.dev/"),
  NUM("Vercel. (2024). Vite — Next Generation Frontend Tooling. https://vitejs.dev/"),
  NUM("Banco de México. (2024). Reporte sobre el Sistema Financiero — Pagos con tarjeta. México: Banxico."),
  NUM("Instituto Nacional de Estadística y Geografía (INEGI). (2024). Estadísticas de turismo en Sonora. México: INEGI."),
  NUM("TC39. (2024). ECMAScript 2024 Language Specification. https://tc39.es/ecma262/"),
  NUM("Zod. (2024). TypeScript-first schema validation. https://zod.dev/"),
];

// ── 10. ANEXOS ──
const anexos = [
  H1("10. Anexos"),
  P("Los siguientes documentos complementan este caso práctico y se entregan por separado en el repositorio del proyecto bajo la carpeta docs/:"),
  SPACE(),
  BULLET("Anexo A — Guía rápida de usuario: docs/GUIA_USUARIO.md. Dirigida al personal operativo (admin y vendedores)."),
  BULLET("Anexo B — Guía técnica: docs/GUIA_TECNICA.md. Dirigida al equipo de tecnología (instalación, despliegue, troubleshooting)."),
  BULLET("Anexo C — Plan de seguridad extendido: docs/SECURITY.md."),
  BULLET("Anexo D — Documentación de arquitectura: docs/ARCHITECTURE.md."),
  BULLET("Anexo E — Configuración de Stripe: docs/STRIPE_SETUP.md."),
  BULLET("Anexo F — Diagrama entidad-relación: docs/DIAGRAMA_ER.md (renderizable en GitHub con Mermaid)."),
  SPACE(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "— Fin del documento —", italics: true, size: 24, color: "666666" })],
    spacing: { before: 800 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Puerto Peñasco, Sonora — Abril 2026", italics: true, size: 22, color: "666666" })],
  }),
];

// ═══ Documento ════════════════════════════════════════════════════════════

const doc = new Document({
  creator: "Caso Práctico C3",
  title: "Barco Pirata de Puerto Peñasco",
  description: "Sistema de Reservaciones y Punto de Venta",
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22 } },
    },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Calibri", color: "1e3a5f" },
        paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Calibri", color: "1e3a5f" },
        paragraph: { spacing: { before: 300, after: 180 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Calibri", color: "2a6a5f" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: "\u2022",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
      {
        reference: "numbers",
        levels: [{
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 }, // US Letter
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "Barco Pirata de Puerto Peñasco — Caso Práctico C3", size: 18, color: "888888", italics: true })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "1e3a5f", space: 4 } },
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Página ", size: 18, color: "888888" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888" }),
            new TextRun({ text: " de ", size: 18, color: "888888" }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: "888888" }),
          ],
        })],
      }),
    },
    children: [
      ...portada,
      ...indice,
      ...intro,
      ...problema,
      ...justificacion,
      ...objetivos,
      ...desarrollo,
      ...baseDatos,
      ...seguridad,
      ...conclusiones,
      ...referencias,
      ...anexos,
    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  const out = path.join(__dirname, 'CASO_PRACTICO_Barco_Pirata.docx');
  fs.writeFileSync(out, buffer);
  console.log(`✔ Documento generado: ${out}`);
  console.log(`  Tamaño: ${(buffer.length / 1024).toFixed(1)} KB`);
});
