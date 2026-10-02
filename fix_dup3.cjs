const fs = require('fs');

const filePath = 'C:/Users/Pichau/Documents/Projetos/lovable/Sistema Ventura/src/pages/crm/Orçamentos.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace all duplicate useFinance imports
content = content.replace(
  /import \{ useFinance \} from '..\/..\/contexts\/FinanceContext';\s*import \{ useFinance \} from '..\/..\/contexts\/FinanceContext';/g,
  "import { useFinance } from '../../contexts/FinanceContext';"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done');