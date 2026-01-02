import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import db from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const toNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeTaxRate = (value) => {
  const rate = toNumber(value);
  if (rate > 1) {
    return rate / 100;
  }
  return Math.max(rate, 0);
};

const calculateAmounts = ({ amount, isGross, taxRate }) => {
  const safeTax = Math.min(Math.max(taxRate, 0), 0.95);
  if (isGross) {
    const grossAmount = amount;
    const netAmount = grossAmount * (1 - safeTax);
    return { grossAmount, netAmount };
  }
  const netAmount = amount;
  const grossAmount = netAmount / (1 - safeTax);
  return { grossAmount, netAmount };
};

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/income-sources', (_req, res) => {
  const sources = db.prepare('SELECT * FROM income_sources ORDER BY created_at DESC').all();
  res.json(sources);
});

app.post('/api/income-sources', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  try {
    const stmt = db.prepare('INSERT INTO income_sources (name) VALUES (?)');
    const result = stmt.run(name.trim());
    const source = db.prepare('SELECT * FROM income_sources WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json(source);
  } catch (error) {
    return res.status(400).json({ error: 'Source already exists' });
  }
});

app.get('/api/categories', (_req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY created_at DESC').all();
  res.json(categories);
});

app.post('/api/categories', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  try {
    const stmt = db.prepare('INSERT INTO categories (name) VALUES (?)');
    const result = stmt.run(name.trim());
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json(category);
  } catch (error) {
    return res.status(400).json({ error: 'Category already exists' });
  }
});

app.get('/api/incomes', (_req, res) => {
  const incomes = db.prepare(`
    SELECT incomes.*, income_sources.name as source_name
    FROM incomes
    JOIN income_sources ON incomes.source_id = income_sources.id
    ORDER BY incomes.created_at DESC
  `).all();
  res.json(incomes);
});

app.post('/api/incomes', (req, res) => {
  const { sourceId, amount, currency, type, taxRate } = req.body;
  const normalizedAmount = toNumber(amount, null);
  if (!sourceId || !normalizedAmount || !currency) {
    return res.status(400).json({ error: 'Source, amount, and currency are required' });
  }
  const normalizedTax = normalizeTaxRate(taxRate);
  const isGross = type === 'gross';
  const { grossAmount, netAmount } = calculateAmounts({
    amount: normalizedAmount,
    isGross,
    taxRate: normalizedTax
  });

  const stmt = db.prepare(`
    INSERT INTO incomes (source_id, amount, currency, is_gross, tax_rate, net_amount, gross_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    sourceId,
    normalizedAmount,
    currency,
    isGross ? 1 : 0,
    normalizedTax,
    netAmount,
    grossAmount
  );
  const income = db.prepare('SELECT * FROM incomes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(income);
});

app.get('/api/expenses', (_req, res) => {
  const expenses = db.prepare(`
    SELECT expenses.*, categories.name as category_name
    FROM expenses
    JOIN categories ON expenses.category_id = categories.id
    ORDER BY expenses.created_at DESC
  `).all();
  res.json(expenses);
});

app.post('/api/expenses', (req, res) => {
  const { categoryId, amount, currency, description } = req.body;
  const normalizedAmount = toNumber(amount, null);
  if (!categoryId || !normalizedAmount || !currency) {
    return res.status(400).json({ error: 'Category, amount, and currency are required' });
  }
  const stmt = db.prepare(`
    INSERT INTO expenses (category_id, amount, currency, description)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(categoryId, normalizedAmount, currency, description?.trim() || null);
  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(expense);
});

app.get('/api/rates', async (req, res) => {
  const base = req.query.base || 'UAH';
  try {
    const response = await fetch(`https://api.exchangerate.host/latest?base=${base}`);
    if (!response.ok) {
      return res.status(502).json({ error: 'Failed to fetch rates' });
    }
    const data = await response.json();
    return res.json({ base: data.base, rates: data.rates, date: data.date });
  } catch (error) {
    return res.status(500).json({ error: 'Rates service unavailable' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
