import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { WhatsAppTemplate } from '../lib/whatsappTemplates';

const COLLECTION = 'whatsapp_templates';

const DEFAULT_TEMPLATES: WhatsAppTemplate[] = [
  { id: 'default-1', name: 'Saudação', message: 'Olá {nome}! Tudo bem? Aqui é {responsavel} da {empresa}. Gostaria de conversar sobre o seu evento. Pode falar agora?', active: true, order: 0 },
  { id: 'default-2', name: 'Envio de proposta', message: 'Olá {nome}! Preparei uma proposta para o evento *{evento}* no dia {data_evento}. O investimento total é de *{valor}*. Posso te enviar os detalhes completos?', active: true, order: 1 },
  { id: 'default-3', name: 'Acompanhamento', message: 'Oi {nome}, tudo bem? Estou passando para saber se você teve a oportunidade de analisar nossa proposta para o {evento}. Ficou com alguma dúvida?', active: true, order: 2 },
];

export const subscribeTemplates = (callback: (templates: WhatsAppTemplate[]) => void): (() => void) => {
  const q = query(collection(db, COLLECTION), orderBy('order'));
  const unsubscribe = onSnapshot(q, snapshot => {
    if (snapshot.empty) {
      seedDefaults().then(() => {
        callback(getTemplatesFromSnapshot(snapshot));
      }).catch(() => {});
      return;
    }
    callback(getTemplatesFromSnapshot(snapshot));
  }, err => console.error('[Firestore] Erro no listener de templates:', err));
  return unsubscribe;
};

const getTemplatesFromSnapshot = (snapshot: any): WhatsAppTemplate[] =>
  snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })) as WhatsAppTemplate[];

export const fetchTemplates = async (): Promise<WhatsAppTemplate[]> => {
  const q = query(collection(db, COLLECTION), orderBy('order'));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    await seedDefaults();
    return DEFAULT_TEMPLATES;
  }
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as WhatsAppTemplate[];
};

const seedDefaults = async (): Promise<void> => {
  for (const tpl of DEFAULT_TEMPLATES) {
    await addDoc(collection(db, COLLECTION), { ...tpl, createdAt: Timestamp.now() });
  }
};

const generateId = (): string => crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);

export const addTemplate = async (input: { name: string; message: string; active?: boolean }): Promise<string> => {
  const templates = await fetchTemplates();
  const docRef = await addDoc(collection(db, COLLECTION), {
    id: generateId(),
    name: input.name,
    message: input.message,
    active: input.active ?? true,
    order: templates.length,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateTemplate = async (id: string, updates: Partial<WhatsAppTemplate>): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), { ...updates, updatedAt: Timestamp.now() });
};

export const deleteTemplate = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};

export const duplicateTemplate = async (id: string): Promise<WhatsAppTemplate | null> => {
  const q = query(collection(db, COLLECTION), orderBy('order'));
  const snapshot = await getDocs(q);
  const source = snapshot.docs.find(d => d.id === id);
  if (!source) return null;
  const data = source.data() as WhatsAppTemplate;
  const templates = snapshot.docs.map(d => d.data() as WhatsAppTemplate);
  const duplicate: WhatsAppTemplate = {
    ...data,
    id: generateId(),
    name: `${data.name} (cópia)`,
    order: templates.length,
  };
  const docRef = await addDoc(collection(db, COLLECTION), { ...duplicate, createdAt: Timestamp.now() });
  return { ...duplicate, id: docRef.id };
};

export const reorderTemplates = async (ids: string[]): Promise<void> => {
  for (let i = 0; i < ids.length; i++) {
    await updateDoc(doc(db, COLLECTION, ids[i]), { order: i, updatedAt: Timestamp.now() });
  }
};

export const moveTemplateUp = async (id: string): Promise<void> => {
  const q = query(collection(db, COLLECTION), orderBy('order'));
  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  const idx = docs.findIndex(d => d.id === id);
  if (idx <= 0) return;
  const currentOrder = docs[idx].data().order;
  const prevOrder = docs[idx - 1].data().order;
  await updateDoc(doc(db, COLLECTION, id), { order: prevOrder, updatedAt: Timestamp.now() });
  await updateDoc(doc(db, COLLECTION, docs[idx - 1].id), { order: currentOrder, updatedAt: Timestamp.now() });
};

export const moveTemplateDown = async (id: string): Promise<void> => {
  const q = query(collection(db, COLLECTION), orderBy('order'));
  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  const idx = docs.findIndex(d => d.id === id);
  if (idx === -1 || idx >= docs.length - 1) return;
  const currentOrder = docs[idx].data().order;
  const nextOrder = docs[idx + 1].data().order;
  await updateDoc(doc(db, COLLECTION, id), { order: nextOrder, updatedAt: Timestamp.now() });
  await updateDoc(doc(db, COLLECTION, docs[idx + 1].id), { order: currentOrder, updatedAt: Timestamp.now() });
};
