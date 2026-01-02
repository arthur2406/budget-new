import { useEffect, useMemo, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const currencies = ['UAH', 'USD', 'EUR', 'PLN', 'GBP'];

const formatMoney = (value, currency) =>
  new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(value || 0);

const formatPercent = (value) => `${Math.round(value * 100)}%`;

const convertToBase = (amount, currency, rates, base) => {
  if (!rates || !base) return amount;
  if (currency === base) return amount;
  const rate = rates[currency];
  if (!rate) return amount;
  return amount / rate;
};

export default function App() {
  const [incomeSources, setIncomeSources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [rates, setRates] = useState({ base: 'UAH', rates: {} });
  const [baseCurrency, setBaseCurrency] = useState('UAH');
  const [message, setMessage] = useState('');

  const [newSource, setNewSource] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const [incomeForm, setIncomeForm] = useState({
    sourceId: '',
    amount: '',
    currency: 'UAH',
    type: 'net',
    taxRate: '18'
  });

  const [expenseForm, setExpenseForm] = useState({
    categoryId: '',
    amount: '',
    currency: 'UAH',
    description: ''
  });

  const loadData = async () => {
    const [sourcesRes, categoriesRes, incomesRes, expensesRes] = await Promise.all([
      fetch(`${API_URL}/income-sources`),
      fetch(`${API_URL}/categories`),
      fetch(`${API_URL}/incomes`),
      fetch(`${API_URL}/expenses`)
    ]);
    const [sources, categoriesData, incomesData, expensesData] = await Promise.all([
      sourcesRes.json(),
      categoriesRes.json(),
      incomesRes.json(),
      expensesRes.json()
    ]);
    setIncomeSources(sources);
    setCategories(categoriesData);
    setIncomes(incomesData);
    setExpenses(expensesData);
  };

  const loadRates = async (base) => {
    try {
      const response = await fetch(`${API_URL}/rates?base=${base}`);
      const data = await response.json();
      setRates(data);
    } catch (error) {
      setMessage('Не вдалося оновити курси валют.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadRates(baseCurrency);
  }, [baseCurrency]);

  const totals = useMemo(() => {
    const incomeTotal = incomes.reduce((sum, income) => {
      const netAmount = Number(income.net_amount ?? income.netAmount ?? income.amount);
      return sum + convertToBase(netAmount, income.currency, rates.rates, baseCurrency);
    }, 0);
    const expensesTotal = expenses.reduce((sum, expense) => {
      return sum + convertToBase(expense.amount, expense.currency, rates.rates, baseCurrency);
    }, 0);
    return {
      incomeTotal,
      expensesTotal,
      balance: incomeTotal - expensesTotal
    };
  }, [incomes, expenses, rates, baseCurrency]);

  const handleAddSource = async (event) => {
    event.preventDefault();
    if (!newSource.trim()) return;
    const response = await fetch(`${API_URL}/income-sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newSource })
    });
    if (!response.ok) {
      setMessage('Не вдалося додати джерело доходу.');
      return;
    }
    setNewSource('');
    loadData();
  };

  const handleAddCategory = async (event) => {
    event.preventDefault();
    if (!newCategory.trim()) return;
    const response = await fetch(`${API_URL}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCategory })
    });
    if (!response.ok) {
      setMessage('Не вдалося додати категорію.');
      return;
    }
    setNewCategory('');
    loadData();
  };

  const handleIncomeSubmit = async (event) => {
    event.preventDefault();
    const response = await fetch(`${API_URL}/incomes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceId: incomeForm.sourceId,
        amount: incomeForm.amount,
        currency: incomeForm.currency,
        type: incomeForm.type,
        taxRate: incomeForm.taxRate
      })
    });
    if (!response.ok) {
      setMessage('Перевірте введені дані доходу.');
      return;
    }
    setIncomeForm({ ...incomeForm, amount: '' });
    loadData();
  };

  const handleExpenseSubmit = async (event) => {
    event.preventDefault();
    const response = await fetch(`${API_URL}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId: expenseForm.categoryId,
        amount: expenseForm.amount,
        currency: expenseForm.currency,
        description: expenseForm.description
      })
    });
    if (!response.ok) {
      setMessage('Перевірте введені дані витрат.');
      return;
    }
    setExpenseForm({ ...expenseForm, amount: '', description: '' });
    loadData();
  };

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Budget Duo</p>
          <h1>Бюджет для пари з підтримкою мультивалютності</h1>
          <p className="subtitle">
            Слідкуйте за доходами й витратами, рахуйте net/gross та миттєво бачте баланс у базовій валюті.
          </p>
        </div>
        <div className="hero-card">
          <div>
            <span className="label">Базова валюта</span>
            <select value={baseCurrency} onChange={(event) => setBaseCurrency(event.target.value)}>
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>
          <div className="totals">
            <div>
              <span>Доходи (net)</span>
              <strong>{formatMoney(totals.incomeTotal, baseCurrency)}</strong>
            </div>
            <div>
              <span>Витрати</span>
              <strong>{formatMoney(totals.expensesTotal, baseCurrency)}</strong>
            </div>
            <div className={totals.balance >= 0 ? 'positive' : 'negative'}>
              <span>Баланс</span>
              <strong>{formatMoney(totals.balance, baseCurrency)}</strong>
            </div>
          </div>
        </div>
      </header>

      {message && <div className="toast">{message}</div>}

      <section className="grid two">
        <div className="card">
          <h2>Джерела доходу</h2>
          <form onSubmit={handleAddSource} className="inline-form">
            <input
              value={newSource}
              onChange={(event) => setNewSource(event.target.value)}
              placeholder="Наприклад, Фріланс"
            />
            <button type="submit">Додати</button>
          </form>
          <ul className="pill-list">
            {incomeSources.map((source) => (
              <li key={source.id}>{source.name}</li>
            ))}
            {!incomeSources.length && <li className="muted">Додайте перше джерело доходу.</li>}
          </ul>
        </div>

        <div className="card">
          <h2>Категорії витрат</h2>
          <form onSubmit={handleAddCategory} className="inline-form">
            <input
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              placeholder="Наприклад, Продукти"
            />
            <button type="submit">Додати</button>
          </form>
          <ul className="pill-list">
            {categories.map((category) => (
              <li key={category.id}>{category.name}</li>)}
            )}
            {!categories.length && <li className="muted">Додайте категорії для витрат.</li>}
          </ul>
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Додати дохід</h2>
          <form onSubmit={handleIncomeSubmit} className="stacked">
            <label>
              Джерело
              <select
                value={incomeForm.sourceId}
                onChange={(event) => setIncomeForm({ ...incomeForm, sourceId: event.target.value })}
                required
              >
                <option value="">Оберіть джерело</option>
                {incomeSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Сума
              <input
                type="number"
                min="0"
                step="0.01"
                value={incomeForm.amount}
                onChange={(event) => setIncomeForm({ ...incomeForm, amount: event.target.value })}
                required
              />
            </label>
            <div className="row">
              <label>
                Валюта
                <select
                  value={incomeForm.currency}
                  onChange={(event) => setIncomeForm({ ...incomeForm, currency: event.target.value })}
                >
                  {currencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Тип
                <select
                  value={incomeForm.type}
                  onChange={(event) => setIncomeForm({ ...incomeForm, type: event.target.value })}
                >
                  <option value="net">Net</option>
                  <option value="gross">Gross</option>
                </select>
              </label>
            </div>
            <label>
              Податок, %
              <input
                type="number"
                min="0"
                max="95"
                step="0.1"
                value={incomeForm.taxRate}
                onChange={(event) => setIncomeForm({ ...incomeForm, taxRate: event.target.value })}
              />
            </label>
            <button type="submit">Зберегти дохід</button>
          </form>
        </div>

        <div className="card">
          <h2>Додати витрату</h2>
          <form onSubmit={handleExpenseSubmit} className="stacked">
            <label>
              Категорія
              <select
                value={expenseForm.categoryId}
                onChange={(event) => setExpenseForm({ ...expenseForm, categoryId: event.target.value })}
                required
              >
                <option value="">Оберіть категорію</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Сума
              <input
                type="number"
                min="0"
                step="0.01"
                value={expenseForm.amount}
                onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })}
                required
              />
            </label>
            <div className="row">
              <label>
                Валюта
                <select
                  value={expenseForm.currency}
                  onChange={(event) => setExpenseForm({ ...expenseForm, currency: event.target.value })}
                >
                  {currencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Нотатка
                <input
                  type="text"
                  value={expenseForm.description}
                  onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })}
                  placeholder="Наприклад, продуктовий кошик"
                />
              </label>
            </div>
            <button type="submit">Зберегти витрату</button>
          </form>
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Останні доходи</h2>
          <ul className="list">
            {incomes.map((income) => (
              <li key={income.id}>
                <div>
                  <strong>{income.source_name}</strong>
                  <span className="muted">{income.currency}</span>
                </div>
                <div className="amounts">
                  <span>{formatMoney(income.net_amount, income.currency)} net</span>
                  <span className="muted">
                    {formatMoney(income.gross_amount, income.currency)} gross · {formatPercent(income.tax_rate)}
                  </span>
                </div>
              </li>
            ))}
            {!incomes.length && <li className="muted">Ще немає записів про доходи.</li>}
          </ul>
        </div>

        <div className="card">
          <h2>Останні витрати</h2>
          <ul className="list">
            {expenses.map((expense) => (
              <li key={expense.id}>
                <div>
                  <strong>{expense.category_name}</strong>
                  <span className="muted">{expense.description || 'Без нотатки'}</span>
                </div>
                <div className="amounts">
                  <span>{formatMoney(expense.amount, expense.currency)}</span>
                  <span className="muted">{expense.currency}</span>
                </div>
              </li>
            ))}
            {!expenses.length && <li className="muted">Ще немає записів про витрати.</li>}
          </ul>
        </div>
      </section>

      <section className="card callout">
        <div>
          <h2>Monobank — наступна фіча</h2>
          <p>
            Додамо підключення до Monobank API, щоб підтягувати баланс та статистику витрат автоматично.
          </p>
        </div>
        <div className="chip">Coming soon</div>
      </section>
    </div>
  );
}
