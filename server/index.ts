import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import eventsRoutes from './routes/events.js';
import leadsRoutes from './routes/leads.js';
import transactionsRoutes from './routes/transactions.js';
import inventoryRoutes from './routes/inventory.js';
import employeesRoutes from './routes/employees.js';
import activityLogsRoutes from './routes/activityLogs.js';
import rentalsRoutes from './routes/rentals.js';
import eventExpensesRoutes from './routes/eventExpenses.js';
import eventStockRoutes from './routes/eventStock.js';
import contractServiceTypesRoutes from './routes/contractServiceTypes.js';
import whatsappTemplatesRoutes from './routes/whatsappTemplates.js';
import configRoutes from './routes/config.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/activity-logs', activityLogsRoutes);
app.use('/api/rentals', rentalsRoutes);
app.use('/api/event-expenses', eventExpensesRoutes);
app.use('/api/event-stock', eventStockRoutes);
app.use('/api/contract-service-types', contractServiceTypesRoutes);
app.use('/api/whatsapp-templates', whatsappTemplatesRoutes);
app.use('/api/config', configRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[SERVER] Backend rodando na porta ${PORT}`);
});

export default app;