import { useState } from 'react';
import { Upload, Download } from 'lucide-react';

const CRMImportar = () => {
  const [selectedType, setSelectedType] = useState('Clientes');

  return (
    <div className="min-h-screen bg-[#000000] p-2 md:p-8">
      <div className="mb-4 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">Importar Dados</h1>
        <p className="text-neutral-400 text-xs md:text-sm">Selecione o tipo de importação e envie seu arquivo CSV.</p>
      </div>

      <div className="max-w-2xl space-y-8">
        {/* Type Selection */}
        <div className="bg-[#111] border border-[#333] rounded-2xl p-6">
          <h3 className="text-[10px] font-black text-[#B5FF03] uppercase tracking-widest mb-4">Tipo de Importação</h3>
          <div className="flex flex-wrap gap-3">
            {['Clientes', 'Equipamentos', 'Orçamentos'].map((type) => (
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

        {/* Drop Zone */}
        <div className="bg-[#0a0a0a] border-2 border-dashed border-[#333] rounded-2xl p-16 text-center cursor-pointer hover:border-[#B5FF03] transition-all group">
          <div className="w-16 h-16 bg-[#111] rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-[#222] transition-all">
            <Upload className="w-6 h-6 text-[#B5FF03] group-hover:text-[#B5FF03] transition-colors" />
          </div>
          <h3 className="text-white font-black text-xl mb-2">Clique ou arraste o arquivo CSV</h3>
          <p className="text-neutral-400 text-sm font-bold">Formatos suportados: .csv, .xlsx, .xls</p>
        </div>

        {/* Download Template */}
        <div className="flex justify-center">
          <button className="flex items-center gap-2 px-6 py-3 bg-[#B5FF03] text-black font-black rounded-lg hover:bg-[#a1e600] transition-all">
            <Download size={16} />
            Baixar modelo CSV
          </button>
        </div>
      </div>
    </div>
  );
};

export default CRMImportar;
