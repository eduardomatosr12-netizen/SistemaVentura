export const cleanDataForFirestore = (data: Record<string, unknown>): Record<string, unknown> => {
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    if (value === null) {
      cleaned[key] = '';
      continue;
    }

    if (Array.isArray(value)) {
      cleaned[key] = value.filter(v => v !== undefined && v !== null);
      continue;
    }

    if (typeof value === 'object' && value !== null) {
      const nested = cleanDataForFirestore(value as Record<string, unknown>);
      if (Object.keys(nested).length > 0) {
        cleaned[key] = nested;
      }
      continue;
    }

    cleaned[key] = value;
  }

  return cleaned;
};

export const validateRequiredFields = (
  data: Record<string, unknown>,
  requiredFields: string[]
): string | null => {
  for (const field of requiredFields) {
    const value = data[field];
    if (value === undefined || value === null || value === '') {
      return `Campo obrigatório vazio: ${field}`;
    }
  }
  return null;
};

export const sanitizeEventData = (eventData: Record<string, unknown>): Record<string, unknown> => {
  const requiredFields = ['title', 'date', 'client'];
  const error = validateRequiredFields(eventData, requiredFields);
  if (error) throw new Error(error);

  return cleanDataForFirestore(eventData);
};