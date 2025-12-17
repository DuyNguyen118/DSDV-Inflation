// --- Layout settings ---
// Increased top margin to 80 to fit the legend properly without clipping
const margin = { top: 80, right: 30, bottom: 40, left: 100 };
const width = 700 - margin.left - margin.right;
const height = 450 - margin.top - margin.bottom;

// --- SVG container ---
const svg = d3.select("#heatmap")
    .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("#heatmap-tooltip");

// --- Load CSV data ---
d3.csv("data/CPI_average_year.csv").then(data => {

    // --- LEGEND (Adjusted Positioning) ---
    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient")
        .attr("id", "linear-gradient");

    linearGradient.append("stop").attr("offset", "0%").attr("stop-color", "#4575b4");
    linearGradient.append("stop").attr("offset", "50%").attr("stop-color", "#ffffff");
    linearGradient.append("stop").attr("offset", "100%").attr("stop-color", "#d73027");

    const legendWidth = 200;
    const legendHeight = 10;
    
    // Center legend relative to chart width
    const legendX = (width - legendWidth) / 2; 
    // Position legend within the top margin space (negative Y relative to chart area)
    const legendY = -40; 

    // 1. "Stable (100)" Label - TOP CENTER
    svg.append("text")
        .attr("x", legendX + legendWidth / 2)
        .attr("y", legendY - 10) // Positioned above the bar
        .text("Stable (100)")
        .style("font-size", "11px")
        .style("font-weight", "bold")
        .style("fill", "#555") 
        .attr("text-anchor", "middle");

    // 2. Gradient Bar
    svg.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#linear-gradient)")
        .attr("transform", `translate(${legendX},${legendY})`)
        .style("stroke", "#e5e7eb");

    // 3. Bottom Labels (Deflation / Inflation)
    svg.append("text")
        .attr("x", legendX)
        .attr("y", legendY + 22) // Below the bar
        .text("Deflation (<100)")
        .style("font-size", "10px")
        .attr("text-anchor", "start")
        .attr("fill", "#4575b4");

    svg.append("text")
        .attr("x", legendX + legendWidth)
        .attr("y", legendY + 22) // Below the bar
        .text("Inflation (>100)")
        .style("font-size", "10px")
        .attr("text-anchor", "end")
        .attr("fill", "#d73027");

    // --- Convert wide → long format ---
    const years = data.columns.slice(1);       // Year columns
    const commodityKey = data.columns[0];      // Category column
    const commodities = data.map(d => d[commodityKey]);

    const heatmapData = [];
    data.forEach(d => {
        years.forEach(year => {
            const value = +d[year];
            if (value) {
                heatmapData.push({
                    group: d[commodityKey],
                    year: year,
                    value: value
                });
            }
        });
    });

    // --- Scales ---
    const x = d3.scaleBand().range([0, width]).domain(years).padding(0.05);
    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x))
        .select(".domain").remove();

    const y = d3.scaleBand().range([0, height]).domain(commodities).padding(0.05);
    svg.append("g")
        .style("font-size", "13px")
        .call(d3.axisLeft(y).tickFormat(d => d.split(' ')[0])) 
        .select(".domain").remove();

    // --- Color scale ---
    const myColor = d3.scaleLinear()
        .domain([95, 100, 115])
        .range(["#4575b4", "#ffffff", "#d73027"])
        .clamp(true);

    // --- Draw heatmap cells ---
    svg.selectAll()
        .data(heatmapData)
        .enter()
        .append("rect")
        .attr("class", "cell")
        .attr("x", d => x(d.year))
        .attr("y", d => y(d.group))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .style("fill", d => myColor(d.value))
        .style("rx", 3)
        .style("ry", 3)
        .on("mouseover", function () {
            tooltip.style("opacity", 1);
            d3.select(this).style("stroke", "#111").style("stroke-width", 2);
        })
        .on("mousemove", function (event, d) {
            tooltip.html(`
                <b>${d.group}</b><br>
                Year: ${d.year}<br>
                Index: <b>${d.value.toFixed(2)}</b><br>
                <span style="font-size:11px; color:#666">
                    ${d.value > 100 ? "Inflation" : "Deflation"}
                </span>
            `)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseleave", function () {
            tooltip.style("opacity", 0);
            d3.select(this).style("stroke", "none");
        });
});