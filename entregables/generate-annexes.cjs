/**
 * Generador de .docx para los dos anexos del Caso Práctico:
 *  - Anexo A: Guía rápida de usuario
 *  - Anexo B: Guía técnica
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat,
  HeadingLevel, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageNumber, PageBreak
} = require('docx');

const border = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
const BORDERS = { top: border, bottom: border, left: border, right: border };
const CELL_MARGINS = { top: 80, bottom: 80, left: 120, right: 120 };

const P = (text, opts = {}) => new Paragraph({
  children: [new TextRun({ text, ...opts })], spacing: { after: 120 },
});
const H1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  children: [new TextRun({ text, bold: true, size: 32, color: "1e3a5f" })],
  spacing: { before: 360, after: 240 },
  pageBreakBefore: true,
});
const H2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  children: [new TextRun({ text, bold: true, size: 28, color: "1e3a5f" })],
  spacing: { before: 300, after: 180 },
});
const H3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  children: [new TextRun({ text, bold: true, size: 24, color: "2a6a5f" })],
  spacing: { before: 240, after: 120 },
});
const BULLET = (text) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  children: [new TextRun(text)], spacing: { after: 80 },
});
const NUM = (text) => new Paragraph({
  numbering: { reference: "numbers", level: 0 },
  children: [new TextRun(text)], spacing: { after: 80 },
});
const SPACE = () => new Paragraph({ children: [new TextRun("")], spacing: { after: 120 } });

const TH = (text, width) => new TableCell({
  borders: BORDERS, width: { size: width, type: WidthType.DXA },
  shading: { fill: "1e3a5f", type: ShadingType.CLEAR },
  margins: CELL_MARGINS, verticalAlign: VerticalAlign.CENTER,
  children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 20 })] })],
});
const TD = (text, width, opts = {}) => new TableCell({
  borders: BORDERS, width: { size: width, type: WidthType.DXA },
  shading: opts.shade ? { fill: opts.shade, type: ShadingType.CLEAR } : undefined,
  margins: CELL_MARGINS, verticalAlign: VerticalAlign.CENTER,
  children: [new Paragraph({ children: [new TextRun({ text: String(text), size: 20 })] })],
});
const TABLE = (headers, rows, columnWidths) => {
  const totalWidth = columnWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => TH(h, columnWidths[i])) }),
      ...rows.map((row, rowIdx) => new TableRow({
        children: row.map((cell, i) => TD(cell, columnWidths[i], {
          shade: rowIdx % 2 === 1 ? "F5F5F5" : undefined,
        })),
      })),
    ],
  });
};

const baseStyles = {
  default: { document: { run: { font: "Calibri", size: 22 } } },
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
};
const baseNumbering = {
  config: [
    { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
  ],
};
const baseSectionProps = (headerText) => ({
  properties: {
    page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
  },
  headers: {
    default: new Header({
      children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: headerText, size: 18, color: "888888", italics: true })],
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
});

// ─────────────────────────────────────────────────────────────
// ANEXO A — GUÍA DE USUARIO
// ─────────────────────────────────────────────────────────────

const portadaUsuario = [
  new Paragraph({ children: [new TextRun("")], spacing: { after: 3600 } }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Anexo A", bold: true, size: 32, color: "888888" })],
    spacing: { after: 200 } }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Guía rápida de usuario", bold: true, size: 48, color: "1e3a5f" })],
    spacing: { after: 200 } }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Barco Pirata de Puerto Peñasco", italics: true, size: 32, color: "2a6a5f" })],
    spacing: { after: 1600 } }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Dirigido al personal operativo (admin y vendedores)", size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Tiempo de lectura: 10 minutos", size: 22, italics: true, color: "666666" })],
    spacing: { after: 1200 } }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Abril 2026", size: 22, color: "666666" })] }),
  new Paragraph({ children: [new PageBreak()] }),
];

const contenidoUsuario = [
  H1("1. ¿Qué hace el sistema?"),
  P("El sistema Barco Pirata administra:"),
  BULLET("Reservaciones de clientes (desde la página pública o desde el panel)."),
  BULLET("Cobros en efectivo o con tarjeta."),
  BULLET("Comprobantes imprimibles y estilizados."),
  BULLET("Reportes diarios con exportación a Excel y PDF."),
  BULLET("Bitácora automática de todas las operaciones."),

  H1("2. Perfiles de usuario"),
  TABLE(
    ["Perfil", "Qué puede hacer"],
    [
      ["Administrador", "Todo: gestiona usuarios, ve la bitácora, elimina registros, consulta reportes históricos."],
      ["Vendedor", "Crea y modifica reservaciones, cobra (efectivo o tarjeta), imprime comprobantes, genera reportes del día."],
      ["Cliente (público)", "Solo crea su propia reservación desde /reservar. No necesita cuenta."],
    ],
    [2400, 6960]
  ),

  H1("3. Acceso al panel administrativo"),
  NUM("Abre el navegador (Chrome, Edge o Firefox)."),
  NUM("Visita http://localhost:3000/admin/login (o tu URL de producción)."),
  NUM("Ingresa tu email y contraseña."),
  NUM("Pulsa \"Iniciar sesión\"."),
  P("Si olvidaste tu contraseña, pide al administrador que la reinicie desde Supabase Dashboard.", { italics: true }),
  H3("Cerrar sesión"),
  P("Pulsa tu nombre en la esquina superior derecha → Cerrar sesión."),

  H1("4. Dashboard"),
  P("Al entrar verás tres indicadores principales:"),
  BULLET("Reservaciones hoy: total del día (incluye pendientes y pagadas, excluye canceladas)."),
  BULLET("Ingresos hoy: suma del total de reservaciones pagadas."),
  BULLET("Personas: número total de pasajeros agendados para hoy."),
  P("Debajo verás una lista de las próximas 5 reservaciones ordenadas por hora."),

  H1("5. Reservar por un cliente"),
  P("Cuándo: si el cliente llega al puerto sin reservación previa."),
  NUM("Desde el panel, pulsa \"Nueva reservación\" o abre /reservar."),
  NUM("Llena nombre, teléfono, fecha, hora, número de personas, paquete y notas opcionales."),
  NUM("Paquetes disponibles:"),
  BULLET("CON_COMIDA — $450 por persona (paseo + bebidas + comida)."),
  BULLET("SOLO_BEBIDAS — $350 por persona (paseo + bebidas)."),
  BULLET("SOLO_PASEO — $250 por persona."),
  NUM("Pulsa \"Reservar\" y comparte el código con el cliente."),
  P("Descuento automático: si son 5 o más personas, el sistema aplica el 10 % de descuento grupal.", { bold: true }),

  H1("6. Cobrar en efectivo"),
  NUM("Ve a Reservaciones → busca la reserva por nombre o teléfono."),
  NUM("Pulsa \"Ir a venta\"."),
  NUM("Verifica el total con el cliente."),
  NUM("Selecciona \"Efectivo\"."),
  NUM("Pulsa \"Registrar pago\"."),
  NUM("Se abre el comprobante imprimible. Pulsa \"Imprimir\" o Ctrl+P."),
  P("El comprobante incluye logo, fecha, datos del cliente, paquete, total, método de pago y leyenda de agradecimiento.", { italics: true }),

  H1("7. Cobrar con tarjeta"),
  NUM("En la página de venta, selecciona \"Tarjeta\"."),
  NUM("Se abre el formulario seguro de Stripe dentro de la app."),
  NUM("El cliente ingresa los datos de su tarjeta."),
  NUM("Pulsa \"Pagar $X,XXX\"."),
  NUM("Si la tarjeta es válida, verás \"Pago exitoso\" y se genera el comprobante."),
  P("Nunca anotes ni guardes datos de tarjeta fuera del formulario de Stripe. El sistema cumple con PCI-DSS Nivel 1.", { bold: true }),

  H1("8. Gestión de reservaciones"),
  H3("Filtros disponibles"),
  BULLET("Por fecha (hoy, mañana, rango personalizado)."),
  BULLET("Por estado (pendiente, confirmada, pagada, cancelada)."),
  BULLET("Por texto (nombre o teléfono)."),
  H3("Cambiar estado de una reserva"),
  NUM("Pulsa los 3 puntos al final de la fila."),
  NUM("Elige Confirmar, Cancelar o Ir a venta."),
  P("Solo los administradores pueden eliminar reservaciones definitivamente.", { bold: true }),

  H1("9. Generar reporte diario"),
  NUM("Ve a Reportes."),
  NUM("Selecciona la fecha (por defecto hoy)."),
  NUM("Verás la tabla con todas las reservaciones del día."),
  NUM("Pulsa \"Exportar a Excel\" o \"Exportar a PDF\"."),
  NUM("El archivo se descarga con el nombre reporte_YYYY-MM-DD.xlsx o .pdf."),
  P("El reporte incluye encabezado con totales, tabla detalle por hora y totales al pie.", { italics: true }),

  H1("10. Preguntas frecuentes"),
  H3("¿Puedo modificar una reserva ya pagada?"),
  P("Solo puedes cambiar las notas. El monto y la fecha quedan bloqueados para evitar fraudes. Si necesitas reembolsar, pide a un administrador."),
  H3("¿Qué pasa si un cliente quiere cambiar de paquete?"),
  P("Si aún no ha pagado: cancela la reservación original y crea una nueva. Si ya pagó: un administrador debe procesar el reembolso en Stripe y crear la nueva."),
  H3("¿Puedo ver las reservaciones de días pasados?"),
  P("Sí, desde Reservaciones con el filtro de fecha. El panel admin no tiene límite histórico."),
  H3("¿Cómo veo cuánto se vendió en efectivo vs. tarjeta?"),
  P("En el reporte diario (Excel o PDF), la columna \"Método de pago\" permite separar."),
  H3("¿Qué hago si la pantalla de pago con tarjeta no carga?"),
  P("Verifica tu conexión. Desactiva bloqueadores de anuncios (Stripe los bloquea). Si persiste, cobra en efectivo y reporta al equipo técnico."),
  H3("¿Puedo usar el sistema desde el celular?"),
  P("Sí, es responsive. Tanto el panel como la página pública se adaptan a pantallas pequeñas."),
];

const docUsuario = new Document({
  creator: "Caso Práctico C3", title: "Anexo A — Guía de Usuario",
  styles: baseStyles, numbering: baseNumbering,
  sections: [{
    ...baseSectionProps("Anexo A — Guía de Usuario — Barco Pirata"),
    children: [...portadaUsuario, ...contenidoUsuario],
  }],
});

// ─────────────────────────────────────────────────────────────
// ANEXO B — GUÍA TÉCNICA
// ─────────────────────────────────────────────────────────────

const portadaTecnica = [
  new Paragraph({ children: [new TextRun("")], spacing: { after: 3600 } }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Anexo B", bold: true, size: 32, color: "888888" })],
    spacing: { after: 200 } }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Guía técnica", bold: true, size: 48, color: "1e3a5f" })],
    spacing: { after: 200 } }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Barco Pirata de Puerto Peñasco", italics: true, size: 32, color: "2a6a5f" })],
    spacing: { after: 1600 } }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Dirigida a desarrolladores, DevOps y administradores del sistema", size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Prerequisitos: Node.js ≥18, Git, Supabase, Stripe", size: 22, italics: true, color: "666666" })],
    spacing: { after: 1200 } }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Abril 2026 — versión 1.0", size: 22, color: "666666" })] }),
  new Paragraph({ children: [new PageBreak()] }),
];

const contenidoTecnico = [
  H1("1. Arquitectura resumida"),
  P("Frontend (Vite + React 18 + TypeScript) → Supabase (PostgreSQL + Auth + Edge Functions) → Stripe API."),
  BULLET("Frontend: SPA desplegada en Vercel/Netlify. Consume Supabase vía @supabase/supabase-js."),
  BULLET("Backend: todo en Supabase — tablas RLS, funciones PL/pgSQL, Edge Functions Deno."),
  BULLET("Pagos: Stripe. La Edge Function es la única que conoce STRIPE_SECRET_KEY."),

  H1("2. Requerimientos de software"),
  TABLE(
    ["Herramienta", "Versión mínima", "Notas"],
    [
      ["Node.js", "18.x", "Recomendado 20 LTS"],
      ["npm", "10.x", "Viene con Node 20"],
      ["Git", "2.40", ""],
      ["Supabase CLI", "1.x", "npm i -g supabase (opcional)"],
      ["Stripe CLI", "1.x", "Opcional, útil para webhooks"],
      ["Navegador", "Chrome/Edge/Firefox", "Versiones actuales con ES2020+"],
    ],
    [2400, 2400, 4560]
  ),
  SPACE(),
  P("Cuentas necesarias: Supabase (supabase.com), Stripe (stripe.com), Vercel o Netlify (opcional)."),

  H1("3. Instalación local"),
  H3("3.1 Clonar"),
  P("git clone <repo-url> barco-pirata && cd barco-pirata && npm install"),
  H3("3.2 Variables de entorno"),
  P("cp .env.example .env.local y edita con tus llaves."),
  H3("3.3 Dev server"),
  P("npm run dev → abre http://localhost:3000"),
  H3("3.4 Verificaciones"),
  P("npm run type-check y npm run build deben pasar sin errores."),

  H1("4. Variables de entorno"),
  TABLE(
    ["Variable", "Obligatoria", "Valor"],
    [
      ["VITE_SUPABASE_URL", "Sí", "URL del proyecto Supabase"],
      ["VITE_SUPABASE_ANON_KEY", "Sí", "Anon key (pública) de Supabase"],
      ["VITE_STRIPE_PUBLISHABLE_KEY", "Recomendada", "pk_test_… (sin ella, el pago con tarjeta se desactiva)"],
      ["VITE_API_URL", "Sí", "<supabase-url>/functions/v1"],
      ["VITE_APP_ENV", "Sí", "development | production"],
      ["STRIPE_SECRET_KEY (backend)", "Sí para pagos", "sk_test_… en Supabase secrets"],
    ],
    [3200, 1800, 4360]
  ),

  H1("5. Estructura del proyecto"),
  BULLET("public/ — assets estáticos (logo, favicon)."),
  BULLET("src/app/ — providers, router, layouts."),
  BULLET("src/components/ — UI reutilizable (ui, layout, common)."),
  BULLET("src/features/ — vertical slices del dominio (reservations, payments, reports)."),
  BULLET("src/pages/ — páginas (public: Home/Reservar/..., admin: Login/Dashboard/...)."),
  BULLET("src/lib/ — clientes externos (supabase, stripe, axios)."),
  BULLET("src/utils/ — helpers puros (pricing, security, validators)."),
  BULLET("src/types/, src/constants/, src/styles/ — globales."),
  BULLET("supabase/migrations/, supabase/functions/, supabase/seed.sql."),
  BULLET("docs/ — documentación del proyecto."),

  H1("6. Scripts disponibles"),
  TABLE(
    ["Script", "Qué hace"],
    [
      ["npm run dev", "Levanta Vite en localhost:3000 con HMR"],
      ["npm run build", "Compila TypeScript + build de producción (dist/)"],
      ["npm run preview", "Sirve dist/ localmente para validación"],
      ["npm run type-check", "tsc --noEmit — verifica tipos sin emitir"],
      ["npm run lint", "Alias actual de type-check"],
    ],
    [2800, 6560]
  ),

  H1("7. Base de datos y migraciones"),
  H3("Archivos"),
  BULLET("00001_initial_schema.sql — tablas, enums, índices."),
  BULLET("00002_triggers_and_functions.sql — updated_at, auditoría, daily_report."),
  BULLET("00003_row_level_security.sql — políticas RLS iniciales."),
  BULLET("00004_security_hardening.sql — is_staff/is_admin, restricciones finas."),
  H3("Aplicar"),
  P("npx supabase link --project-ref <tu-ref> → npx supabase db push → psql \"$DATABASE_URL\" -f supabase/seed.sql"),
  H3("Bitácora"),
  P("Consultar audit_log requiere rol admin. Ejemplo: SELECT created_at, user_email, action FROM public.audit_log ORDER BY created_at DESC LIMIT 100;"),
  H3("Respaldos y restauración"),
  P("Supabase hace backup automático diario. Manual: pg_dump \"$DATABASE_URL\" --format=custom -f backup.dump. Restaurar: pg_restore --clean --if-exists --no-owner --dbname=\"$DATABASE_URL\" backup.dump"),

  H1("8. Edge Functions"),
  H3("create-payment-intent"),
  P("Ruta: supabase/functions/create-payment-intent/index.ts. Se invoca con supabase.functions.invoke('create-payment-intent', { body: { reservationId } })."),
  P("Lógica: valida reservación → verifica no pagada → crea PaymentIntent en Stripe con amount=reservation.total*100 → devuelve clientSecret."),
  P("Desplegar: npx supabase functions deploy create-payment-intent --no-verify-jwt"),
  P("Logs: npx supabase functions logs create-payment-intent --tail"),

  H1("9. Despliegue a producción"),
  H3("Frontend en Vercel"),
  NUM("Conecta el repo en Vercel."),
  NUM("Añade las environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_STRIPE_PUBLISHABLE_KEY con pk_live_, VITE_API_URL, VITE_APP_ENV=production)."),
  NUM("Deploy — Vercel detecta Vite automáticamente."),
  H3("Backend Supabase"),
  P("npx supabase db push → npx supabase functions deploy create-payment-intent → npx supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx"),
  H3("Checklist pre-producción"),
  BULLET("Cuenta Stripe activada (no test)."),
  BULLET("Llaves pk_live_ y sk_live_ configuradas."),
  BULLET("Dominio propio con SSL."),
  BULLET("Supabase en plan Pro (para PITR de 7 días)."),
  BULLET("Respaldos verificados (restaurar en staging)."),
  BULLET("Contraseñas de seed cambiadas."),
  BULLET("Políticas RLS revisadas una vez más."),

  H1("10. Solución de problemas"),
  TABLE(
    ["Síntoma", "Causa probable", "Solución"],
    [
      ["\"Configuración de pagos incompleta\"", "Falta STRIPE_SECRET_KEY en Supabase", "npx supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx"],
      ["\"Missing Supabase credentials\"", "Falta .env.local", "Copia .env.example → .env.local y completa"],
      ["Popup de Stripe no aparece", "Bloqueador de anuncios o CSP", "Whitelist js.stripe.com y api.stripe.com"],
      ["Login rechaza credenciales", "Usuario sin confirmar email", "UPDATE auth.users SET email_confirmed_at=now() WHERE email='x'"],
      ["\"new row violates RLS\"", "User no tiene perfil", "Inserta fila en user_profiles con ese auth.uid()"],
      ["Dashboard muestra 0 reservaciones", "is_staff() devuelve false", "Revisa que exista perfil del usuario en user_profiles"],
      ["\"No such payment_intent\"", "Mezclaste llaves test y live", "pk y sk deben ser del mismo modo"],
    ],
    [3000, 3000, 3360]
  ),
  SPACE(),
  H3("Probar Stripe con tarjetas de test"),
  TABLE(
    ["Escenario", "Número", "CVC", "Fecha"],
    [
      ["Éxito", "4242 4242 4242 4242", "cualquier", "futura"],
      ["Rechazada", "4000 0000 0000 0002", "cualquier", "futura"],
      ["3D Secure", "4000 0025 0000 3155", "cualquier", "futura"],
    ],
    [2000, 3400, 2000, 1960]
  ),

  H1("11. Convenciones de código"),
  H3("TypeScript"),
  BULLET("strict: true. No se permite any sin justificación."),
  BULLET("Path aliases: @app, @components, @features, @lib, @pages, @utils, @app-types."),
  H3("Naming"),
  BULLET("Componentes: PascalCase (ReservationForm.tsx)."),
  BULLET("Hooks: camelCase con use (useReservation.ts)."),
  BULLET("Servicios: camelCase (reservationService.ts)."),
  BULLET("Columnas BD: snake_case (contact_phone)."),
  BULLET("Props frontend: camelCase (reservationId)."),
  H3("Git"),
  BULLET("Una rama por feature: feat/<nombre>, fix/<nombre>, chore/<nombre>."),
  BULLET("Commits atómicos con conventional commits."),
  H3("Validación"),
  P("Toda entrada pública pasa por: Zod → DOMPurify → CHECK constraints en BD."),

  H1("12. Rotación de credenciales"),
  P("Cada 90 días como buena práctica:"),
  NUM("Rota STRIPE_SECRET_KEY desde Stripe Dashboard → Developers → API keys → Roll."),
  NUM("Actualiza el secret en Supabase."),
  NUM("Si SUPABASE_ANON_KEY es comprometida, resetéala desde Supabase Settings → API."),
  NUM("Actualiza .env.local del frontend y redeploy."),
];

const docTecnico = new Document({
  creator: "Caso Práctico C3", title: "Anexo B — Guía Técnica",
  styles: baseStyles, numbering: baseNumbering,
  sections: [{
    ...baseSectionProps("Anexo B — Guía Técnica — Barco Pirata"),
    children: [...portadaTecnica, ...contenidoTecnico],
  }],
});

// ─── Packing ──────────────────────────────────────────────────
Promise.all([
  Packer.toBuffer(docUsuario),
  Packer.toBuffer(docTecnico),
]).then(([bufUsuario, bufTecnico]) => {
  const outA = path.join(__dirname, 'ANEXO_A_Guia_Usuario.docx');
  const outB = path.join(__dirname, 'ANEXO_B_Guia_Tecnica.docx');
  fs.writeFileSync(outA, bufUsuario);
  fs.writeFileSync(outB, bufTecnico);
  console.log(`✔ Anexo A: ${outA} (${(bufUsuario.length / 1024).toFixed(1)} KB)`);
  console.log(`✔ Anexo B: ${outB} (${(bufTecnico.length / 1024).toFixed(1)} KB)`);
});
