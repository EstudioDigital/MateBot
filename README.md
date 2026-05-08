# Mate Bot

SaaS de automatización de WhatsApp para pymes argentinas.
El bot actúa como socio del negocio: atiende clientes, gestiona turnos,
registra finanzas y responde con IA cuando ninguna regla aplica.

---

## Requisitos previos

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **PostgreSQL** — [postgresql.org](https://www.postgresql.org/download/windows/) o usar Neon/Supabase gratuito
- **Cuenta Meta for Developers** con app de WhatsApp Business configurada

---

## Setup paso a paso en Windows

### 1. Clonar e instalar dependencias

Abrí una terminal PowerShell en la carpeta del proyecto y ejecutá:

```powershell
npm install
```

### 2. Configurar variables de entorno

Copiá el archivo de ejemplo y completá los valores:

```powershell
Copy-Item .env.example .env
```

Abrí `.env` con tu editor y completá:

| Variable | Descripción |
|---|---|
| `META_APP_SECRET` | App Secret de tu app en Meta for Developers |
| `WEBHOOK_VERIFY_TOKEN` | Token que configurás en el webhook de Meta (podés dejarlo como está) |
| `ANTHROPIC_API_KEY` | Clave de API de [console.anthropic.com](https://console.anthropic.com) |
| `DATABASE_URL` | URL de conexión a PostgreSQL (ver paso 3) |

### 3. Configurar PostgreSQL

**Opción A — PostgreSQL local:**

1. Instalá PostgreSQL desde [postgresql.org](https://www.postgresql.org/download/windows/)
2. Abrí pgAdmin o psql y creá una base de datos:
   ```sql
   CREATE DATABASE matebot_db;
   ```
3. Actualizá `DATABASE_URL` en `.env`:
   ```
   DATABASE_URL=postgresql://postgres:tu_password@localhost:5432/matebot_db
   ```

**Opción B — Neon (recomendado para empezar, gratis):**

1. Creá cuenta en [neon.tech](https://neon.tech)
2. Creá un proyecto y copiá la connection string
3. Pegala en `DATABASE_URL` en `.env`

### 4. Crear las tablas en la base de datos

```powershell
npm run db:generate
npm run db:push
```

Para explorar los datos visualmente:

```powershell
npm run db:studio
```

### 5. Exponer el servidor localmente para Meta (desarrollo)

Meta necesita una URL pública para el webhook. Usá ngrok:

1. Descargá ngrok desde [ngrok.com](https://ngrok.com/download)
2. En una terminal aparte, ejecutá:
   ```powershell
   ngrok http 3000
   ```
3. Copiá la URL `https://xxxx.ngrok.io` que aparece

### 6. Configurar el webhook en Meta for Developers

1. Ingresá a [developers.facebook.com](https://developers.facebook.com)
2. Entrá a tu app → WhatsApp → Configuración
3. En **Webhook URL** pegá: `https://xxxx.ngrok.io/webhook`
4. En **Verify Token** pegá el valor de `WEBHOOK_VERIFY_TOKEN` de tu `.env`
5. Hacé clic en **Verificar y guardar**
6. Suscribite a los campos: `messages`

### 7. Arrancar el servidor

**Modo desarrollo** (se reinicia automáticamente al guardar archivos):

```powershell
npm run dev
```

**Modo producción:**

```powershell
npm start
```

El servidor arranca en `http://localhost:3000`.

---

## Crear tu primer Account en la base de datos

Usá Prisma Studio (`npm run db:studio`) o psql para insertar un Account:

```sql
INSERT INTO "Account" (id, name, "phoneNumberId", "waToken", "ownerPhone", tone, plan)
VALUES (
  'cuid_generado',
  'Mi Negocio',
  '123456789012345',   -- tu phoneNumberId de Meta
  'EAAG...',           -- tu token permanente de Meta
  '5491112345678',     -- tu número con código de país, sin +
  'friendly',
  'starter'
);
```

Luego activá los módulos que necesitás:

```sql
INSERT INTO "Module" (id, "accountId", type, active)
VALUES
  ('mod1', 'cuid_generado', 'ai', true),
  ('mod2', 'cuid_generado', 'appointments', true),
  ('mod3', 'cuid_generado', 'catalog', true);
```

---

## Estructura del proyecto

```
src/
├── server.js              Fastify + webhook + procesador de mensajes
├── brain/
│   ├── index.js           Motor de decisión en cascada (3 niveles)
│   ├── rules.js           Evaluador de reglas configurables
│   └── ai.js              Respuestas con Claude Haiku
├── modules/
│   ├── appointments.js    Gestión de turnos
│   ├── finance.js         Registro de ingresos y gastos
│   └── catalog.js         Catálogo y pedidos
└── utils/
    └── whatsapp.js        Envío de mensajes via Meta Cloud API
```

---

## Lógica del motor de decisión

Cada mensaje entrante pasa por 3 niveles en cascada:

1. **Reglas** — Si el texto coincide con una Rule configurada (keyword, regex, exact, etc.), se responde inmediatamente.
2. **Módulos** — Si algún módulo activo detecta la intención (turnos / finanzas / catálogo), lo maneja.
3. **IA** — Si el módulo `ai` está activo, Claude Haiku genera una respuesta contextual.
4. **Fallback** — Mensaje genérico si nada aplica.

> El módulo `finance` solo responde si el mensaje proviene del `ownerPhone` del account.

---

## Health check

```
GET /health
```

Retorna `{"status":"ok","ts":"..."}` — usalo para monitorear el servicio.

---

## Variables de entorno completas

```env
META_APP_SECRET=           # Requerido en producción para verificar firmas
WEBHOOK_VERIFY_TOKEN=      # Token que configurás en el panel de Meta
ANTHROPIC_API_KEY=         # Requerido si el módulo ai está activo
DATABASE_URL=              # Requerido siempre
PORT=3000                  # Opcional, default 3000
NODE_ENV=development       # development | production
LOG_LEVEL=info             # trace | debug | info | warn | error
```

---

## Despliegue en producción (Railway / Render)

1. Subí el proyecto a GitHub
2. Creá un nuevo proyecto en [railway.app](https://railway.app) o [render.com](https://render.com)
3. Conectá el repositorio
4. Agregá las variables de entorno
5. Configurá el comando de inicio: `npm start`
6. Actualizá la Webhook URL en Meta con la URL de producción

---

## Licencia

MIT
