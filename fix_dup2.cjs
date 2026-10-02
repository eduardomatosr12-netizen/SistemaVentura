const fs = require('fs');

const filePath = 'C:/Users/Pichau/Documents/Projetos/lovable/Sistema Ventura/src/pages/crm/Orçamentos.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix duplicate useFinance import
content = content.replace(
  "import { useFinance } from '../../contexts/FinanceContext';\nimport { useFinance } from '../../contexts/FinanceContext';",
  "import { useFinance } from '../../contexts/FinanceContext';"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done');