const fs = require('fs');

const filePath = 'C:/Users/Pichau/Documents/Projetos/lovable/Sistema Ventura/src/pages/crm/Orçamentos.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace the first useEffect completely
content = content.replace(
  "  useEffect(() => {\n    setInvStockItems(getAllInventoryItems());\n    const unsub = subscribeInventoryChanges(() => {\n      setInvStockItems(getAllInventoryItems());\n    });\n    return unsub;\n  }, []);",
  "  // Load inventory items from API\n  useEffect(() => {\n    const loadInventory = async () => {\n      try {\n        const { inventoryApi } = await import('../../services/apiInventory.js');\n        const boards = await inventoryApi.list();\n        const items = [];\n        boards.forEach(board => {\n          board.rows?.forEach(row => {\n            const name = String(row.values['col-1'] || '');\n            if (name) {\n              items.push({\n                name,\n                qty: Number(row.values['col-3'] || 0),\n                category: String(row.values['col-2'] || board.title),\n              });\n            }\n          });\n        });\n        setInvStockItems(items);\n      } catch (err) {\n        console.error('[Orçamentos] Erro ao carregar inventário:', err);\n      }\n    };\n    loadInventory();\n  }, []);"
);

// Replace the second useEffect that uses getAllInventoryItems
content = content.replace(
  "  useEffect(() => {\n    if (isOpen) {\n      setInvStockItems(getAllInventoryItems());\n      setInvSearch('');",
  "  useEffect(() => {\n    if (isOpen) {\n      const { inventoryApi } = await import('../../services/apiInventory.js');\n      const boards = await inventoryApi.list();\n      const items = [];\n      boards.forEach(board => {\n        board.rows?.forEach(row => {\n          const name = String(row.values['col-1'] || '');\n          if (name) {\n            items.push({\n              name,\n              qty: Number(row.values['col-3'] || 0),\n              category: String(row.values['col-2'] || board.title),\n            });\n          });\n        });\n        setInvStockItems(items);\n      setInvSearch('');"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done');