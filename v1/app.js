const API = 'https://api.frankfurter.dev/v2/rates';
const CACHE_KEY = 'currencyflow_rates_v1';
const ROWS_KEY = 'currencyflow_rows_v1';
const THEME_KEY = 'currencyflow_theme_v1';
const CACHE_MS = 6 * 60 * 60 * 1000;

const currencies = [
  ['USD','US Dollar','🇺🇸','$'], ['EUR','Euro','🇪🇺','€'], ['INR','Indian Rupee','🇮🇳','₹'],
  ['GBP','British Pound','🇬🇧','£'], ['JPY','Japanese Yen','🇯🇵','¥'], ['AED','UAE Dirham','🇦🇪','د.إ'],
  ['CAD','Canadian Dollar','🇨🇦','C$'], ['AUD','Australian Dollar','🇦🇺','A$'], ['CHF','Swiss Franc','🇨🇭','CHF'],
  ['SGD','Singapore Dollar','🇸🇬','S$'], ['HKD','Hong Kong Dollar','🇭🇰','HK$'], ['CNY','Chinese Yuan','🇨🇳','¥'],
  ['NZD','New Zealand Dollar','🇳🇿','NZ$'], ['SEK','Swedish Krona','🇸🇪','kr'], ['NOK','Norwegian Krone','🇳🇴','kr'],
  ['DKK','Danish Krone','🇩🇰','kr'], ['ZAR','South African Rand','🇿🇦','R'], ['BRL','Brazilian Real','🇧🇷','R$'],
  ['MXN','Mexican Peso','🇲🇽','$'], ['THB','Thai Baht','🇹🇭','฿'], ['KRW','South Korean Won','🇰🇷','₩'],
  ['IDR','Indonesian Rupiah','🇮🇩','Rp'], ['MYR','Malaysian Ringgit','🇲🇾','RM'], ['SAR','Saudi Riyal','🇸🇦','﷼'],
  ['QAR','Qatari Riyal','🇶🇦','﷼'], ['KWD','Kuwaiti Dinar','🇰🇼','د.ك'], ['TRY','Turkish Lira','🇹🇷','₺'],
  ['RUB','Russian Ruble','🇷🇺','₽'], ['PLN','Polish Zloty','🇵🇱','zł'], ['CZK','Czech Koruna','🇨🇿','Kč']
].map(([code,name,flag,symbol]) => ({code,name,flag,symbol}));

const currencyMap = Object.fromEntries(currencies.map(c => [c.code, c]));
const defaultRows = [
  { amount: 1, from: 'USD', to: 'INR' },
  { amount: 1, from: 'JPY', to: 'INR' },
  { amount: 1, from: 'EUR', to: 'INR' },
  { amount: 1, from: 'USD', to: 'JPY' },
  { amount: 100, from: 'USD', to: 'AED' }
];

let rows = loadRows();
let rateData = { rates: { EUR: 1 }, date: null, fetchedAt: 0, source: 'Frankfurter' };
let activePicker = null;

const list = document.getElementById('conversionList');
const rateDate = document.getElementById('rateDate');
const toast = document.getElementById('toast');

function loadRows() {
  try {
    const saved = JSON.parse(localStorage.getItem(ROWS_KEY));
    return Array.isArray(saved) && saved.length ? saved : structuredClone(defaultRows);
  } catch { return structuredClone(defaultRows); }
}

function saveRows() { localStorage.setItem(ROWS_KEY, JSON.stringify(rows)); }

function currency(code) { return currencyMap[code] || { code, name: code, flag: '🌐', symbol: code }; }

function formatNumber(value, max = 6) {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  let decimals = max;
  if (abs >= 1000) decimals = 2;
  else if (abs >= 100) decimals = 3;
  else if (abs >= 1) decimals = 4;
  else if (abs >= 0.01) decimals = 5;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: decimals }).format(value);
}

function formatAmount(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(value);
}

function pairRate(from, to) {
  if (from === to) return 1;
  const fromRate = rateData.rates[from];
  const toRate = rateData.rates[to];
  if (!fromRate || !toRate) return null;
  return toRate / fromRate;
}

function render() {
  list.innerHTML = '';
  rows.forEach((row, index) => {
    const from = currency(row.from), to = currency(row.to);
    const rate = pairRate(row.from, row.to);
    const result = rate == null ? null : Number(row.amount) * rate;

    const card = document.createElement('article');
    card.className = 'conversion-card';
    card.dataset.index = index;
    card.innerHTML = `
      <div class="drag-handle" aria-hidden="true">⋮⋮</div>
      <div class="amount-wrap">
        <span class="field-label">Amount</span>
        <input class="amount-input" inputmode="decimal" value="${escapeHtml(String(row.amount))}" aria-label="Amount" />
      </div>
      <div class="currency-wrap">
        <span class="field-label">From</span>
        <button class="currency-select" data-side="from" type="button" aria-label="Select source currency">
          <span class="currency-main"><span class="flag">${from.flag}</span><span class="currency-code">${from.code}</span></span>
          <span class="chevron">⌄</span>
        </button>
      </div>
      <div class="swap-wrap"><button class="swap-button" type="button" title="Swap currencies" aria-label="Swap currencies">⇄</button></div>
      <div class="currency-wrap">
        <span class="field-label">To</span>
        <button class="currency-select" data-side="to" type="button" aria-label="Select target currency">
          <span class="currency-main"><span class="flag">${to.flag}</span><span class="currency-code">${to.code}</span></span>
          <span class="chevron">⌄</span>
        </button>
      </div>
      <div class="result-wrap">
        <span class="field-label">Result</span>
        <div class="result-value">${result == null ? 'Loading…' : currency(to.code).symbol + formatNumber(result)}</div>
        <div class="result-meta">${rate == null ? 'Fetching latest rate…' : '1 ' + from.code + ' = ' + formatNumber(rate) + ' ' + to.code}</div>
        <div class="result-pair">${row.amount} ${from.code} → ${result == null ? '—' : formatNumber(result)} ${to.code}</div>
      </div>
      <div class="row-actions">
        <button class="row-action swap-action" type="button" title="Swap">⇄</button>
        <button class="row-action copy-action" type="button" title="Duplicate">▣</button>
        <button class="row-action delete" type="button" title="Delete">♲</button>
      </div>
    `;
    list.appendChild(card);
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

function addRow() {
  rows.push({ amount: 1, from: 'USD', to: 'INR' });
  saveRows(); render();
  setTimeout(() => list.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
}

function swapRow(index) {
  const row = rows[index];
  [row.from, row.to] = [row.to, row.from];
  saveRows(); render();
}

function duplicateRow(index) {
  rows.splice(index + 1, 0, { ...rows[index] });
  saveRows(); render();
}

function deleteRow(index) {
  if (rows.length === 1) return showToast('Keep at least one conversion.');
  rows.splice(index, 1); saveRows(); render();
}

function openPicker(index, side) {
  closePicker();
  activePicker = { index, side };
  const backdrop = document.createElement('div');
  backdrop.className = 'picker-backdrop';
  backdrop.id = 'pickerBackdrop';
  backdrop.innerHTML = `
    <div class="picker" role="dialog" aria-modal="true" aria-label="Select currency">
      <div class="picker-head"><h2>Select currency</h2><button class="picker-close" type="button" aria-label="Close">×</button></div>
      <div class="search-wrap"><input class="search-input" id="currencySearch" placeholder="Search currency or code…" autocomplete="off" /></div>
      <div class="currency-options" id="currencyOptions"></div>
    </div>`;
  document.body.appendChild(backdrop);
  const search = backdrop.querySelector('#currencySearch');
  const options = backdrop.querySelector('#currencyOptions');
  const drawOptions = () => {
    const q = search.value.trim().toLowerCase();
    options.innerHTML = '';
    currencies.filter(c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)).forEach(c => {
      const button = document.createElement('button');
      button.className = 'currency-option'; button.type = 'button';
      button.innerHTML = `<span class="flag">${c.flag}</span><strong>${c.code}</strong>`;
      button.addEventListener('click', () => {
        rows[index][side] = c.code; saveRows(); closePicker(); render();
      });
      options.appendChild(button);
    });
  };
  drawOptions(); search.focus(); search.addEventListener('input', drawOptions);
  backdrop.addEventListener('click', e => { if (e.target === backdrop || e.target.closest('.picker-close')) closePicker(); });
}

function closePicker() {
  document.getElementById('pickerBackdrop')?.remove();
  activePicker = null;
}

async function loadRates(force = false) {
  const cached = readCache();
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_MS) {
    rateData = cached;
    updateRateStatus(); render();
    return;
  }

  rateDate.textContent = 'Updating…';
  try {
    const codes = [...new Set(rows.flatMap(r => [r.from, r.to]))];
    const quotes = codes.filter(c => c !== 'EUR').join(',');
    const url = `${API}?base=EUR${quotes ? `&quotes=${encodeURIComponent(quotes)}` : ''}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const rates = { EUR: 1 };
    data.forEach(item => { rates[item.quote] = item.rate; });
    rateData = { rates, date: data[0]?.date || new Date().toISOString().slice(0,10), fetchedAt: Date.now(), source: 'Frankfurter' };
    localStorage.setItem(CACHE_KEY, JSON.stringify(rateData));
    updateRateStatus(); render();
    showToast('Rates updated.');
  } catch (error) {
    if (cached) {
      rateData = cached; updateRateStatus(); render(); showToast('Using cached rates — API unavailable.');
    } else {
      rateDate.textContent = 'Unable to load'; render(); showToast('Could not load rates. Check your connection.');
    }
    console.error(error);
  }
}

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
}

function updateRateStatus() {
  const sourceDate = rateData.date ? new Date(`${rateData.date}T00:00:00Z`) : null;
  const dateText = sourceDate && !Number.isNaN(sourceDate.getTime())
    ? sourceDate.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : 'Latest available';
  rateDate.textContent = dateText;
}

function showToast(message) {
  toast.textContent = message; toast.classList.add('show');
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
}

list.addEventListener('input', event => {
  if (!event.target.classList.contains('amount-input')) return;
  const card = event.target.closest('.conversion-card');
  const index = Number(card.dataset.index);
  const value = Number(event.target.value);
  rows[index].amount = Number.isFinite(value) && value >= 0 ? value : 0;
  saveRows();
  const rate = pairRate(rows[index].from, rows[index].to);
  const result = rate == null ? null : rows[index].amount * rate;
  card.querySelector('.result-value').textContent = result == null ? 'Loading…' : currency(rows[index].to).symbol + formatNumber(result);
  card.querySelector('.result-pair').textContent = `${formatAmount(rows[index].amount)} ${rows[index].from} → ${result == null ? '—' : formatNumber(result)} ${rows[index].to}`;
});

list.addEventListener('click', event => {
  const card = event.target.closest('.conversion-card'); if (!card) return;
  const index = Number(card.dataset.index);
  if (event.target.closest('.currency-select')) return openPicker(index, event.target.closest('.currency-select').dataset.side);
  if (event.target.closest('.swap-button, .swap-action')) return swapRow(index);
  if (event.target.closest('.copy-action')) return duplicateRow(index);
  if (event.target.closest('.delete')) return deleteRow(index);
});

document.getElementById('addRowButton').addEventListener('click', addRow);
document.getElementById('updateRatesButton').addEventListener('click', () => loadRates(true));

document.getElementById('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem(THEME_KEY, document.body.classList.contains('dark') ? 'dark' : 'light');
});

document.addEventListener('keydown', e => { if (e.key === 'Escape') closePicker(); });

if (localStorage.getItem(THEME_KEY) === 'dark') document.body.classList.add('dark');
render();
loadRates();
