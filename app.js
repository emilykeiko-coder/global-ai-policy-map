/* ===== Global AI Policy Map — app.js ===== */

// Country centroid coordinates [lat, lng]
const COUNTRY_COORDS = {
  US: [38.0, -97.0],
  EU: [50.5, 10.5],
  CN: [35.0, 105.0],
  GB: [54.0, -2.0],
  CA: [56.0, -96.0],
  JP: [36.0, 138.0],
  KR: [36.5, 127.5],
  AU: [-27.0, 133.0],
  IN: [22.0, 79.0],
  BR: [-10.0, -55.0],
  SG: [1.35, 103.82],
  DE: [51.2, 10.5],
  FR: [46.5, 2.3],
  IL: [31.5, 35.0],
  ZA: [-29.0, 25.0],
  AE: [24.0, 54.0],
  MX: [23.0, -102.0],
  NG: [9.0, 8.0],
  KE: [-0.5, 37.5],
  RU: [61.0, 100.0],
};

const MATURITY_COLORS = {
  advanced:   '#2ea043',
  developing: '#d29922',
  emerging:   '#e3621b',
  minimal:    '#6e7681',
};

const MATURITY_SIZE = {
  advanced:   20,
  developing: 16,
  emerging:   14,
  minimal:    12,
};

// State
let allCountries = [];
let maturityData = {};
let activeFilters = new Set(['advanced', 'developing', 'emerging', 'minimal']);
let selectedCode = null;
let markers = {};
let map;

// ===== Init =====
async function init() {
  const response = await fetch('data/policies.json');
  const data = await response.json();
  allCountries = data.countries;
  maturityData = data.maturity_levels;

  initMap();
  renderLegend();
  renderCountryList();
  renderMarkers();
  updateStats();
  bindSearch();

  document.getElementById('close-detail').addEventListener('click', closeDetail);
}

// ===== Map =====
function initMap() {
  map = L.map('map', {
    center: [20, 10],
    zoom: 2,
    minZoom: 1.5,
    maxZoom: 8,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);
}

function renderMarkers() {
  // Clear old markers
  Object.values(markers).forEach(m => map.removeLayer(m));
  markers = {};

  allCountries.forEach(country => {
    const coords = COUNTRY_COORDS[country.code];
    if (!coords) return;

    const color = MATURITY_COLORS[country.maturity] || MATURITY_COLORS.minimal;
    const size = MATURITY_SIZE[country.maturity] || 12;

    const icon = L.divIcon({
      className: '',
      html: `<div class="ai-marker" style="width:${size}px;height:${size}px;background:${color};"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -(size / 2 + 6)],
    });

    const marker = L.marker(coords, { icon })
      .bindPopup(buildPopup(country), { maxWidth: 260 })
      .addTo(map);

    marker.on('click', () => selectCountry(country.code));
    markers[country.code] = marker;
  });
}

function buildPopup(country) {
  const color = MATURITY_COLORS[country.maturity];
  const matLabel = maturityData[country.maturity]?.label || country.maturity;
  return `
    <div class="popup-name">${country.name}</div>
    <div class="popup-status">
      <span class="popup-dot" style="background:${color}"></span>
      <span>${matLabel}</span>
    </div>
    <div class="popup-summary">${country.summary.substring(0, 100)}…</div>
    <div class="popup-click-hint">Click marker for full details →</div>
  `;
}

// ===== Legend & Filters =====
function renderLegend() {
  const legend = document.getElementById('legend');
  legend.innerHTML = '';

  const counts = {};
  allCountries.forEach(c => { counts[c.maturity] = (counts[c.maturity] || 0) + 1; });

  Object.entries(maturityData).forEach(([key, info]) => {
    const item = document.createElement('div');
    item.className = 'legend-item active';
    item.dataset.maturity = key;
    item.innerHTML = `
      <span class="legend-dot" style="background:${info.color}"></span>
      <span class="legend-label">${info.label}</span>
      <span class="legend-count">${counts[key] || 0}</span>
    `;
    item.title = info.description;
    item.addEventListener('click', () => toggleFilter(key, item));
    legend.appendChild(item);
  });
}

function toggleFilter(maturity, el) {
  if (activeFilters.has(maturity)) {
    activeFilters.delete(maturity);
    el.classList.remove('active');
    el.classList.add('inactive');
  } else {
    activeFilters.add(maturity);
    el.classList.remove('inactive');
    el.classList.add('active');
  }
  applyFilters();
}

function applyFilters() {
  const items = document.querySelectorAll('.country-list-item');
  items.forEach(item => {
    const maturity = item.dataset.maturity;
    if (activeFilters.has(maturity)) {
      item.classList.remove('hidden-item');
    } else {
      item.classList.add('hidden-item');
    }
  });

  // Show/hide markers
  allCountries.forEach(country => {
    const marker = markers[country.code];
    if (!marker) return;
    if (activeFilters.has(country.maturity)) {
      marker.addTo(map);
    } else {
      map.removeLayer(marker);
    }
  });

  updateListCount();
}

// ===== Country List =====
function renderCountryList() {
  const list = document.getElementById('country-list');
  list.innerHTML = '';

  const sorted = [...allCountries].sort((a, b) => a.name.localeCompare(b.name));

  sorted.forEach(country => {
    const color = MATURITY_COLORS[country.maturity];
    const li = document.createElement('li');
    li.className = 'country-list-item';
    li.dataset.code = country.code;
    li.dataset.maturity = country.maturity;
    li.innerHTML = `
      <span class="country-list-dot" style="background:${color}"></span>
      <span class="country-list-name">${country.name}</span>
      <span class="country-list-year">${country.year}</span>
    `;
    li.addEventListener('click', () => selectCountry(country.code));
    list.appendChild(li);
  });

  updateListCount();
}

function updateListCount() {
  const visible = document.querySelectorAll('.country-list-item:not(.hidden-item)').length;
  document.getElementById('list-count').textContent = visible;
}

// ===== Country Selection & Detail Panel =====
function selectCountry(code) {
  // Update list selection state
  document.querySelectorAll('.country-list-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.code === code);
  });

  selectedCode = code;
  const country = allCountries.find(c => c.code === code);
  if (!country) return;

  // Fly map to country
  const coords = COUNTRY_COORDS[code];
  if (coords) {
    map.flyTo(coords, Math.max(map.getZoom(), 4), { duration: 0.8 });
  }

  // Render detail panel
  renderDetail(country);

  // Scroll list item into view
  const listItem = document.querySelector(`.country-list-item[data-code="${code}"]`);
  if (listItem) listItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function renderDetail(country) {
  const panel = document.getElementById('detail-panel');
  const content = document.getElementById('detail-content');

  const color = MATURITY_COLORS[country.maturity];
  const matLabel = maturityData[country.maturity]?.label || country.maturity;
  const matDesc = maturityData[country.maturity]?.description || '';

  const frameworksHtml = country.frameworks.map(f =>
    `<span class="framework-tag">${f}</span>`
  ).join('');

  const highlightsHtml = country.highlights.map(h =>
    `<li>${h}</li>`
  ).join('');

  const linksHtml = country.links && country.links.length > 0
    ? country.links.map(l =>
        `<a class="detail-link" href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`
      ).join('')
    : '<span style="font-size:0.78rem;color:var(--color-text-muted)">No external links yet</span>';

  content.innerHTML = `
    <div class="detail-header">
      <div class="detail-country-name">${country.name}</div>
      <div class="detail-meta">
        <span class="detail-badge badge-${country.maturity}">
          <span style="width:7px;height:7px;border-radius:50%;background:${color};display:inline-block;"></span>
          ${matLabel}
        </span>
        <span class="detail-year">Since ${country.year}</span>
      </div>
      <div class="detail-authority">
        <strong>Authority:</strong> ${country.authority}
      </div>
      <p class="detail-summary">${country.summary}</p>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Frameworks & Policies</div>
      <div class="framework-tags">${frameworksHtml}</div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Key Highlights</div>
      <ul class="highlights-list">${highlightsHtml}</ul>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Resources</div>
      <div class="detail-links">${linksHtml}</div>
    </div>

    <div class="detail-section" style="margin-top:24px; padding-top:16px; border-top:1px solid var(--color-border)">
      <div style="font-size:0.73rem;color:var(--color-text-muted);font-style:italic;">${matDesc}</div>
    </div>
  `;

  panel.classList.remove('hidden');
}

function closeDetail() {
  document.getElementById('detail-panel').classList.add('hidden');
  document.querySelectorAll('.country-list-item').forEach(el => el.classList.remove('selected'));
  selectedCode = null;
}

// ===== Search =====
function bindSearch() {
  const input = document.getElementById('search-input');
  const dropdown = document.getElementById('search-results');

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      dropdown.classList.add('hidden');
      return;
    }

    const results = allCountries.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.frameworks.some(f => f.toLowerCase().includes(q)) ||
      c.summary.toLowerCase().includes(q)
    ).slice(0, 8);

    if (!results.length) {
      dropdown.classList.add('hidden');
      return;
    }

    dropdown.innerHTML = results.map(c => {
      const color = MATURITY_COLORS[c.maturity];
      const matLabel = maturityData[c.maturity]?.label || c.maturity;
      return `
        <div class="search-result-item" data-code="${c.code}">
          <span class="result-code">${c.code}</span>
          <span class="result-name">${c.name}</span>
          <span class="result-badge" style="color:${color}">${matLabel}</span>
        </div>
      `;
    }).join('');

    dropdown.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        selectCountry(el.dataset.code);
        input.value = '';
        dropdown.classList.add('hidden');
      });
    });

    dropdown.classList.remove('hidden');
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrapper')) {
      dropdown.classList.add('hidden');
    }
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      dropdown.classList.add('hidden');
      input.value = '';
    }
  });
}

// ===== Stats =====
function updateStats() {
  document.getElementById('stat-total').textContent = allCountries.length;
  document.getElementById('stat-advanced').textContent =
    allCountries.filter(c => c.maturity === 'advanced').length;
  document.getElementById('stat-developing').textContent =
    allCountries.filter(c => c.maturity === 'developing').length;
}

// ===== Bootstrap =====
document.addEventListener('DOMContentLoaded', init);
