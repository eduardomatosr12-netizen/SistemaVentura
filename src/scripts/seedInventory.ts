import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { generateUUID } from '../lib/uuid';

const BOARD_ID = 'board-1';

const COLUMNS = [
  { id: 'col-1', title: 'ITEM', type: 'text', width: 250 },
  { id: 'col-2', title: 'CATEGORIA', type: 'status', width: 150 },
  { id: 'col-3', title: 'QTD. ATUAL', type: 'number', width: 140 },
  { id: 'col-4', title: 'ESTOQUE', type: 'number', width: 130 },
  { id: 'col-5', title: 'FORNECEDOR', type: 'text', width: 200 },
  { id: 'col-6', title: 'ÚLTIMA ENTRADA', type: 'date', width: 130 },
  { id: 'col-7', title: 'VALOR UNIT.', type: 'number', width: 120 },
];

interface SeedItem {
  item: string;
  qtdAtual: number;
  estoque: number;
  fornecedor: string;
  valorUnit: number;
}

const ITEMS: SeedItem[] = [
  { item: 'Painel de Led P3.9 LPS Curvo (50x100)', qtdAtual: 9, estoque: 18, fornecedor: 'LPG', valorUnit: 75 },
  { item: 'Par Led 60 Led 3w Rgb Triled', qtdAtual: 49, estoque: 50, fornecedor: 'Mercado Livre', valorUnit: 25 },
  { item: 'Varal de Lampada Comum (66 Lâmpadas)', qtdAtual: 3, estoque: 1, fornecedor: 'Mercado Livre', valorUnit: 200 },
  { item: 'Varal de Lampada Japonesa (66 Lâmpadas)', qtdAtual: 3, estoque: 1, fornecedor: 'Mercado Livre', valorUnit: 300 },
  { item: 'Som - Medio', qtdAtual: 2, estoque: 2, fornecedor: 'Power System', valorUnit: 175 },
  { item: 'Som - Grave', qtdAtual: 1, estoque: 2, fornecedor: 'Power System', valorUnit: 175 },
  { item: 'Som Completo (Banda)', qtdAtual: 1, estoque: 1, fornecedor: 'Power System', valorUnit: 750 },
  { item: 'Som Completo (DJ/Evento)', qtdAtual: 1, estoque: 1, fornecedor: 'Power System', valorUnit: 400 },
  { item: 'Piso Palco Praticáveis (100x200x)', qtdAtual: 9, estoque: 9, fornecedor: 'Pernambuco Estruturas', valorUnit: 80 },
  { item: 'Cabine Fotografica Infinite', qtdAtual: 1, estoque: 1, fornecedor: 'Maxi Grua', valorUnit: 500 },
  { item: 'Seta de Led', qtdAtual: 5, estoque: 1, fornecedor: 'Maxi Grua', valorUnit: 200 },
  { item: 'Totem de Led P3.9 (100x200)', qtdAtual: 40, estoque: 4, fornecedor: 'LPG', valorUnit: 300 },
  { item: 'Piso Paris Galáxia', qtdAtual: 1, estoque: 16, fornecedor: 'Milleto', valorUnit: 50 },
  { item: 'Moving Beem 14R LPG', qtdAtual: 0, estoque: 4, fornecedor: 'LPG', valorUnit: 150 },
  { item: 'Refletor Holofote Super Led 50w - BR', qtdAtual: 0, estoque: 0, fornecedor: 'Ipojuca - Caruaru', valorUnit: 25 },
  { item: 'Refletor Par 38', qtdAtual: 0, estoque: 20, fornecedor: 'Mercado Livre', valorUnit: 25 },
  { item: 'Refletor Holofote Led 30W - PT', qtdAtual: 0, estoque: 24, fornecedor: 'Mercado Livre', valorUnit: 25 },
  { item: 'Refletor Holofote Led 30W - BR', qtdAtual: 0, estoque: 12, fornecedor: 'Mercado Livre', valorUnit: 25 },
  { item: 'Refletor Holofote Led 200w - PT', qtdAtual: 0, estoque: 30, fornecedor: 'Mercado Livre', valorUnit: 25 },
  { item: 'Gride Alumínio P25 (Mt)', qtdAtual: 0, estoque: 40, fornecedor: 'One Light', valorUnit: 30 },
  { item: 'Show DJ', qtdAtual: 0, estoque: 1, fornecedor: 'Ventura', valorUnit: 800 },
  { item: 'Jatos CO2', qtdAtual: 0, estoque: 4, fornecedor: 'Pirulito Recife', valorUnit: 400 },
  { item: 'Efeitos Pirotécnicos', qtdAtual: 0, estoque: 10, fornecedor: 'Casa do Fogueteiro - Caruaru', valorUnit: 0 },
];

export const seedInventory = async () => {
  const rows = ITEMS.map(item => ({
    id: generateUUID(),
    values: {
      'col-1': item.item,
      'col-2': '',
      'col-3': item.qtdAtual,
      'col-4': item.estoque,
      'col-5': item.fornecedor,
      'col-6': '',
      'col-7': item.valorUnit,
    },
    lastModifiedBy: 'Administrador',
  }));

  const boardData = {
    title: 'Inventário de Itens',
    color: '#3b82f6',
    columns: COLUMNS,
    rows,
    updatedAt: Timestamp.now(),
  };

  await setDoc(doc(db, 'inventory_boards', BOARD_ID), boardData);
  console.log(`Seed concluído: ${rows.length} itens salvos em inventory_boards/${BOARD_ID}`);
  return boardData;
};
