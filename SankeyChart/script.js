// ==================== PHẦN 1: TẢI DỮ LIỆU TỪ CSV ====================

// Biến toàn cục (Global Variables) sẽ được gán sau khi tải CSV thành công
let sectorsData = {};
let totals = {};
let macro = {};
let ioMap = {};
const FLOW_THRESHOLD = 0.001; // Giữ nguyên hằng số

// Hàm bổ trợ: Chuyển text CSV thành Array of Objects
function csvToObjects(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].trim().split(',');
  
  return lines.slice(1).map(line => {
    const values = line.trim().split(',');
    const obj = {};
    headers.forEach((header, i) => {
      // Nếu là số thì chuyển thành Number, nếu không giữ nguyên Text
      const val = values[i];
      obj[header] = isNaN(val) ? val : parseFloat(val);
    });
    return obj;
  });
}

// Hàm chính: Tải 3 file, parse và gán vào biến toàn cục
async function loadDataAndRun() {
  try {
    // 1. Tải file
    const [sectorsRes, macroRes, ioRes] = await Promise.all([
      fetch('sectors.csv'),
      fetch('macro.csv'),
      fetch('io_mapping.csv')
    ]);

    // 2. Parse text sang raw data
    const sectorsRaw = csvToObjects(await sectorsRes.text());
    const macroRaw = csvToObjects(await macroRes.text());
    const ioRaw = csvToObjects(await ioRes.text());

    // 3. Tái tạo cấu trúc Object cho các biến toàn cục
    
    // a) Tái tạo sectorsData
    sectorsRaw.forEach(row => {
      const y = row.year.toString();
      if (!sectorsData[y]) sectorsData[y] = [];
      sectorsData[y].push({
        key: row.key,
        name: row.name,
        weight: row.weight,
        change: row.change,
        contrib: row.contrib
      });
    });

    // b) Tái tạo totals và macro
    macroRaw.forEach(row => {
      const y = row.year.toString();
      totals[y] = row.headline_cpi;
      macro[y] = {
        gdp: row.gdp,
        unemp: row.unemp,
        realWageLoss: row.real_wage_loss
      };
    });

    // c) Tái tạo ioMap
    ioRaw.forEach(row => {
      if (!ioMap[row.cause]) ioMap[row.cause] = {};
      ioMap[row.cause][row.sector_key] = row.ratio;
    });

    // 4. Kích hoạt ứng dụng
    console.log("Dữ liệu đã sẵn sàng! sectorsData, totals, macro, ioMap đã được gán.");
    
    // Chạy logic vẽ lần đầu
    createLegend();
    switchYear('2022');

  } catch (error) {
    console.error("Lỗi khi tải dữ liệu từ CSV. Vui lòng đảm bảo chạy trên Live Server:", error);
    const container = document.getElementById('main-container') || document.body;
    container.innerHTML = '<h1>Lỗi tải dữ liệu. Cần chạy ứng dụng trên Local Server (ví dụ: Live Server trong VS Code) và đảm bảo các file CSV đúng tên.</h1>';
  }
}


// ==================== PHẦN 2: HELPERS (GIỮ NGUYÊN) ====================
function round2(x) { 
  return Number((x).toFixed(2)); 
}

function formatPct(x) {
  const n = Number(x);
  return (n > 0 ? '+' : '') + round2(n) + '%';
}

function getVar(name) {
  // Hàm này có vẻ không được dùng trong logic data/chart, giữ lại nếu cần cho CSS
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ==================== SUMMARY CARDS (GIỮ NGUYÊN) ====================
function updateSummaryCards(year) {
  const m = macro[year];
  const cpi = totals[year];
  
  const cards = [
    { label: 'Headline CPI', value: formatPct(cpi), trend: cpi > 0 ? 'up' : 'down' },
    { label: 'GDP Growth', value: formatPct(m.gdp), trend: m.gdp > 0 ? 'up' : 'down' },
    // Unemployment là ngoại lệ: trend-up nghĩa là chỉ số thất nghiệp giảm (tốt)
    { label: 'Unemployment', value: round2(m.unemp) + '%', trend: m.unemp < (macro["2021"].unemp || 0) ? 'down' : 'up' }, 
    { label: 'Real Wage Loss', value: formatPct(m.realWageLoss), trend: m.realWageLoss < 0 ? 'down' : 'up' }
  ];

  const container = document.getElementById('summaryCards');
  container.innerHTML = cards.map(c => `
    <div class="summary-card">
      <div class="summary-label">${c.label}</div>
      <div class="summary-value ${c.trend === 'up' ? 'trend-up' : 'trend-down'}">
        ${c.value}
      </div>
    </div>
  `).join('');
}

// ==================== TABLE (GIỮ NGUYÊN) ====================
function updateTable(year) {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  const d21 = sectorsData["2021"];
  const d22 = sectorsData["2022"];

  if (!d21 || !d22) return; // Bảo vệ nếu data chưa tải

  d21.forEach(s21 => {
    const s22 = d22.find(x => x.key === s21.key);
    if (!s22) return;
    
    const delta = s22.change - s21.change;
    
    // Helper to create colored trend spans with arrows
    const trendSpan = (val, showArrow = true) => {
      if (Math.abs(val) < 0.01) return `<span class="neutral">${formatPct(val)}</span>`;
      const cls = val > 0 ? 'trend-up' : 'trend-down';
      const arrow = showArrow ? (val > 0 ? ' ▲' : ' ▼') : '';
      return `<span class="${cls}">${formatPct(val)}${arrow}</span>`;
    };

    const row = `
      <tr>
        <td style="font-weight:600">${s21.name}</td>
        <td class="center num">${round2(s21.weight)}%</td>
        <td class="center num">${trendSpan(s21.change, false)}</td>
        <td class="center num">${round2(s22.weight)}%</td>
        <td class="center num">${trendSpan(s22.change, false)}</td>
        <td class="center num">${trendSpan(delta, true)}</td>
      </tr>
    `;
    tbody.innerHTML += row;
  });

  // Total row
  const deltaTotal = totals["2022"] - totals["2021"];
  const totalTrendSpan = (val, showArrow) => {
    if (Math.abs(val) < 0.01) return `<span class="neutral">${formatPct(val)}</span>`;
    const cls = val > 0 ? 'trend-up' : 'trend-down';
    const arrow = showArrow ? (val > 0 ? ' ▲' : ' ▼') : '';
    return `<span class="${cls}">${formatPct(val)}${arrow}</span>`;
  };

  tbody.innerHTML += `
    <tr class="total-row">
      <td>HEADLINE CPI</td>
      <td class="center num">—</td>
      <td class="center num">${totalTrendSpan(totals["2021"], false)}</td>
      <td class="center num">—</td>
      <td class="center num">${totalTrendSpan(totals["2022"], false)}</td>
      <td class="center num">${totalTrendSpan(deltaTotal, true)}</td>
    </tr>
  `;
}

// ==================== SANKEY CHART (GIỮ NGUYÊN) ====================
function drawChart(year) {
  const dSectors = sectorsData[year];
  const m = macro[year];
  
  if (!dSectors || !m) return; // Bảo vệ nếu data chưa tải

  const causeLabels = ["Global Energy Prices", "Global Inflation", "Credit Policy", "Public Service Adj."];
  const sectorLabels = dSectors.map(s => `${s.name}\n${formatPct(s.contrib)}`);
  const totalLabel = `Headline CPI\n${totals[year]}%`;
  const consLabels = [
    `GDP Growth\n${formatPct(m.gdp)}`,
    `Unemployment\n${round2(m.unemp)}%`,
    `Real Wage Loss\n${formatPct(m.realWageLoss)}`
  ];

  const allLabels = [...causeLabels, ...sectorLabels, totalLabel, ...consLabels];

  const idx = (name) => allLabels.findIndex(l => l.startsWith(name));

  // Màu nodes - Macro đen hơn để dễ phân biệt
  const colors = {
    nodeCause: '#0d1f26',      // Đen hơn nhiều
    nodeSector: '#2d5f73',     // Xanh sector
    nodeTotal: '#d68910',      // Vàng cam headline
    nodeCons: '#c0392b',       // Đỏ impact
    linkPos: 'rgba(46, 204, 113, 0.45)',    // Pastel xanh lá
    linkNeg: 'rgba(231, 76, 60, 0.45)',     // Pastel đỏ
    linkNeu: 'rgba(120, 144, 156, 0.4)'     // Pastel xám
  };

  const nodeColors = allLabels.map((l, i) => {
    if (i < causeLabels.length) return colors.nodeCause;
    if (i < causeLabels.length + sectorLabels.length) return colors.nodeSector;
    if (l.startsWith('Headline')) return colors.nodeTotal;
    return colors.nodeCons;
  });

  const sourceIndices = [];
  const targetIndices = [];
  const values = [];
  const linkColors = [];
  const hoverTexts = [];

  const sectorMap = Object.fromEntries(dSectors.map(s => [s.key, s]));

  // 1. Macro -> Sectors (với minimum flow value để tránh nodes bị nhảy)
  Object.entries(ioMap).forEach(([causeName, targets]) => {
    Object.entries(targets).forEach(([secKey, ratio]) => {
      const secData = sectorMap[secKey];
      if (!secData) return;

      const targetIndex = idx(secData.name);
      sourceIndices.push(idx(causeName));
      targetIndices.push(targetIndex);

      // Tăng minimum width để nodes không bị nhảy
      const baseWidth = Math.abs(secData.contrib) * ratio * 5;
      const width = Math.max(baseWidth, 0.15); // Minimum width = 0.15
      values.push(width);

      linkColors.push(colors.linkNeu);
      hoverTexts.push(
        `<b>${causeName}</b><br>→<br><b>${secData.name}</b><br>Impact Weight: ${Math.round(ratio * 100)}%`
      );
    });
  });

  // 2. Sectors -> Headline
  let totalVisualWidth = 0;
  dSectors.forEach(s => {
    const sourceIndex = idx(s.name);
    sourceIndices.push(sourceIndex);
    targetIndices.push(idx('Headline CPI'));

    const width = Math.abs(s.contrib) * 4;
    values.push(width);
    totalVisualWidth += width;

    const isPositive = s.contrib > 0;
    linkColors.push(isPositive ? colors.linkPos : colors.linkNeg);
    hoverTexts.push(
      `<b>${s.name}</b><br>` +
      `Weight: ${round2(s.weight)}%<br>` +
      `Price Change: ${formatPct(s.change)}<br>` +
      `<b>CPI Contribution: ${formatPct(s.contrib)}</b>`
    );
  });

  // 3. Headline -> Impact
  const consNodes = [
    { label: 'GDP Growth', mag: Math.abs(m.gdp), value: formatPct(m.gdp) },
    { label: 'Unemployment', mag: Math.abs(m.unemp), value: round2(m.unemp) + '%' },
    { label: 'Real Wage Loss', mag: Math.abs(m.realWageLoss), value: formatPct(m.realWageLoss) }
  ];

  const totalMacroMag = consNodes.reduce((sum, n) => sum + n.mag, 0) || 1;

  consNodes.forEach(node => {
    sourceIndices.push(idx('Headline CPI'));
    targetIndices.push(idx(node.label));

    const width = (node.mag / totalMacroMag) * totalVisualWidth;
    values.push(width);
    linkColors.push(colors.linkNeu);
    hoverTexts.push(`<b>Economic Impact</b><br>${node.label}: ${node.value}`);
  });

  // Annotations - Tên sections trên đầu biểu đồ
  const annotations = [
    { 
      text: 'Macro Drivers', 
      x: 0.05, y: 1.06, 
      showarrow: false, 
      font: { size: 14, color: '#2c3e50', family: 'Inter', weight: 600 }, 
      xanchor: 'center' 
    },
    { 
      text: 'CPI Sectors', 
      x: 0.35, y: 1.06, 
      showarrow: false, 
      font: { size: 14, color: '#2c3e50', family: 'Inter', weight: 600 }, 
      xanchor: 'center' 
    },
    { 
      text: 'Headline CPI', 
      x: 0.65, y: 1.06, 
      showarrow: false, 
      font: { size: 14, color: '#2c3e50', family: 'Inter', weight: 600 }, 
      xanchor: 'center' 
    },
    { 
      text: 'Economic Impact', 
      x: 0.95, y: 1.06, 
      showarrow: false, 
      font: { size: 14, color: '#2c3e50', family: 'Inter', weight: 600 }, 
      xanchor: 'center' 
    }
  ];

  const data = [{
    type: "sankey",
    orientation: "h",
    arrangement: "snap",
    node: {
      pad: 20,
      thickness: 30,  // Tăng từ 25 lên 30 để nodes to hơn
      line: { color: "white", width: 2 },
      label: allLabels,
      color: nodeColors,
      hovertemplate: '<b>%{label}</b><extra></extra>',
      align: "center"
    },
    link: {
      source: sourceIndices,
      target: targetIndices,
      value: values,
      color: linkColors,
      customdata: hoverTexts,
      hovertemplate: '%{customdata}<extra></extra>'
    }
  }];

  const layout = {
    font: { size: 11, family: "Inter", color: "#2c3e50" },
    margin: { l: 20, r: 20, t: 50, b: 20 },  // Tăng margin top để có chỗ cho annotations
    height: 700,
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    annotations: annotations
  };

  const config = { displayModeBar: false, responsive: true };

  Plotly.react('chart', data, layout, config);
}

// ==================== LEGEND CREATION (GIỮ NGUYÊN) ====================
function createLegend() {
  const chartContainer = document.getElementById('chart');
  
  // Check if legend already exists
  if (document.getElementById('chartLegend')) return;
  
  const legend = document.createElement('div');
  legend.id = 'chartLegend';
  legend.style.cssText = `
    display: flex;
    gap: 20px;
    margin-top: 16px;
    font-size: 13px;
    color: var(--text-secondary);
    flex-wrap: wrap;
    padding: 14px 18px;
    background: var(--card-bg);
    border-radius: 8px;
    border: 1px solid #e0e6ea;
  `;
  
  const legendItems = [
    { color: '#0d1f26', label: 'Macro Drivers' },
    { color: '#2d5f73', label: 'CPI Sectors' },
    { color: '#d68910', label: 'Headline CPI' },
    { color: '#c0392b', label: 'Economic Impact' },
    { type: 'divider' },
    { color: 'rgba(46, 204, 113, 0.7)', label: 'Inflationary Pressure' },
    { color: 'rgba(231, 76, 60, 0.7)', label: 'Deflationary Pressure' },
    { color: 'rgba(120, 144, 156, 0.65)', label: 'Neutral Flow' }
  ];
  
  legend.innerHTML = legendItems.map(item => {
    if (item.type === 'divider') {
      return '<div style="width: 1px; height: 20px; background: #e0e6ea; margin: 0 8px;"></div>';
    }
    return `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="width: 14px; height: 14px; border-radius: 3px; background: ${item.color}; flex-shrink: 0;"></span>
        <span>${item.label}</span>
      </div>
    `;
  }).join('');
  
  chartContainer.parentNode.insertBefore(legend, chartContainer.nextSibling);
}

// ==================== YEAR SWITCHING (GIỮ NGUYÊN) ====================
function switchYear(year) {
  document.querySelectorAll('.year-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.year === year);
  });

  updateSummaryCards(year);
  drawChart(year);
  updateTable(year);
}

// ==================== PHẦN 3: KÍCH HOẠT ====================

// Event Listeners (Giữ nguyên)
document.querySelectorAll('.year-btn').forEach(btn => {
  btn.addEventListener('click', () => switchYear(btn.dataset.year));
});

// INIT: Bắt đầu tải dữ liệu và sau đó chạy ứng dụng
loadDataAndRun();