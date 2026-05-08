// Muestra el catálogo, responde precios y registra pedidos de clientes

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Normaliza texto para comparación sin tildes ni mayúsculas */
function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Busca un producto por nombre aproximado en el texto del cliente */
function findProductInText(text, products) {
  const normalText = normalize(text);
  return products.find((p) => normalText.includes(normalize(p.name)));
}

/** Parsea qué productos y cantidades quiere pedir el cliente */
function parseOrder(text, products) {
  const items = [];
  for (const product of products) {
    const normalName = normalize(product.name);
    const normalText = normalize(text);
    if (!normalText.includes(normalName)) continue;

    const quantityMatch = normalText.match(new RegExp(`(\\d+)\\s+${normalName}|${normalName}\\s+(\\d+)`));
    const quantity = quantityMatch ? parseInt(quantityMatch[1] ?? quantityMatch[2], 10) : 1;
    items.push({ product, quantity, subtotal: product.price * quantity });
  }
  return items;
}

/** Lista todos los productos activos del account como interactive_list */
async function browseProducts(accountId) {
  const products = await prisma.product.findMany({
    where: { accountId, available: true },
    orderBy: { order: 'asc' },
  });

  if (!products.length) {
    return { type: 'text', body: 'Por el momento no hay productos disponibles en el catálogo.' };
  }

  return {
    type: 'interactive_list',
    body: 'Estos son nuestros productos disponibles:',
    buttonLabel: 'Ver catálogo',
    sections: [
      {
        title: 'Catálogo',
        rows: products.map((p) => ({
          id: p.id,
          title: p.name,
          description: `$${p.price.toLocaleString('es-AR')}${p.unit ? ` / ${p.unit}` : ''}${p.description ? ` — ${p.description}` : ''}`,
        })),
      },
    ],
  };
}

/** Responde con el precio de un producto encontrado en el texto */
async function priceQuery(text, accountId) {
  const products = await prisma.product.findMany({ where: { accountId, available: true } });
  const product = findProductInText(text, products);

  if (!product) {
    return { type: 'text', body: 'No encontré ese producto en el catálogo. Escribí "catálogo" para ver todos los disponibles.' };
  }

  const price = product.price.toLocaleString('es-AR', { minimumFractionDigits: 2 });
  return { type: 'text', body: `${product.name}: $${price}${product.unit ? ` por ${product.unit}` : ''}. ${product.description ?? ''}`.trim() };
}

/** Registra un pedido y confirma al cliente con el total */
async function placeOrder(text, accountId, clientId) {
  const products = await prisma.product.findMany({ where: { accountId, available: true } });
  const items = parseOrder(text, products);

  if (!items.length) {
    return { type: 'text', body: 'No pude identificar qué querés pedir. ¿Podés decirme el nombre del producto?' };
  }

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  const detail = items.map((i) => `${i.quantity}x ${i.product.name} ($${i.subtotal.toLocaleString('es-AR')})`).join(', ');

  // Registra el pedido como Message para trazabilidad hasta implementar tabla Order
  await prisma.message.create({
    data: {
      accountId,
      clientId,
      direction: 'in',
      type: 'order',
      body: `PEDIDO: ${detail} | Total: $${total.toLocaleString('es-AR')}`,
      autoSent: false,
    },
  });

  return {
    type: 'text',
    body: `Pedido registrado: ${detail}. Total: $${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}. Nos contactamos para coordinar la entrega.`,
  };
}

/** Maneja intenciones del catálogo: browse, price, order */
export async function handleCatalog(intent, message, account, client_) {
  const accountId = account.id;
  const clientId = client_.id;
  const text = message.body ?? '';

  if (intent === 'browse') return browseProducts(accountId);
  if (intent === 'price') return priceQuery(text, accountId);
  if (intent === 'order') return placeOrder(text, accountId, clientId);

  return { type: 'text', body: 'Puedo mostrarte el catálogo, consultar precios o registrar un pedido. ¿Qué necesitás?' };
}
