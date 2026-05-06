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
    <div className="min-h-screen p-2 md:p-8">
      <div className="mb-4 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-black tracking-tight mb-1">Importar</h1>
        <p className="text-neutral-500 text-xs md:text-sm">Importe leads e contatos para o CRM com mapeamento de colunas.</p>
      </div>

      {notification && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          notification.type === 'success' ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' : 'bg-red-50 border border-red-100 text-red-800'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <p className="text-sm font-bold">{notification.message}</p>
        </div>
      )}

      {step !== 'upload' && (
        <div className="flex items-center gap-4 mb-6">
          <button onClick={goBack} className="flex items-center gap-2 px-4 py-2 border border-neutral-200 rounded-lg text-sm font-bold text-neutral-600 hover:bg-neutral-50 transition-colors">
            <ArrowLeft size={16} /> Voltar
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${step === 'upload' ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-500'}`}>1. Upload</span>
            <span className="text-neutral-300">→</span>
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${step === 'mapping' ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-500'}`}>2. Mapeamento</span>
            <span className="text-neutral-300">→</span>
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${step === 'preview' ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-500'}`}>3. Leads</span>
          </div>
        </div>
      )}

      {step === 'mapping' && uploadState && (
        <div className="max-w-5xl">
          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm mb-6">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Map size={16} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-black">Mapeamento de Colunas</h3>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                    {uploadState.fileName} · {uploadState.spreadsheetColumns.length} colunas · {mappedCount} mapeadas
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={autoMapAll} className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  Auto-detectar
                </button>
                <button onClick={clearMappings} className="px-3 py-1.5 text-xs font-bold text-neutral-500 hover:bg-neutral-100 rounded-lg transition-colors">
                  Limpar
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50">
                    <th className="text-left px-6 py-3 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                      Coluna da Planilha
                    </th>
                    <th className="text-center px-4 py-3">
                      <ArrowDownLeft size={14} className="text-neutral-300 mx-auto" />
                    </th>
                    <th className="text-left px-6 py-3 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                      Campo no Sistema
                    </th>
                    <th className="text-left px-4 py-3 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                      Exemplo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {mappings.map((mapping, index) => (
                    <tr key={index} className={`hover:bg-neutral-50 transition-colors ${!mapping.targetField ? 'bg-neutral-50' : ''}`}>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${mapping.targetField ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                          <span className="text-sm font-bold text-black">{mapping.spreadsheetColumn}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ArrowDownLeft size={14} className="text-neutral-300" />
                      </td>
                      <td className="px-6 py-3">
                        <select
                          value={mapping.targetField}
                          onChange={(e) => updateMapping(index, e.target.value)}
                          className="text-sm font-medium text-neutral-900 border-2 border-neutral-300 rounded-lg px-3 py-2.5 outline-none focus:border-black focus:ring-2 focus:ring-black/10 bg-white hover:bg-neutral-50 hover:border-neutral-400 cursor-pointer min-w-[220px] transition-colors"
                        >
                          {TARGET_FIELDS.map(field => (
                            <option key={field.key || 'empty'} value={field.key}>
                              {field.label}{field.required ? ' *' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-neutral-500 font-medium truncate block max-w-[150px]">
                          {mapping.sampleValue || '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {unmappedCount > 0 && (
              <div className="px-6 py-3 bg-amber-50 border-t border-amber-100">
                <p className="text-xs font-bold text-amber-700">
                  {unmappedCount} coluna{unmappedCount > 1 ? 's' : ''} nao mapeada{unmappedCount > 1 ? 's' : ''} (serao ignoradas na importacao)
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <button onClick={cancelImport} className="flex-1 py-4 rounded-xl font-black text-sm uppercase tracking-widest border border-neutral-200 text-neutral-500 hover:bg-neutral-50 transition-colors">
              Cancelar
            </button>
            <button onClick={proceedToPreview} className="flex-[2] py-4 rounded-xl font-black text-sm uppercase tracking-widest bg-black text-white hover:brightness-90 transition-all flex items-center justify-center gap-2">
              Proximo: Preview dos Leads <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && uploadState && (
        <div className="max-w-6xl">
          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm mb-6">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Table size={16} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-black">Preview dos Leads</h3>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                    {selectedRows.size} de {uploadState.rawData.length} leads selecionados · {mappedCount} campos mapeados
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={selectAllRows} className="px-3 py-1.5 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
                  Selecionar Todos
                </button>
                <button onClick={deselectAllRows} className="px-3 py-1.5 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
                  Desselecionar
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50">
                    <th className="w-10 px-3 py-3"></th>
                    <th className="text-left px-3 py-3 font-black text-neutral-400 uppercase tracking-widest">Nome</th>
                    <th className="text-left px-3 py-3 font-black text-neutral-400 uppercase tracking-widest">Nicho</th>
                    <th className="text-left px-3 py-3 font-black text-neutral-400 uppercase tracking-widest">WhatsApp</th>
                    <th className="text-left px-3 py-3 font-black text-neutral-400 uppercase tracking-widest">Email</th>
                    <th className="text-left px-3 py-3 font-black text-neutral-400 uppercase tracking-widest">Etapa</th>
                    <th className="text-left px-3 py-3 font-black text-neutral-400 uppercase tracking-widest">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadState.rawData.slice(0, 50).map((row, rowIndex) => {
                    const lead = mapRowToLead(row, mappings);
                    return (
                      <tr
                        key={rowIndex}
                        className={`border-b border-neutral-50 transition-colors cursor-pointer ${
                          selectedRows.has(rowIndex) ? 'bg-emerald-50/50' : 'hover:bg-neutral-50'
                        }`}
                        onClick={() => toggleRow(rowIndex)}
                      >
                        <td className="px-3 py-2.5">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                            selectedRows.has(rowIndex) ? 'bg-black border-black text-white' : 'border-neutral-300'
                          }`}>
                            {selectedRows.has(rowIndex) && <CheckCircle2 size={10} />}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-black">{lead?.name || '-'}</td>
                        <td className="px-3 py-2.5 text-neutral-600">{lead?.niche || '-'}</td>
                        <td className="px-3 py-2.5 text-neutral-600">{lead?.whatsapp || '-'}</td>
                        <td className="px-3 py-2.5 text-neutral-600">{lead?.email || '-'}</td>
                        <td className="px-3 py-2.5">
                          <span className="px-2 py-0.5 bg-neutral-100 rounded text-[10px] font-bold">{lead?.stage || '-'}</span>
                        </td>
                        <td className="px-3 py-2.5 text-neutral-600 font-medium">{lead?.value || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {uploadState.rawData.length > 50 && (
              <div className="px-6 py-3 bg-neutral-50 border-t border-neutral-100 text-center">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                  Mostrando 50 de {uploadState.rawData.length} leads
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <button onClick={goBack} className="flex-1 py-4 rounded-xl font-black text-sm uppercase tracking-widest border border-neutral-200 text-neutral-500 hover:bg-neutral-50 transition-colors">
              Voltar ao Mapeamento
            </button>
            <button
              onClick={confirmImport}
              disabled={isImporting || selectedRows.size === 0}
              className="flex-[2] py-4 rounded-xl font-black text-sm uppercase tracking-widest bg-black text-white hover:brightness-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
              Importar {selectedRows.size} Leads
            </button>
          </div>
        </div>
      )}

      {step === 'upload' && (
        <div className="max-w-2xl space-y-8">
          <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />

          <div
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`bg-white border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer group shadow-sm ${
              isUploading ? 'border-neutral-200 cursor-not-allowed' : 'border-neutral-300 hover:border-black hover:shadow-md'
            }`}
          >
            {isUploading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="w-12 h-12 text-black animate-spin mb-4" />
                <h3 className="text-black font-black text-lg mb-1">Processando arquivo...</h3>
                <p className="text-neutral-400 text-sm font-bold uppercase tracking-widest">Aguarde</p>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-black transition-all group-hover:scale-110 group-hover:rotate-3">
                  <Upload className="w-6 h-6 text-neutral-400 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-black font-black text-xl mb-2">Arraste ou clique para selecionar</h3>
                <p className="text-neutral-400 text-sm font-bold">CSV, XLSX, XLS — maximo 10MB</p>
                <div className="mt-8 flex justify-center gap-4">
                  <span className="px-4 py-2 bg-neutral-50 rounded-lg text-[10px] font-black text-neutral-400 uppercase tracking-widest border border-neutral-100">Excel</span>
                  <span className="px-4 py-2 bg-neutral-50 rounded-lg text-[10px] font-black text-neutral-400 uppercase tracking-widest border border-neutral-100">CSV</span>
                </div>
              </>
            )}
          </div>

          {recentImports.length > 0 && (
            <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-8 py-5 border-b border-neutral-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-neutral-50 flex items-center justify-center">
                  <FileText size={16} className="text-black" />
                </div>
                <h3 className="text-[11px] font-black text-black uppercase tracking-widest">Importacoes Recentes</h3>
              </div>
              <div className="divide-y divide-neutral-100">
                {recentImports.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between px-8 py-5 hover:bg-neutral-50 transition-colors">
                    <div>
                      <p className="text-sm font-black text-black">{item.name}</p>
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">
                        {item.date} · <span className="text-neutral-500">{item.records}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'Concluida' ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                      <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{item.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CRMImportar;
