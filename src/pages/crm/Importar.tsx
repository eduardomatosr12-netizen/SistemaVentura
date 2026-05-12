import { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, ArrowRight, Download, FileSpreadsheet } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { generateUUID } from '../../lib/uuid';
import { getBoards, saveBoards } from '../../lib/inventory';
import { useCRM } from '../../contexts/CRMContext';

const COLUMNS_BY_TYPE: Record<string, { headers: string[]; map: Record<string, string> }> = {
  Estoque: {
    headers: ['ITEM', 'CATEGORIA', 'QTD. ATUAL', 'ESTOQUE MÍNIMO', 'FORNECEDOR', 'ÚLTIMA ENTRADA', 'VALOR UNIT.'],
    map: {
      'ITEM': 'col-1',
      'CATEGORIA': 'col-2',
      'QTD. ATUAL': 'col-3',
      'ESTOQUE MÍNIMO': 'col-4',
      'FORNECEDOR': 'col-5',
      'ÚLTIMA ENTRADA': 'col-6',
      'VALOR UNIT.': 'col-7',
    },
  },
  Clientes: {
    headers: ['Nome', 'Email', 'Telefone', 'Instagram', 'Nicho', 'Origem'],
    map: {
      'Nome': 'nome',
      'Email': 'email',
      'Telefone': 'telefone',
      'Instagram': 'instagram',
      'Nicho': 'nicho',
      'Origem': 'origem',
    },
  },
  Orçamentos: {
    headers: ['Cliente', 'Cidade', 'Data', 'Valor', 'Categoria', 'Observações'],
    map: {
      'Cliente': 'cliente',
      'Cidade': 'cidade',
      'Data': 'data',
      'Valor': 'valor',
      'Categoria': 'categoria',
      'Observações': 'observacoes',
    },
  },
};

const CATEGORY_OPTIONS = ['Decoração', 'Móveis', 'Iluminação'];

const ROUTE_MAP: Record<string, string> = {
  Estoque: '/tarefas',
  Clientes: '/crm/orcamentos',
  Orçamentos: '/crm/orcamentos',
};

type ImportType = keyof typeof COLUMNS_BY_TYPE;

function parseCSVFile(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => resolve(results.data as Record<string, string>[]),
      error: (err) => reject(err),
    });
  });
}

function parseXLSXFile(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(firstSheet, { defval: '' }) as Record<string, string>[];
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsBinaryString(file);
  });
}

function generateSampleRow(headers: string[]): Record<string, string> {
  const samples: Record<string, string> = {
    'ITEM': 'Mesa Redonda',
    'CATEGORIA': 'Decoração',
    'QTD. ATUAL': '10',
    'ESTOQUE MÍNIMO': '2',
    'FORNECEDOR': 'Fornecedor A',
    'ÚLTIMA ENTRADA': '01/01/2026',
    'VALOR UNIT.': '150,00',
    'Nome': 'João Silva',
    'Email': 'joao@email.com',
    'Telefone': '11999999999',
    'Instagram': '@joaosilva',
    'Nicho': 'Odontologia',
    'Origem': 'Instagram',
    'Cliente': 'Maria Santos',
    'Cidade': 'São Paulo - SP',
    'Data': '15/06/2026',
    'Valor': 'R$ 5.000',
    'Categoria': 'Decoração',
    'Observações': 'Cliente solicitou orçamento',
  };
  const row: Record<string, string> = {};
  for (const h of headers) {
    row[h] = samples[h] ?? '';
  }
  return row;
}

function downloadCSV(headers: string[], filename: string) {
  const sampleRow = generateSampleRow(headers);
  const allRows = [headers, headers.map(h => sampleRow[h] || '')];
  const csv = allRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadXLSX(headers: string[], filename: string) {
  const sampleRow = generateSampleRow(headers);
  const data = [headers, headers.map(h => sampleRow[h] || '')];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function matchHeader(header: string, expected: string[]): string | null {
  const h = header.trim().toLowerCase();
  for (const exp of expected) {
    if (exp.toLowerCase() === h) return exp;
  }
  return null;
}

interface Toast {
  type: 'success' | 'error' | 'info';
  message: string;
  action?: { label: string; href: string };
}

const Importar = () => {
  const [selectedType, setSelectedType] = useState<ImportType>('Estoque');
  const [toast, setToast] = useState<Toast | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addLead } = useCRM();

  const showToast = (t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 8000);
  };

  const processEstoque = (rows: Record<string, string>[]) => {
    const config = COLUMNS_BY_TYPE.Estoque;
    const boards = getBoards();

    let inventoryBoard = boards.find((b) => b.id === 'board-1');
    if (!inventoryBoard) {
      inventoryBoard = {
        id: 'board-1',
        title: 'Inventário',
        color: '#B5FF03',
        columns: config.headers.map((h, i) => ({
          id: `col-${i + 1}`,
          title: h,
          type: i === 2 || i === 3 || i === 6 ? 'number' : i === 5 ? 'date' : 'text',
          width: 150,
        })),
        rows: [],
      };
      boards.push(inventoryBoard);
    }

    const newRows = rows.map((row) => {
      const values: Record<string, unknown> = {};
      for (const header of config.headers) {
        const colId = config.map[header];
        let raw = (row[header] ?? row[header.toLowerCase()] ?? '').toString().trim();

        if (colId === 'col-2') {
          const match = CATEGORY_OPTIONS.find((opt) => opt.toLowerCase() === raw.toLowerCase());
          raw = match || raw;
        }
        if (colId === 'col-3' || colId === 'col-4' || colId === 'col-7') {
          values[colId] = isNaN(parseFloat(raw.replace(',', '.'))) ? 0 : parseFloat(raw.replace(',', '.'));
        } else {
          values[colId] = raw;
        }
      }
      return { id: generateUUID(), values };
    });

    inventoryBoard.rows = [...(inventoryBoard.rows || []), ...newRows];
    saveBoards(boards);
    showToast({
      type: 'success',
      message: `${newRows.length} registros importados com sucesso em Estoque`,
      action: { label: 'Ver registros importados', href: ROUTE_MAP.Estoque },
    });
  };

  const processOrcamentos = (rows: Record<string, string>[], isCliente: boolean) => {
    const now = new Date().toISOString().slice(0, 10);

    const newRecords = rows.map((row) => {
      if (isCliente) {
        return {
          name: (row['Nome'] || row['nome'] || '').trim(),
          email: (row['Email'] || row['email'] || '').trim(),
          whatsapp: (row['Telefone'] || row['telefone'] || row['WhatsApp'] || row['whatsapp'] || '').trim(),
          instagram: (row['Instagram'] || row['instagram'] || '').trim(),
          niche: (row['Nicho'] || row['nicho'] || '').trim(),
          origin: (row['Origem'] || row['origem'] || '').trim(),
          stage: 'Novos Orçamentos',
          firstContact: now,
          closingDate: '',
          followUpReminder: '',
          address: '',
          notes: '',
          value: '',
        };
      }

      return {
        name: (row['Cliente'] || row['cliente'] || row['Nome'] || row['nome'] || '').trim(),
        address: (row['Cidade'] || row['cidade'] || '').trim(),
        firstContact: (row['Data'] || row['data'] || now).trim(),
        value: (row['Valor'] || row['valor'] || '').trim(),
        notes: (row['Observações'] || row['observacoes'] || '').trim(),
        niche: (row['Categoria'] || row['categoria'] || '').trim(),
        stage: 'Novos Orçamentos',
        email: '',
        whatsapp: '',
        instagram: '',
        origin: '',
        closingDate: '',
        followUpReminder: '',
      };
    });

    for (const record of newRecords) {
      addLead(record);
    }

    showToast({
      type: 'success',
      message: `${newRecords.length} registros importados com sucesso em ${isCliente ? 'Clientes' : 'Orçamentos'}`,
      action: { label: 'Ver registros importados', href: ROUTE_MAP.Orçamentos },
    });
  };

  const validateHeaders = (rows: Record<string, string>[], expected: string[]): string | null => {
    if (rows.length === 0) return 'Arquivo vazio.';
    const fileHeaders = Object.keys(rows[0]).map((h) => h.trim().toLowerCase());
    const required = expected.map((h) => h.toLowerCase());
    const matched = required.filter((r) => fileHeaders.includes(r));
    if (matched.length < Math.ceil(required.length * 0.6)) {
      return `Os cabeçalhos do arquivo não correspondem ao tipo "${selectedType}". Esperado: ${expected.join(', ')}`;
    }
    return null;
  };

  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx') {
      showToast({ type: 'error', message: 'Formato não suportado. Use .csv ou .xlsx.' });
      return;
    }

    setIsProcessing(true);
    try {
      const rows: Record<string, string>[] = ext === 'csv' ? await parseCSVFile(file) : await parseXLSXFile(file);
      if (!rows || rows.length === 0) {
        showToast({ type: 'error', message: 'Arquivo vazio ou formato inválido.' });
        return;
      }

      const config = COLUMNS_BY_TYPE[selectedType];
      const validationError = validateHeaders(rows, config.headers);
      if (validationError) {
        showToast({ type: 'error', message: validationError });
        return;
      }

      if (selectedType === 'Estoque') {
        processEstoque(rows);
      } else if (selectedType === 'Clientes') {
        processOrcamentos(rows, true);
      } else if (selectedType === 'Orçamentos') {
        processOrcamentos(rows, false);
      }
    } catch {
      showToast({ type: 'error', message: 'Erro ao processar o arquivo.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] p-2 md:p-8">
      <div className="mb-4 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Importar Dados</h1>
        <p className="text-neutral-400 text-xs md:text-sm">Selecione o tipo de importação e envie seu arquivo.</p>
      </div>

      {toast && (
        <div
          className={`fixed top-6 right-6 z-[200] flex items-center gap-4 px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-top-2 fade-in duration-300 ${
            toast.type === 'success'
              ? 'bg-[#1a1a1a] border border-[#B5FF03]'
              : toast.type === 'error'
              ? 'bg-[#1a1a1a] border border-red-500'
              : 'bg-[#1a1a1a] border border-[#B5FF03]'
          }`}
        >
          <div className="flex items-center gap-3 flex-1">
            {toast.type === 'success' ? (
              <CheckCircle size={20} className="text-[#B5FF03]" />
            ) : (
              <AlertCircle size={20} className="text-red-400" />
            )}
            <span className={`text-sm font-bold ${toast.type === 'success' ? 'text-[#B5FF03]' : 'text-red-400'}`}>
              {toast.message}
            </span>
          </div>
          {toast.action && (
            <a
              href={toast.action.href}
              className="flex items-center gap-1 px-4 py-2 bg-[#B5FF03] text-black rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-[#a1e600] transition-all shrink-0"
            >
              {toast.action.label}
              <ArrowRight size={14} />
            </a>
          )}
        </div>
      )}

      <div className="max-w-2xl space-y-8">
        <div className="bg-[#111] border border-[#333] rounded-2xl p-6">
          <h3 className="text-[10px] font-black text-[#B5FF03] uppercase tracking-widest mb-4">Tipo de Importação</h3>
          <div className="flex flex-wrap gap-3">
            {Object.keys(COLUMNS_BY_TYPE).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type as ImportType)}
                className={
                  'px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ' +
                  (selectedType === type
                    ? 'bg-[#B5FF03] text-black'
                    : 'bg-[#1a1a1a] text-neutral-400 border border-[#333] hover:border-[#B5FF03]')
                }
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#111] border border-[#333] rounded-2xl p-6">
          <h3 className="text-[10px] font-black text-[#B5FF03] uppercase tracking-widest mb-4">Baixar Modelo de Planilha</h3>
          <p className="text-xs text-neutral-400 mb-4">
            Baixe um arquivo modelo com os cabeçalhos corretos para o tipo selecionado.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                const config = COLUMNS_BY_TYPE[selectedType];
                downloadCSV(config.headers, `modelo_${selectedType.toLowerCase()}`);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-xs font-bold text-neutral-300 hover:text-white hover:border-[#B5FF03] transition-all"
            >
              <Download size={14} /> CSV
            </button>
            <button
              onClick={() => {
                const config = COLUMNS_BY_TYPE[selectedType];
                downloadXLSX(config.headers, `modelo_${selectedType.toLowerCase()}`);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-xs font-bold text-neutral-300 hover:text-white hover:border-[#B5FF03] transition-all"
            >
              <FileSpreadsheet size={14} /> XLSX
            </button>
          </div>
          <div className="mt-4 p-3 bg-[#0a0a0a] border border-[#222] rounded-xl">
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Colunas do modelo:</p>
            <div className="flex flex-wrap gap-1.5">
              {COLUMNS_BY_TYPE[selectedType].headers.map(h => (
                <span key={h} className="px-2 py-1 bg-[#222] rounded text-[10px] font-medium text-neutral-400">
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="w-full bg-[#0a0a0a] border-2 border-dashed border-[#333] rounded-2xl p-16 text-center cursor-pointer hover:border-[#B5FF03] transition-all group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            onChange={handleInputChange}
            className="hidden"
          />
          <div className="w-16 h-16 bg-[#111] rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-[#222] transition-all">
            <Upload className="w-6 h-6 text-[#B5FF03] transition-colors" />
          </div>
          <h3 className="text-white font-black text-xl mb-2">
            {isProcessing ? 'Processando...' : 'Clique ou arraste o arquivo CSV'}
          </h3>
          <p className="text-neutral-400 text-sm font-bold">Formatos suportados: .csv, .xlsx</p>
        </button>

      </div>
    </div>
  );
};

export default Importar;
