import { useState, useRef } from 'react';
import { Upload, Download, CheckCircle, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { generateUUID } from '../../lib/uuid';

const COLUMN_MAP: Record<string, string> = {
  'ITEM': 'col-1',
  'CATEGORIA': 'col-2',
  'QTD. ATUAL': 'col-3',
  'ESTOQUE MÍNIMO': 'col-4',
  'FORNECEDOR': 'col-5',
  'ÚLTIMA ENTRADA': 'col-6',
  'VALOR UNIT.': 'col-7',
};

const CATEGORY_OPTIONS = ['Decoração', 'Móveis', 'Iluminação'];

function generateCSVTemplate(): string {
  const headers = Object.keys(COLUMN_MAP);
  const sampleRow = [
    'Mesa de Centro',
    'Móveis',
    '10',
    '5',
    'Móveis LTDA',
    '2026-05-01',
    '850,00',
  ];
  return [headers.join(','), sampleRow.join(',')].join('\n');
}

function downloadCSV() {
  const csv = generateCSVTemplate();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'modelo_estoque.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

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

interface Toast {
  type: 'success' | 'error';
  message: string;
}

const Importar = () => {
  const [selectedType, setSelectedType] = useState('Estoque');
  const [toast, setToast] = useState<Toast | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: Toast['type'], message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const processRows = (rows: Record<string, string>[]) => {
    const storageKey = 'axium_boards_v3';
    const stored = localStorage.getItem(storageKey);
    const boards = stored ? JSON.parse(stored) : [];

    const inventoryBoard = boards.find((b: { id: string }) => b.id === 'board-1');
    if (!inventoryBoard) {
      showToast('error', 'Board de inventário não encontrado.');
      return;
    }

    const colKeys = Object.keys(COLUMN_MAP);
    const newRows = rows.map((row) => {
      const values: Record<string, unknown> = {};
      for (const header of colKeys) {
        const colId = COLUMN_MAP[header];
        let raw = (row[header] ?? row[header.toLowerCase()] ?? '').toString().trim();

        if (colId === 'col-2') {
          const match = CATEGORY_OPTIONS.find(
            (opt) => opt.toLowerCase() === raw.toLowerCase()
          );
          raw = match || raw;
        }
        if (colId === 'col-3' || colId === 'col-4' || colId === 'col-7') {
          const num = parseFloat(raw.replace(',', '.'));
          values[colId] = isNaN(num) ? 0 : num;
        } else {
          values[colId] = raw;
        }
      }
      return { id: generateUUID(), values };
    });

    inventoryBoard.rows = [...(inventoryBoard.rows || []), ...newRows];
    localStorage.setItem(storageKey, JSON.stringify(boards));
    showToast('success', `${newRows.length} item(ns) importado(s) com sucesso!`);
  };

  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext !== 'csv' && ext !== 'xlsx') {
      showToast('error', 'Formato não suportado. Use .csv ou .xlsx.');
      return;
    }

    setIsProcessing(true);
    try {
      let rows: Record<string, string>[];
      if (ext === 'csv') {
        rows = await parseCSVFile(file);
      } else {
        rows = await parseXLSXFile(file);
      }

      if (!rows || rows.length === 0) {
        showToast('error', 'Arquivo vazio ou formato inválido.');
        setIsProcessing(false);
        return;
      }

      processRows(rows);
    } catch {
      showToast('error', 'Erro ao importar o arquivo.');
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
        <p className="text-neutral-400 text-xs md:text-sm">Selecione o tipo de importação e envie seu arquivo CSV.</p>
      </div>

      {toast && (
        <div
          className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-top-2 fade-in duration-300 ${
            toast.type === 'success'
              ? 'bg-[#1a1a1a] border border-[#B5FF03] text-[#B5FF03]'
              : 'bg-[#1a1a1a] border border-red-500 text-red-400'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}

      <div className="max-w-2xl space-y-8">
        <div className="bg-[#111] border border-[#333] rounded-2xl p-6">
          <h3 className="text-[10px] font-black text-[#B5FF03] uppercase tracking-widest mb-4">Tipo de Importação</h3>
          <div className="flex flex-wrap gap-3">
            {['Estoque', 'Clientes', 'Equipamentos', 'Orçamentos'].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
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

        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="bg-[#0a0a0a] border-2 border-dashed border-[#333] rounded-2xl p-16 text-center cursor-pointer hover:border-[#B5FF03] transition-all group"
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
        </div>

        <div className="flex justify-center">
          <button
            onClick={downloadCSV}
            className="flex items-center gap-2 px-6 py-3 bg-[#B5FF03] text-black font-black rounded-lg hover:bg-[#a1e600] transition-all"
          >
            <Download size={16} />
            Baixar modelo CSV
          </button>
        </div>
      </div>
    </div>
  );
};

export default Importar;
