// Registra ingresos y gastos, y responde consultas financieras al dueño del negocio

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Detecta si el texto hace referencia a hoy, esta semana o este mes */
export function detectPeriod(text) {
  const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (t.includes('hoy') || t.includes('dia') || t.includes('día')) return 'hoy';
  if (t.includes('semana')) return 'semana';
  if (t.includes('mes')) return 'mes';
  return 'hoy';
}

/** Calcula el inicio del período solicitado */
function periodStart(period) {
  const now = new Date();
  if (period === 'hoy') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === 'semana') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.getFullYear(), now.getMonth(), diff);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Agrupa transacciones por tipo y suma montos para el período dado */
export async function getFinanceSummary(accountId, period = 'hoy') {
  const since = periodStart(period);

  const transactions = await prisma.transaction.findMany({
    where: { accountId, createdAt: { gte: since } },
  });

  const income = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const expense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  return { income, expense, net: income - expense, count: transactions.length };
}

/** Parsea el monto de un texto como "vendí 3500" o "gasté 800 en algo" */
function parseAmount(text) {
  const match = text.match(/[\d.,]+/);
  if (!match) return null;
  return parseFloat(match[0].replace(',', '.'));
}

/** Parsea la categoría de un texto que contiene "en <categoría>" */
function parseCategory(text) {
  const match = text.toLowerCase().match(/\ben\s+(.+)$/);
  return match ? match[1].trim() : 'general';
}

/** Registra una transacción y retorna mensaje de confirmación con total del día */
async function recordTransaction(accountId, type, amount, category, note) {
  await prisma.transaction.create({ data: { accountId, type, amount, category, note } });

  const summary = await getFinanceSummary(accountId, 'hoy');
  const typeLabel = type === 'income' ? 'ingreso' : 'gasto';
  const formatted = amount.toLocaleString('es-AR', { minimumFractionDigits: 2 });
  const netFormatted = summary.net.toLocaleString('es-AR', { minimumFractionDigits: 2 });

  return `Registré un ${typeLabel} de $${formatted}${category !== 'general' ? ` en ${category}` : ''}. Balance de hoy: $${netFormatted}.`;
}

/** Maneja intenciones financieras: income, expense, query */
export async function handleFinance(intentData, account) {
  const { type: intentType, amount, rawText } = intentData;
  const accountId = account.id;

  if (intentType === 'income') {
    const parsedAmount = amount ?? parseAmount(rawText);
    if (!parsedAmount) {
      return { type: 'text', body: 'No pude leer el monto. Escribí algo como "vendí 3500" o "ingresé 2000".' };
    }
    const msg = await recordTransaction(accountId, 'income', parsedAmount, 'general', rawText);
    return { type: 'text', body: msg };
  }

  if (intentType === 'expense') {
    const parsedAmount = amount ?? parseAmount(rawText);
    if (!parsedAmount) {
      return { type: 'text', body: 'No pude leer el monto. Escribí algo como "gasté 800 en mercadería".' };
    }
    const category = parseCategory(rawText);
    const msg = await recordTransaction(accountId, 'expense', parsedAmount, category, rawText);
    return { type: 'text', body: msg };
  }

  if (intentType === 'query') {
    const period = detectPeriod(rawText);
    const summary = await getFinanceSummary(accountId, period);
    const periodLabel = { hoy: 'hoy', semana: 'esta semana', mes: 'este mes' }[period];

    if (summary.count === 0) {
      return { type: 'text', body: `No hay transacciones registradas ${periodLabel}.` };
    }

    const income = summary.income.toLocaleString('es-AR', { minimumFractionDigits: 2 });
    const expense = summary.expense.toLocaleString('es-AR', { minimumFractionDigits: 2 });
    const net = summary.net.toLocaleString('es-AR', { minimumFractionDigits: 2 });

    return {
      type: 'text',
      body: `Resumen ${periodLabel}: ingresos $${income}, gastos $${expense}, balance $${net}.`,
    };
  }

  return { type: 'text', body: 'Puedo registrar ingresos, gastos y mostrarte resúmenes. ¿Qué necesitás?' };
}
