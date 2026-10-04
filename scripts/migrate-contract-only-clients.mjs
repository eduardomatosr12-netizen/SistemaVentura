#!/usr/bin/env node
/**
 * Migração: separa "orçamento" de "cliente com contrato".
 *
 * Nova regra do sistema:
 *   - Orçamento/evento SEM contrato vive apenas no Calendário (`events`).
 *   - Orçamento NUNCA cria cliente.
 *   - O cliente nasce em `leads` quando o contrato é emitido (aba Emissão do
 *     Contrato), com CPF, RG e endereço, e fica listado em `/clientes`.
 *
 * O que o script faz:
 *   1. `events`: para cada evento que emitiu contrato, cria/atualiza o lead
 *      correspondente em `leads` com `eventoId` e os dados do contrato.
 *   2. `events`: remove `clientEmail` de todos os documentos.
 *   3. `events`: remove clientCpf, clientRg, clientAddress e clientGender dos
 *      eventos que NÃO emitiram contrato.
 *   4. `events`: garante `clientId` apontando para o lead criado.
 *   5. `leads`: remove leads de orçamento (sem contrato e sem evento
 *      contratado) — somente com --delete-orphan-leads.
 *   6. `leads`: normaliza os leads Newly importados para o formato atual.
 *
 * Como saber se um evento emitiu contrato:
 *   Por padrão, considera emitido o evento que tem algum serviço de contrato
 *   escolhido (contractServices não vazio) OU status evento_confirmado /
 *   evento_concluido. Ajuste com --status=<lista> ou --keep-services=<false|true>.
 *
 * Uso:
 *   node scripts/migrate-contract-only-clients.mjs                      # dry-run
 *   node scripts/migrate-contract-only-clients.mjs --apply              # grava
 *   node scripts/migrate-contract-only-clients.mjs --apply --delete-orphan-leads
 *                                                                    # apaga leads
 *                                                                    # de orçamento
 *   node scripts/migrate-contract-only-clients.mjs --apply --clear-lead-email
 *                                                                    # apaga leads.email
 *
 *IMPORTANTE: rode primeiro sem --apply e confira o relatório. --delete-orphan-leads
 * é irreversível.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { initializeApp } from 'firebase/app';
import {
  addDoc, collection, deleteDoc, deleteField, doc, getDocs, setDoc, updateDoc,
} from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Lê o .env sem depender do dotenv (que não está no package.json). */
function loadEnv() {
  const env = {};
  let raw;
  try {
    raw = readFileSync(resolve(ROOT, '.env'), 'utf8');
  } catch {
    return env;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const flagValue = (name) => {
  const found = args.find(a => a.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : undefined;
};

const APPLY = hasFlag('--apply');
const KEEP_SERVICES = flagValue('--keep-services') !== 'false';
const DELETE_ORPHAN_LEADS = hasFlag('--delete-orphan-leads');
const CLEAR_LEAD_EMAIL = hasFlag('--clear-lead-email');

const CLOSED_STATUSES = new Set(
  (flagValue('--status') ?? 'evento_confirmado,evento_concluido')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
);

const EVENT_ALWAYS_FIELDS = ['clientEmail'];
const EVENT_CONTRACT_FIELDS = ['clientCpf', 'clientRg', 'clientAddress', 'clientGender'];
const LEAD_EMAIL_FIELDS = CLEAR_LEAD_EMAIL ? ['email'] : [];

const env = { ...loadEnv() };
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Configuração do Firebase ausente. Verifique o .env na raiz do projeto.');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/** Um evento "emitiu contrato" se tiver serviço escolhido ou status fechado. */
function hasContract(event) {
  const services = Array.isArray(event.contractServices) ? event.contractServices : [];
  if (KEEP_SERVICES && services.length > 0) return true;
  return CLOSED_STATUSES.has(event.status);
}

const hasAny = (data, fields) =>
  fields.some(f => data[f] !== undefined && data[f] !== null && data[f] !== '');

const formatBRL = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Payload do lead de contrato, equivalente ao que o app grava ao salvar o contrato. */
function buildContractLead(event) {
  const today = new Date().toISOString().split('T')[0];
  // `valorTotal` do evento já é líquido: o desconto foi abatido ao salvar.
  const total = Math.max(0, Number(event.valorTotal || 0));
  const services = Array.isArray(event.contractServices) ? event.contractServices : [];
  const notes = [event.description || '', services.length > 0 ? `Serviços: ${services.join(', ')}` : '']
    .filter(Boolean)
    .join(' • ');

  return {
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
    notes,
    value: formatBRL(total),
    items: Array.isArray(event.items) ? event.items : [],
    lastModifiedBy: 'migracao',
    eventoId: event.id,
    cpf: event.clientCpf || '',
    rg: event.clientRg || '',
    clientAddress: event.clientAddress || '',
    clientGender: event.clientGender || '',
  };
}

const eventsSnapshot = await getDocs(collection(db, 'events'));
const leadsSnapshot = await getDocs(collection(db, 'leads'));

const events = eventsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
const leads = leadsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

const leadsByEventId = new Map();
for (const lead of leads) {
  if (lead.eventoId) leadsByEventId.set(lead.eventoId, lead);
}

const plan = [];

for (const event of events) {
  const contracted = hasContract(event);
  const existing = leadsByEventId.get(event.id);

  if (contracted) {
    const payload = buildContractLead(event);
    if (existing) {
      plan.push({
        action: 'updateLead',
        collection: 'leads',
        id: existing.id,
        label: existing.name || event.client || event.id,
        event: event.id,
        payload,
      });
    } else {
      plan.push({
        action: 'createLead',
        collection: 'leads',
        label: payload.name,
        event: event.id,
        payload,
      });
    }

    if (event.clientId !== existing?.id) {
      plan.push({
        action: 'linkEvent',
        collection: 'events',
        id: event.id,
        label: event.title || event.client || event.id,
        status: event.status || '',
        fields: { clientId: existing?.id ?? '@novoLeadId' },
      });
    }
  }

  const fields = [
    ...EVENT_ALWAYS_FIELDS.filter(f => hasAny(event, [f])),
    ...(contracted ? [] : EVENT_CONTRACT_FIELDS.filter(f => hasAny(event, [f]))),
  ];
  if (fields.length > 0) {
    plan.push({
      action: 'stripFields',
      collection: 'events',
      id: event.id,
      label: event.title || event.client || event.id,
      status: event.status || '',
      fields,
    });
  }
}

const contractedEventIds = new Set(events.filter(hasContract).map(e => e.id));

for (const lead of leads) {
  const linkedToContract = (lead.eventoId && contractedEventIds.has(lead.eventoId)) || lead.stage === 'Contrato Fechado';

  if (!linkedToContract) {
    if (DELETE_ORPHAN_LEADS) {
      plan.push({
        action: 'deleteLead',
        collection: 'leads',
        id: lead.id,
        label: lead.name || lead.id,
        status: lead.stage || '',
        fields: [],
      });
    }
    continue;
  }

  const fields = LEAD_EMAIL_FIELDS.filter(f => hasAny(lead, [f]));
  if (fields.length > 0) {
    plan.push({
      action: 'stripFields',
      collection: 'leads',
      id: lead.id,
      label: lead.name || lead.id,
      status: lead.stage || '',
      fields,
    });
  }
}

const contractedCount = events.filter(hasContract).length;
console.log(APPLY
  ? 'MODO APLICAÇÃO — as alterações abaixo serão gravadas no Firestore.'
  : 'MODO DRY-RUN — nenhuma alteração será gravada. Use --apply para executar.');
console.log(`Eventos analisados: ${events.length} (com contrato: ${contractedCount})`);
console.log(`Leads analisados: ${leads.length}`);
console.log(`Critério de "contrato emitido": contractServices não vazio (${KEEP_SERVICES ? 'sim' : 'não'}) ou status em [${[...CLOSED_STATUSES].join(', ')}]`);
console.log(`Leads de orçamento sem contrato: ${DELETE_ORPHAN_LEADS ? 'SERÃO APAGADOS' : 'mantidos (use --delete-orphan-leads para apagar)'}`);
console.log('');

if (plan.length === 0) {
  console.log('Nada a fazer: a base já está no formato "somente clientes com contrato".');
  process.exit(0);
}

const orphans = plan.filter(p => p.action === 'deleteLead').length;
const created = plan.filter(p => p.action === 'createLead').length;
const updated = plan.filter(p => p.action === 'updateLead').length;

console.log(`${plan.length} operação(ões) planejada(s):`);
console.log(`  ${created} lead(s) criado(s) a partir de evento com contrato`);
console.log(`  ${updated} lead(s) atualizado(s)`);
console.log(`  ${orphans} lead(s) de orçamento que serão apagados`);
console.log('');

for (const item of plan) {
  const head = `  [${item.action}] ${item.collection}/${item.id ?? '(novo)'}  "${item.label}"${item.status ? ` [${item.status}]` : ''}`;
  console.log(head);
  if (item.action === 'stripFields') console.log(`      remove: ${item.fields.join(', ')}`);
  if (item.action === 'linkEvent') console.log('      define: clientId');
}

console.log('');

if (!APPLY) {
  console.log('Dry-run concluído. Nenhum dado foi alterado.');
  console.log('Para gravar: node scripts/migrate-contract-only-clients.mjs --apply');
  process.exit(0);
}

let applied = 0;
const newLeadIdByEventId = new Map();

for (const item of plan) {
  if (item.action === 'createLead') {
    const createdDoc = await addDoc(collection(db, 'leads'), item.payload);
    newLeadIdByEventId.set(item.event, createdDoc.id);
    applied++;
    continue;
  }

  if (item.action === 'updateLead') {
    await setDoc(doc(db, 'leads', item.id), item.payload, { merge: true });
    newLeadIdByEventId.set(item.event, item.id);
    applied++;
    continue;
  }

  if (item.action === 'linkEvent') {
    const clientId = item.fields.clientId === '@novoLeadId'
      ? newLeadIdByEventId.get(item.event)
      : item.fields.clientId;
    if (!clientId) continue;
    await updateDoc(doc(db, 'events', item.id), { clientId });
    applied++;
    continue;
  }

  if (item.action === 'stripFields') {
    const update = Object.fromEntries(item.fields.map(f => [f, deleteField()]));
    await updateDoc(doc(db, item.collection, item.id), update);
    applied++;
    continue;
  }

  if (item.action === 'deleteLead') {
    await deleteDoc(doc(db, 'leads', item.id));
    applied++;
  }
}

console.log(`Concluído: ${applied} operação(ões) aplicada(s).`);