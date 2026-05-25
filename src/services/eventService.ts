import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { CalendarEvent } from '../contexts/CRMContext';

const COLLECTION = 'events';

export const fetchEvents = async (): Promise<CalendarEvent[]> => {
  const q = query(collection(db, COLLECTION), orderBy('date'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => {
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
    } as CalendarEvent;
  });
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
