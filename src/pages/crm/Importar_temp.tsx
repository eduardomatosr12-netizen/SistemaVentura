import { useState, useRef, useMemo } from 'react';
import { useCRM, type Lead } from '../../contexts/CRMContext';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Table, X, ArrowRight, ArrowLeft, ArrowDownLeft, Map } from 'lucide-react';

interface ImportRecord {
  name: string;
  date: string;
  records: string;
  status: 'Concluida' | 'Erro' | 'Processando';
}

type ImportStep = 'upload' | 'mapping' | 'preview';

interface MappedColumn {
  spreadsheetColumn: string;
  targetField: string;
  sampleValue: string;
}

interface UploadState {
  fileName: string;
  rawData: any[];
  spreadsheetColumns: string[];
}

const TARGET_FIELDS: { key: string; label: string; required: boolean; type: string; keywords: string[] }[] = [
  { key: '', label: '-- Nao mapear --', required: false, type: 'skip', keywords: [] },
  { key: 'name', label: 'Nome', required: true, type: 'text', keywords: ['nome', 'name', 'cliente', 'full name', 'nome completo', 'razao social'] },
  { key: 'niche', label: 'Nicho', required: false, type: 'text', keywords: ['niche', 'nicho', 'segmento', 'area', 'categoria', 'setor', 'tipo'] },
  { key: 'whatsapp', label: 'WhatsApp', required: false, type: 'phone', keywords: ['whatsapp', 'telefone', 'phone', 'celular', 'contato', 'tel', 'zap', 'numero', 'whats'] },
  { key: 'email', label: 'Email', required: false, type: 'email', keywords: ['email', 'e-mail', 'mail', 'e_mail', 'correo'] },
  { key: 'instagram', label: 'Instagram', required: false, type: 'text', keywords: ['instagram', 'ig', 'insta', 'social', 'midia social'] },
  { key: 'stage', label: 'Etapa do Pipeline', required: false, type: 'select', keywords: ['etapa', 'stage', 'status', 'fase', 'pipeline', 'situacao'] },
  { key: 'firstContact', label: 'Primeiro Contato', required: false, type: 'date', keywords: ['primeiro contato', 'primeiro_contato', 'data entrada', 'data inicio', 'created', 'entrada'] },
  { key: 'closingDate', label: 'Data de Fechamento', required: false, type: 'date', keywords: ['fechamento', 'closing', 'data fim', 'previsao', 'expected'] },
  { key: 'followUpReminder', label: 'Follow-up', required: false, type: 'date', keywords: ['follow', 'followup', 'follow-up', 'lembrete', 'proximo contato', 'retorno'] },
  { key: 'value', label: 'Valor do Contato', required: false, type: 'currency', keywords: ['valor', 'value', 'preco', 'price', 'investimento', 'ticket', 'faturamento', 'contrato'] },
  { key: 'address', label: 'Endereco', required: false, type: 'text', keywords: ['endereco', 'address', 'cidade', 'city', 'estado', 'uf', 'localizacao', 'pais'] },
  { key: 'gmnReviews', label: 'Qtd. Avaliacoes GMN', required: false, type: 'number', keywords: ['avaliacoes', 'reviews', 'qtd avaliacoes', 'total avaliacoes', 'numero avaliacoes'] },
  { key: 'gmnStars', label: 'Media de Estrelas GMN', required: false, type: 'float', keywords: ['estrelas', 'stars', 'media estrelas', 'rating', 'nota'] },
  { key: 'notes', label: 'Observacoes', required: false, type: 'textarea', keywords: ['observacoes', 'notas', 'notes', 'obs', 'comentarios', 'descricao', 'informacoes'] },
];

const STAGE_MAP: Record<string, string> = {
  'novos leads': 'Novos Leads',
  'novo lead': 'Novos Leads',
  'novo': 'Novos Leads',
  'primeiro contato': 'Primeiro Contato',
  'contato ativo': 'Contato Ativo',
  'reuniao agendada': 'Reunião Agendada',
  'follow up': 'Follow Up',
  'proposta enviada': 'Proposta Enviada',
  'contrato fechado': 'Contrato Fechado',
  'perdido': 'Perdido',
  'ganho': 'Contrato Fechado',
  'qualificacao': 'Primeiro Contato',
};

const CRMImportar = () => {
  const { addLead } = useCRM();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [step, setStep] = useState<ImportStep>('upload');
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [mappings, setMappings] = useState<MappedColumn[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [recentImports, setRecentImports] = useState<ImportRecord[]>([]);

  const detectMapping = (colName: string): string => {
    const lower = colName.toLowerCase().trim();
    for (const field of TARGET_FIELDS) {
      if (field.key === '') continue;
      if (field.keywords.some(kw => lower.includes(kw))) {
        return field.key;
      }
    }
    return '';
  };

  const parseDateValue = (val: string): string => {
    if (!val || !val.trim()) return '';
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.split('T')[0];
    const brMatch = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (brMatch) {
      const [, day, month, year] = brMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    const usMatch = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (usMatch) {
      const [, a, b, c] = usMatch;
      const year = c.length === 2 ? `20${c}` : c;
      return `${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return '';
  };

  const parseCurrencyValue = (val: string): string => {
    if (!val || !val.trim()) return '';
    let cleaned = val.trim().replace(/[R$\s]/g, '');
    if (cleaned.includes('.') && cleaned.includes(',')) {
      if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes(',')) {
      cleaned = cleaned.replace(',', '.');
    }
    const num = parseFloat(cleaned);
    if (isNaN(num)) return val.trim();
    return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const parseNumberValue = (val: string): string => {
    if (!val || !val.trim()) return '';
    const cleaned = val.trim().replace(/[^\d.,]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return '';
    return String(Math.round(num));
  };

  const parseFloatValue = (val: string): string => {
    if (!val || !val.trim()) return '';
    const cleaned = val.trim().replace(/[^\d.,]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return '';
    return num.toFixed(1);
  };

  const mapRowToLead = (row: any, cols: MappedColumn[]): Lead | null => {
    const getValue = (targetField: string): string => {
      const col = cols.find(c => c.targetField === targetField);
      if (!col) return '';
      const raw = String(row[col.spreadsheetColumn] ?? '').trim();
      if (!raw) return '';

      switch (targetField) {
        case 'firstContact':
        case 'closingDate':
        case 'followUpReminder':
          return parseDateValue(raw);
        case 'value':
          return parseCurrencyValue(raw);
        case 'gmnReviews':
          return parseNumberValue(raw);
        case 'gmnStars':
          return parseFloatValue(raw);
        case 'stage':
          return STAGE_MAP[raw.toLowerCase()] || raw;
        default:
          return raw;
      }
    };

    const name = getValue('name');
    if (!name) return null;

    return {
      id: '',
      name,
      niche: getValue('niche'),
      whatsapp: getValue('whatsapp'),
      email: getValue('email'),
      instagram: getValue('instagram'),
      stage: getValue('stage') || 'Novos Leads',
      firstContact: getValue('firstContact'),
      closingDate: getValue('closingDate'),
      followUpReminder: getValue('followUpReminder'),
      address: getValue('address'),
      gmnReviews: getValue('gmnReviews') || '0',
      gmnStars: getValue('gmnStars') || '0',
      notes: getValue('notes') || 'Importado via planilha.',
      value: getValue('value'),
    };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setNotification({ type: 'error', message: 'Nenhum arquivo selecionado.' });
      return;
    }

    setIsUploading(true);
    setNotification(null);
    const fileName = file.name;

    const processColumns = (rawColumns: string[], data: any[]) => {
      const mapped: MappedColumn[] = rawColumns.map(col => ({
        spreadsheetColumn: col,
        targetField: detectMapping(col),
        sampleValue: data.length > 0 ? String(data[0][col] ?? '') : '',
      }));
      setUploadState({ fileName, rawData: data, spreadsheetColumns: rawColumns });
      setMappings(mapped);
      setSelectedRows(new Set(data.map((_, i) => i)));
      setStep('mapping');
      setIsUploading(false);
    };

    if (fileName.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const rawColumns = results.data.length > 0 ? Object.keys(results.data[0]) : [];
            processColumns(rawColumns, results.data);
          } catch {
            setNotification({ type: 'error', message: 'Erro ao processar CSV.' });
            setIsUploading(false);
          }
        },
        error: () => {
          setNotification({ type: 'error', message: 'Erro ao processar CSV.' });
          setIsUploading(false);
        }
      });
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          if (!bstr) throw new Error('Arquivo nao pode ser lido.');
          const wb = XLSX.read(bstr, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws);
          const rawColumns = data.length > 0 ? Object.keys(data[0]) : [];
          processColumns(rawColumns, data);
        } catch {
          setNotification({ type: 'error', message: 'Erro ao processar Excel.' });
          setIsUploading(false);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setNotification({ type: 'error', message: 'Formato nao suportado. Use CSV, XLSX ou XLS.' });
      setIsUploading(false);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateMapping = (index: number, targetField: string) => {
    setMappings(prev => prev.map((m, i) => i === index ? { ...m, targetField } : m));
  };

  const autoMapAll = () => {
    setMappings(prev => prev.map(m => ({
      ...m,
      targetField: detectMapping(m.spreadsheetColumn),
    })));
  };

  const clearMappings = () => {
    setMappings(prev => prev.map(m => ({ ...m, targetField: '' })));
  };

  const mappedFieldsSet = useMemo(() => {
    const used = new Set<string>();
    mappings.forEach(m => { if (m.targetField) used.add(m.targetField); });
    return used;
  }, [mappings]);

  const proceedToPreview = () => {
    const nameMapped = mappings.some(m => m.targetField === 'name');
    if (!nameMapped) {
      setNotification({ type: 'error', message: 'O campo "Nome" e obrigatorio. Mapeie pelo menos uma coluna da planilha para "Nome".' });
      return;
    }
    setStep('preview');
    setNotification(null);
  };

  const toggleRow = (index: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectAllRows = () => setSelectedRows(new Set(uploadState?.rawData.map((_, i) => i) ?? []));
  const deselectAllRows = () => setSelectedRows(new Set());

  const confirmImport = () => {
    if (!uploadState) return;
    setIsImporting(true);

    let count = 0;
    const sortedRows = Array.from(selectedRows).sort((a, b) => a - b);
    sortedRows.forEach(rowIndex => {
      const row = uploadState.rawData[rowIndex];
      if (!row) return;
      const lead = mapRowToLead(row, mappings);
      if (lead) {
        addLead(lead);
        count++;
      }
    });

    const newImport: ImportRecord = {
      name: uploadState.fileName,
      date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
      records: `${count} registros`,
      status: 'Concluida'
    };
    setRecentImports(prev => [newImport, ...prev]);
    setNotification({ type: 'success', message: `Sucesso! ${count} leads importados.` });
    setUploadState(null);
    setMappings([]);
    setSelectedRows(new Set());
    setStep('upload');
    setIsImporting(false);
    setTimeout(() => setNotification(null), 5000);
  };

  const cancelImport = () => {
    setUploadState(null);
    setMappings([]);
    setSelectedRows(new Set());
    setStep('upload');
    setNotification(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const goBack = () => {
    if (step === 'preview') setStep('mapping');
    else if (step === 'mapping') cancelImport();
  };

  const previewData = useMemo(() => {
    if (!uploadState || !mappings.length) return [];
    return uploadState.rawData.slice(0, 5).map(row => {
      const lead = mapRowToLead(row, mappings);
      return lead ? {
        nome: lead.name,
        nicho: lead.niche,
        whatsapp: lead.whatsapp,
        email: lead.email,
        etapa: lead.stage,
        valor: lead.value,
      } : null;
    }).filter(Boolean);
  }, [uploadState, mappings]);

  const mappedCount = mappings.filter(m => m.targetField !== '').length;
  const unmappedCount = mappings.length - mappedCount;

  return (
    <div className="min-h-screen p-2 md:p-8 bg-[#000000]">
      <div className="mb-4 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Importar</h1>
        <p className="text-neutral-400 text-xs md:text-sm">Importe leads e contatos para o CRM com mapeamento de colunas.</p>
      </div>

      {notification && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          notification.type === 'success' ? 'bg-emerald-900/30 border border-emerald-500/30 text-emerald-400' : 'bg-red-900/30 border border-red-500/30 text-red-400'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <p className="text-sm font-bold">{notification.message}</p>
        </div>
      )}

      {step !== 'upload' && (
        <div className="flex items-center gap-4 mb-6">
          <button onClick={goBack} className="flex items-center gap-2 px-4 py-2 border border-[#333] rounded-lg text-sm font-bold text-neutral-400 hover:bg-[#111] hover:text-white transition-colors">
            <ArrowLeft size={16} /> Voltar
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${step === 'upload' ? 'bg-[#B5FF03] text-black' : 'bg-[#1a1a1a] text-neutral-400 border border-[#333]'}`}>1. Upload</span>
            <span className="text-[#333]">→</span>
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${step === 'mapping' ? 'bg-[#B5FF03] text-black' : 'bg-[#1a1a1a] text-neutral-400 border border-[#333]'}`}>2. Mapeamento</span>
            <span className="text-[#333]">→</span>
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${step === 'preview' ? 'bg-[#B5FF03] text-black' : 'bg-[#1a1a1a] text-neutral-400 border border-[#333]'}`}>3. Leads</span>
          </div>
        </div>
      )}

      {step === 'mapping' && uploadState && (
