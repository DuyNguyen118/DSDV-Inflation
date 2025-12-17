(function () {

  let sectorsData = {};
  let totals = {};
  let macro = {};
  let ioMap = {};
  const FLOW_THRESHOLD = 0.001; 

  function csvToObjects(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].trim().split(',');

    return lines.slice(1).map(line => {
      const values = line.trim().split(',');
      const obj = {};
      headers.forEach((header, i) => {
        const val = values[i];
        obj[header] = isNaN(val) ? val : parseFloat(val);
      });
      return obj;
    });
  }

  async function loadDataAndRun() {
    try {
      const [sectorsRes, macroRes, ioRes] = await Promise.all([
        fetch('data/sectors.csv'),
        fetch('data/macro.csv'),
        fetch('data/io_mapping.csv')
      ]);

      const sectorsRaw = csvToObjects(await sectorsRes.text());
      const macroRaw = csvToObjects(await macroRes.text());
      const ioRaw = csvToObjects(await ioRes.text());

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

      macroRaw.forEach(row => {
        const y = row.year.toString();
        totals[y] = row.headline_cpi;
        macro[y] = {
          gdp: row.gdp,
          unemp: row.unemp,
          realWageLoss: row.real_wage_loss
        };
      });

      ioRaw.forEach(row => {
        if (!ioMap[row.cause]) ioMap[row.cause] = {};
        ioMap[row.cause][row.sector_key] = row.ratio;
      });

      console.log("Data ready.");
      createLegend();
      switchYear('2022'); 
      setupTableToggle(); // Initialize the dropdown logic

    } catch (error) {
      console.error("Error loading CSV:", error);
    }
  }

  function round2(x) { return Number((x).toFixed(2)); }
  function formatPct(x) {
    const n = Number(x);
    return (n > 0 ? '+' : '') + round2(n) + '%';
  }

  // ==================== SUMMARY METRICS ====================
  function updateSummaryCards(year) {
    const m = macro[year];
    const cpi = totals[year];

    const metrics = [
        { label: 'Headline CPI', value: formatPct(cpi), class: 'metric-neutral' },
        { label: 'GDP Growth', value: formatPct(m.gdp), class: 'metric-positive' },
        { label: 'Real Wage Loss', value: formatPct(m.realWageLoss), class: 'metric-negative' },
        { label: 'Unemployment', value: round2(m.unemp) + '%', class: 'metric-neutral' }
    ];

    const container = document.getElementById('sankey-summary-cards');
    container.innerHTML = metrics.map(m => `
        <div class="sankey-metric-item">
            <span class="sankey-metric-label">${m.label}</span>
            <span class="sankey-metric-value ${m.class}">${m.value}</span>
        </div>
    `).join('');
  }

  // ==================== TABLE UPDATE ====================
  function updateTable(year) {
    const tbody = document.getElementById('sankey-table-body');
    tbody.innerHTML = '';

    const d21 = sectorsData["2021"];
    const d22 = sectorsData["2022"];

    if (!d21 || !d22) return; 
    
    d21.forEach(s21 => {
      const s22 = d22.find(x => x.key === s21.key);
      if (!s22) return;

      const delta = s22.change - s21.change;
      const trendSpan = (val, showArrow = true) => {
        if (Math.abs(val) < 0.01) return `<span class="sankey-neutral">${formatPct(val)}</span>`;
        const cls = val > 0 ? 'sankey-trend-up' : 'sankey-trend-down';
        const arrow = showArrow ? (val > 0 ? ' ▲' : ' ▼') : '';
        return `<span class="${cls}">${formatPct(val)}${arrow}</span>`;
      };

      const row = `
        <tr>
          <td>${s21.name}</td>
          <td class="sankey-center sankey-num">${round2(s21.weight)}%</td>
          <td class="sankey-center sankey-num">${trendSpan(s21.change, false)}</td>
          <td class="sankey-center sankey-num">${round2(s22.weight)}%</td>
          <td class="sankey-center sankey-num">${trendSpan(s22.change, false)}</td>
          <td class="sankey-center sankey-num">${trendSpan(delta, true)}</td>
        </tr>
      `;
      tbody.innerHTML += row;
    });

    const deltaTotal = totals["2022"] - totals["2021"];
    const totalTrendSpan = (val, showArrow) => {
      if (Math.abs(val) < 0.01) return `<span class="sankey-neutral">${formatPct(val)}</span>`;
      const cls = val > 0 ? 'sankey-trend-up' : 'sankey-trend-down';
      const arrow = showArrow ? (val > 0 ? ' ▲' : ' ▼') : '';
      return `<span class="${cls}">${formatPct(val)}${arrow}</span>`;
    };

    tbody.innerHTML += `
    <tr class="sankey-total-row">
      <td><strong>HEADLINE CPI</strong></td>
      <td class="sankey-center sankey-num">—</td>
      <td class="sankey-center sankey-num">${totalTrendSpan(totals["2021"], false)}</td>
      <td class="sankey-center sankey-num">—</td>
      <td class="sankey-center sankey-num">${totalTrendSpan(totals["2022"], false)}</td>
      <td class="sankey-center sankey-num">${totalTrendSpan(deltaTotal, true)}</td>
    </tr>
    `;
  }

  // ==================== SANKEY CHART ====================
  function drawSankeyChart(year) {
    const dSectors = sectorsData[year];
    const m = macro[year];

    if (!dSectors || !m) return;

    const causeLabels = ["Global Energy Prices", "Global Inflation", "Credit Policy", "Public Service Adj."];
    const sectorLabels = dSectors.map(s => `${s.name} ${formatPct(s.contrib)}`);
    const totalLabel = `Headline CPI ${totals[year]}%`;
    const consLabels = [
        `GDP Growth ${formatPct(m.gdp)}`, 
        `Unemployment ${round2(m.unemp)}%`, 
        `Real Wage Loss ${formatPct(m.realWageLoss)}`
    ];

    const allLabels = [...causeLabels, ...sectorLabels, totalLabel, ...consLabels];
    
    const idx = (name) => {
        const i = allLabels.findIndex(l => l.startsWith(name));
        return i === -1 ? 0 : i;
    };

    const colors = {
      nodeCause: '#0d1f26',
      nodeSector: '#2d5f73',
      nodeTotal: '#d68910',
      nodeCons: '#c0392b',
      linkPos: 'rgba(46, 204, 113, 0.45)',
      linkNeg: 'rgba(231, 76, 60, 0.45)',
      linkNeu: 'rgba(120, 144, 156, 0.4)'
    };

    const nodeColors = allLabels.map((l, i) => {
      if (i < causeLabels.length) return colors.nodeCause;
      if (i < causeLabels.length + sectorLabels.length) return colors.nodeSector;
      if (l.includes('Headline')) return colors.nodeTotal;
      return colors.nodeCons;
    });

    const sourceIndices = [];
    const targetIndices = [];
    const values = [];
    const linkColors = [];
    const hoverTexts = [];

    const sectorMap = Object.fromEntries(dSectors.map(s => [s.key, s]));

    Object.entries(ioMap).forEach(([causeName, targets]) => {
      Object.entries(targets).forEach(([secKey, ratio]) => {
        const secData = sectorMap[secKey];
        if (!secData) return;

        sourceIndices.push(idx(causeName));
        targetIndices.push(idx(secData.name));

        const baseWidth = Math.abs(secData.contrib) * ratio * 5;
        const width = Math.max(baseWidth, 0.15); 
        values.push(width);

        linkColors.push(colors.linkNeu);
        hoverTexts.push(`${causeName} → ${secData.name}<br>Impact: ${Math.round(ratio * 100)}%`);
      });
    });

    let totalVisualWidth = 0;
    dSectors.forEach(s => {
      sourceIndices.push(idx(s.name));
      targetIndices.push(idx('Headline CPI'));

      const width = Math.abs(s.contrib) * 4;
      values.push(width);
      totalVisualWidth += width;

      const isPositive = s.contrib > 0;
      linkColors.push(isPositive ? colors.linkPos : colors.linkNeg);
      hoverTexts.push(
        `${s.name}<br>` +
        `Weight: ${round2(s.weight)}%<br>` +
        `Price Change: ${formatPct(s.change)}<br>` +
        `CPI Contribution: ${formatPct(s.contrib)}`
      );
    });

    const consNodes = [
      { label: 'GDP Growth', mag: Math.abs(m.gdp), value: m.gdp },
      { label: 'Unemployment', mag: Math.abs(m.unemp), value: m.unemp },
      { label: 'Real Wage Loss', mag: Math.abs(m.realWageLoss), value: m.realWageLoss }
    ];

    const totalMacroMag = consNodes.reduce((sum, n) => sum + n.mag, 0) || 1;

    consNodes.forEach(node => {
      sourceIndices.push(idx('Headline CPI'));
      targetIndices.push(idx(node.label));
      const width = (node.mag / totalMacroMag) * totalVisualWidth;
      values.push(width);
      linkColors.push(colors.linkNeu);
      const valueStr = node.label === 'Unemployment' 
        ? `${round2(node.value)}%` 
        : formatPct(node.value);
      hoverTexts.push(
        `Headline CPI → ${node.label}<br>` +
        `Value: ${valueStr}<br>` +
        `Share of Impact: ${Math.round((node.mag / totalMacroMag) * 100)}%`
      );
    });

    const annotations = [
      { text: 'Macro Drivers', x: 0, y: 1.05, showarrow: false, font: { size: 14, color: '#0d1f26', family: 'Google Sans', weight: 700 }, xanchor: 'left' },
      { text: 'CPI Sectors', x: 0.35, y: 1.05, showarrow: false, font: { size: 14, color: '#2d5f73', family: 'Google Sans', weight: 700 }, xanchor: 'center' },
      { text: 'Headline CPI', x: 0.65, y: 1.05, showarrow: false, font: { size: 14, color: '#d68910', family: 'Google Sans', weight: 700 }, xanchor: 'center' },
      { text: 'Economic Impact', x: 1, y: 1.05, showarrow: false, font: { size: 14, color: '#c0392b', family: 'Google Sans', weight: 700 }, xanchor: 'right' }
    ];

    const data = [{
      type: "sankey",
      orientation: "h",
      arrangement: "snap",
      node: {
        pad: 20,
        thickness: 20,
        line: { color: "white", width: 1 },
        label: allLabels,
        color: nodeColors,
        hoverinfo: 'skip', 
        align: "center",
        textfont: { family: "Google Sans", size: 11, color: "#333" } 
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
      font: { size: 12, family: "Google Sans", color: "#2c3e50" },
      margin: { l: 10, r: 10, t: 30, b: 10 }, 
      height: 500,
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      annotations: annotations
    };

    const config = { displayModeBar: false, responsive: true };
    Plotly.react('sankey-chart', data, layout, config);
  }

  // ==================== LEGEND & TOGGLES ====================
  function createLegend() {
    const container = document.getElementById('sankey-legend-container');
    if (!container || document.getElementById('chartLegend')) return;

    const legend = document.createElement('div');
    legend.id = 'chartLegend';

    const legendItems = [
      { color: 'rgba(46, 204, 113, 0.7)', label: 'Inflationary Pressure' },
      { color: 'rgba(231, 76, 60, 0.7)', label: 'Deflationary Pressure' },
      { color: 'rgba(120, 144, 156, 0.65)', label: 'Neutral Flow' }
    ];

    legend.innerHTML = legendItems.map(item => `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="width: 12px; height: 12px; border-radius: 2px; background: ${item.color};"></span>
        <span>${item.label}</span>
      </div>
    `).join('');

    container.appendChild(legend);
  }

  function setupTableToggle() {
      const btn = document.getElementById('sankey-table-toggle');
      const wrapper = document.getElementById('sankey-details-wrapper');
      
      if(btn && wrapper) {
          btn.addEventListener('click', () => {
              btn.classList.toggle('active');
              wrapper.classList.toggle('open');
          });
      }
  }

  function switchYear(year) {
    document.querySelectorAll('.sankey-year-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.year === year);
    });
    updateSummaryCards(year);
    drawSankeyChart(year);
    updateTable(year);
  }

  document.querySelectorAll('.sankey-year-btn').forEach(btn => {
    btn.addEventListener('click', () => switchYear(btn.dataset.year));
  });

  loadDataAndRun();

})();