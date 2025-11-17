// script.js
document.addEventListener('DOMContentLoaded', function () {

    // Chart dimensions and margins - INCREASED LEFT MARGIN
    const margin = { top: 60, right: 30, bottom: 150, left: 120 };
    const width = 1000 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // Load and process the GDP growth data from CSV
    d3.text("../Data/GDP, GRDP/GDP growth.csv")
        .then(function (csvText) {

            const lines = csvText.split('\n')
                .filter(line => line.trim() !== '');

            if (lines[0].charCodeAt(0) === 0xFEFF) {
                lines[0] = lines[0].substring(1);
            }

            const csvData = d3.csvParseRows(lines.join('\n'), function (row) {
                if (!this.headers) {
                    this.headers = row;
                    return null;
                }

                const obj = {};
                this.headers.forEach((h, i) => {
                    obj[h] = (i >= 4 && row[i] === '') ? null : row[i];
                });
                return obj;
            }).filter(Boolean);

            const vietnamData = csvData.find(row =>
                row["Country Name"] &&
                row["Country Name"].toLowerCase().includes("viet")
            );

            if (!vietnamData) {
                console.error("Vietnam not found in GDP growth data");
                return;
            }

            const years = Object.keys(vietnamData)
                .filter(key => /^\d{4}$/.test(key))
                .sort();

            const vnGdpData = years.map(year => ({
                year: year,
                gdp: vietnamData[year] ? parseFloat(vietnamData[year]) : null
            })).filter(d => d.gdp !== null);

            createGdpGrowthChart(vnGdpData, "#gdp-growth-chart");
        })
        .catch(err => console.error("CSV Load Error:", err));


    // -----------------------
    // Create GDP Chart
    // -----------------------
    function createGdpGrowthChart(data, containerId) {

        d3.select(containerId).select("svg").remove();

        const svg = d3.select(containerId)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "500px")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`)

        const tooltip = d3.select(containerId)
            .append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        // Scales
        const x = d3.scaleBand()
            .domain(data.map(d => d.year))
            .range([0, width])
            .padding(0.1);

        const y = d3.scaleLinear()
            .domain([d3.min(data, d => d.gdp) * 0.9, d3.max(data, d => d.gdp) * 1.1])
            .range([height, 0]);

        // Line generator
        const line = d3.line()
            .x(d => x(d.year) + x.bandwidth() / 2)
            .y(d => y(d.gdp));

        // Line path
        svg.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", "#4e79a7")
            .attr("stroke-width", 3)
            .attr("d", line);

        // Dots
        svg.selectAll(".dot")
            .data(data)
            .enter()
            .append("circle")
            .attr("class", "dot")
            .attr("r", 5)
            .attr("cx", d => x(d.year) + x.bandwidth() / 2)
            .attr("cy", d => y(d.gdp))
            .attr("fill", "#4e79a7")
            .on("mouseover", function(event, d) {
            d3.select(this)
                .attr("r", 7)
                .attr("fill", "#e6550d");
                
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            
            const containerRect = d3.select(containerId).node().getBoundingClientRect();
            const xPos = event.clientX - containerRect.left;
            const yPos = event.clientY - containerRect.top;
            
            tooltip.html(`
                <h4>${d.year}</h4>
                <p>GDP Growth: ${d.gdp}%</p>
            `)
            .style("left", (xPos + 10) + "px")
            .style("top", (yPos - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this)
                .attr("r", 5)
                .attr("fill", "#4e79a7");
                
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

        // X-axis
        svg.append("g")
            .attr("transform", `translate(0, ${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .style("font-size", "10px")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end");

        // X-AXIS LABEL - Better positioned
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height + 55)
            .style("text-anchor", "middle")
            .style("font-size", "14px")
            .style("font-weight", "500")
            .text("Year");

        // Y-axis
        svg.append("g")
            .call(
                d3.axisLeft(y)
                    .ticks(6)
                    .tickFormat(d => `${d}%`) // Format to percentage
            );

        // Y-AXIS LABEL - Better positioned
        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", -100)
            .style("text-anchor", "middle")
            .style("font-size", "14px")
            .style("font-weight", "500")
            .text("GDP Growth (annual %)");
            
        // Source attribution
        svg.append("text")
            .attr("x", width)
            .attr("y", height + 55)
            .style("text-anchor", "end")
            .style("font-size", "10px")
            .style("fill", "#666")
    }

});