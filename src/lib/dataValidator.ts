export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

export type ValidationResultAny = ValidationResult<unknown>;

const log = (prefix: string, data: unknown) => {
  console.log(`[Validator] ${prefix}:`, data);
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

export const validateISODate = (value: unknown, field: string): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return `${field}: deve ser string`;
  if (!value.match(/^\d{4}-\d{2}-\d{2}/)) return `${field}: formato inválido (YYYY-MM-DD)`;
  const date = new Date(value + 'T00:00:00');
  if (isNaN(date.getTime())) return `${field}: data inválida`;
  return value;
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
  log('Validando event', data);
  const errors: string[] = [];
  const cleaned: Partial<EventInput> = {};

  const title = validateString(data?.title, 'title', true, false);
  if (typeof title === 'string' && !title.startsWith('title:')) cleaned.title = title;
  else if (title) errors.push(title);

  const date = validateISODate(data?.date, 'date');
  if (typeof date === 'string' && !date.startsWith('date:')) cleaned.date = date;
  else if (date) errors.push(date);

  const client = validateString(data?.client, 'client', true, false);
  if (typeof client === 'string' && !client.startsWith('client:')) cleaned.client = client;
  else if (client) errors.push(client);

  const clientId = validateString(data?.clientId, 'clientId', false, true);
  if (clientId && !clientId.startsWith('clientId:')) cleaned.clientId = clientId;
  else if (clientId) errors.push(clientId);

  const clientPhone = validateString(data?.clientPhone, 'clientPhone', false, true);
  if (clientPhone && !clientPhone.startsWith('clientPhone:')) cleaned.clientPhone = clientPhone;
  else if (clientPhone) errors.push(clientPhone);

  const clientEmail = validateString(data?.clientEmail, 'clientEmail', false, true);
  if (clientEmail && !clientEmail.startsWith('clientEmail:')) cleaned.clientEmail = clientEmail;
  else if (clientEmail) errors.push(clientEmail);

  const clientCpf = validateString(data?.clientCpf, 'clientCpf', false, true);
  if (clientCpf && !clientCpf.startsWith('clientCpf:')) cleaned.clientCpf = clientCpf;
  else if (clientCpf) errors.push(clientCpf);

  const clientAddress = validateString(data?.clientAddress, 'clientAddress', false, true);
  if (clientAddress && !clientAddress.startsWith('clientAddress:')) cleaned.clientAddress = clientAddress;
  else if (clientAddress) errors.push(clientAddress);

  const clientGender = validateString(data?.clientGender, 'clientGender', false, true);
  if (clientGender && !clientGender.startsWith('clientGender:') && ['F', 'M', ''].includes(clientGender)) {
    cleaned.clientGender = clientGender as 'F' | 'M' | '';
  } else if (clientGender) {
    errors.push('clientGender: deve ser "F", "M" ou ""');
  } else {
    cleaned.clientGender = '';
  }

  const eventType = validateString(data?.eventType, 'eventType', false, true);
  if (eventType && !eventType.startsWith('eventType:')) cleaned.eventType = eventType;
  else if (eventType) errors.push(eventType);

  const dateEnd = validateISODate(data?.dateEnd, 'dateEnd');
  if (typeof dateEnd === 'string' && !dateEnd.startsWith('dateEnd:')) cleaned.dateEnd = dateEnd;
  else if (dateEnd) errors.push(dateEnd);

  const time = validateString(data?.time, 'time', false, true);
  if (time && !time.startsWith('time:')) cleaned.time = time;
  else if (time) errors.push(time);

  const local = validateString(data?.local, 'local', false, true);
  if (local && !local.startsWith('local:')) cleaned.local = local;
  else if (local) errors.push(local);

  const decorator = validateString(data?.decorator, 'decorator', false, true);
  if (decorator && !decorator.startsWith('decorator:')) cleaned.decorator = decorator;
  else if (decorator) errors.push(decorator);

  const city = validateString(data?.city, 'city', false, true);
  if (city && !city.startsWith('city:')) cleaned.city = city;
  else if (city) errors.push(city);

  const description = validateString(data?.description, 'description', false, true);
  if (description && !description.startsWith('description:')) cleaned.description = description;
  else if (description) errors.push(description);

  const equipe = validateString(data?.equipe, 'equipe', false, true);
  if (equipe && !equipe.startsWith('equipe:')) cleaned.equipe = equipe;
  else if (equipe) errors.push(equipe);

  const contractServices = validateArray<string>(data?.contractServices, 'contractServices');
  if (Array.isArray(contractServices)) cleaned.contractServices = contractServices;
  else if (contractServices) errors.push(contractServices);

  const status = validateString(data?.status, 'status', false, true);
  if (status && !status.startsWith('status:') && ['orcamento', 'orcamento_cancelado', 'evento_confirmado', 'evento_concluido'].includes(status)) {
    cleaned.status = status as EventInput['status'];
  } else if (status) {
    errors.push('status: deve ser orcamento, orcamento_cancelado, evento_confirmado ou evento_concluido');
  } else {
    cleaned.status = 'orcamento';
  }

  const valorTotal = validateNumber(data?.valorTotal, 'valorTotal', false, 0);
  if (typeof valorTotal === 'number') cleaned.valorTotal = valorTotal;
  else if (valorTotal) errors.push(valorTotal);

  const desconto = validateNumber(data?.desconto, 'desconto', false, 0);
  if (typeof desconto === 'number') cleaned.desconto = desconto;
  else if (desconto) errors.push(desconto);

  if (data?.items) {
    const itemsResult = validateArray(data.items, 'items', (item) => {
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
}

export const validateAndCleanLead = (data: unknown): ValidationResult<LeadInput> => {
  log('Validando lead', data);
  const errors: string[] = [];
  const cleaned: Partial<LeadInput> = {};

  const name = validateString(data?.name, 'name', true, false);
  if (typeof name === 'string' && !name.startsWith('name:')) cleaned.name = name;
  else if (name) errors.push(name);

  const niche = validateString(data?.niche, 'niche', true, false);
  if (typeof niche === 'string' && !niche.startsWith('niche:')) cleaned.niche = niche;
  else if (niche) errors.push(niche);

  const whatsapp = validateString(data?.whatsapp, 'whatsapp', false, true);
  if (typeof whatsapp === 'string' && !whatsapp.startsWith('whatsapp:')) cleaned.whatsapp = whatsapp;
  else if (whatsapp) errors.push(whatsapp);

  const email = validateString(data?.email, 'email', false, true);
  if (typeof email === 'string' && !email.startsWith('email:')) cleaned.email = email;
  else if (email) errors.push(email);

  const instagram = validateString(data?.instagram, 'instagram', false, true);
  if (instagram && !instagram.startsWith('instagram:')) cleaned.instagram = instagram;
  else if (instagram) errors.push(instagram);

  const stage = validateString(data?.stage, 'stage', true, false);
  if (typeof stage === 'string' && !stage.startsWith('stage:')) cleaned.stage = stage;
  else if (stage) errors.push(stage);

  const origin = validateString(data?.origin, 'origin', false, true);
  if (origin && !origin.startsWith('origin:')) cleaned.origin = origin;
  else if (origin) errors.push(origin);

  const firstContact = validateISODate(data?.firstContact, 'firstContact');
  if (typeof firstContact === 'string' && !firstContact.startsWith('firstContact:')) cleaned.firstContact = firstContact;
  else if (firstContact) errors.push(firstContact);

  const closingDate = validateISODate(data?.closingDate, 'closingDate');
  if (typeof closingDate === 'string' && !closingDate.startsWith('closingDate:')) cleaned.closingDate = closingDate;
  else if (closingDate) errors.push(closingDate);

  const followUpReminder = validateISODate(data?.followUpReminder, 'followUpReminder');
  if (typeof followUpReminder === 'string' && !followUpReminder.startsWith('followUpReminder:')) cleaned.followUpReminder = followUpReminder;
  else if (followUpReminder) errors.push(followUpReminder);

  const address = validateString(data?.address, 'address', false, true);
  if (address && !address.startsWith('address:')) cleaned.address = address;
  else if (address) errors.push(address);

  const notes = validateString(data?.notes, 'notes', false, true);
  if (notes && !notes.startsWith('notes:')) cleaned.notes = notes;
  else if (notes) errors.push(notes);

  const value = validateString(data?.value, 'value', false, true);
  if (value && !value.startsWith('value:')) cleaned.value = value;
  else if (value) errors.push(value);

  if (data?.items) {
    const itemsResult = validateArray(data.items, 'items', (item) => {
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

  const lastModifiedBy = validateString(data?.lastModifiedBy, 'lastModifiedBy', false, true);
  if (lastModifiedBy && !lastModifiedBy.startsWith('lastModifiedBy:')) cleaned.lastModifiedBy = lastModifiedBy;
  else if (lastModifiedBy) errors.push(lastModifiedBy);

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
  log('Validando finance record', data);
  const errors: string[] = [];
  const cleaned: Partial<FinanceRecordInput> = {};

  const type = validateString(data?.type, 'type', true, false);
  if (typeof type === 'string' && !type.startsWith('type:') && ['receita', 'despesa'].includes(type)) {
    cleaned.type = type as FinanceRecordInput['type'];
  } else if (type) {
    errors.push('type: deve ser "receita" ou "despesa"');
  }

  const client = validateString(data?.client, 'client', false, true);
  if (client && !client.startsWith('client:')) cleaned.client = client;
  else if (client) errors.push(client);

  const description = validateString(data?.description, 'description', true, false);
  if (typeof description === 'string' && !description.startsWith('description:')) cleaned.description = description;
  else if (description) errors.push(description);

  const amount = validateNumber(data?.amount, 'amount', true, 0);
  if (typeof amount === 'number') cleaned.amount = amount;
  else if (amount) errors.push(amount);

  const date = validateISODate(data?.date, 'date');
  if (typeof date === 'string' && !date.startsWith('date:')) cleaned.date = date;
  else if (date) errors.push(date);

  const paidDate = validateISODate(data?.paidDate, 'paidDate');
  if (typeof paidDate === 'string' && !paidDate.startsWith('paidDate:')) cleaned.paidDate = paidDate;
  else if (paidDate) errors.push(paidDate);

  const status = validateString(data?.status, 'status', true, false);
  if (typeof status === 'string' && !status.startsWith('status:') && ['Pago', 'Pendente', 'Vencida', 'Cancelado'].includes(status)) {
    cleaned.status = status as FinanceRecordInput['status'];
  } else if (status) {
    errors.push('status: deve ser Pago, Pendente, Vencida ou Cancelado');
  }

  const source = validateString(data?.source, 'source', false, true);
  if (source && !source.startsWith('source:') && ['manual', 'lead', 'evento', 'asaas'].includes(source)) {
    cleaned.source = source as FinanceRecordInput['source'];
  } else if (source) {
    errors.push('source: deve ser manual, lead, evento ou asaas');
  }

  const paymentMethod = validateString(data?.paymentMethod, 'paymentMethod', false, true);
  if (paymentMethod && !paymentMethod.startsWith('paymentMethod:')) cleaned.paymentMethod = paymentMethod;
  else if (paymentMethod) errors.push(paymentMethod);

  const installments = validateString(data?.installments, 'installments', false, true);
  if (installments && !installments.startsWith('installments:')) cleaned.installments = installments;
  else if (installments) errors.push(installments);

  const category = validateString(data?.category, 'category', false, true);
  if (category && !category.startsWith('category:')) cleaned.category = category;
  else if (category) errors.push(category);

  const eventType = validateString(data?.eventType, 'eventType', false, true);
  if (eventType && !eventType.startsWith('eventType:')) cleaned.eventType = eventType;
  else if (eventType) errors.push(eventType);

  const origemEventoId = validateString(data?.origemEventoId, 'origemEventoId', false, true);
  if (origemEventoId && !origemEventoId.startsWith('origemEventoId:')) cleaned.origemEventoId = origemEventoId;
  else if (origemEventoId) errors.push(origemEventoId);

  const lastModifiedBy = validateString(data?.lastModifiedBy, 'lastModifiedBy', false, true);
  if (lastModifiedBy && !lastModifiedBy.startsWith('lastModifiedBy:')) cleaned.lastModifiedBy = lastModifiedBy;
  else if (lastModifiedBy) errors.push(lastModifiedBy);

  const expenseType = validateString(data?.expenseType, 'expenseType', false, true);
  if (expenseType && !expenseType.startsWith('expenseType:') && ['fixa', 'variavel'].includes(expenseType)) {
    cleaned.expenseType = expenseType as FinanceRecordInput['expenseType'];
  } else if (expenseType) {
    errors.push('expenseType: deve ser fixa ou variavel');
  }

  const recurrence = validateString(data?.recurrence, 'recurrence', false, true);
  if (recurrence && !recurrence.startsWith('recurrence:') && ['mensal', 'trimestral', 'anual'].includes(recurrence)) {
    cleaned.recurrence = recurrence as FinanceRecordInput['recurrence'];
  } else if (recurrence) {
    errors.push('recurrence: deve ser mensal, trimestral ou anual');
  }

  const dueDay = validateNumber(data?.dueDay, 'dueDay', false, 1);
  if (typeof dueDay === 'number' && dueDay <= 31) cleaned.dueDay = dueDay;
  else if (dueDay) errors.push('dueDay: deve ser 1-31');

  const parentId = validateString(data?.parentId, 'parentId', false, true);
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
  log('Validando event expense', data);
  const errors: string[] = [];
  const cleaned: Partial<EventExpenseInput> = {};

  const eventId = validateString(data?.eventId, 'eventId', true, false);
  if (typeof eventId === 'string' && !eventId.startsWith('eventId:')) cleaned.eventId = eventId;
  else if (eventId) errors.push(eventId);

  const description = validateString(data?.description, 'description', true, false);
  if (typeof description === 'string' && !description.startsWith('description:')) cleaned.description = description;
  else if (description) errors.push(description);

  const category = validateString(data?.category, 'category', true, false);
  if (typeof category === 'string' && !category.startsWith('category:') && 
      ['Transporte', 'Alimentação', 'Hospedagem', 'Material', 'Equipe', 'Outros'].includes(category)) {
    cleaned.category = category as EventExpenseInput['category'];
  } else if (category) {
    errors.push('category: deve ser Transporte, Alimentação, Hospedagem, Material, Equipe ou Outros');
  }

  const customName = validateString(data?.customName, 'customName', false, true);
  if (customName && !customName.startsWith('customName:')) cleaned.customName = customName;
  else if (customName) errors.push(customName);

  const valor = validateNumber(data?.valor, 'valor', true, 0);
  if (typeof valor === 'number') cleaned.valor = valor;
  else if (valor) errors.push(valor);

  const status = validateString(data?.status, 'status', true, false);
  if (typeof status === 'string' && !status.startsWith('status:') && ['Pendente', 'Pago'].includes(status)) {
    cleaned.status = status as EventExpenseInput['status'];
  } else if (status) {
    errors.push('status: deve ser Pendente ou Pago');
  }

  const paymentMethod = validateString(data?.paymentMethod, 'paymentMethod', false, true);
  if (paymentMethod && !paymentMethod.startsWith('paymentMethod:') && 
      ['Pix', 'Dinheiro', 'Cartão', 'Boleto'].includes(paymentMethod)) {
    cleaned.paymentMethod = paymentMethod as EventExpenseInput['paymentMethod'];
  } else if (paymentMethod) {
    errors.push('paymentMethod: deve ser Pix, Dinheiro, Cartão ou Boleto');
  }

  cleaned.tipo = 'variavel';
  cleaned.interno = true;

  const financeiroId = validateString(data?.financeiroId, 'financeiroId', false, true);
  if (financeiroId && !financeiroId.startsWith('financeiroId:')) cleaned.financeiroId = financeiroId;
  else if (financeiroId) errors.push(financeiroId);

  const date = validateISODate(data?.date, 'date');
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