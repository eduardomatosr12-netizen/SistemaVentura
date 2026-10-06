import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { CalendarEvent } from '../types/crm';
import { validateAndCleanEvent } from '../lib/dataValidator';

const COLLECTION = 'events';

const mapEventDoc = (d: { id: string; data: () => Record<string, unknown> }): CalendarEvent => {
  const data = d.data();
  const rawGender = data.clientGender;
  const validGender = rawGender === 'F' || rawGender === 'M' ? rawGender : '';
  return {
    id: d.id,
    title: data.title || '',
    client: data.client || '',
    clientId: data.clientId || '',
    eventType: data.eventType || '',
    date: data.date || '',
    dateEnd: data.dateEnd || '',
    time: data.time || '',
    local: data.local || '',
    decorator: data.decorator || '',
    city: data.city || '',
    description: data.description || '',
    equipe: data.equipe || '',
    clientPhone: data.clientPhone || '',
    clientCpf: data.clientCpf || '',
    clientRg: data.clientRg || '',
    clientAddress: data.clientAddress || '',
    clientGender: validGender,
    contractServices: Array.isArray(data.contractServices)
      ? (data.contractServices as unknown[]).map(String).filter(Boolean)
      : [],
    status: data.status || 'orcamento',
    valorTotal: data.valorTotal ?? 0,
    desconto: data.desconto ?? 0,
    items: data.items ?? [],
  } as CalendarEvent;
};

const sortByDate = (events: CalendarEvent[]): CalendarEvent[] =>
  events.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

export const subscribeEvents = (callback: (events: CalendarEvent[]) => void): () => void => {
  const q = query(collection(db, COLLECTION), orderBy('date'));
  const unsubscribe = onSnapshot(q, snapshot => {
    const events = snapshot.docs.map(mapEventDoc);
    callback(sortByDate(events));
  }, err => {
    console.error('[Firestore] Erro no listener de eventos:', err);
  });
  return unsubscribe;
};

export const fetchEvents = async (): Promise<CalendarEvent[]> => {
  const q = query(collection(db, COLLECTION));
  const snapshot = await getDocs(q);
  return sortByDate(snapshot.docs.map(mapEventDoc));
};

export const addEvent = async (event: Omit<CalendarEvent, 'id'>): Promise<string> => {
  try {
    const result = validateAndCleanEvent(event);
    if (!result.success) {
      const error = new Error('Validação falhou: ' + result.errors?.join(', '));
      console.error('[Firestore] Validação falhou ao criar evento:', error.message);
      throw error;
    }
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...result.data,
      createdAt: Timestamp.now(),
    });
    console.log('[Firestore] Evento criado:', docRef.id);
    return docRef.id;
  } catch (err) {
    console.error('[Firestore] Erro ao criar evento:', err);
    throw err;
  }
};

export const updateEvent = async (id: string, fields: Partial<CalendarEvent>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION, id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
      const error = new Error('Evento não encontrado: ' + id);
      console.error('[Firestore] Erro ao atualizar evento:', error.message);
      throw error;
    }
    // A validação exige title/date/client, mas updateEvent recebe apenas os
    // campos alterados (ex.: dados do contrato). Mescla com o documento atual
    // para validar o estado completo e não sobrescrever campos não enviados.
    const existing = snapshot.data() as Partial<CalendarEvent>;
    const result = validateAndCleanEvent({ ...existing, ...fields, id });
    if (!result.success) {
      const error = new Error('Validação falhou: ' + result.errors?.join(', '));
      console.error('[Firestore] Validação falhou ao atualizar evento:', error.message);
      throw error;
    }
    const data = { ...result.data } as Record<string, unknown>;
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    // O validador omite campos opcionais vazios; quando o usuário limpou um
    // campo ('') gravamos '' explicitamente para apagar o valor antigo.
    Object.entries(fields).forEach(([key, value]) => {
      if (value === '' && !(key in data)) data[key] = '';
    });
    await updateDoc(docRef, { ...data, updatedAt: Timestamp.now() });
    console.log('[Firestore] Evento atualizado:', id);
  } catch (err) {
    console.error('[Firestore] Erro ao atualizar evento:', id, err);
    throw err;
  }
};

export const deleteEvent = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTION, id));
    console.log('[Firestore] Evento excluído:', id);
  } catch (err) {
    console.error('[Firestore] Erro ao excluir evento:', id, err);
    throw err;
  }
};
