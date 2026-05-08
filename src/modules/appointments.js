// Gestiona turnos: consulta disponibilidad, reservas, cancelaciones y recordatorios

import { PrismaClient } from '@prisma/client';
import { sendWhatsAppMessage } from '../utils/whatsapp.js';

const prisma = new PrismaClient();

// Sesiones en memoria para flujos multi-turno de reserva
const bookingSessions = new Map();

/** Formatea una fecha para mostrar al usuario en zona AR */
function formatDatetime(dt) {
  return new Date(dt).toLocaleString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

/** Consulta slots disponibles para los próximos 7 días del account */
async function getAvailableSlots(accountId) {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return prisma.appointment.findMany({
    where: {
      accountId,
      datetime: { gte: now, lte: nextWeek },
      status: 'available',
    },
    orderBy: { datetime: 'asc' },
    take: 10,
  });
}

/** Busca el próximo turno confirmado del cliente */
async function getNextClientAppointment(accountId, clientId) {
  return prisma.appointment.findFirst({
    where: {
      accountId,
      clientId,
      datetime: { gte: new Date() },
      status: 'confirmed',
    },
    orderBy: { datetime: 'asc' },
  });
}

/** Programa un recordatorio por setTimeout 24hs antes del turno */
export function scheduleReminder(appointment, account) {
  const reminderTime = new Date(appointment.datetime).getTime() - 24 * 60 * 60 * 1000;
  const msUntilReminder = reminderTime - Date.now();

  if (msUntilReminder <= 0) return;

  setTimeout(async () => {
    try {
      const appt = await prisma.appointment.findUnique({ where: { id: appointment.id } });
      if (!appt || appt.status !== 'confirmed' || appt.reminderSent) return;

      const client_ = await prisma.client.findUnique({ where: { id: appt.clientId } });
      if (!client_) return;

      await sendWhatsAppMessage({
        to: client_.phone,
        phoneNumberId: account.phoneNumberId,
        token: account.waToken,
        message: {
          type: 'template',
          templateName: 'appointment_reminder',
          components: [
            { type: 'body', parameters: [{ type: 'text', text: formatDatetime(appt.datetime) }] },
          ],
        },
      });

      await prisma.appointment.update({ where: { id: appt.id }, data: { reminderSent: true } });
    } catch (err) {
      console.error('[appointments] Error enviando recordatorio:', err.message);
    }
  }, msUntilReminder);
}

/** Maneja intenciones de turno: book, cancel, consult */
export async function handleAppointment(intent, message, account, client_) {
  const accountId = account.id;
  const clientId = client_.id;

  if (intent === 'book') {
    const slots = await getAvailableSlots(accountId);

    if (!slots.length) {
      return { type: 'text', body: 'Por el momento no hay turnos disponibles en los próximos 7 días. Te avisamos cuando haya disponibilidad.' };
    }

    bookingSessions.set(client_.phone, { slots, accountId, clientId });

    return {
      type: 'interactive_list',
      body: 'Estos son los turnos disponibles. ¿Cuál te viene mejor?',
      buttonLabel: 'Ver turnos',
      sections: [
        {
          title: 'Turnos disponibles',
          rows: slots.map((s) => ({
            id: s.id,
            title: formatDatetime(s.datetime),
            description: s.service ?? '',
          })),
        },
      ],
    };
  }

  if (intent === 'cancel') {
    const appt = await getNextClientAppointment(accountId, clientId);

    if (!appt) {
      return { type: 'text', body: 'No encontré ningún turno próximo a cancelar. Si necesitás ayuda, escribinos.' };
    }

    await prisma.appointment.update({ where: { id: appt.id }, data: { status: 'cancelled' } });

    return { type: 'text', body: `Tu turno del ${formatDatetime(appt.datetime)} fue cancelado. Podés reservar otro cuando quieras.` };
  }

  if (intent === 'consult') {
    const appt = await getNextClientAppointment(accountId, clientId);

    if (!appt) {
      return { type: 'text', body: 'No tenés turnos próximos agendados. ¿Querés reservar uno?' };
    }

    return { type: 'text', body: `Tu próximo turno es el ${formatDatetime(appt.datetime)}${appt.service ? ` — ${appt.service}` : ''}. ¡Te esperamos!` };
  }

  return { type: 'text', body: 'Puedo ayudarte a reservar, cancelar o consultar tus turnos. ¿Qué necesitás?' };
}
