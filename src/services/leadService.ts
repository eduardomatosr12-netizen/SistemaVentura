import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Lead } from '../contexts/CRMContext';
import { generateUUID } from '../lib/uuid';

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
    } as Lead;
  });
};

export const addLead = async (lead: Omit<Lead, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...lead,
    firstContact: lead.firstContact || new Date().toISOString().split('T')[0],
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateLead = async (id: string, fields: Partial<Lead>): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), { ...fields, updatedAt: Timestamp.now() });
};

export const deleteLead = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};

export const updateLeadStage = async (id: string, stage: string): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), { stage, updatedAt: Timestamp.now() });
};
