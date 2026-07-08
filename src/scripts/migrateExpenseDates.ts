import {
  collection, getDocs, query, where, doc, updateDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase';

export async function migrateExpenseDates() {
  const transacoesRef = collection(db, 'transacoes');
  const eventsRef = collection(db, 'events');

  const despesasSnap = await getDocs(query(
    transacoesRef,
    where('type', '==', 'despesa'),
    where('origemEventoId', '!=', ''),
  ));

  const eventsSnap = await getDocs(eventsRef);
  const eventsMap = new Map<string, string>();
  eventsSnap.forEach(d => {
    const data = d.data();
    if (data.date) {
      eventsMap.set(d.id, data.date);
    }
  });

  let updated = 0;
  let skipped = 0;

  const promises: Promise<void>[] = [];

  despesasSnap.forEach(d => {
    const data = d.data();
    const eventId = data.origemEventoId as string | undefined;
    if (!eventId) { skipped++; return; }

    const eventDate = eventsMap.get(eventId);
    if (!eventDate) { skipped++; return; }

    if (data.date !== eventDate) {
      const ref = doc(db, 'transacoes', d.id);
      promises.push(
        updateDoc(ref, { date: eventDate, updatedAt: new Date() }).then(() => {
          updated++;
          console.log(`[Migração] ${d.id}: data "${data.date}" → "${eventDate}"`);
        }),
      );
    } else {
      skipped++;
    }
  });

  await Promise.all(promises);
  console.log(`[Migração] Concluída! ${updated} atualizada(s), ${skipped} ignorada(s).`);
  return { updated, skipped };
}
