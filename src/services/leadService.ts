import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Lead } from '../types/crm';
import { validateAndCleanLead } from '../lib/dataValidator';
import type { ValidationResult } from '../lib/dataValidator';
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
      cpf: data.cpf || '',
      rg: data.rg || '',
      clientAddress: data.clientAddress || '',
      clientGender: data.clientGender || '',
    } as Lead;
  });
};

export const addLead = async (lead: Omit<Lead, 'id'>): Promise<string> => {
  try {
    const result: ValidationResult<Lead> = validateAndCleanLead({
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
    const result: ValidationResult<Lead> = validateAndCleanLead({ ...fields, id });
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
