// Evalúa reglas configuradas por el negocio contra el texto recibido

/** Normaliza texto: minúsculas y sin tildes para comparaciones robustas */
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Verifica si una regla individual coincide con el texto */
function ruleMatches(text, rule) {
  const { type, value } = rule.trigger;
  const normalText = normalize(text);
  const normalValue = value ? normalize(value) : '';

  switch (type) {
    case 'keyword':
      return normalText.includes(normalValue);
    case 'startsWith':
      return normalText.startsWith(normalValue);
    case 'exact':
      return normalText === normalValue;
    case 'regex':
      return new RegExp(value, 'i').test(text);
    case 'always':
      return true;
    default:
      return false;
  }
}

/** Itera las reglas activas ordenadas por prioridad y retorna la primera que coincide */
export function matchRule(text, rules) {
  if (!rules?.length) return null;

  const activeRules = rules
    .filter((r) => r.active)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of activeRules) {
    try {
      if (ruleMatches(text, rule)) {
        return { matchedTrigger: rule.trigger, response: rule.response };
      }
    } catch (err) {
      // Regex inválido u otro error en la regla — se ignora y continúa
      console.error(`[rules] Error evaluando regla ${rule.id}:`, err.message);
    }
  }

  return null;
}
