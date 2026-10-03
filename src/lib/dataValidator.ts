export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

export type ValidationResultAny = ValidationResult<unknown>;

const log = (prefix: string, data: unknown) => {
  console.log(`[Validator] ${prefix}:`, data);
};

const debugDate = (field: string, value: unknown, normalized: string | null) => {
  const type = Array.isArray(value) ? 'array' : value === null ? 'null' : value === undefined ? 'undefined' : value.constructor?.name || typeof value;
  let rawDisplay: string;
  if (value instanceof Date) {
    rawDisplay = value.toISOString();
  } else if (typeof value === 'number') {
    rawDisplay = `timestamp: ${value} (${new Date(value).toISOString()})`;
  } else if (Array.isArray(value)) {
    rawDisplay = `array: [${value.map(v => String(v)).join(', ')}]`;
  } else {
    rawDisplay = String(value);
  }
  console.log(`[Validator] DATE DEBUG ${field}:`, {
    type,
    raw: rawDisplay,
    normalized,
    isValid: normalized !== null
  });
};

export const validateString = (value: unknown, field: string, required = true, allowEmpty = false): string | null => {
  if (value === undefined || value === null) {
    return required ? `${field}: obrigatório` : null;
  }
  if (typeof value !== 'string') {
    return `${field}: deve ser string`;
  }
  if (!allowEmpty && value.trim() === '') {
    return required ? `${field}: não pode ser vazio` : null;
  }
  return value.trim();
};

export const validateNumber = (value: unknown, field: string, required = true, min?: number): number | null => {
  if (value === undefined || value === null) {
    return required ? `${field}: obrigatório` : null;
  }
  if (typeof value !== 'number' || isNaN(value)) {
    return `${field}: deve ser número`;
  }
  if (min !== undefined && value < min) {
    return `${field}: deve ser >= ${min}`;
  }
  return value;
};

export const validateBoolean = (value: unknown): boolean => {
  if (value === undefined || value === null) return false;
  return Boolean(value);
};

export const validateArray = <T>(value: unknown, field: string, itemValidator?: (item: unknown) => T): T[] | null => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return `${field}: deve ser array`;
  if (itemValidator) {
    const result: T[] = [];
    for (const item of value) {
      const validated = itemValidator(item);
      if (typeof validated === 'string') return validated;
      result.push(validated);
    }
    return result;
  }
  return value as T[];
};

const aggressiveNormalizeDate = (value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return aggressiveNormalizeDate(value[0]);
  }

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString().split('T')[0];
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (trimmed.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const date = new Date(trimmed + 'T00:00:00');
      if (isNaN(date.getTime())) return null;
      return trimmed;
    }

    if (trimmed.match(/^\d{4}-\d{2}-\d{2}T/)) {
      const date = new Date(trimmed);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0];
    }

    if (trimmed.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [day, month, year] = trimmed.split('/');
      const date = new Date(`${year}-${month}-${day}T00:00:00`);
      if (isNaN(date.getTime())) return null;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    try {
      const date = value.toDate();
      if (date instanceof Date && !isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      return null;
    }
  }

  return null;
};

export const normalizeDate = (value: unknown, field: string): string | null => {
  const normalized = aggressiveNormalizeDate(value);
  debugDate(field, value, normalized);
  return normalized;
};

export interface InventoryItemInput {
  id?: string;
  name: string;
  quantity: number;
  category?: string;
  unit?: string;
  valorReferencia?: number;
  observacao?: string;
}

export const validateAndCleanInventory = (data: unknown): ValidationResult<InventoryItemInput> => {
  log('Validando inventory item', data);
  const errors: string[] = [];
  const cleaned: Partial<InventoryItemInput> = {};

  const name = validateString(data?.name, 'name', true, false);
  if (typeof name === 'string' && !name.startsWith('name:')) cleaned.name = name;
  else if (name) errors.push(name);

  const quantity = validateNumber(data?.quantity, 'quantity', true, 0);
  if (typeof quantity === 'number') cleaned.quantity = quantity;
  else if (quantity) errors.push(quantity);

  const category = validateString(data?.category, 'category', false, true);
  if (category && !category.startsWith('category:')) cleaned.category = category;
  else if (category) errors.push(category);

  const unit = validateString(data?.unit, 'unit', false, true);
  if (unit && !unit.startsWith('unit:')) cleaned.unit = unit;
  else if (unit) errors.push(unit);

  const valorReferencia = validateNumber(data?.valorReferencia, 'valorReferencia', false, 0);
  if (typeof valorReferencia === 'number') cleaned.valorReferencia = valorReferencia;
  else if (valorReferencia) errors.push(valorReferencia);

  const observacao = validateString(data?.observacao, 'observacao', false, true);
  if (observacao && !observacao.startsWith('observacao:')) cleaned.observacao = observacao;
  else if (observacao) errors.push(observacao);

  if (data?.id) {
    const id = validateString(data.id, 'id', false, false);
    if (id && !id.startsWith('id:')) cleaned.id = id;
    else if (id) errors.push(id);
  }

  cleaned.updatedAt = new Date().toISOString();
  if (!data?.id) cleaned.createdAt = new Date().toISOString();

  if (errors.length > 0) {
    log('Validação falhou', errors);
    return { success: false, errors };
  }

  log('Dados validados e limpos', cleaned);
  return { success: true, data: cleaned as InventoryItemInput };
};

export interface EventInput {
  id?: string;
  title: string;
  date: string;
  client: string;
  clientId?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientCpf?: string;
  clientAddress?: string;
  clientGender?: 'F' | 'M' | '';
  eventType?: string;
  dateEnd?: string;
  time?: string;
  local?: string;
  decorator?: string;
  city?: string;
  description?: string;
  equipe?: string;
  contractServices?: string[];
  status?: 'orcamento' | 'orcamento_cancelado' | 'evento_confirmado' | 'evento_concluido';
  valorTotal?: number;
  desconto?: number;
  items?: Array<{ id: string; item: string; qtdAtual: number; valorUnit: number; semPreco?: boolean; eventStockId?: string }>;
}

export const validateAndCleanEvent = (data: unknown): ValidationResult<EventInput> => {
  log('Validando event (dados brutos)', data);
  
  const normalizedData = { ...data as Record<string, unknown> };
  if ('date' in normalizedData) normalizedData.date = normalizeDate(normalizedData.date, 'date') || normalizedData.date;
  if ('dateEnd' in normalizedData) normalizedData.dateEnd = normalizeDate(normalizedData.dateEnd, 'dateEnd') || normalizedData.dateEnd;
  
  log('Validando event (dados normalizados)', normalizedData);

  const errors: string[] = [];
  const cleaned: Partial<EventInput> = {};

  const title = validateString(normalizedData?.title, 'title', true, false);
  if (typeof title === 'string' && !title.startsWith('title:')) cleaned.title = title;
  else if (title) errors.push(title);

  const date = validateString(normalizedData?.date, 'date', true, false);
  if (typeof date === 'string' && !date.startsWith('date:')) cleaned.date = date;
  else if (date) errors.push(date);

  const client = validateString(normalizedData?.client, 'client', true, false);
  if (typeof client === 'string' && !client.startsWith('client:')) cleaned.client = client;
  else if (client) errors.push(client);

  const clientId = validateString(normalizedData?.clientId, 'clientId', false, true);
  if (clientId && !clientId.startsWith('clientId:')) cleaned.clientId = clientId;
  else if (clientId) errors.push(clientId);

  const clientPhone = validateString(normalizedData?.clientPhone, 'clientPhone', false, true);
  if (clientPhone && !clientPhone.startsWith('clientPhone:')) cleaned.clientPhone = clientPhone;
  else if (clientPhone) errors.push(clientPhone);

  const clientEmail = validateString(normalizedData?.clientEmail, 'clientEmail', false, true);
  if (clientEmail && !clientEmail.startsWith('clientEmail:')) cleaned.clientEmail = clientEmail;
  else if (clientEmail) errors.push(clientEmail);

  const clientCpf = validateString(normalizedData?.clientCpf, 'clientCpf', false, true);
  if (clientCpf && !clientCpf.startsWith('clientCpf:')) cleaned.clientCpf = clientCpf;
  else if (clientCpf) errors.push(clientCpf);

  const clientAddress = validateString(normalizedData?.clientAddress, 'clientAddress', false, true);
  if (clientAddress && !clientAddress.startsWith('clientAddress:')) cleaned.clientAddress = clientAddress;
  else if (clientAddress) errors.push(clientAddress);

  const clientGender = validateString(normalizedData?.clientGender, 'clientGender', false, true);
  if (clientGender && !clientGender.startsWith('clientGender:') && ['F', 'M', ''].includes(clientGender)) {
    cleaned.clientGender = clientGender as 'F' | 'M' | '';
  } else if (clientGender) {
    errors.push('clientGender: deve ser "F", "M" ou ""');
  } else {
    cleaned.clientGender = '';
  }

  const eventType = validateString(normalizedData?.eventType, 'eventType', false, true);
  if (eventType && !eventType.startsWith('eventType:')) cleaned.eventType = eventType;
  else if (eventType) errors.push(eventType);

  const dateEnd = validateString(normalizedData?.dateEnd, 'dateEnd', false, true);
  if (dateEnd && !dateEnd.startsWith('dateEnd:')) cleaned.dateEnd = dateEnd;
  else if (dateEnd) errors.push(dateEnd);

  const time = validateString(normalizedData?.time, 'time', false, true);
  if (time && !time.startsWith('time:')) cleaned.time = time;
  else if (time) errors.push(time);

  const local = validateString(normalizedData?.local, 'local', false, true);
  if (local && !local.startsWith('local:')) cleaned.local = local;
  else if (local) errors.push(local);

  const decorator = validateString(normalizedData?.decorator, 'decorator', false, true);
  if (decorator && !decorator.startsWith('decorator:')) cleaned.decorator = decorator;
  else if (decorator) errors.push(decorator);

  const city = validateString(normalizedData?.city, 'city', false, true);
  if (city && !city.startsWith('city:')) cleaned.city = city;
  else if (city) errors.push(city);

  const description = validateString(normalizedData?.description, 'description', false, true);
  if (description && !description.startsWith('description:')) cleaned.description = description;
  else if (description) errors.push(description);

  const equipe = validateString(normalizedData?.equipe, 'equipe', false, true);
  if (equipe && !equipe.startsWith('equipe:')) cleaned.equipe = equipe;
  else if (equipe) errors.push(equipe);

  const contractServices = validateArray<string>(normalizedData?.contractServices, 'contractServices');
  if (Array.isArray(contractServices)) cleaned.contractServices = contractServices;
  else if (contractServices) errors.push(contractServices);

  const status = validateString(normalizedData?.status, 'status', false, true);
  if (status && !status.startsWith('status:') && ['orcamento', 'orcamento_cancelado', 'evento_confirmado', 'evento_concluido'].includes(status)) {
    cleaned.status = status as EventInput['status'];
  } else if (status) {
    errors.push('status: deve ser orcamento, orcamento_cancelado, evento_confirmado ou evento_concluido');
  } else {
    cleaned.status = 'orcamento';
  }

  const valorTotal = validateNumber(normalizedData?.valorTotal, 'valorTotal', false, 0);
  if (typeof valorTotal === 'number') cleaned.valorTotal = valorTotal;
  else if (valorTotal) errors.push(valorTotal);

  const desconto = validateNumber(normalizedData?.desconto, 'desconto', false, 0);
  if (typeof desconto === 'number') cleaned.desconto = desconto;
  else if (desconto) errors.push(desconto);

  if (normalizedData?.items) {
    const itemsResult = validateArray(normalizedData.items, 'items', (item) => {
      const itemErrors: string[] = [];
      const itemCleaned: Record<string, unknown> = {};
      const itemId = validateString(item?.id, 'item.id', true, false);
      if (typeof itemId === 'string' && !itemId.startsWith('item.id:')) itemCleaned.id = itemId;
      else if (itemId) itemErrors.push(itemId);

      const itemName = validateString(item?.item, 'item.item', true, false);
      if (typeof itemName === 'string' && !itemName.startsWith('item.item:')) itemCleaned.item = itemName;
      else if (itemName) itemErrors.push(itemName);

      const qtdAtual = validateNumber(item?.qtdAtual, 'item.qtdAtual', true, 0);
      if (typeof qtdAtual === 'number') itemCleaned.qtdAtual = qtdAtual;
      else if (qtdAtual) itemErrors.push(qtdAtual);

      const valorUnit = validateNumber(item?.valorUnit, 'item.valorUnit', true, 0);
      if (typeof valorUnit === 'number') itemCleaned.valorUnit = valorUnit;
      else if (valorUnit) itemErrors.push(valorUnit);

      itemCleaned.semPreco = validateBoolean(item?.semPreco);

      const eventStockId = validateString(item?.eventStockId, 'item.eventStockId', false, true);
      if (eventStockId && !eventStockId.startsWith('item.eventStockId:')) itemCleaned.eventStockId = eventStockId;
      else if (eventStockId) itemErrors.push(eventStockId);

      if (itemErrors.length > 0) return `item ${item?.id}: ${itemErrors.join(', ')}`;
      return itemCleaned;
    });
    if (Array.isArray(itemsResult)) cleaned.items = itemsResult;
    else if (itemsResult) errors.push(itemsResult);
  }

  cleaned.updatedAt = new Date().toISOString();
  if (!data?.id) cleaned.createdAt = new Date().toISOString();

  if (errors.length > 0) {
    log('Validação falhou', errors);
    return { success: false, errors };
  }

  log('Dados validados e limpos', cleaned);
  return { success: true, data: cleaned as EventInput };
};

export interface LeadInput {
  id?: string;
  name: string;
  niche: string;
  whatsapp: string;
  email: string;
  instagram?: string;
  stage: string;
  origin?: string;
  firstContact?: string;
  closingDate?: string;
  followUpReminder?: string;
  address?: string;
  notes?: string;
  value?: string;
  items?: Array<{ id: string; item: string; qtdAtual: number; valorUnit: number; semPreco?: boolean; eventStockId?: string }>;
  lastModifiedBy?: string;
  cpf?: string;
  rg?: string;
  clientAddress?: string;
  clientGender?: 'F' | 'M' | '';
}

export const validateAndCleanLead = (data: unknown): ValidationResult<LeadInput> => {
  log('Validando lead (dados brutos)', data);
  
  const normalizedData = { ...data as Record<string, unknown> };
  if ('firstContact' in normalizedData) normalizedData.firstContact = normalizeDate(normalizedData.firstContact, 'firstContact') || normalizedData.firstContact;
  if ('closingDate' in normalizedData) normalizedData.closingDate = normalizeDate(normalizedData.closingDate, 'closingDate') || normalizedData.closingDate;
  if ('followUpReminder' in normalizedData) normalizedData.followUpReminder = normalizeDate(normalizedData.followUpReminder, 'followUpReminder') || normalizedData.followUpReminder;
  
  log('Validando lead (dados normalizados)', normalizedData);

  const errors: string[] = [];
  const cleaned: Partial<LeadInput> = {};

  const name = validateString(normalizedData?.name, 'name', true, false);
  if (typeof name === 'string' && !name.startsWith('name:')) cleaned.name = name;
  else if (name) errors.push(name);

  const niche = validateString(normalizedData?.niche, 'niche', true, false);
  if (typeof niche === 'string' && !niche.startsWith('niche:')) cleaned.niche = niche;
  else if (niche) errors.push(niche);

  const whatsapp = validateString(normalizedData?.whatsapp, 'whatsapp', false, true);
  if (typeof whatsapp === 'string' && !whatsapp.startsWith('whatsapp:')) cleaned.whatsapp = whatsapp;
  else if (whatsapp) errors.push(whatsapp);

  const email = validateString(normalizedData?.email, 'email', false, true);
  if (typeof email === 'string' && !email.startsWith('email:')) cleaned.email = email;
  else if (email) errors.push(email);

  const instagram = validateString(normalizedData?.instagram, 'instagram', false, true);
  if (instagram && !instagram.startsWith('instagram:')) cleaned.instagram = instagram;
  else if (instagram) errors.push(instagram);

  const stage = validateString(normalizedData?.stage, 'stage', true, false);
  if (typeof stage === 'string' && !stage.startsWith('stage:')) cleaned.stage = stage;
  else if (stage) errors.push(stage);

  const origin = validateString(normalizedData?.origin, 'origin', false, true);
  if (origin && !origin.startsWith('origin:')) cleaned.origin = origin;
  else if (origin) errors.push(origin);

  const firstContact = validateString(normalizedData?.firstContact, 'firstContact', false, true);
  if (firstContact && !firstContact.startsWith('firstContact:')) cleaned.firstContact = firstContact;
  else if (firstContact) errors.push(firstContact);

  const closingDate = validateString(normalizedData?.closingDate, 'closingDate', false, true);
  if (closingDate && !closingDate.startsWith('closingDate:')) cleaned.closingDate = closingDate;
  else if (closingDate) errors.push(closingDate);

  const followUpReminder = validateString(normalizedData?.followUpReminder, 'followUpReminder', false, true);
  if (followUpReminder && !followUpReminder.startsWith('followUpReminder:')) cleaned.followUpReminder = followUpReminder;
  else if (followUpReminder) errors.push(followUpReminder);

  const address = validateString(normalizedData?.address, 'address', false, true);
  if (address && !address.startsWith('address:')) cleaned.address = address;
  else if (address) errors.push(address);

  const notes = validateString(normalizedData?.notes, 'notes', false, true);
  if (notes && !notes.startsWith('notes:')) cleaned.notes = notes;
  else if (notes) errors.push(notes);

  const value = validateString(normalizedData?.value, 'value', false, true);
  if (value && !value.startsWith('value:')) cleaned.value = value;
  else if (value) errors.push(value);

  if (normalizedData?.items) {
    const itemsResult = validateArray(normalizedData.items, 'items', (item) => {
      const itemErrors: string[] = [];
      const itemCleaned: Record<string, unknown> = {};
      const itemId = validateString(item?.id, 'item.id', true, false);
      if (typeof itemId === 'string' && !itemId.startsWith('item.id:')) itemCleaned.id = itemId;
      else if (itemId) itemErrors.push(itemId);

      const itemName = validateString(item?.item, 'item.item', true, false);
      if (typeof itemName === 'string' && !itemName.startsWith('item.item:')) itemCleaned.item = itemName;
      else if (itemName) itemErrors.push(itemName);

      const qtdAtual = validateNumber(item?.qtdAtual, 'item.qtdAtual', true, 0);
      if (typeof qtdAtual === 'number') itemCleaned.qtdAtual = qtdAtual;
      else if (qtdAtual) itemErrors.push(qtdAtual);

      const valorUnit = validateNumber(item?.valorUnit, 'item.valorUnit', true, 0);
      if (typeof valorUnit === 'number') itemCleaned.valorUnit = valorUnit;
      else if (valorUnit) itemErrors.push(valorUnit);

      itemCleaned.semPreco = validateBoolean(item?.semPreco);

      const eventStockId = validateString(item?.eventStockId, 'item.eventStockId', false, true);
      if (eventStockId && !eventStockId.startsWith('item.eventStockId:')) itemCleaned.eventStockId = eventStockId;
      else if (eventStockId) itemErrors.push(eventStockId);

      if (itemErrors.length > 0) return `item ${item?.id}: ${itemErrors.join(', ')}`;
      return itemCleaned;
    });
    if (Array.isArray(itemsResult)) cleaned.items = itemsResult;
    else if (itemsResult) errors.push(itemsResult);
  }

  const lastModifiedBy = validateString(normalizedData?.lastModifiedBy, 'lastModifiedBy', false, true);
  if (lastModifiedBy && !lastModifiedBy.startsWith('lastModifiedBy:')) cleaned.lastModifiedBy = lastModifiedBy;
  else if (lastModifiedBy) errors.push(lastModifiedBy);

  const cpf = validateString(normalizedData?.cpf, 'cpf', false, true);
  if (cpf && !cpf.startsWith('cpf:')) cleaned.cpf = cpf;
  else if (cpf) errors.push(cpf);

  const rg = validateString(normalizedData?.rg, 'rg', false, true);
  if (rg && !rg.startsWith('rg:')) cleaned.rg = rg;
  else if (rg) errors.push(rg);

  const clientAddress = validateString(normalizedData?.clientAddress, 'clientAddress', false, true);
  if (clientAddress && !clientAddress.startsWith('clientAddress:')) cleaned.clientAddress = clientAddress;
  else if (clientAddress) errors.push(clientAddress);

  const clientGender = validateString(normalizedData?.clientGender, 'clientGender', false, true);
  if (clientGender && !clientGender.startsWith('clientGender:')) cleaned.clientGender = clientGender as LeadInput['clientGender'];
  else if (clientGender) errors.push(clientGender);

  cleaned.updatedAt = new Date().toISOString();
  if (!data?.id) cleaned.createdAt = new Date().toISOString();

  if (errors.length > 0) {
    log('Validação falhou', errors);
    return { success: false, errors };
  }

  log('Dados validados e limpos', cleaned);
  return { success: true, data: cleaned as LeadInput };
};

export interface FinanceRecordInput {
  id?: string;
  type: 'receita' | 'despesa';
  client?: string;
  description: string;
  amount: number;
  date: string;
  paidDate?: string;
  status: 'Pago' | 'Pendente' | 'Vencida' | 'Cancelado';
  source?: 'manual' | 'lead' | 'evento' | 'asaas';
  paymentMethod?: string;
  installments?: string;
  category?: string;
  eventType?: string;
  origemEventoId?: string;
  lastModifiedBy?: string;
  expenseType?: 'fixa' | 'variavel';
  recurrence?: 'mensal' | 'trimestral' | 'anual';
  dueDay?: number;
  parentId?: string;
}

export const validateAndCleanFinance = (data: unknown): ValidationResult<FinanceRecordInput> => {
  log('Validando finance record (dados brutos)', data);
  
  const normalizedData = { ...data as Record<string, unknown> };
  if ('date' in normalizedData) normalizedData.date = normalizeDate(normalizedData.date, 'date') || normalizedData.date;
  if ('paidDate' in normalizedData) normalizedData.paidDate = normalizeDate(normalizedData.paidDate, 'paidDate') || normalizedData.paidDate;
  
  log('Validando finance record (dados normalizados)', normalizedData);

  const errors: string[] = [];
  const cleaned: Partial<FinanceRecordInput> = {};

  const type = validateString(normalizedData?.type, 'type', true, false);
  if (typeof type === 'string' && !type.startsWith('type:') && ['receita', 'despesa'].includes(type)) {
    cleaned.type = type as FinanceRecordInput['type'];
  } else if (type) {
    errors.push('type: deve ser "receita" ou "despesa"');
  }

  const client = validateString(normalizedData?.client, 'client', false, true);
  if (client && !client.startsWith('client:')) cleaned.client = client;
  else if (client) errors.push(client);

  const description = validateString(normalizedData?.description, 'description', true, false);
  if (typeof description === 'string' && !description.startsWith('description:')) cleaned.description = description;
  else if (description) errors.push(description);

  const amount = validateNumber(normalizedData?.amount, 'amount', true, 0);
  if (typeof amount === 'number') cleaned.amount = amount;
  else if (amount) errors.push(amount);

  const date = validateString(normalizedData?.date, 'date', true, false);
  if (typeof date === 'string' && !date.startsWith('date:')) cleaned.date = date;
  else if (date) errors.push(date);

  const paidDate = validateString(normalizedData?.paidDate, 'paidDate', false, true);
  if (paidDate && !paidDate.startsWith('paidDate:')) cleaned.paidDate = paidDate;
  else if (paidDate) errors.push(paidDate);

  const status = validateString(normalizedData?.status, 'status', true, false);
  if (typeof status === 'string' && !status.startsWith('status:') && ['Pago', 'Pendente', 'Vencida', 'Cancelado'].includes(status)) {
    cleaned.status = status as FinanceRecordInput['status'];
  } else if (status) {
    errors.push('status: deve ser Pago, Pendente, Vencida ou Cancelado');
  }

  const source = validateString(normalizedData?.source, 'source', false, true);
  if (source && !source.startsWith('source:') && ['manual', 'lead', 'evento', 'asaas'].includes(source)) {
    cleaned.source = source as FinanceRecordInput['source'];
  } else if (source) {
    errors.push('source: deve ser manual, lead, evento ou asaas');
  }

  const paymentMethod = validateString(normalizedData?.paymentMethod, 'paymentMethod', false, true);
  if (paymentMethod && !paymentMethod.startsWith('paymentMethod:')) cleaned.paymentMethod = paymentMethod;
  else if (paymentMethod) errors.push(paymentMethod);

  const installments = validateString(normalizedData?.installments, 'installments', false, true);
  if (installments && !installments.startsWith('installments:')) cleaned.installments = installments;
  else if (installments) errors.push(installments);

  const category = validateString(normalizedData?.category, 'category', false, true);
  if (category && !category.startsWith('category:')) cleaned.category = category;
  else if (category) errors.push(category);

  const eventType = validateString(normalizedData?.eventType, 'eventType', false, true);
  if (eventType && !eventType.startsWith('eventType:')) cleaned.eventType = eventType;
  else if (eventType) errors.push(eventType);

  const origemEventoId = validateString(normalizedData?.origemEventoId, 'origemEventoId', false, true);
  if (origemEventoId && !origemEventoId.startsWith('origemEventoId:')) cleaned.origemEventoId = origemEventoId;
  else if (origemEventoId) errors.push(origemEventoId);

  const lastModifiedBy = validateString(normalizedData?.lastModifiedBy, 'lastModifiedBy', false, true);
  if (lastModifiedBy && !lastModifiedBy.startsWith('lastModifiedBy:')) cleaned.lastModifiedBy = lastModifiedBy;
  else if (lastModifiedBy) errors.push(lastModifiedBy);

  const expenseType = validateString(normalizedData?.expenseType, 'expenseType', false, true);
  if (expenseType && !expenseType.startsWith('expenseType:') && ['fixa', 'variavel'].includes(expenseType)) {
    cleaned.expenseType = expenseType as FinanceRecordInput['expenseType'];
  } else if (expenseType) {
    errors.push('expenseType: deve ser fixa ou variavel');
  }

  const recurrence = validateString(normalizedData?.recurrence, 'recurrence', false, true);
  if (recurrence && !recurrence.startsWith('recurrence:') && ['mensal', 'trimestral', 'anual'].includes(recurrence)) {
    cleaned.recurrence = recurrence as FinanceRecordInput['recurrence'];
  } else if (recurrence) {
    errors.push('recurrence: deve ser mensal, trimestral ou anual');
  }

  const dueDay = validateNumber(normalizedData?.dueDay, 'dueDay', false, 1);
  if (typeof dueDay === 'number' && dueDay <= 31) cleaned.dueDay = dueDay;
  else if (dueDay) errors.push('dueDay: deve ser 1-31');

  const parentId = validateString(normalizedData?.parentId, 'parentId', false, true);
  if (parentId && !parentId.startsWith('parentId:')) cleaned.parentId = parentId;
  else if (parentId) errors.push(parentId);

  cleaned.updatedAt = new Date().toISOString();
  if (!data?.id) cleaned.createdAt = new Date().toISOString();

  if (errors.length > 0) {
    log('Validação falhou', errors);
    return { success: false, errors };
  }

  log('Dados validados e limpos', cleaned);
  return { success: true, data: cleaned as FinanceRecordInput };
};

export interface EventExpenseInput {
  id?: string;
  eventId: string;
  description: string;
  category: 'Transporte' | 'Alimentação' | 'Hospedagem' | 'Material' | 'Equipe' | 'Outros';
  customName?: string;
  valor: number;
  status: 'Pendente' | 'Pago';
  paymentMethod?: 'Pix' | 'Dinheiro' | 'Cartão' | 'Boleto';
  tipo: 'variavel';
  interno: true;
  financeiroId?: string;
  date: string;
}

export const validateAndCleanEventExpense = (data: unknown): ValidationResult<EventExpenseInput> => {
  log('Validando event expense (dados brutos)', data);
  
  const normalizedData = { ...data as Record<string, unknown> };
  if ('date' in normalizedData) normalizedData.date = normalizeDate(normalizedData.date, 'date') || normalizedData.date;
  
  log('Validando event expense (dados normalizados)', normalizedData);

  const errors: string[] = [];
  const cleaned: Partial<EventExpenseInput> = {};

  const eventId = validateString(normalizedData?.eventId, 'eventId', true, false);
  if (typeof eventId === 'string' && !eventId.startsWith('eventId:')) cleaned.eventId = eventId;
  else if (eventId) errors.push(eventId);

  const description = validateString(normalizedData?.description, 'description', true, false);
  if (typeof description === 'string' && !description.startsWith('description:')) cleaned.description = description;
  else if (description) errors.push(description);

  const category = validateString(normalizedData?.category, 'category', true, false);
  if (typeof category === 'string' && !category.startsWith('category:') && 
      ['Transporte', 'Alimentação', 'Hospedagem', 'Material', 'Equipe', 'Outros'].includes(category)) {
    cleaned.category = category as EventExpenseInput['category'];
  } else if (category) {
    errors.push('category: deve ser Transporte, Alimentação, Hospedagem, Material, Equipe ou Outros');
  }

  const customName = validateString(normalizedData?.customName, 'customName', false, true);
  if (customName && !customName.startsWith('customName:')) cleaned.customName = customName;
  else if (customName) errors.push(customName);

  const valor = validateNumber(normalizedData?.valor, 'valor', true, 0);
  if (typeof valor === 'number') cleaned.valor = valor;
  else if (valor) errors.push(valor);

  const status = validateString(normalizedData?.status, 'status', true, false);
  if (typeof status === 'string' && !status.startsWith('status:') && ['Pendente', 'Pago'].includes(status)) {
    cleaned.status = status as EventExpenseInput['status'];
  } else if (status) {
    errors.push('status: deve ser Pendente ou Pago');
  }

  const paymentMethod = validateString(normalizedData?.paymentMethod, 'paymentMethod', false, true);
  if (paymentMethod && !paymentMethod.startsWith('paymentMethod:') && 
      ['Pix', 'Dinheiro', 'Cartão', 'Boleto'].includes(paymentMethod)) {
    cleaned.paymentMethod = paymentMethod as EventExpenseInput['paymentMethod'];
  } else if (paymentMethod) {
    errors.push('paymentMethod: deve ser Pix, Dinheiro, Cartão ou Boleto');
  }

  cleaned.tipo = 'variavel';
  cleaned.interno = true;

  const financeiroId = validateString(normalizedData?.financeiroId, 'financeiroId', false, true);
  if (financeiroId && !financeiroId.startsWith('financeiroId:')) cleaned.financeiroId = financeiroId;
  else if (financeiroId) errors.push(financeiroId);

  const date = validateString(normalizedData?.date, 'date', true, false);
  if (typeof date === 'string' && !date.startsWith('date:')) cleaned.date = date;
  else if (date) errors.push(date);

  cleaned.updatedAt = new Date().toISOString();
  if (!data?.id) cleaned.createdAt = new Date().toISOString();

  if (errors.length > 0) {
    log('Validação falhou', errors);
    return { success: false, errors };
  }

  log('Dados validados e limpos', cleaned);
  return { success: true, data: cleaned as EventExpenseInput };
};

export interface EventStockItemInput {
  id?: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  valorReferencia: number;
  observacao: string;
}

export const validateAndCleanEventStock = (data: unknown): ValidationResult<EventStockItemInput> => {
  log('Validando event stock item', data);
  const errors: string[] = [];
  const cleaned: Partial<EventStockItemInput> = {};

  const name = validateString(data?.name, 'name', true, false);
  if (typeof name === 'string' && !name.startsWith('name:')) cleaned.name = name;
  else if (name) errors.push(name);

  const category = validateString(data?.category, 'category', true, false);
  if (typeof category === 'string' && !category.startsWith('category:') && 
      ['Iluminação', 'Som', 'Efeitos', 'Estrutura', 'Vídeo', 'Outros'].includes(category)) {
    cleaned.category = category;
  } else if (category) {
    errors.push('category: deve ser Iluminação, Som, Efeitos, Estrutura, Vídeo ou Outros');
  }

  const quantity = validateNumber(data?.quantity, 'quantity', false, 0);
  if (typeof quantity === 'number') cleaned.quantity = quantity;
  else if (quantity) errors.push(quantity);

  const unit = validateString(data?.unit, 'unit', false, true);
  if (unit && !unit.startsWith('unit:') && 
      ['kit', 'unidade', 'par', 'set', 'metro', 'outros'].includes(unit)) {
    cleaned.unit = unit;
  } else if (unit) {
    errors.push('unit: deve ser kit, unidade, par, set, metro ou outros');
  }

  const valorReferencia = validateNumber(data?.valorReferencia, 'valorReferencia', false, 0);
  if (typeof valorReferencia === 'number') cleaned.valorReferencia = valorReferencia;
  else if (valorReferencia) errors.push(valorReferencia);

  const observacao = validateString(data?.observacao, 'observacao', false, true);
  if (observacao && !observacao.startsWith('observacao:')) cleaned.observacao = observacao;
  else if (observacao) errors.push(observacao);

  if (data?.id) {
    const id = validateString(data.id, 'id', false, false);
    if (id && !id.startsWith('id:')) cleaned.id = id;
    else if (id) errors.push(id);
  }

  cleaned.updatedAt = new Date().toISOString();
  if (!data?.id) cleaned.createdAt = new Date().toISOString();

  if (errors.length > 0) {
    log('Validação falhou', errors);
    return { success: false, errors };
  }

  log('Dados validados e limpos', cleaned);
  return { success: true, data: cleaned as EventStockItemInput };
};