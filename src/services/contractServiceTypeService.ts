import {
  collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export interface ContractServiceType {
  id: string;
  name: string;
}

/**
 * Serviços que já vêm prontos na emissão do contrato. Os que o usuário cadastra
 * ficam no Firestore e são somados a esta lista.
 */
export const PRESET_CONTRACT_SERVICES = [
  'Iluminação Cênica',
  'Estrutura de Palco',
  'Efeitos de Fogos',
  'Áudio e Som',
  'Projeção e Vídeo',
  'Show ao Vivo',
] as const;

const COLLECTION = 'contract_service_types';

const mapDoc = (d: { id: string; data: () => Record<string, unknown> }): ContractServiceType => ({
  id: d.id,
  name: String(d.data().name || '').trim(),
});

const sortByName = (items: ContractServiceType[]): ContractServiceType[] =>
  items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

/** Une os presets com os cadastrados, sem duplicar por nome (ignora maiúsculas). */
export const mergeServiceNames = (presets: readonly string[], custom: ContractServiceType[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...presets, ...custom.map(c => c.name)]) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
};

export const subscribeContractServiceTypes = (callback: (items: ContractServiceType[]) => void): (() => void) => {
  const q = query(collection(db, COLLECTION), orderBy('name'));
  const unsubscribe = onSnapshot(q, snapshot => {
    callback(sortByName(snapshot.docs.map(mapDoc).filter(item => item.name)));
  }, err => {
    console.error('[Firestore] Erro no listener de tipos de serviço do contrato:', err);
  });
  return unsubscribe;
};

export const fetchContractServiceTypes = async (): Promise<ContractServiceType[]> => {
  const q = query(collection(db, COLLECTION), orderBy('name'));
  const snapshot = await getDocs(q);
  return sortByName(snapshot.docs.map(mapDoc).filter(item => item.name));
};

export const addContractServiceType = async (name: string): Promise<string> => {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Informe o nome do serviço.');
  const docRef = await addDoc(collection(db, COLLECTION), {
    name: trimmed,
    createdAt: Timestamp.now(),
  });
  console.log('[Firestore] Tipo de serviço do contrato criado:', docRef.id, trimmed);
  return docRef.id;
};

export const deleteContractServiceType = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTION, id));
    console.log('[Firestore] Tipo de serviço do contrato excluído:', id);
  } catch (err) {
    console.error('[Firestore] Erro ao excluir tipo de serviço do contrato:', id, err);
    throw err;
  }
};
