const fs = require('fs');

const filePath = 'C:/Users/Pichau/Documents/Projetos/lovable/Sistema Ventura/src/pages/crm/Orçamentos.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace the component start
const oldStart = "const CRMOrçamentos = () => {\n  const { Orçamentos, events, addLead, updateLead, deleteLead, searchTerm } = useCRM();\n  const { clearFilters } = useFilters();\n  const { role, employeeName } = useAuth();\n\n  const [isOpen, setIsOpen] = useState(false);";

const newStart = "const CRMOrçamentos = () => {\n  const { Orçamentos, events, addLead, updateLead, deleteLead, searchTerm } = useCRM();\n  const { clearFilters } = useFilters();\n  const { role, employeeName } = useAuth();\n  const { addTransaction } = useFinance();\n\n  const [isOpen, setIsOpen] = useState(false);";

content = content.replace(oldStart, newStart);

// Replace the useEffect for inventory
const oldEffect = "  useEffect(() => {\n    setInvStockItems(getAllInventoryItems());\n    const unsub = subscribeInventoryChanges(() => {\n      setInvStockItems(getAllInventoryItems());\n    });\n    return unsub;\n  }, []);";

const newEffect = "  // Load inventory items from API\n  useEffect(() => {\n    const loadInventory = async () => {\n      try {\n        const { inventoryApi } = await import('../../services/apiInventory.js');\n        const boards = await inventoryApi.list();\n        const items = [];\n        boards.forEach(board => {\n          board.rows?.forEach(row => {\n            const name = String(row.values['col-1'] || '');\n            if (name) {\n              items.push({\n                name,\n                qty: Number(row.values['col-3'] || 0),\n                category: String(row.values['col-2'] || board.title),\n              });\n            }\n          });\n        });\n        setInvStockItems(items);\n      } catch (err) {\n        console.error('[Orçamentos] Erro ao carregar inventário:', err);\n      }\n    };\n    loadInventory();\n  }, []);";

content = content.replace(oldEffect, newEffect);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done');