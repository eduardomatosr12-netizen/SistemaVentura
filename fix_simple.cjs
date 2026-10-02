const fs = require('fs');

const filePath = 'C:/Users/Pichau/Documents/Projetos/lovable/Sistema Ventura/src/pages/crm/Orçamentos.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Just replace getAllInventoryItems with a comment to track where it's used
content = content.replace(/getAllInventoryItems\(\)/g, '/* getAllInventoryItems() */ []');
content = content.replace(/subscribeInventoryChanges\(/g, '/* subscribeInventoryChanges( */ (() => {');
content = content.replace(/getAvailableQuantity\(/g, '/* getAvailableQuantity( */ (async () => {');

// Also remove the old imports
content = content.replace(
  "import { subscribeInventoryChanges, getAllInventoryItems, getAvailableQuantity } from '../../lib/inventory';",
  "// import { subscribeInventoryChanges, getAllInventoryItems, getAvailableQuantity } from '../../lib/inventory'; // REMOVED - use API instead"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done');