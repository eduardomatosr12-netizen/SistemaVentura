import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Lead, CalendarEvent } from '../types/crm';
import { validateAndCleanLead } from '../lib/dataValidator';
const COLLECTION = 'leads';

const toDate = (ts: Timestamp | string | undefined): string => {
  if (!ts) return new Date().toISOString().split('T')[0];
  if (ts instanceof Timestamp) return ts.toDate().toISOString().split('T')[0];
  return String(ts).split('T')[0];
};

export const subscribeLeads = (callback: (leads: Lead[]) => void): () => void => {
  const q = query(collection(db, COLLECTION), orderBy('name'));
  const unsubscribe = onSnapshot(q, snapshot => {
    const leads = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || '',
        niche: data.niche || '',
        whatsapp: data.whatsapp || '',
        email: data.email || '',
        instagram: data.instagram || '',
        stage: data.stage || '',
        origin: data.origin || '',
        firstContact: toDate(data.firstContact),
        closingDate: toDate(data.closingDate),
        followUpReminder: data.followUpReminder || '',
        address: data.address || '',
        notes: data.notes || '',
        value: data.value || '0',
        items: data.items || [],
        lastModifiedBy: data.lastModifiedBy || '',
        eventoId: data.eventoId || '',
        cpf: data.cpf || '',
        rg: data.rg || '',
        clientAddress: data.clientAddress || '',
        clientGender: data.clientGender || '',
      } as Lead;
    });
    callback(leads);
  }, err => console.error('[Firestore] Erro no listener de leads:', err));
  return unsubscribe;
};

export const fetchLeads = async (): Promise<Lead[]> => {
  const q = query(collection(db, COLLECTION), orderBy('name'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name || '',
      niche: data.niche || '',
      whatsapp: data.whatsapp || '',
      email: data.email || '',
      instagram: data.instagram || '',
      stage: data.stage || '',
      origin: data.origin || '',
      firstContact: toDate(data.firstContact),
      closingDate: toDate(data.closingDate),
      followUpReminder: data.followUpReminder || '',
      address: data.address || '',
      notes: data.notes || '',
      value: data.value || '0',
      items: data.items || [],
      lastModifiedBy: data.lastModifiedBy || '',
      eventoId: data.eventoId || '',
      cpf: data.cpf || '',
      rg: data.rg || '',
      clientAddress: data.clientAddress || '',
      clientGender: data.clientGender || '',
    } as Lead;
  });
};

export const addLead = async (lead: Omit<Lead, 'id'>): Promise<string> => {
  try {
    const result = validateAndCleanLead({
      ...lead,
      firstContact: lead.firstContact || new Date().toISOString().split('T')[0],
    });
    if (!result.success) {
      const error = new Error('Validação falhou: ' + result.errors?.join(', '));
      console.error('[Firestore] Validação falhou ao criar lead:', error.message);
      throw error;
    }
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...result.data,
      createdAt: Timestamp.now(),
    });
    console.log('[Firestore] Lead criado:', docRef.id);
    return docRef.id;
  } catch (err) {
    console.error('[Firestore] Erro ao criar lead:', err);
    throw err;
  }
};

export const updateLead = async (id: string, fields: Partial<Lead>): Promise<void> => {
  try {
    const result = validateAndCleanLead({ ...fields, id });
    if (!result.success) {
      const error = new Error('Validação falhou: ' + result.errors?.join(', '));
      console.error('[Firestore] Validação falhou ao atualizar lead:', error.message);
      throw error;
    }
    const data = { ...result.data } as Record<string, unknown>;
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    await updateDoc(doc(db, COLLECTION, id), { ...data, updatedAt: Timestamp.now() });
    console.log('[Firestore] Lead atualizado:', id);
  } catch (err) {
    console.error('[Firestore] Erro ao atualizar lead:', id, err);
    throw err;
  }
};

export const deleteLead = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTION, id));
    console.log('[Firestore] Lead excluído:', id);
  } catch (err) {
    console.error('[Firestore] Erro ao excluir lead:', id, err);
    throw err;
  }
};

export const updateLeadStage = async (id: string, stage: string): Promise<void> => {
  try {
    await updateDoc(doc(db, COLLECTION, id), { stage, updatedAt: Timestamp.now() });
    console.log('[Firestore] Stage do lead atualizado:', id, '->', stage);
  } catch (err) {
    console.error('[Firestore] Erro ao atualizar stage do lead:', id, err);
    throw err;
  }
};

/** Campos do evento que alimentam o cadastro do cliente na sessão "Clientes". */
export type ContractClientSource = Pick<
  CalendarEvent,
  'id' | 'client' | 'clientPhone' | 'eventType' | 'date' | 'city' | 'description'
> &
  Pick<CalendarEvent, 'clientCpf' | 'clientRg' | 'clientAddress' | 'clientGender' | 'valorTotal' | 'desconto' | 'items'>;

const formatBRL = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Grava (ou atualiza) o cliente de um evento que teve contrato emitido.
 *
 * É o único caminho do sistema que cria registros em `leads`: até aqui o
 * cliente existe somente no calendário.
 */
export const saveContractClient = async (
  event: ContractClientSource,
  options: { contractServices?: string[] } = {},
): Promise<string> => {
  const today = new Date().toISOString().split('T')[0];
  // `valorTotal` do evento já é líquido (o desconto foi abatido na hora de salvar).
  const total = Math.max(0, Number(event.valorTotal || 0));
  const items = (event.items || []) as Lead['items'];

  const payload: Omit<Lead, 'id'> = {
    name: event.client || 'Cliente',
    niche: event.eventType || 'Evento',
    whatsapp: event.clientPhone || '',
    email: '',
    instagram: '',
    stage: 'Contrato Fechado',
    origin: 'contrato',
    firstContact: event.date || today,
    closingDate: today,
    followUpReminder: '',
    address: event.city || '',
    notes: event.description || '',
    value: formatBRL(total),
    items,
    eventoId: event.id,
    cpf: event.clientCpf || '',
    rg: event.clientRg || '',
    clientAddress: event.clientAddress || '',
    clientGender: event.clientGender || '',
  };

  if (options.contractServices && options.contractServices.length > 0) {
    payload.notes = [payload.notes, `Serviços: ${options.contractServices.join(', ')}`]
      .filter(Boolean)
      .join(' • ');
  }

  const existing = await getDocs(query(collection(db, COLLECTION), where('eventoId', '==', event.id)));
  const existingId = existing.docs[0]?.id;

  if (existingId) {
    await updateLead(existingId, payload);
    console.log('[Firestore] Cliente do contrato atualizado:', existingId);
    return existingId;
  }

  const newId = await addLead(payload);
  console.log('[Firestore] Cliente do contrato criado:', newId);
  return newId;
};
