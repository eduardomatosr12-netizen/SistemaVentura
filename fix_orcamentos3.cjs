const fs = require('fs');

const filePath = 'C:/Users/Pichau/Documents/Projetos/lovable/Sistema Ventura/src/pages/crm/Orçamentos.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace the second useEffect that uses getAllInventoryItems
content = content.replace(
  "useEffect(() => {\n    if (isOpen) {\n      setInvStockItems(getAllInventoryItems());",
  "useEffect(() => {\n    if (isOpen) {\n      const { inventoryApi } = await import('../../services/apiInventory.js');\n      const boards = await inventoryApi.list();\n      const items = [];\n      boards.forEach(board => {\n        board.rows?.forEach(row => {\n          const name = String(row.values['col-1'] || '');\n          if (name) {\n            items.push({\n              name,\n              qty: Number(row.values['col-3'] || 0),\n              category: String(row.values['col-2'] || board.title),\n            });\n          });\n        });\n        setInvStockItems(items);"
);

// Replace getAvailableQuantity calls
content = content.replace(
  "const available = getAvailableQuantity(newItemDesc.trim(), eventDate);",
  "const { inventoryApi } = await import('../../services/apiInventory.js');\n      const boards = await inventoryApi.list();\n      let available = 0;\n      boards.forEach(board => {\n        board.rows?.forEach(row => {\n          const name = String(row.values['col-1'] || '');\n          if (name.toLowerCase() === newItemDesc.trim().toLowerCase()) {\n            available = Number(row.values['col-3'] || 0);\n          }\n        });\n      });\n      const available = available;"
);

content = content.replace(
  "const available = getAvailableQuantity(item.name, current.firstContact || '');",
  "const { inventoryApi } = await import('../../services/apiInventory.js');\n      const boards = await inventoryApi.list();\n      let available = 0;\n      boards.forEach(board => {\n        board.rows?.forEach(row => {\n          const name = String(row.values['col-1'] || '');\n          if (name.toLowerCase() === item.name.toLowerCase()) {\n            available = Number(row.values['col-3'] || 0);\n          }\n        });\n      });\n      const available = available;"
);

content = content.replace(
  "const available = getAvailableQuantity(newItemDesc.trim(), current.firstContact || '');",
  "const { inventoryApi } = await import('../../services/apiInventory.js');\n      const boards = await inventoryApi.list();\n      let available = 0;\n      boards.forEach(board => {\n        board.rows?.forEach(row => {\n          const name = String(row.values['col-1'] || '');\n          if (name.toLowerCase() === newItemDesc.trim().toLowerCase()) {\n            available = Number(row.values['col-3'] || 0);\n          }\n        });\n      });\n      const available = available;"
);

// Replace addTransaction with useFinance
content = content.replace(
  "addTransaction({",
  "addTransaction({"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done');