// Genera respuestas usando Claude Haiku cuando ninguna regla ni módulo aplica

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 300;

const FALLBACK = 'Recibimos tu mensaje, te respondemos a la brevedad.';

/** Construye el system prompt con la personalidad y contexto del negocio */
function buildSystemPrompt(account, client_) {
  const toneMap = {
    formal: 'Usá un tono profesional y respetuoso.',
    friendly: 'Usá un tono amigable y cercano.',
    casual: 'Usá un tono informal y distendido.',
    technical: 'Usá un tono técnico y preciso.',
  };

  const tone = toneMap[account.tone] ?? toneMap.friendly;

  let prompt = `Sos el asistente virtual de "${account.name}".
${tone}
Hablá siempre en español rioplatense: vos, tenés, podés, querés.
Respondé en máximo 3 oraciones. No uses markdown, listas ni emojis.
`;

  if (account.businessInfo) {
    prompt += `\nInformación del negocio: ${account.businessInfo}`;
  }

  if (account.faq) {
    prompt += `\nPreguntas frecuentes: ${account.faq}`;
  }

  if (account.catalog) {
    prompt += `\nCatálogo disponible: ${account.catalog}`;
  }

  if (client_?.name) {
    prompt += `\nEstás hablando con ${client_.name}.`;
  }

  return prompt;
}

/** Convierte el historial de mensajes al formato messages de Anthropic */
function buildMessages(currentMessage, history) {
  const messages = [];

  for (const msg of history) {
    if (!msg.body) continue;
    messages.push({
      role: msg.direction === 'in' ? 'user' : 'assistant',
      content: msg.body,
    });
  }

  messages.push({ role: 'user', content: currentMessage.body ?? '' });

  return messages;
}

/** Llama a Claude Haiku y retorna la respuesta en texto plano */
export async function aiResponse(message, account, client_, history = []) {
  try {
    const systemPrompt = buildSystemPrompt(account, client_);
    const messages = buildMessages(message, history);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
    });

    const text = response.content?.[0]?.text?.trim();
    return text || FALLBACK;
  } catch (err) {
    console.error('[ai] Error llamando a Claude:', err.message);
    return FALLBACK;
  }
}
