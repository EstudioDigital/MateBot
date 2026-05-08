Mate — El asistente de negocios por WhatsApp
Un solo bot. Infinitas industrias. Se configura en minutos, trabaja 24/7, habla como humano.


El negocio se registra en tu plataforma y elige su industria (salud, gastronomía, comercio, servicios, finanzas personales, etc).

2. La plataforma activa automáticamente los módulos relevantes para ese rubro: turnos, pedidos, cobranzas, recordatorios, reportes.

3. El negocio conecta su número de WhatsApp Business, personaliza el nombre y tono del bot, y en 15 minutos está operativo.

4. El bot aprende del negocio: sus productos, sus preguntas frecuentes, sus horarios, su forma de hablar. Con IA detrás.

5. El dueño tiene un panel web donde ve todo: conversaciones, métricas, ventas, gastos, turnos, contactos. Un solo lugar.

Diferencial clave vs competidores

Modular por industria
No es genérico. Una verdulería activa módulo de pedidos. Una clínica activa módulo de turnos. Cada negocio ve solo lo que necesita.

IA que aprende el negocio
Cargás el catálogo, las FAQ, los precios. La IA responde como si fuera un empleado que conoce el negocio de memoria.

Finanzas integradas
El bot registra cada venta, cada gasto. El dueño pregunta "¿cuánto vendí hoy?" por WhatsApp y el bot responde con el número exacto.

Tono personalizable
El bot puede ser formal, amigable, juvenil o profesional. El dueño lo configura en un slider. No todos los negocios hablan igual.


Stack elegido y por qué


Backend — Node.js + Fastify
Elegido sobre Python porque los webhooks de Meta son I/O puro — recibir, procesar, responder. Node maneja miles de conexiones concurrentes sin sudar. Fastify es 2x más rápido que Express.
Node.js 20
Fastify
BullMQ
Prisma ORM
Socket.io
Zod

Frontend — React + Vite
Panel web donde cada negocio configura su bot. React + Vite para desarrollo rápido. TanStack Query para el estado del servidor. Tailwind + shadcn para la UI sin perder tiempo en CSS.
React 18
Vite
TanStack Query
Zustand
Tailwind
shadcn/ui

Datos — PostgreSQL + Redis
PostgreSQL para todo lo persistente: cuentas, clientes, turnos, transacciones, configuración. Redis para colas de mensajes (BullMQ), sesiones de conversación activa y caché de respuestas frecuentes.
PostgreSQL 16
Redis 7
Prisma
pgvector

IA — Claude API + Whisper
Claude Haiku para respuestas conversacionales (barato y rápido, $0.00025/1k tokens). Whisper de OpenAI para transcribir audios. pgvector para búsqueda semántica en el catálogo del negocio.
Claude Haiku
Whisper API
pgvector
LangChain

Deploy — Railway + Vercel
Railway para backend + PostgreSQL + Redis. Vercel para el frontend React. GitHub Actions para CI/CD. HTTPS automático en ambos — crítico porque Meta exige HTTPS para el webhook desde el día 1.
Railway
Vercel
GitHub Actions
Docker

Pagos — MercadoPago + Stripe
MercadoPago para clientes argentinos (suscripción mensual en ARS o USD). Stripe para clientes internacionales. Ambos tienen webhooks para confirmar pagos automáticamente.
MercadoPago
Stripe
Webhooks

Arquitectura

Capa 1 — Entrada de mensajes (Meta Cloud API) Día 1

Meta envía cada mensaje como POST a tu webhook. Fastify recibe, valida firma HMAC-SHA256, responde 200 OK inmediatamente y encola en BullMQ. Jamás proceses en el mismo request — Meta reintenta si tardás más de 5 segundos.
// Webhook handler — responde rápido, procesa después

fastify.post('/webhook', async (req, reply) => {
  verifyMetaSignature(req) // lanza 403 si inválido
  reply.send({ status: 'ok' }) // respuesta inmediata
  await messageQueue.add('inbound', req.body) // asíncrono
})


Capa 2 — Motor de decisión (Brain) Semana 1
El worker de BullMQ procesa cada mensaje. Identifica la cuenta por phone_number_id, carga su configuración y decide qué módulo maneja el mensaje. Tres niveles en cascada: reglas exactas → búsqueda semántica → IA.

async function brain(message, account) {
  // Nivel 1: regla exacta (keyword match)
  const rule = await matchRule(message.text, account.id)
  if (rule) return executeRule(rule, message)

  // Nivel 2: búsqueda semántica (pgvector)
  const similar = await semanticSearch(message.text, account.id)
  if (similar.score > 0.85) return similar.response

  // Nivel 3: IA (Claude Haiku)
  return await aiResponse(message, account)
}


Capa 3 — Módulos de negocio Semanas 2-6
Cada módulo es un handler independiente: turnos, pedidos, finanzas, fidelización. El brain le pasa el mensaje al módulo correcto con el contexto del cliente. Los módulos se activan/desactivan por cuenta desde el panel.
// Módulo de turnos

async function turnosModule(message, account, cliente) {
  const intent = detectIntent(message) // 'agendar'|'cancelar'|'consultar'
  const slots = await getAvailableSlots(account.id)
  return buildTurnoFlow(intent, slots, cliente)
}


Capa 4 — Salida (envío + panel en tiempo real) Semana 1
La respuesta generada se envía por la Cloud API de Meta. Simultáneamente se guarda en la DB y se emite por Socket.io al panel del negocio. El dueño ve la conversación en tiempo real y puede intervenir manualmente.

Capa 5 — Multi-tenant Semana 3
Un webhook único para todos los clientes. El enrutamiento se hace por phone_number_id — cada negocio tiene el suyo. La configuración (módulos activos, reglas, catálogo, tono) está completamente aislada por account_id.
// Enrutamiento multi-tenant

const phoneId = payload.entry[0].changes[0]
  .value.metadata.phone_number_id
const account = await db.account.findUnique({
  where: { phoneNumberId: phoneId },
  include: { modules: true, rules: true }
})


8 semanas · 2-4 horas diarias · primer cliente real

Semana 1 — Base sólida
Proyecto Node + webhook Meta funcionando
Fastify levantado, deploy en Railway con HTTPS, webhook verificado, primer mensaje recibido y logueado. PostgreSQL + Redis corriendo. Prisma con schema inicial. 2-4hs/día = alcanzable.
Semana 2 — Motor de reglas
Brain + módulo core de respuestas
Sistema de reglas keyword en DB. Multi-tenant por phoneNumberId. El bot responde mensajes reales de una cuenta de prueba con reglas básicas.
Semana 3 — Módulo de turnos
Agendar, confirmar, recordar
Flujo completo de turnos por WhatsApp. Recordatorio automático con cron job. Guardado en DB. Este módulo solo ya justifica la venta del producto.
Semana 4 — Módulo de finanzas
Registro de ventas y gastos por chat
Parser de mensajes financieros. El dueño dice "vendí $3500" y el bot registra. Puede preguntar "¿cuánto vendí esta semana?" y recibe el número. Esta es la funcionalidad que los sorprende.
Semana 5 — Panel React
Interfaz web para configurar el bot
Login, dashboard con conversaciones en tiempo real (Socket.io), editor de reglas, calendario de turnos, reporte financiero básico. Sin esto el cliente no puede gestionar nada sin código.
Semana 6 — Beta real
3 clientes de Estudio Digital conectados
Conectás 3 negocios reales con sus números. Recopilás feedback. No agregás features — solo corregís lo que falla. Esta semana vale más que cualquier otra.
Semana 7 — IA + catálogo
Claude Haiku integrado + módulo de pedidos
La IA entra cuando ninguna regla aplica. Catálogo de productos con pedidos por chat. Estas dos funcionalidades abren el producto a gastronómicos y comercios.
Semana 8 — Monetización
MercadoPago + landing + primer cliente pago
Suscripción mensual integrada. Onboarding self-service: el cliente conecta su número sin ayuda tuya. Landing page con demo en video. Objetivo: $200 MRR antes del día 60.




