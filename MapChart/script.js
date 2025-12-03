// script.js
document.addEventListener('DOMContentLoaded', function () {

    // Chart dimensions and margins for GDP growth chart
    const gdpMargin = { top: 40, right: 20, bottom: 100, left: 80 };
    const gdpWidth = 800 - gdpMargin.left - gdpMargin.right;
    const gdpHeight = 350 - gdpMargin.top - gdpMargin.bottom;

    // Chart dimensions and margins for CPI chart
    const cpiMargin = { top: 50, right: 30, bottom: 50, left: 70 };
    const cpiWidth = 750 - cpiMargin.left - cpiMargin.right;
    const cpiHeight = 280 - cpiMargin.top - cpiMargin.bottom;

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

            createGdpGrowthChart(vnGdpData, "#gdp-growth-chart", gdpWidth, gdpHeight, gdpMargin);
        })
        .catch(err => console.error("CSV Load Error:", err));


    // Load and process the CPI data from CSV
    d3.text("../Data/CPI and Inflation/global_inflation_data.csv")
        .then(function(csvText) {
            // Parse the CSV data
            const lines = csvText.split('\n');
            const headers = lines[0].split(',');
            
            // Find Vietnam's data row (case-insensitive search)
            let vietnamRow = null;
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes('vietnam')) {
                    const values = lines[i].split(',');
                    vietnamRow = {};
                    headers.forEach((header, index) => {
                        vietnamRow[header] = values[index];
                    });
                    break;
                }
            }

            if (!vietnamRow) {
                console.error("Vietnam not found in CPI data");
                return;
            }

            // Process the data
            const years = [];
            const cpiData = [];
            
            // Get years from 1980 to 2024
            for (let year = 1980; year <= 2024; year++) {
                const yearStr = year.toString();
                if (vietnamRow[yearStr] && vietnamRow[yearStr].trim() !== '') {
                    years.push(yearStr);
                    cpiData.push({
                        year: yearStr,
                        cpi: parseFloat(vietnamRow[yearStr])
                    });
                }
            }

            createCpiChart(cpiData, "#cpi-chart", cpiWidth, cpiHeight, cpiMargin);
        })
        .catch(err => console.error("CPI CSV Load Error:", err));

    // -----------------------
    // Create CPI Chart
    // -----------------------
    function createCpiChart(data, containerId, width, height, margin) {
        d3.select(containerId).select("svg").remove();

        const svg = d3.select(containerId)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "400px")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        const tooltip = d3.select(containerId)
            .append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        // Scales
        const x = d3.scaleBand()
            .domain(data.map(d => d.year))
            .range([0, width])
            .padding(0.1);

        // For CPI, we'll use 0 as the minimum to better show negative values
        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.cpi) * 1.1])
            .range([height, 0]);

        // Line generator
        const line = d3.line()
            .x(d => x(d.year) + x.bandwidth() / 2)
            .y(d => y(d.cpi));

        // Add the line
        svg.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", "#ff4d9a")
            .attr("stroke-width", 3)
            .attr("d", line);

        // Add dots for each data point
        svg.selectAll(".dot")
            .data(data)
            .enter()
            .append("circle")
            .attr("class", "dot")
            .attr("r", 4)
            .attr("cx", d => x(d.year) + x.bandwidth() / 2)
            .attr("cy", d => y(d.cpi))
            .attr("fill", "#ff4d9a")
            .on("mouseover", function(event, d) {
                d3.select(this)
                    .attr("r", 6)
                    .attr("fill", "#e60073");
                    
                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                
                const containerRect = d3.select(containerId).node().getBoundingClientRect();
                const xPos = event.clientX - containerRect.left;
                const yPos = event.clientY - containerRect.top;
                
                tooltip.html(`
                    <h4>${d.year}</h4>
                    <p>Inflation Rate: ${d.cpi.toFixed(2)}%</p>
                `)
                .style("left", (xPos + 10) + "px")
                .style("top", (yPos - 28) + "px");
            })
            .on("mouseout", function() {
                d3.select(this)
                    .attr("r", 4)
                    .attr("fill", "#ff4d9a");
                    
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });

        // X-axis
        svg.append("g")
            .attr("transform", `translate(0, ${height})`)
            .call(d3.axisBottom(x).tickValues(x.domain().filter((d, i) => i % 5 === 0))) // Show every 5th year
            .selectAll("text")
            .style("font-size", "10px")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end");

        // X-axis label
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height + margin.bottom - 10)
            .style("text-anchor", "middle")
            .style("font-size", "14px")
            .style("font-weight", "500")
            .style("fill", "#333")
            .text("Year");

        // Y-axis
        svg.append("g")
            .call(
                d3.axisLeft(y)
                    .ticks(6)
                    .tickFormat(d => `${d}%`)
            );

        // Y-axis label
        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", -50)
            .style("text-anchor", "middle")
            .style("font-size", "14px")
            .style("font-weight", "500")
            .text("Inflation Rate (%)");
            
        // Add a title (optional)
        svg.append("text")
            .attr("x", (width / 2))             
            .attr("y", 0 - (margin.top / 2))
            .attr("text-anchor", "middle")  
            .style("font-size", "16px") 
            .style("font-weight", "bold")  
            .text("Vietnam Annual Inflation Rate (CPI)");
            
        // Add a horizontal line at y=0 for reference
        svg.append("line")
            .attr("x1", 0)
            .attr("y1", y(0))
            .attr("x2", width)
            .attr("y2", y(0))
            .attr("stroke", "#999")
            .attr("stroke-dasharray", "5,5");
    }

    // -----------------------
    // Create GDP Chart
    // -----------------------
    function createGdpGrowthChart(data, containerId, width, height, margin) {

        d3.select(containerId).select("svg").remove();

        const svg = d3.select(containerId)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "400px")
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

    // -----------------------
    // Load Food Consumption Data
    // -----------------------
    let allFoodData = []; // Store all data for all years
    const years = ['2002', '2004', '2006', '2008', '2010', '2012', '2014', '2016', '2018', '2020', '2022', '2024'];
    
    d3.text("../Data/Foods/consumption_data.csv")
        .then(function(csvText) {
            // Parse CSV using d3.csvParse
            const data = d3.csvParse(csvText);
            
            // Store all data with all years
            allFoodData = data.map(d => {
                const category = d.Category;
                const yearData = {};
                years.forEach(year => {
                    const value = parseFloat(d[year]);
                    yearData[year] = isNaN(value) ? 0 : value;
                });
                return {
                    category: category,
                    ...yearData
                };
            }).filter(d => d.category);

            // Initialize with the last year (2024)
            updateFoodChart(11); // Index 11 = 2024
            
            // Set up slider
            const slider = document.getElementById('year-slider');
            const yearDisplay = document.getElementById('selected-year');
            
            slider.addEventListener('input', function() {
                const yearIndex = parseInt(this.value);
                yearDisplay.textContent = years[yearIndex];
                updateFoodChart(yearIndex);
            });
        })
        .catch(err => console.error("Food Consumption CSV Load Error:", err));

    // Function to update chart based on selected year
    function updateFoodChart(yearIndex) {
        const selectedYear = years[yearIndex];
        
        // Process data for selected year
        const processedData = allFoodData.map(d => ({
            category: d.category,
            quantity: d[selectedYear]
        }))
        .filter(d => d.category && d.quantity > 0)
        // Sort by quantity in descending order
        .sort((a, b) => b.quantity - a.quantity);

        // Chart dimensions for horizontal bar chart
        const foodMargin = { top: 15, right: 30, bottom: 60, left: 180 };
        const foodWidth = 700 - foodMargin.left - foodMargin.right;
        const foodHeight = processedData.length * 28;

        createFoodConsumptionChart(processedData, "#food-consumption-chart", foodWidth, foodHeight, foodMargin, selectedYear);
    }

    // -----------------------
    // Create Food Consumption Horizontal Bar Chart
    // -----------------------
    function createFoodConsumptionChart(data, containerId, width, height, margin, selectedYear) {
        // Remove any existing chart
        d3.select(containerId).selectAll("*").remove();

        const totalHeight = height + margin.top + margin.bottom;
        const totalWidth = width + margin.left + margin.right;
        
        const svg = d3.select(containerId)
            .append("svg")
            .attr("width", "100%")
            .attr("height", totalHeight + "px")
            .attr("viewBox", `0 0 ${totalWidth} ${totalHeight}`)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        const tooltip = d3.select(containerId)
            .append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        // Scales - fix X-axis at 12 for consistent scaling
        const x = d3.scaleLinear()
            .domain([0, 12])
            .range([0, width]);

        const y = d3.scaleBand()
            .domain(data.map(d => d.category))
            .range([0, height])
            .padding(0.2);

        // Color scale - gradient from highest (darker) to lowest (lighter)
        // Since data is already sorted, use index-based coloring for more visible gradient
        const colorScale = d3.scaleSequential()
            .domain([0, data.length - 1])
            .interpolator(d3.interpolateRgb("#1565c0", "#e3f2fd")); // Dark blue (highest) to very light blue (lowest)

        // Add bars
        svg.selectAll(".bar")
            .data(data)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", 0)
            .attr("y", d => y(d.category))
            .attr("width", d => x(d.quantity))
            .attr("height", y.bandwidth())
            .attr("fill", (d, i) => colorScale(i))
            .attr("rx", 3)
            .on("mouseover", function(event, d) {
                d3.select(this)
                    .style("fill", "#1565c0"); // Darker blue on hover
                
                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                
                const containerRect = d3.select(containerId).node().getBoundingClientRect();
                const xPos = event.clientX - containerRect.left;
                const yPos = event.clientY - containerRect.top;
                
                tooltip.html(`
                    <h4>${d.category}</h4>
                    <p>Quantity (${selectedYear}): ${d.quantity.toFixed(2)}</p>
                `)
                .style("left", (xPos + 10) + "px")
                .style("top", (yPos - 28) + "px");
            })
            .on("mouseout", function(event, d) {
                const index = data.findIndex(item => item.category === d.category);
                d3.select(this)
                    .style("fill", colorScale(index)); // Return to original color
                
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });

        // Add value labels on bars
        svg.selectAll(".bar-label")
            .data(data)
            .enter()
            .append("text")
            .attr("class", "bar-label")
            .attr("x", d => x(d.quantity) + 5)
            .attr("y", d => y(d.category) + y.bandwidth() / 2)
            .attr("dy", "0.35em")
            .style("font-size", "11px")
            .style("fill", "#333")
            .text(d => d.quantity.toFixed(2));

        // X-axis - with fixed max at 12
        svg.append("g")
            .attr("transform", `translate(0, ${height})`)
            .call(d3.axisBottom(x).ticks(7).tickValues([0, 2, 4, 6, 8, 10, 12]));

        // X-axis label
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height + 50)
            .style("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "500")
            .style("fill", "#333")
            .text("Average Monthly Per Capita Consumption");

        // Y-axis
        svg.append("g")
            .call(d3.axisLeft(y))
            .selectAll("text")
            .style("font-size", "11px");

        // Y-axis label
        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", -220)
            .style("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "500")
            .text("Essential Items");
    }

    // -----------------------
    // Global Inflation Map
    // -----------------------
    let globalInflationData = {};
    let worldMap = null;
    let selectedMapYear = 2024;

    // Helper function to normalize country names for matching
    function normalizeCountryName(name) {
        if (!name) return '';
        return name.toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s]/g, '')
            .trim();
    }

    // Helper function to find country data by matching name variations
    function findCountryData(countryName) {
        if (!countryName) return null;
        
        // Direct lookup
        if (globalInflationData[countryName]) {
            return globalInflationData[countryName];
        }
        
        // Check country name mapping
        const countryNameMap = {
            "United States of America": "United States",
            "Russian Federation": "Russia",
            "Czechia": "Czech Republic",
            "Syrian Arab Republic": "Syria",
            "Iran, Islamic Rep.": "Iran",
            "Korea, Rep.": "South Korea",
            "Korea, Dem. People's Rep.": "North Korea",
            "Lao People's Democratic Republic": "Laos",
            "Viet Nam": "Vietnam",
            "Myanmar": "Burma",
            "Macedonia": "North Macedonia",
            "Congo": "Republic of the Congo",
            "Dem. Rep. Congo": "Congo, Democratic Republic of the",
            "Tanzania": "Tanzania, United Republic of",
            "Egypt, Arab Rep.": "Egypt",
            "Venezuela, RB": "Venezuela",
            "Yemen, Rep.": "Yemen",
            "Slovakia": "Slovak Republic",
            "Bolivia": "Bolivia, Plurinational State of",
            "Brunei": "Brunei Darussalam",
            "East Timor": "Timor-Leste",
            "Ivory Coast": "Cote d'Ivoire",
            "Swaziland": "Eswatini",
            "The Bahamas": "Bahamas, The",
            "Bahamas": "Bahamas, The",
            "Gambia": "Gambia, The",
            "The Gambia": "Gambia, The"
        };
        
        const mappedName = countryNameMap[countryName];
        if (mappedName && globalInflationData[mappedName]) {
            return globalInflationData[mappedName];
        }
        
        // Fuzzy matching by normalized name
        const normalizedSearch = normalizeCountryName(countryName);
        const dataKeys = Object.keys(globalInflationData);
        
        // Try exact normalized match
        for (const key of dataKeys) {
            if (normalizeCountryName(key) === normalizedSearch) {
                return globalInflationData[key];
            }
        }
        
        // Try partial match
        for (const key of dataKeys) {
            const normalizedKey = normalizeCountryName(key);
            if (normalizedKey.includes(normalizedSearch) || normalizedSearch.includes(normalizedKey)) {
                return globalInflationData[key];
            }
        }
        
        return null;
    }

    // Load global inflation data
    d3.csv("../Data/CPI and Inflation/global_inflation_data.csv")
        .then(function(csvData) {
            // Parse all country data
            csvData.forEach(row => {
                const countryName = row.country_name ? row.country_name.trim() : '';
                
                if (!countryName) return;
                
                globalInflationData[countryName] = {};
                
                // Get all year columns (1980-2024)
                Object.keys(row).forEach(key => {
                    if (key === 'country_name' || key === 'indicator_name') return;
                    
                    const year = key.trim();
                    const value = row[key] ? row[key].trim() : '';
                    if (value && value !== '' && !isNaN(parseFloat(value))) {
                        globalInflationData[countryName][year] = parseFloat(value);
                    }
                });
            });

            console.log(`Loaded inflation data for ${Object.keys(globalInflationData).length} countries`);
            
            // Load world map and create visualization
            loadWorldMap();
        })
        .catch(err => {
            console.error("Global Inflation CSV Load Error:", err);
            // Fallback: try text loading method
            d3.text("../Data/CPI and Inflation/global_inflation_data.csv")
                .then(function(csvText) {
                    const lines = csvText.split('\n').filter(line => line.trim() !== '');
                    
                    // Handle BOM if present
                    if (lines[0].charCodeAt(0) === 0xFEFF) {
                        lines[0] = lines[0].substring(1);
                    }

                    const headers = lines[0].split(',');
                    
                    // Parse all country data
                    for (let i = 1; i < lines.length; i++) {
                        const values = lines[i].split(',');
                        const countryName = values[0] ? values[0].trim().replace(/"/g, '') : '';
                        
                        if (!countryName) continue;
                        
                        globalInflationData[countryName] = {};
                        headers.forEach((header, index) => {
                            if (index === 0) return; // Skip country_name
                            if (index === 1) return; // Skip indicator_name
                            
                            const year = header.trim();
                            const value = values[index] ? values[index].trim() : '';
                            if (value && value !== '' && !isNaN(parseFloat(value))) {
                                globalInflationData[countryName][year] = parseFloat(value);
                            }
                        });
                    }

                    loadWorldMap();
                });
        });

    // Load world map from TopoJSON
    function loadWorldMap() {
        d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
            .then(function(world) {
                worldMap = world;
                createGlobalMap();
            })
            .catch(function(error) {
                console.error("Error loading world map:", error);
                // Fallback: try alternative source
                d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson")
                    .then(function(world) {
                        worldMap = world;
                        createGlobalMapGeoJSON();
                    })
                    .catch(function(err) {
                        console.error("Error loading alternative map:", err);
                    });
            });
    }

    // Create map with TopoJSON
    function createGlobalMap() {
        const container = d3.select("#global-inflation-map");
        container.selectAll("*").remove();

        const width = Math.min(1000, window.innerWidth - 60);
        const height = 600;
        const margin = { top: 20, right: 20, bottom: 20, left: 20 };

        const svg = container
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");

        const projection = d3.geoNaturalEarth1()
            .scale(width / 6.5)
            .translate([width / 2, height / 2]);

        const path = d3.geoPath().projection(projection);

        // Convert TopoJSON to GeoJSON
        const countries = topojson.feature(worldMap, worldMap.objects.countries);

        // Get all inflation values for the selected year to create color scale
        const inflationValues = [];
        countries.features.forEach(d => {
            const countryName = d.properties.NAME || d.properties.name;
            const countryData = findCountryData(countryName);
            
            if (countryData) {
                const value = countryData[selectedMapYear.toString()];
                if (value !== undefined && value !== null && !isNaN(value)) {
                    inflationValues.push(value);
                }
            }
        });

        // Create color scale
        const minInflation = d3.min(inflationValues) || 0;
        const maxInflation = d3.max(inflationValues) || 10;
        
        // Create a color scale that handles negative, low, moderate, and high inflation
        const colorScale = d3.scaleSequential(d3.interpolateRdYlGn)
            .domain([maxInflation, Math.min(minInflation, -5)]); // Reverse so red = high, green = low/negative
        
        // Alternative: Use a custom color scale for better visualization
        const customColorScale = d3.scaleThreshold()
            .domain([-5, 0, 2, 5, 10, 20, 50])
            .range(["#2e7d32", "#66bb6a", "#ffeb3b", "#ff9800", "#f44336", "#c62828", "#8e0000"]);

        // Draw countries
        svg.selectAll(".country")
            .data(countries.features)
            .enter()
            .append("path")
            .attr("class", "country")
            .attr("d", path)
            .attr("fill", d => {
                const countryName = d.properties.NAME || d.properties.name;
                const countryData = findCountryData(countryName);
                
                if (countryData) {
                    const value = countryData[selectedMapYear.toString()];
                    if (value !== undefined && value !== null && !isNaN(value)) {
                        return customColorScale(value);
                    }
                }
                return "#e0e0e0"; // No data
            })
            .on("mouseover", function(event, d) {
                d3.select(this)
                    .attr("stroke", "#333")
                    .attr("stroke-width", 2);

                const countryName = d.properties.NAME || d.properties.name;
                const countryData = findCountryData(countryName);
                
                let inflationRate = "No data";
                if (countryData) {
                    const value = countryData[selectedMapYear.toString()];
                    if (value !== undefined && value !== null && !isNaN(value)) {
                        inflationRate = value.toFixed(2) + "%";
                    }
                }

                const tooltip = d3.select("body")
                    .append("div")
                    .attr("class", "tooltip")
                    .style("opacity", 0);

                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);

                tooltip.html(`
                    <h4>${countryName}</h4>
                    <p>Year: ${selectedMapYear}</p>
                    <p>Inflation Rate: ${inflationRate}</p>
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                d3.select(this)
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 0.5);

                d3.selectAll(".tooltip").remove();
            });

        // Create legend
        createMapLegend(customColorScale);
    }

    // Fallback function for GeoJSON format
    function createGlobalMapGeoJSON() {
        const container = d3.select("#global-inflation-map");
        container.selectAll("*").remove();

        const width = Math.min(1000, window.innerWidth - 60);
        const height = 600;

        const svg = container
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");

        const projection = d3.geoNaturalEarth1()
            .scale(width / 6.5)
            .translate([width / 2, height / 2]);

        const path = d3.geoPath().projection(projection);

        // Similar implementation for GeoJSON format
        const countries = worldMap.features || worldMap;

        const inflationValues = [];
        countries.forEach(d => {
            const countryName = d.properties.name || d.properties.NAME;
            const countryData = findCountryData(countryName);
            
            if (countryData) {
                const value = countryData[selectedMapYear.toString()];
                if (value !== undefined && value !== null && !isNaN(value)) {
                    inflationValues.push(value);
                }
            }
        });

        const minInflation = d3.min(inflationValues) || 0;
        const maxInflation = d3.max(inflationValues) || 10;

        const customColorScale = d3.scaleThreshold()
            .domain([-5, 0, 2, 5, 10, 20, 50])
            .range(["#2e7d32", "#66bb6a", "#ffeb3b", "#ff9800", "#f44336", "#c62828", "#8e0000"]);

        svg.selectAll(".country")
            .data(countries)
            .enter()
            .append("path")
            .attr("class", "country")
            .attr("d", path)
            .attr("fill", d => {
                const countryName = d.properties.name || d.properties.NAME;
                const countryData = findCountryData(countryName);
                
                if (countryData) {
                    const value = countryData[selectedMapYear.toString()];
                    if (value !== undefined && value !== null && !isNaN(value)) {
                        return customColorScale(value);
                    }
                }
                return "#e0e0e0";
            })
            .on("mouseover", function(event, d) {
                d3.select(this).attr("stroke", "#333").attr("stroke-width", 2);
                
                const countryName = d.properties.name || d.properties.NAME;
                const countryData = findCountryData(countryName);
                
                let inflationRate = "No data";
                if (countryData) {
                    const value = countryData[selectedMapYear.toString()];
                    if (value !== undefined && value !== null && !isNaN(value)) {
                        inflationRate = value.toFixed(2) + "%";
                    }
                }

                const tooltip = d3.select("body")
                    .append("div")
                    .attr("class", "tooltip")
                    .style("opacity", 0);

                tooltip.transition().duration(200).style("opacity", .9);

                tooltip.html(`
                    <h4>${countryName}</h4>
                    <p>Year: ${selectedMapYear}</p>
                    <p>Inflation Rate: ${inflationRate}</p>
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("stroke", "#fff").attr("stroke-width", 0.5);
                d3.selectAll(".tooltip").remove();
            });

        createMapLegend(customColorScale);
    }

    // Create legend for the map
    function createMapLegend(colorScale) {
        const legendContainer = d3.select("#map-legend");
        legendContainer.selectAll("*").remove();

        const thresholds = colorScale.domain();
        const colors = colorScale.range();

        const legendItems = thresholds.map((threshold, i) => {
            const prevThreshold = i === 0 ? -Infinity : thresholds[i - 1];
            return {
                min: prevThreshold,
                max: threshold,
                color: colors[i]
            };
        }).concat([{
            min: thresholds[thresholds.length - 1],
            max: Infinity,
            color: colors[colors.length - 1]
        }]);

        const legend = legendContainer
            .append("div")
            .style("display", "flex")
            .style("flex-wrap", "wrap")
            .style("justify-content", "center")
            .style("align-items", "center")
            .style("gap", "10px");

        legendItems.forEach((item, i) => {
            const itemDiv = legend.append("div")
                .attr("class", "legend-item")
                .style("display", "inline-flex")
                .style("align-items", "center")
                .style("margin", "0 5px");

            itemDiv.append("div")
                .attr("class", "legend-color")
                .style("background-color", item.color)
                .style("width", "25px")
                .style("height", "15px")
                .style("border", "1px solid #999");

            const label = i === 0 
                ? `< ${item.max}%`
                : i === legendItems.length - 1
                ? `> ${item.min}%`
                : `${item.min}% - ${item.max}%`;

            itemDiv.append("span")
                .style("font-size", "12px")
                .style("color", "#333")
                .text(label);
        });
    }

    // Set up map year slider
    const mapYearSlider = document.getElementById('map-year-slider');
    const mapYearDisplay = document.getElementById('selected-map-year');
    
    if (mapYearSlider && mapYearDisplay) {
        mapYearSlider.addEventListener('input', function() {
            selectedMapYear = parseInt(this.value);
            mapYearDisplay.textContent = selectedMapYear;
            
            // Recreate map with new year data
            if (worldMap) {
                if (worldMap.objects) {
                    createGlobalMap();
                } else {
                    createGlobalMapGeoJSON();
                }
            }
        });
    }

});