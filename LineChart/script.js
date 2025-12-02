// ---- 1. Load Vietnam data from WDI CSVs ----
Promise.all([
  d3.csv("inflation-consumer-price.csv"),
  d3.csv("gdp-growth-rate.csv"),
]).then(([inflRaw, gdpRaw]) => {
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
});

// ---- 2. Chart with hover + dynamic annotations ----
function drawChart(data) {
  const svg = d3.select("#chart");
  const width = +svg.attr("width");
  const height = +svg.attr("height");

  const margin = { top: 32, right: 64, bottom: 40, left: 56 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const tooltip = d3.select("#tooltip");
  const axisToggleInput = document.getElementById("axis-toggle-input");
  const axisToggleText = document.getElementById("axis-toggle-text");

  let axisMode = "dual"; // 'dual' or 'single'

  const x = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d.year))
    .range([0, innerWidth]);

  const yInflation = d3.scaleLinear().range([innerHeight, 0]);
  const yGDP = d3.scaleLinear().range([innerHeight, 0]);

  updateYDomains();

  const originalXDomain = x.domain().slice();

  const xAxis = d3
    .axisBottom(x)
    .tickFormat(d3.format("d"))
    .ticks(10);

  const yAxisLeft = d3.axisLeft(yInflation).ticks(6);
  const yAxisRight = d3.axisRight(yGDP).ticks(6);

  const xAxisG = g
    .append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .attr("class", "x-axis")
    .call(xAxis)
    .call((g) =>
      g.selectAll("text").style("fill", "#9ca3af").style("font-size", "11px")
    )
    .call((g) => g.selectAll("line").style("stroke", "#1f2937"))
    .call((g) => g.select(".domain").style("stroke", "#4b5563"));

  const yAxisLeftG = g
    .append("g")
    .attr("class", "y-axis-left")
    .call(yAxisLeft)
    .call((g) =>
      g.selectAll("text").style("fill", "#60a5fa").style("font-size", "11px")
    )
    .call((g) =>
      g
        .selectAll("line")
        .style("stroke", "#111827")
        .style("stroke-opacity", 0.4)
    )
    .call((g) => g.select(".domain").style("stroke", "#4b5563"));

  const yAxisRightG = g
    .append("g")
    .attr("class", "y-axis-right")
    .attr("transform", `translate(${innerWidth},0)`)
    .call(yAxisRight)
    .call((g) =>
      g.selectAll("text").style("fill", "#f97373").style("font-size", "11px")
    )
    .call((g) => g.selectAll("line").remove())
    .call((g) => g.select(".domain").style("stroke", "#4b5563"));

  const yInflLabel = svg
    .append("text")
    .attr("x", margin.left - 40)
    .attr("y", margin.top - 10)
    .attr("fill", "#60a5fa")
    .attr("font-size", 11)
    .text("Inflation (%)");

  const yGDPLabel = svg
    .append("text")
    .attr("x", width - margin.right + 30)
    .attr("y", margin.top - 10)
    .attr("fill", "#f97373")
    .attr("font-size", 11)
    .style("text-anchor", "end")
    .text("GDP growth (%)");

  const gridG = g
    .append("g")
    .attr("class", "grid")
    .call(
      d3
        .axisLeft(yInflation)
        .ticks(6)
        .tickSize(-innerWidth)
        .tickFormat("")
    )
    .call((g) =>
      g
        .selectAll("line")
        .style("stroke", "#111827")
        .style("stroke-opacity", 0.55)
    )
    .call((g) => g.select(".domain").remove());

  const lineInflation = d3
    .line()
    .x((d) => x(d.year))
    .y((d) => yInflation(d.inflation))
    .curve(d3.curveMonotoneX);

  const lineGDP_dual = d3
    .line()
    .x((d) => x(d.year))
    .y((d) => yGDP(d.gdp))
    .curve(d3.curveMonotoneX);

  const lineGDP_single = d3
    .line()
    .x((d) => x(d.year))
    .y((d) => yInflation(d.gdp))
    .curve(d3.curveMonotoneX);

  const inflationPath = g
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#38bdf8")
    .attr("stroke-width", 2)
    .attr("d", lineInflation);

  const gdpPath = g
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#fb7185")
    .attr("stroke-width", 2)
    .attr("d", lineGDP_dual);

  [inflationPath, gdpPath].forEach((path) => {
    const length = path.node().getTotalLength();
    path
      .attr("stroke-dasharray", `${length} ${length}`)
      .attr("stroke-dashoffset", length)
      .transition()
      .duration(1400)
      .ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0);
  });

  // Hover group
  const focusGroup = g.append("g");
  const focusLine = focusGroup
    .append("line")
    .attr("stroke", "#4b5563")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "4 4")
    .style("opacity", 0);

  const focusInflationDot = focusGroup
    .append("circle")
    .attr("r", 4)
    .attr("fill", "#38bdf8")
    .attr("stroke", "#0f172a")
    .attr("stroke-width", 1.5)
    .style("opacity", 0);

  const focusGDPDot = focusGroup
    .append("circle")
    .attr("r", 4)
    .attr("fill", "#fb7185")
    .attr("stroke", "#0f172a")
    .attr("stroke-width", 1.5)
    .style("opacity", 0);

  const hoverAnnotationGroup = g.append("g");

  const overlay = g
    .append("rect")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent")
    .on("mousemove", handleMove)
    .on("mouseenter", handleEnter)
    .on("mouseleave", handleLeave);

  const bisectYear = d3.bisector((d) => d.year).center;

  // Data-driven interesting events
  const eventNotes = {
    1998: "Asian financial crisis; GDP slows while inflation rises",
    1999: "Crisis aftermath; weak growth with inflation still elevated",
    2008: "Global financial crisis; inflation spike with growth slowdown",
    2011: "Post-crisis inflation flare-up amid solid growth",
    2020: "COVID‑19 shock; growth collapse, moderate inflation",
    2022: "Reopening + energy shock; strong growth, higher prices",
  };

  function handleEnter() {
    focusLine.style("opacity", 1);
    focusInflationDot.style("opacity", 1);
    focusGDPDot.style("opacity", 1);
    tooltip.style("opacity", 1);
  }

  function handleLeave() {
    focusLine.style("opacity", 0);
    focusInflationDot.style("opacity", 0);
    focusGDPDot.style("opacity", 0);
    tooltip.style("opacity", 0);
    hoverAnnotationGroup.selectAll("*").remove();
  }

  function handleMove(event) {
    const [xm] = d3.pointer(event);
    const yearVal = x.invert(xm);
    const idx = bisectYear(data, yearVal);
    const d = data[idx];

    const xPos = x(d.year);
    const yInfl = yInflation(d.inflation);
    const yGdp = axisMode === "dual" ? yGDP(d.gdp) : yInflation(d.gdp);

    focusLine
      .attr("x1", xPos)
      .attr("x2", xPos)
      .attr("y1", 0)
      .attr("y2", innerHeight);
    focusInflationDot.attr("cx", xPos).attr("cy", yInfl);
    focusGDPDot.attr("cx", xPos).attr("cy", yGdp);

    const [pageX, pageY] = d3.pointer(event, document.body);
    tooltip
      .style("left", `${pageX}px`)
      .style("top", `${pageY}px`)
      .html(
        `<strong>${d.year}</strong><br/>
         CPI inflation: ${d.inflation.toFixed(2)}%<br/>
         GDP growth: ${d.gdp.toFixed(2)}%`
      );

    // Dynamic annotation for interesting years
    hoverAnnotationGroup.selectAll("*").remove();
    const note = eventNotes[d.year];
    if (note) {
      const boxWidth = 220;
      const boxHeight = 40;
      const boxX = Math.min(Math.max(xPos + 6, 0), innerWidth - boxWidth);
      const boxY = 6;

      hoverAnnotationGroup
        .append("rect")
        .attr("x", boxX)
        .attr("y", boxY)
        .attr("rx", 4)
        .attr("ry", 4)
        .attr("width", boxWidth)
        .attr("height", boxHeight)
        .attr("fill", "rgba(15,23,42,0.96)")
        .attr("stroke", "#f59e0b")
        .attr("stroke-width", 1);

      hoverAnnotationGroup
        .append("text")
        .attr("x", boxX + 8)
        .attr("y", boxY + 16)
        .attr("fill", "#e5e7eb")
        .attr("font-size", 11)
        .text(`${d.year}:`);

      hoverAnnotationGroup
        .append("text")
        .attr("x", boxX + 8)
        .attr("y", boxY + 30)
        .attr("fill", "#9ca3af")
        .attr("font-size", 10)
        .text(note);
    }
  }

  axisToggleInput.addEventListener("change", () => {
    axisMode = axisToggleInput.checked ? "single" : "dual";
    axisToggleText.textContent =
      axisMode === "dual" ? "Dual axis" : "Single axis";
    updateYDomains();
    redrawAxesAndLines(true);
  });

  function updateYDomains() {
    const minInfl = d3.min(data, (d) => d.inflation);
    const maxInfl = d3.max(data, (d) => d.inflation);
    const minGdp = d3.min(data, (d) => d.gdp);
    const maxGdp = d3.max(data, (d) => d.gdp);

    if (axisMode === "dual") {
      yInflation.domain([Math.min(0, minInfl), maxInfl * 1.1]);
      yGDP.domain([Math.min(0, minGdp), maxGdp * 1.15]);
    } else {
      const overallMin = Math.min(0, minInfl, minGdp);
      const overallMax = Math.max(maxInfl, maxGdp);
      yInflation.domain([overallMin, overallMax * 1.1]);
    }
  }

  function redrawAxesAndLines(withTransition = false) {
    const t = withTransition
      ? svg.transition().duration(500)
      : svg.transition().duration(0);

    xAxisG.transition(t).call(xAxis);

    if (axisMode === "dual") {
      yAxisLeftG.transition(t).call(yAxisLeft);
      yAxisRightG.transition(t).style("opacity", 1).call(yAxisRight);
      yInflLabel.text("Inflation (%)");
      yGDPLabel.text("GDP growth (%)");
    } else {
      yAxisLeftG.transition(t).call(yAxisLeft);
      yAxisRightG.transition(t).style("opacity", 0);
      yInflLabel.text("Inflation & GDP (%)");
      yGDPLabel.text("");
    }

    gridG
      .transition(t)
      .call(
        d3
          .axisLeft(yInflation)
          .ticks(6)
          .tickSize(-innerWidth)
          .tickFormat("")
      )
      .call((g) => g.select(".domain").remove());

    inflationPath.datum(data).transition(t).attr("d", lineInflation);

    if (axisMode === "dual") {
      gdpPath.datum(data).transition(t).attr("d", lineGDP_dual);
    } else {
      gdpPath.datum(data).transition(t).attr("d", lineGDP_single);
    }
  }

  // Optional: scroll zoom on x only, without breaking hover
  const zoom = d3
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
      const zx = event.transform.rescaleX(
        d3.scaleLinear().domain(originalXDomain).range([0, innerWidth])
      );
      x.domain(zx.domain());
      redrawAxesAndLines(false);
    });

  svg.call(zoom);
}
