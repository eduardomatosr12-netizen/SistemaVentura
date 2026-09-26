import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from './firebase';

export const EMPLOYEE_ROLES = [
  'tecnico',
  'motorista',
  'decorador',
  'administrativo',
] as const;

export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  createdAt: string;
}

const COLLECTION = 'employees';

const mapEmployeeDoc = (d: { id: string; data: () => Record<string, unknown> }): Employee => {
  const data = d.data();
  const created = data.createdAt as { toDate?: () => Date } | undefined;
  return {
    id: d.id,
    name: String(data.name || ''),
    role: (data.role as EmployeeRole) || 'tecnico',
    createdAt: created?.toDate ? created.toDate().toISOString() : '',
  };
};

const sortByName = (items: Employee[]): Employee[] =>
  items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

/**
 * Live list of the crew, used to populate the team picker when creating or
 * editing an event. Errors are logged and degrade to an empty list so a
 * missing read permission can never break the calendar screen.
 */
export const subscribeEmployees = (callback: (employees: Employee[]) => void): (() => void) => {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    snapshot => {
      callback(sortByName(snapshot.docs.map(mapEmployeeDoc)));
    },
    err => {
      console.error('[Firestore] Erro no listener de funcionários:', err);
    },
  );
};
