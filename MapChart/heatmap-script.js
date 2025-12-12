// --- Layout settings ---
const margin = { top: 50, right: 50, bottom: 100, left: 220 };
const width = 900 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

// --- SVG container ---
const svg = d3.select("#heatmap")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("#heatmap-tooltip");

// --- Load CSV data ---
d3.csv("data/CPI_average_year.csv").then(data => {

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
        .style("font-size", "14px")
        .call(d3.axisLeft(y).tickSize(0))
        .select(".domain").remove();

    // --- Color scale (<100 blue, 100 white, >100 red) ---
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
        .style("rx", 4)
        .style("ry", 4)
        .on("mouseover", function () {
            tooltip.style("opacity", 1);
            d3.select(this).style("stroke", "black").style("stroke-width", 2);
        })
        .on("mousemove", function (event, d) {
            tooltip.html(`
                <b>${d.group}</b><br>
                Year: ${d.year}<br>
                Index: <b>${d.value.toFixed(2)}</b><br>
                <span style="font-size:10px; color:#ccc">
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

    // --- Legend ---
    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient")
        .attr("id", "linear-gradient");

    linearGradient.append("stop").attr("offset", "0%").attr("stop-color", "#4575b4");
    linearGradient.append("stop").attr("offset", "50%").attr("stop-color", "#ffffff");
    linearGradient.append("stop").attr("offset", "100%").attr("stop-color", "#d73027");

    const legendWidth = 300;
    const legendHeight = 15;
    const legendX = (width - legendWidth) / 2;
    const legendY = height + 60;

    svg.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#linear-gradient)")
        .attr("transform", `translate(${legendX},${legendY})`)
        .style("stroke", "#ccc");

    svg.append("text")
        .attr("x", legendX + legendWidth / 2)
        .attr("y", legendY - 8)
        .text("Stable (100)")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .attr("text-anchor", "middle")
        .attr("fill", "#555");

    svg.append("text")
        .attr("x", legendX)
        .attr("y", legendY + 28)
        .text("Deflation (<100)")
        .style("font-size", "12px")
        .attr("text-anchor", "start")
        .attr("fill", "#4575b4");

    svg.append("text")
        .attr("x", legendX + legendWidth)
        .attr("y", legendY + 28)
        .text("Inflation (>100)")
        .style("font-size", "12px")
        .attr("text-anchor", "end")
        .attr("fill", "#d73027");

    // --- X-axis label ---
    svg.append("text")
        .attr("text-anchor", "end")
        .attr("x", width)
        .attr("y", height + 40)
        .style("font-weight", "bold")
        .text("Year");
});
