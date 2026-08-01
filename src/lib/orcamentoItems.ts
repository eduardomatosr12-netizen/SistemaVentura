export interface OrcamentoItemInfo {
  name: string;
  category: string;
  valorUnit: number;
}

// Catálogo específico de itens para orçamentos de eventos.
// Esta lista é INDEPENDENTE do estoque/inventário: mudanças no estoque
// não afetam os itens disponíveis na criação de eventos.
//
// TODO: preencher com a nova lista de itens para orçamentos.
const ORCAMENTO_ITEMS: OrcamentoItemInfo[] = [];

export const getAllOrcamentoItems = (): OrcamentoItemInfo[] => ORCAMENTO_ITEMS;
