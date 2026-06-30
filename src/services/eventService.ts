import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { CalendarEvent } from '../contexts/CRMContext';

const COLLECTION = 'events';

const mapEventDoc = (d: { id: string; data: () => Record<string, unknown> }): CalendarEvent => {
  const data = d.data();
  return {
    id: d.id,
    title: data.title || '',
    client: data.client || '',
    clientId: data.clientId || '',
    eventType: data.eventType || '',
    date: data.date || '',
    time: data.time || '',
    local: data.local || '',
    decorator: data.decorator || '',
    city: data.city || '',
    description: data.description || '',
    equipe: data.equipe || '',
    clientEmail: data.clientEmail || '',
    clientPhone: data.clientPhone || '',
    clientCpf: data.clientCpf || '',
    status: data.status || 'pendente',
    dataMontagem: data.dataMontagem || '',
    dataDesmontagem: data.dataDesmontagem || '',
    valorTotal: data.valorTotal ?? 0,
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
  const q = query(collection(db, COLLECTION));
  const unsubscribe = onSnapshot(q, snapshot => {
    const events = snapshot.docs.map(mapEventDoc);
    callback(sortByDate(events));
  }, err => {
    console.error('[Firestore] Erro no listener de eventos (tentando fallback):', err);
    fetchEvents().then(callback).catch(e => console.error('[Firestore] Fallback também falhou:', e));
  });
  return unsubscribe;
};

export const fetchEvents = async (): Promise<CalendarEvent[]> => {
  const q = query(collection(db, COLLECTION));
  const snapshot = await getDocs(q);
  return sortByDate(snapshot.docs.map(mapEventDoc));
};

export const addEvent = async (event: Omit<CalendarEvent, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...event,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateEvent = async (id: string, fields: Partial<CalendarEvent>): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), { ...fields, updatedAt: Timestamp.now() });
};

export const deleteEvent = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};
