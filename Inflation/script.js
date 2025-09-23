// script.js
document.addEventListener('DOMContentLoaded', function() {
    const data = [
        { label: 'Jan', value: 30 },
        { label: 'Feb', value: 86 },
        { label: 'Mar', value: 168 },
        { label: 'Apr', value: 281 },
        { label: 'May', value: 303 },
        { label: 'Jun', value: 365 }
    ];

    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const width = 300;
    const height = 200;

    createBarChart(data, '#bar-chart');
    createLineChart(data, '#line-chart');
    createPieChart(data, '#pie-chart');

    function createBarChart(data, containerId) {
        const svg = d3.select(containerId)
            .append('svg')
            .attr('width', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        const x = d3.scaleBand()
            .domain(data.map(d => d.label))
            .range([margin.left, width - margin.right])
            .padding(0.2);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.value)])
            .nice()
            .range([height - margin.bottom, margin.top]);

        svg.selectAll('rect')
            .data(data)
            .join('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.label))
            .attr('y', d => y(d.value))
            .attr('width', x.bandwidth())
            .attr('height', d => y(0) - y(d.value))
            .attr('rx', 2)
            .attr('ry', 2);

        // Add x-axis
        svg.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x));

        svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(y));
    }

    function createLineChart(data, containerId) {
        const svg = d3.select(containerId)
            .append('svg')
            .attr('width', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        const x = d3.scalePoint()
            .domain(data.map(d => d.label))
            .range([margin.left, width - margin.right]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.value)])
            .nice()
            .range([height - margin.bottom, margin.top]);

        const line = d3.line()
            .x(d => x(d.label))
            .y(d => y(d.value));
        svg.append('path')
            .datum(data)
            .attr('class', 'line')
            .attr('d', line)
            .attr('fill', 'none')
            .attr('stroke', '#e74c3c')
            .attr('stroke-width', 2.5);

        svg.selectAll('circle')
            .data(data)
            .join('circle')
            .attr('cx', d => x(d.label))
            .attr('cy', d => y(d.value))
            .attr('r', 4)
            .attr('fill', '#e74c3c');

        svg.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x));
        svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(y));
    }

    function createPieChart(data, containerId) {
        const radius = Math.min(width, height) / 2 - 10;
        
        const svg = d3.select(containerId)
            .append('svg')
            .attr('width', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .append('g')
            .attr('transform', `translate(${width / 2}, ${height / 2})`);

        const pie = d3.pie()
            .value(d => d.value);

        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius);

        const color = d3.scaleOrdinal()
            .domain(data.map(d => d.label))
            .range(d3.schemeCategory10);
        const arcs = svg.selectAll('.arc')
            .data(pie(data))
            .enter()
            .append('g')
            .attr('class', 'arc');

        arcs.append('path')
            .attr('d', arc)
            .attr('fill', d => color(d.data.label))
            .attr('class', 'pie-arc')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1);

        arcs.append('text')
            .attr('transform', d => `translate(${arc.centroid(d)})`)
            .attr('dy', '0.35em')
            .text(d => d.data.value)
            .style('text-anchor', 'middle')
            .style('font-size', '10px')
            .style('fill', '#fff');

        const legend = svg.selectAll('.legend')
            .data(data)
            .enter()
            .append('g')
            .attr('class', 'legend')
            .attr('transform', (d, i) => `translate(${radius + 20}, ${i * 20 - 40})`);

        legend.append('rect')
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', d => color(d.label));

        legend.append('text')
            .attr('x', 16)
            .attr('y', 10)
            .text(d => d.label)
            .style('font-size', '10px')
            .style('text-anchor', 'start');
    }
});