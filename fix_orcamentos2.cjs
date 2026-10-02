const fs = require('fs');

const filePath = 'C:/Users/Pichau/Documents/Projetos/lovable/Sistema Ventura/src/pages/crm/Orçamentos.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add useFinance import
content = content.replace(
  "import { useCRM } from '../../contexts/CRMContext';",
  "import { useCRM } from '../../contexts/CRMContext';\nimport { useFinance } from '../../contexts/FinanceContext';"
);

// 2. Add addTransaction to useCRM destructuring
content = content.replace(
  "const { Orçamentos, events, addLead, updateLead, deleteLead, searchTerm } = useCRM();",
  "const { Orçamentos, events, addLead, updateLead, deleteLead, searchTerm } = useCRM();\n  const { addTransaction } = useFinance();"
);

// 3. Replace the useEffect for inventory loading
content = content.replace(
  "useEffect(() => {\n    setInvStockItems(getAllInventoryItems());\n    const unsub = subscribeInventoryChanges(() => {\n      setInvStockItems(getAllInventoryItems());\n    });\n    return unsub;\n  }, []);",
  "// Load inventory items from API\n  useEffect(() => {\n    const loadInventory = async () => {\n      try {\n        const { inventoryApi } = await import('../../services/apiInventory.js');\n        const boards = await inventoryApi.list();\n        const items = [];\n        boards.forEach(board => {\n          board.rows?.forEach(row => {\n            const name = String(row.values['col-1'] || '');\n            if (name) {\n              items.push({\n                name,\n                qty: Number(row.values['col-3'] || 0),\n                category: String(row.values['col-2'] || board.title),\n              });\n            }\n          });\n        });\n        setInvStockItems(items);\n      } catch (err) {\n        console.error('[Orçamentos] Erro ao carregar inventário:', err);\n      }\n    };\n    loadInventory();\n  }, []);"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done');