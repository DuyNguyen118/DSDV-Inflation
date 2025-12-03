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
    d3.csv("data/global_inflation_data.csv")
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
            d3.text("data/global_inflation_data.csv")
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
                return "#bdbabaff"; // No data
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