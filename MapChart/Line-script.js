// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function () {
  // ---- 1. Load Vietnam data from WDI CSVs ----
  console.log("Loading data...");
  Promise.all([
    d3.csv("data/inflation-consumer-price.csv"),
    d3.csv("data/gdp-growth-rate.csv"),
  ]).then(([inflRaw, gdpRaw]) => {
    console.log("Data loaded, processing...");
    const inflRow = inflRaw.find(
      (d) =>
        d["Country Code"] === "VNM" &&
        d["Indicator Code"] === "FP.CPI.TOTL.ZG"
    );
    const gdpRow = gdpRaw.find(
      (d) =>
        d["Country Code"] === "VNM" &&
        d["Indicator Code"] === "NY.GDP.MKTP.KD.ZG"
    );

    if (!inflRow || !gdpRow) {
      console.error("Could not find Vietnam rows in CSV files.");
      return;
    }

    const yearKeys = Object.keys(inflRow).filter((k) => /^\d{4}$/.test(k));
    const years = yearKeys.map((y) => +y);

    const data = years
      .map((year) => {
        const inflVal = parseFloat(inflRow[year]);
        const gdpVal = parseFloat(gdpRow[year]);
        if (isNaN(inflVal) || isNaN(gdpVal)) return null;
        return { year, inflation: inflVal, gdp: gdpVal };
      })
      .filter((d) => d !== null);

    drawChart(data);
  }).catch(error => {
    console.error("Error loading CSV data:", error);
  });
});

// ---- 2. Chart with hover + dynamic annotations ----
function drawChart(data) {
  const container = window.d3.select("#vietnam-chart-container")
  container.select("svg").remove() // Clear any existing chart

  const width = 700
  const height = 400

  const svg = container
    .append("svg")
    .attr("id", "vietnam-chart")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")

  const margin = { top: 32, right: 64, bottom: 40, left: 56 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`)

  svg
    .append("defs")
    .append("clipPath")
    .attr("id", "chart-clip")
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", innerWidth)
    .attr("height", innerHeight)

  const tooltip = window.d3.select("#line-tooltip")
    .style("background-color", "rgba(31, 41, 55, 0.95)")
    .style("color", "#ffffff")
    .style("padding", "8px")
    .style("border-radius", "4px")
    .style("border", "1px solid #4b5563")
    .style("font-size", "12px");

  const axisToggleInput = document.getElementById("axis-toggle-input")
  const labelDual = document.getElementById("label-dual")
  const labelSingle = document.getElementById("label-single")

  let axisMode = "dual" // 'dual' or 'single'

  // Sync the checkbox with the initial mode
  axisToggleInput.checked = false // false for dual axis
  labelDual.classList.add('active')
  labelSingle.classList.remove('active')

  const x = window.d3
    .scaleLinear()
    .domain(window.d3.extent(data, (d) => d.year))
    .range([0, innerWidth])

  const yInflation = window.d3.scaleLinear().range([innerHeight, 0])
  const yGDP = window.d3.scaleLinear().range([innerHeight, 0])

  updateYDomains()

  const originalXDomain = x.domain().slice()

  const xAxis = window.d3.axisBottom(x).tickFormat(window.d3.format("d")).ticks(10)

  const yAxisLeft = window.d3.axisLeft(yInflation).ticks(6)
  const yAxisRight = window.d3.axisRight(yGDP).ticks(6)

  const xAxisG = g
    .append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .attr("class", "x-axis")
    .call(xAxis)
    .call((g) => g.selectAll("text").style("fill", "#4b5563").style("font-size", "11px"))
    .call((g) => g.selectAll("line").style("stroke", "#d1d5dbbb"))
    .call((g) => g.select(".domain").style("stroke", "#d1d5dbbb"))

  const yAxisLeftG = g
    .append("g")
    .attr("class", "y-axis y-axis-left")
    .call(yAxisLeft)
    .call((g) => g.selectAll("text").style("fill", "#60a5fa").style("font-size", "11px"))
    .call((g) => g.selectAll("line").style("stroke", "#d1d5dbbb").style("stroke-opacity", 1))
    .call((g) => g.select(".domain").style("stroke", "#d1d5dbbb"))

  const yAxisRightG = g
    .append("g")
    .attr("class", "y-axis y-axis-right")
    .attr("transform", `translate(${innerWidth},0)`)
    .call(yAxisRight)
    .call((g) => g.selectAll("text").style("fill", "#fb7185").style("font-size", "11px"))
    .call((g) => g.selectAll("line").remove())
    .call((g) => g.select(".domain").style("stroke", "#d1d5dbbb"))

  const yInflLabel = svg
    .append("text")
    .attr("x", margin.left - 40)
    .attr("y", margin.top - 10)
    .attr("fill", "#60a5fa")
    .attr("font-size", 11)
    .attr("font-family", "Inter, sans-serif")
    .text("Inflation (%)")

  const yGDPLabel = svg
    .append("text")
    .attr("x", width - margin.right + 30)
    .attr("y", margin.top - 10)
    .attr("fill", "#fb7185")
    .attr("font-size", 11)
    .attr("font-family", "Inter, sans-serif")
    .style("text-anchor", "end")
    .text("GDP growth (%)")

  const gridG = g
    .append("g")
    .attr("class", "grid")
    .call(window.d3.axisLeft(yInflation).ticks(6).tickSize(-innerWidth).tickFormat(""))
    .call((g) => g.selectAll("line").style("stroke", "#e5e7eb").style("stroke-opacity", 0.7))
    .call((g) => g.select(".domain").remove())

  const clippedGroup = g.append("g").attr("clip-path", "url(#chart-clip)")

  const lineInflation = window.d3
    .line()
    .x((d) => x(d.year))
    .y((d) => yInflation(d.inflation))
    .curve(d3.curveLinear)

  const lineGDP_dual = window.d3
    .line()
    .x((d) => x(d.year))
    .y((d) => yGDP(d.gdp))
    .curve(d3.curveLinear)

  const lineGDP_single = window.d3
    .line()
    .x((d) => x(d.year))
    .y((d) => yInflation(d.gdp))
    .curve(d3.curveLinear)

  const inflationPath = clippedGroup
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#38bdf8")
    .attr("stroke-width", 2)
    .attr("d", lineInflation)

  const gdpPath = clippedGroup
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#fb7185")
    .attr("stroke-width", 2)
    .attr("d", lineGDP_dual)
  ;[inflationPath, gdpPath].forEach((path) => {
    const length = path.node().getTotalLength()
    path
      .attr("stroke-dasharray", `${length} ${length}`)
      .attr("stroke-dashoffset", length)
      .transition()
      .duration(1400)
      .ease(window.d3.easeCubicOut)
      .attr("stroke-dashoffset", 0)
  })

  const focusGroup = clippedGroup.append("g")

  const focusLine = focusGroup
    .append("line")
    .attr("stroke", "#d1d5dbbb")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "4 4")
    .style("opacity", 0)

  const focusInflationDot = focusGroup
    .append("circle")
    .attr("r", 4)
    .attr("fill", "#38bdf8")
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 1.5)
    .style("opacity", 0)

  const focusGDPDot = focusGroup
    .append("circle")
    .attr("r", 4)
    .attr("fill", "#fb7185")
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 1.5)
    .style("opacity", 0)

  const hoverAnnotationGroup = g.append("g")

  const overlay = g
    .append("rect")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent")
    .on("mousemove", handleMove)
    .on("mouseenter", handleEnter)
    .on("mouseleave", handleLeave)

  const bisectYear = window.d3.bisector((d) => d.year).center

  // Data-driven interesting events
  const eventNotes = {
    1996: "Normalization: Economy stabilizes post-Doi Moi reforms.",
        1997: "Asian Financial Crisis: Regional impact dampens growth.",
        1998: "Crisis Impact: Growth slows, inflation rises moderately.",
        1999: "Recovery: Inflation stabilizes, growth begins to recover.",
        2000: "Deflation: Weak domestic demand despite growth.",
        2001: "Deflation continues: Global slowdown impacts prices.",
        2002: "Recovery: Domestic demand picks up, prices normalize.",
        2003: "Expansion: Strong growth, mild inflation.",
        2004: "Heating Up: Rapid credit growth fuels inflation.",
        2005: "Pre-WTO Boom: Strong investment drives prices up.",
        2006: "High Growth: Economy overheats before WTO entry.",
        2007: "WTO Accession: Massive capital inflows, asset bubbles.",
        2008: "Crisis Spike: Oil >$140/bbl + internal overheating.",
        2009: "Stimulus: Gov pumps money to counter global crisis.",
        2010: "Instability: Devaluation & stimulus lag effects.",
        2011: "Peak Instability: Resolution 11 passes to curb inflation.",
        2012: "Stabilization: Credit tightening cools the economy.",
        2013: "Single Digit: Inflation successfully brought under control.",
        2014: "Low Oil: Global oil collapse aids price stability.",
        2015: "Golden Era: High growth, record low inflation.",
        2016: "Stable Growth: Robust exports, stable macro.",
        2017: "Broad Growth: Strong FDI, controlled CPI.",
        2018: "Trade War: Vietnam benefits, manufacturing boom.",
        2019: "Peak Stability: 7% growth with <3% inflation.",
        2020: "COVID-19: Demand shock crashes inflation.",
        2021: "Supply Crunch: Low base effect, supply chain issues.",
        2022: "The Divergence: High growth vs controlled CPI (subsidies).",
        2023: "Global Slowdown: External demand weakens growth.",
        2024: "Recovery: Gradual return to trend growth."
  }

  function handleEnter() {
    focusLine.style("opacity", 1)
    focusInflationDot.style("opacity", 1)
    focusGDPDot.style("opacity", 1)
    tooltip.style("opacity", 1)
  }

  function handleLeave() {
    focusLine.style("opacity", 0)
    focusInflationDot.style("opacity", 0)
    focusGDPDot.style("opacity", 0)
    tooltip.style("opacity", 0)
    hoverAnnotationGroup.selectAll("*").remove()
  }

  function handleMove(event) {
    const [xm] = window.d3.pointer(event)
    const yearVal = x.invert(xm)
    const idx = bisectYear(data, yearVal)
    const d = data[idx]

    if (!d) return

    const xPos = x(d.year)
    const yInfl = yInflation(d.inflation)
    const yGdp = axisMode === "dual" ? yGDP(d.gdp) : yInflation(d.gdp)

    focusLine.attr("x1", xPos).attr("x2", xPos).attr("y1", 0).attr("y2", innerHeight)
    focusInflationDot.attr("cx", xPos).attr("cy", yInfl)
    focusGDPDot.attr("cx", xPos).attr("cy", yGdp)

    const [pageX, pageY] = window.d3.pointer(event, document.body)
    tooltip
      .style("left", `${pageX + 15}px`)
      .style("top", `${pageY - 28}px`)
      .html(
        `<strong>${d.year}</strong><br/>
         CPI inflation: ${d.inflation.toFixed(2)}%<br/>
         GDP growth: ${d.gdp.toFixed(2)}%`,
      )

    // Dynamic annotation for interesting years
    hoverAnnotationGroup.selectAll("*").remove();
    const note = eventNotes[d.year];
    if (note) {
      const padding = 10;
      const lineHeight = 16;
      const maxWidth = 200;
      const words = note.split(/\s+/);
      let line = '';
      const lines = [];
      
      // Simple word wrapping
      for (const word of words) {
        const testLine = line ? line + ' ' + word : word;
        const testWidth = getTextWidth(testLine, '11px Google Sans');
        if (testWidth <= maxWidth - (2 * padding)) {
          line = testLine;
        } else {
          if (line) lines.push(line);
          line = word;
        }
      }
      if (line) lines.push(line);
      
      // Calculate box dimensions
      const yearWidth = getTextWidth(`${d.year}:`, 'bold 12px Google Sans');
      let maxLineW = yearWidth;
      lines.forEach(l => {
        maxLineW = Math.max(maxLineW, getTextWidth(l, '11px Google Sans'));
      });
      
      const boxWidth = Math.min(maxWidth, maxLineW + 2 * padding);
      const boxHeight = (lines.length + 1) * lineHeight + (2 * padding);
      
      // Calculate position
      const boxX = xPos + 15 + boxWidth > innerWidth 
        ? xPos - 15 - boxWidth
        : xPos + 15;
        
      const boxY = 15;
      
      // Create box with improved styling
      hoverAnnotationGroup
        .append("rect")
        .attr("x", boxX)
        .attr("y", boxY)
        .attr("rx", 6)
        .attr("ry", 6)
        .attr("width", boxWidth)
        .attr("height", boxHeight)
        .attr("fill", "rgba(255, 255, 255, 0.95)")
        .attr("stroke", "#eb99a6ea")
        .attr("stroke-width", 2)
        .attr("filter", "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))");
      
      // Add year text
      hoverAnnotationGroup
        .append("text")
        .attr("x", boxX + padding)
        .attr("y", boxY + padding)
        .attr("font-weight", "bold")
        .attr("fill", "#1f2937")
        .attr("font-size", "12px")
        .attr("font-family", "Google Sans, sans-serif")
        .attr("dominant-baseline", "hanging")  
        .text(`${d.year}:`);
      
      // Add wrapped text lines
      lines.forEach((lineText, i) => {
        hoverAnnotationGroup
          .append("text")
          .attr("x", boxX + padding)
          .attr("y", boxY + padding + lineHeight * (i + 1))
          .attr("fill", "#374151")
          .attr("font-size", "11px")
          .attr("font-family", "Google Sans, sans-serif")
          .attr("dominant-baseline", "hanging")  
          .text(lineText);
      });
    }
  }

  // Helper function to calculate text width
  function getTextWidth(text, font) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = font;
    return context.measureText(text).width;
  }

  axisToggleInput.addEventListener("change", function () {
    axisMode = this.checked ? "single" : "dual"
    
    // Update active labels
    if (axisMode === "dual") {
      labelDual.classList.add('active')
      labelSingle.classList.remove('active')
    } else {
      labelDual.classList.remove('active')
      labelSingle.classList.add('active')
    }
    
    updateYDomains()
    redrawAxesAndLines(true)
  })

  function updateYDomains() {
    const minInfl = window.d3.min(data, (d) => d.inflation)
    const maxInfl = window.d3.max(data, (d) => d.inflation)
    const minGdp = window.d3.min(data, (d) => d.gdp)
    const maxGdp = window.d3.max(data, (d) => d.gdp)

    if (axisMode === "dual") {
      yInflation.domain([Math.min(0, minInfl), maxInfl * 1.1])
      yGDP.domain([Math.min(0, minGdp), maxGdp * 1.15])
    } else {
      const overallMin = Math.min(0, minInfl, minGdp)
      const overallMax = Math.max(maxInfl, maxGdp)
      yInflation.domain([overallMin, overallMax * 1.1])
    }
  }

  function redrawAxesAndLines(withTransition = false) {
    const t = withTransition ? svg.transition().duration(500) : svg.transition().duration(0)

    xAxisG.transition(t).call(xAxis)

if (axisMode === "dual") {
  yAxisLeftG.transition(t).call(yAxisLeft)
  yAxisRightG.transition(t).style("opacity", 1).call(yAxisRight)
  yInflLabel.text("Inflation (%)")
  yGDPLabel.text("GDP growth (%)")
  yGDPLabel.style("opacity", 1)
  gdpPath.attr("stroke", "#fb7185")
} else {
  yAxisLeftG.transition(t).call(yAxisLeft)
  yAxisRightG.transition(t).style("opacity", 0)
  yInflLabel.text("Inflation & GDP growth (%)")
  yGDPLabel.text("")
  yGDPLabel.style("opacity", 0)
  gdpPath.attr("stroke", "#fb7185") 
}

    gridG
      .transition(t)
      .call(window.d3.axisLeft(yInflation).ticks(6).tickSize(-innerWidth).tickFormat(""))
      .call((g) => g.select(".domain").remove())

    inflationPath.datum(data).transition(t).attr("d", lineInflation)

    if (axisMode === "dual") {
      gdpPath.datum(data).transition(t).attr("d", lineGDP_dual)
    } else {
      gdpPath.datum(data).transition(t).attr("d", lineGDP_single)
    }
  }

  const zoom = window.d3
    .zoom()
    .scaleExtent([1, 8])
    .translateExtent([
      [0, 0],
      [innerWidth, innerHeight],
    ])
    .extent([
      [0, 0],
      [innerWidth, innerHeight],
    ])
    .on("zoom", (event) => {
      // Create new x scale with the zoomed domain
      const newX = event.transform.rescaleX(window.d3.scaleLinear().domain(originalXDomain).range([0, innerWidth]))
      
      // Update the main x scale domain
      const [x0, x1] = newX.domain()
      x.domain([x0, x1])
      
      // Filter data to visible domain for better performance
      const visibleData = data.filter(d => d.year >= Math.floor(x0) && d.year <= Math.ceil(x1))
      const displayData = visibleData.length > 0 ? visibleData : data

      // In the zoom event handler, update the axis call to include line styles:
xAxisG.call(xAxis)
  .selectAll("text")
  .style("font-size", "11px")
  .style("font-family", "Google Sans, sans-serif")
  .style("fill", "#4b5563");  // Ensure text color is consistent

// Add this after the xAxisG call to style the axis lines
xAxisG.selectAll(".domain")
  .style("stroke", "#d1d5dbbb")
  .style("stroke-width", "1px");

// Style the tick lines
xAxisG.selectAll(".tick line")
  .style("stroke", "#e5e7eb")
  .style("stroke-opacity", "0.7")
  .style("shape-rendering", "crispEdges");

      // Redraw the lines with the updated x scale and filtered data
      inflationPath.datum(displayData).attr("d", lineInflation)

      if (axisMode === "dual") {
        gdpPath.datum(displayData).attr("d", lineGDP_dual)
      } else {
        gdpPath.datum(displayData).attr("d", lineGDP_single)
      }
    })
  overlay.call(zoom)
}

// Load and process data from multiple CSV files
Promise.all([
  d3.csv("data/inflation-consumer-price.csv"),
  d3.csv("data/gdp-growth-rate.csv")
]).then(([inflationData, gdpData]) => {
  // Process inflation data for Vietnam
  const vietnamInflation = inflationData
    .filter(d => d['Country Name'] === 'Vietnam')
    .map(d => {
      const entry = { year: +d.Year, inflation: +d['Inflation, consumer prices (annual %)'] };
      return !isNaN(entry.year) && !isNaN(entry.inflation) ? entry : null;
    })
    .filter(Boolean);
  // Process GDP data for Vietnam
  const vietnamGDP = gdpData
    .filter(d => d['Country Name'] === 'Vietnam')
    .map(d => {
      const entry = { year: +d.Year, gdp: +d['GDP growth (annual %)'] };
      return !isNaN(entry.year) && !isNaN(entry.gdp) ? entry : null;
    })
    .filter(Boolean);
  // Merge the data
  const combinedData = [];
  const allYears = new Set([
    ...vietnamInflation.map(d => d.year),
    ...vietnamGDP.map(d => d.year)
  ]);
  allYears.forEach(year => {
    const inflationEntry = vietnamInflation.find(d => d.year === year);
    const gdpEntry = vietnamGDP.find(d => d.year === year);
    
    if (inflationEntry || gdpEntry) {
      combinedData.push({
        year,
        inflation: inflationEntry?.inflation,
        gdp: gdpEntry?.gdp
      });
    }
  });
  // Sort by year and draw the chart
  combinedData.sort((a, b) => a.year - b.year);
  drawChart(combinedData);
  })
  .catch((error) => {
    console.warn("CSV not found, using fallback data:", error)
    // Use inline fallback data for Vietnam CPI and GDP
    const fallbackData = [
      { year: 1996, inflation: 4.5, gdp: 9.3 },
      { year: 1997, inflation: 3.6, gdp: 8.2 },
      { year: 1998, inflation: 7.3, gdp: 5.8 },
      { year: 1999, inflation: 4.1, gdp: 4.8 },
      { year: 2000, inflation: -1.7, gdp: 6.8 },
      { year: 2001, inflation: -0.4, gdp: 6.9 },
      { year: 2002, inflation: 4.0, gdp: 7.1 },
      { year: 2003, inflation: 3.2, gdp: 7.3 },
      { year: 2004, inflation: 7.8, gdp: 7.8 },
      { year: 2005, inflation: 8.3, gdp: 7.5 },
      { year: 2006, inflation: 7.5, gdp: 7.0 },
      { year: 2007, inflation: 8.3, gdp: 7.1 },
      { year: 2008, inflation: 23.1, gdp: 5.7 },
      { year: 2009, inflation: 6.9, gdp: 5.4 },
      { year: 2010, inflation: 8.9, gdp: 6.4 },
      { year: 2011, inflation: 18.7, gdp: 6.2 },
      { year: 2012, inflation: 9.1, gdp: 5.2 },
      { year: 2013, inflation: 6.6, gdp: 5.4 },
      { year: 2014, inflation: 4.1, gdp: 6.0 },
      { year: 2015, inflation: 0.6, gdp: 6.7 },
      { year: 2016, inflation: 2.7, gdp: 6.2 },
      { year: 2017, inflation: 3.5, gdp: 6.8 },
      { year: 2018, inflation: 3.5, gdp: 7.1 },
      { year: 2019, inflation: 2.8, gdp: 7.0 },
      { year: 2020, inflation: 3.2, gdp: 2.9 },
      { year: 2021, inflation: 1.8, gdp: 2.6 },
      { year: 2022, inflation: 3.2, gdp: 8.0 },
      { year: 2023, inflation: 3.3, gdp: 5.0 },
    ]
    drawChart(fallbackData)
  })