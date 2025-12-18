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
            "The Gambia": "Gambia, The",
            "Kyrgyz Republic": "Kyrgyzstan",
            "Libya": "Libyan Arab Jamahiriya",
            "Moldova": "Moldova, Republic of",
            "St. Kitts and Nevis": "Saint Kitts and Nevis",
            "St. Lucia": "Saint Lucia",
            "St. Vincent and the Grenadines": "Saint Vincent and the Grenadines",
            "Turkiye": "Turkey",
            "Hong Kong SAR, China": "Hong Kong",
            "Macao SAR, China": "Macao",
            "West Bank and Gaza": "Palestine"
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
        .then(function (csvData) {
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
                .then(function (csvText) {
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
            .then(function (world) {
                worldMap = world;
                createGlobalMap();
            })
            .catch(function (error) {
                console.error("Error loading world map:", error);
                // Fallback: try alternative source
                d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson")
                    .then(function (world) {
                        worldMap = world;
                        createGlobalMapGeoJSON();
                    })
                    .catch(function (err) {
                        console.error("Error loading alternative map:", err);
                    });
            });
    }

    // Helper to update big number overlays with color coding
    function updateBigNumberOverlays(year) {
        // 1. Calculate Global Average
        let totalInflation = 0;
        let count = 0;
        
        Object.values(globalInflationData).forEach(countryData => {
            const val = countryData[year.toString()];
            if (val !== undefined && val !== null && !isNaN(val)) {
                totalInflation += val;
                count++;
            }
        });

        const globalAvg = count > 0 ? (totalInflation / count).toFixed(1) : "--";
        const globalEl = document.getElementById("global-avg-value");
        if (globalEl) {
            globalEl.innerText = globalAvg + "%";
            colorCodeElement(globalEl, parseFloat(globalAvg));
        }

        // 2. Get Vietnam Data
        const vietnamData = globalInflationData["Vietnam"];
        const vietnamVal = (vietnamData && vietnamData[year.toString()] !== undefined) 
            ? vietnamData[year.toString()].toFixed(1) 
            : "--";
            
        const vietnamEl = document.getElementById("vietnam-val-value");
        if (vietnamEl) {
            vietnamEl.innerText = vietnamVal + "%";
            colorCodeElement(vietnamEl, parseFloat(vietnamVal));
        }
    }

    // Helper to color text based on map legend scale
    function colorCodeElement(element, value) {
        if (isNaN(value)) {
            element.style.color = "#333";
            return;
        }
        
        // Matches the customColorScale range
            if (value < -5) element.style.color = "#2e7d32";     
            else if (value < 0) element.style.color = "#66bb6a"; 
            else if (value < 2) element.style.color = "#ffeb3b"; 
            else if (value < 5) element.style.color = "#ff9800"; 
            else if (value < 10) element.style.color = "#f44336"; 
            else if (value < 20) element.style.color = "#c62828"; 
            else element.style.color = "#8e0000";   
    }

    // Create map with TopoJSON
    function createGlobalMap() {
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

        // Convert TopoJSON to GeoJSON
        const countries = topojson.feature(worldMap, worldMap.objects.countries);

        // Calculate Scale Range
        const inflationValues = [];
        countries.features.forEach(d => {
            const countryName = d.properties.NAME || d.properties.name;
            const countryData = findCountryData(countryName);
            if (countryData) {
                const value = countryData[selectedMapYear.toString()];
                if (value !== undefined && !isNaN(value)) inflationValues.push(value);
            }
        });

        // Use a custom color scale matching the legend
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
                return "#e0e0e0"; // No data gray
            })
            .on("mouseover", function (event, d) {
                d3.select(this)
                    .style("opacity", 0.5)
                    
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
                    .attr("class", "map-tooltip")
                    .style("opacity", 0);

                tooltip.transition().duration(200).style("opacity", 0.95);

                tooltip.html(`
                    <h4>${countryName}</h4>
                    <p>Year: ${selectedMapYear}</p>
                    <p>Inflation Rate: <strong>${inflationRate}</strong></p>
                `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function () {
                d3.select(this)
                    .style("opacity", 1)
                    .style("stroke", "#fff")
                    .style("stroke-width", 0.5);

                d3.selectAll(".map-tooltip").remove();
            });

        // Update Overlays
        updateBigNumberOverlays(selectedMapYear);

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

        const countries = worldMap.features || worldMap;

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
                    if (value !== undefined && !isNaN(value)) {
                        return customColorScale(value);
                    }
                }
                return "#e0e0e0";
            })
            .on("mouseover", function (event, d) {
                d3.select(this).attr("stroke", "#333").attr("stroke-width", 1.5);

                const countryName = d.properties.name || d.properties.NAME;
                const countryData = findCountryData(countryName);

                let inflationRate = "No data";
                if (countryData) {
                    const value = countryData[selectedMapYear.toString()];
                    if (value !== undefined && !isNaN(value)) {
                        inflationRate = value.toFixed(2) + "%";
                    }
                }

                const tooltip = d3.select("body")
                    .append("div")
                    .attr("class", "map-tooltip")
                    .style("opacity", 0);

                tooltip.transition().duration(200).style("opacity", 0.95);

                tooltip.html(`
                    <h4>${countryName}</h4>
                    <p>Year: ${selectedMapYear}</p>
                    <p>Inflation Rate: <strong>${inflationRate}</strong></p>
                `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function () {
                d3.select(this).attr("stroke", "#fff").attr("stroke-width", 0.5);
                d3.selectAll(".map-tooltip").remove();
            });

        updateBigNumberOverlays(selectedMapYear);
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
            .style("gap", "12px");

        legendItems.forEach((item, i) => {
            const itemDiv = legend.append("div")
                .attr("class", "legend-item")
                .style("display", "inline-flex")
                .style("align-items", "center")
                .style("gap", "6px");

            itemDiv.append("div")
                .attr("class", "legend-color")
                .style("background-color", item.color)
                .style("width", "20px")
                .style("height", "12px")
                .style("border", "1px solid rgba(0,0,0,0.1)")
                .style("border-radius", "2px");

            const label = i === 0
                ? `< ${item.max}%`
                : i === legendItems.length - 1
                    ? `> ${item.min}%`
                    : `${item.min}-${item.max}%`;

            itemDiv.append("span")
                .style("font-size", "11px")
                .style("color", "#4b5563")
                .text(label);
        });
    }

    // --- Slider & Play Button Logic ---
    const mapYearSlider = document.getElementById('map-year-slider');
    const mapYearDisplay = document.getElementById('selected-map-year');
    const playButton = document.getElementById('map-play-btn');

    let isPlaying = false;
    let playInterval = null;
    const minYear = 2000; // Adjusted based on slider HTML
    const maxYear = 2024;
    const playSpeed = 800; 

    // Update the slider background fill logic
    function updateSliderFill(slider) {
        if (!slider) return;
        const min = parseInt(slider.min);
        const max = parseInt(slider.max);
        const val = parseInt(slider.value);
        const percentage = ((val - min) / (max - min)) * 100;
        
        // Fill with black up to thumb, transparent after
        slider.style.background = `linear-gradient(to right, #111827 ${percentage}%, transparent ${percentage}%)`;
    }

    function updateMapYear(year) {
        selectedMapYear = year;
        if (mapYearDisplay) mapYearDisplay.textContent = selectedMapYear;
        if (mapYearSlider) {
            mapYearSlider.value = selectedMapYear;
            updateSliderFill(mapYearSlider);
        }

        if (worldMap) {
            if (worldMap.objects) {
                createGlobalMap();
            } else {
                createGlobalMapGeoJSON();
            }
        }
    }

    function togglePlay() {
        isPlaying = !isPlaying;

        if (isPlaying) {
            // Restart if at end
            if (selectedMapYear >= maxYear) {
                updateMapYear(minYear);
            }

            // Pause Icon
            playButton.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
            `;

            playInterval = setInterval(() => {
                let nextYear = selectedMapYear + 1;
                if (nextYear > maxYear) {
                    togglePlay(); 
                    return;
                }
                updateMapYear(nextYear);
            }, playSpeed);

        } else {
            // Play Icon
            playButton.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                </svg>
            `;

            if (playInterval) {
                clearInterval(playInterval);
                playInterval = null;
            }
        }
    }

    if (mapYearSlider) {
        // Initial fill
        updateSliderFill(mapYearSlider);
        
        mapYearSlider.addEventListener('input', function () {
            if (isPlaying) togglePlay(); // Stop play on manual interaction
            updateMapYear(parseInt(this.value));
        });
    }

    if (playButton) {
        playButton.addEventListener('click', function (e) {
            e.preventDefault();
            togglePlay();
        });
    }

    // Scroll Animation Observer
    const chartSections = document.querySelectorAll('.full-width-chart, .chart-section');

    if (chartSections.length > 0) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target); 
                }
            });
        }, {
            threshold: 0.2
        });

        chartSections.forEach(section => {
            observer.observe(section);
        });
    }

    // Smooth Scrolling for Anchors
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const headerOffset = 100;
                const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerOffset;
                const startPosition = window.pageYOffset;
                const distance = targetPosition - startPosition;
                const duration = 500;
                let start = null;

                function step(timestamp) {
                    const progress = timestamp - start;
                    const percent = Math.min(progress / duration, 1);
                    const ease = percent; // Linear for simplicity or add easing function

                    window.scrollTo(0, startPosition + distance * ease);

                    if (progress < duration) {
                        window.requestAnimationFrame(step);
                    } else {
                        history.pushState(null, null, targetId);
                    }
                }
                
                // Initialize start time
                window.requestAnimationFrame(function(timestamp) {
                    start = timestamp;
                    step(timestamp);
                });
            }
        });
    });

});