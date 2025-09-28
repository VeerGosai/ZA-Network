document.addEventListener('DOMContentLoaded', () => {
    // Set up the SVG container
    const width = document.getElementById('visualization').clientWidth;
    const height = document.getElementById('visualization').clientHeight;

    // Create SVG with zoom support
    const svg = d3.select('#visualization')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // Create a group element for zoom behavior to transform
    const g = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 10]) // Set the zoom limits
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });

    // Apply zoom to the SVG
    svg.call(zoom);

    // Add zoom controls
    const zoomControls = d3.select('#visualization')
        .append('div')
        .attr('class', 'zoom-controls');
    
    zoomControls.append('button')
        .text('+')
        .on('click', () => {
            svg.transition().duration(300).call(zoom.scaleBy, 1.5);
        });
    
    zoomControls.append('button')
        .text('-')
        .on('click', () => {
            svg.transition().duration(300).call(zoom.scaleBy, 0.75);
        });
    
    zoomControls.append('button')
        .text('Reset')
        .on('click', () => {
            svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
        });

    // Load all three CSV files
    Promise.all([
        d3.csv('data.csv'),
        d3.csv('companies.csv'),
        d3.csv('ix.csv')
    ]).then(([networkData, companyData, ixData]) => {
        // Process network data
        const networkNodes = networkData.map(d => ({
            type: 'network',
            name: d['Peer Name'],
            ipv4: d['IPv4'],
            asn: d['ASN'],
            ipv6: d['IPv6'],
            speed: d['Speed (Gbps)'],
            exchange: d['Internet Exchange'],
            // Initial random position
            x: Math.random() * (width - 100) + 50,
            y: Math.random() * (height - 100) + 50
        }));

        // Process company data
        const companyNodes = companyData.map(d => ({
            type: 'company',
            name: d['Company'],
            // Initial random position - position them slightly differently
            x: Math.random() * (width - 150) + 75,
            y: Math.random() * (height - 150) + 75
        }));
        
        // Process IX data - position them centrally
        const ixNodes = ixData.map(d => ({
            type: 'ix',
            name: d['ix'],
            // Position IX nodes more centrally
            x: Math.random() * (width/2) + width/4,
            y: Math.random() * (height/2) + height/4
        }));

        // Combine all nodes
        const allNodes = [...networkNodes, ...companyNodes, ...ixNodes];

        // Create links between network nodes and their Internet Exchanges
        const ixLinks = [];
        networkNodes.forEach(networkNode => {
            // Find the matching IX node
            const matchingIX = ixNodes.find(ixNode => ixNode.name === networkNode.exchange);
            if (matchingIX) {
                ixLinks.push({
                    source: networkNode,
                    target: matchingIX,
                    type: 'ix-connection'
                });
            }
        });

        // Create links between network nodes and their matching companies
        const companyLinks = [];
        networkNodes.forEach(networkNode => {
            // Extract just the company part of the peer name (before any commas or other delimiters)
            const peerCompanyName = networkNode.name.split(',')[0].trim();
            
            // Find all matching company nodes
            const matchingCompanies = companyNodes.filter(companyNode => 
                companyNode.name === peerCompanyName || 
                peerCompanyName.includes(companyNode.name) || 
                companyNode.name.includes(peerCompanyName)
            );
            
            // Create links for each match
            matchingCompanies.forEach(matchingCompany => {
                companyLinks.push({
                    source: networkNode,
                    target: matchingCompany,
                    type: 'company-connection'
                });
            });
        });

        // Combine all links
        const allLinks = [...ixLinks, ...companyLinks];

        // Create force simulation with all nodes and links
        const simulation = d3.forceSimulation(allNodes)
            .force('charge', d3.forceManyBody().strength(d => {
                // Make company nodes have less repulsion to move more freely
                if (d.type === 'company') return -15;
                else if (d.type === 'ix') return -400; // Increased repulsion for IX nodes
                else return -60;
            }))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(d => {
                // Smaller collision radius for company nodes
                if (d.type === 'company') return 8; 
                else if (d.type === 'ix') return 35; // Increased radius for IX nodes
                else return 15;
            }))
            .force('link', d3.forceLink(allLinks).id(d => d.name)
                // Make IX connections the strongest
                .strength(d => {
                    if (d.type === 'ix-connection') {
                        return 0.9; // Strongest force for IX connections
                    } else if (d.type === 'company-connection') {
                        // Get the company node
                        const companyNode = d.source.type === 'company' ? d.source : d.target;
                        
                        // Count how many connections this company has
                        const connectionCount = companyLinks.filter(link => 
                            (link.source === companyNode || link.target === companyNode)).length;
                        
                        if (connectionCount === 2) {
                            return 0.7; // Strong but less than IX connections
                        } else if (connectionCount > 2) {
                            return 0.4;
                        }
                        return 0.1; // Weak for single connections
                    }
                    return 0.4; // Default
                })
                .distance(d => {
                    if (d.type === 'ix-connection') {
                        return 50; // Shortest distance for IX connections
                    } else if (d.type === 'company-connection') {
                        const companyNode = d.source.type === 'company' ? d.source : d.target;
                        const connectionCount = companyLinks.filter(link => 
                            (link.source === companyNode || link.target === companyNode)).length;
                        
                        if (connectionCount === 2) {
                            return 70; // Longer than IX but still short
                        } else if (connectionCount > 2) {
                            return 90;
                        }
                        return 150; // Longest for single connections
                    }
                    return 100; // Default
                })
            )
            .on('tick', ticked);

        // Custom force to position company nodes precisely between their connections
        simulation.force('center-companies', alpha => {
            companyNodes.forEach(companyNode => {
                // Find all links connected to this company
                const connectedLinks = companyLinks.filter(link => 
                    link.source === companyNode || link.target === companyNode);
                
                // If company has connections
                if (connectedLinks.length > 0) {
                    // Find all nodes connected to this company
                    const connectedNodes = [];
                    connectedLinks.forEach(link => {
                        if (link.source === companyNode) {
                            connectedNodes.push(link.target);
                        } else {
                            connectedNodes.push(link.source);
                        }
                    });
                    
                    // For exactly 2 connections, position precisely in the middle
                    if (connectedNodes.length === 2) {
                        const node1 = connectedNodes[0];
                        const node2 = connectedNodes[1];
                        
                        // Calculate exact midpoint
                        const midX = (node1.x + node2.x) / 2;
                        const midY = (node1.y + node2.y) / 2;
                        
                        // Move company node precisely to midpoint with stronger force
                        companyNode.x += (midX - companyNode.x) * alpha * 0.9;
                        companyNode.y += (midY - companyNode.y) * alpha * 0.9;
                    } 
                    // For more than 2 connections, still try to center but less strictly
                    else if (connectedNodes.length > 2) {
                        // Calculate the centroid of connected nodes
                        let cx = 0, cy = 0;
                        connectedNodes.forEach(node => {
                            cx += node.x;
                            cy += node.y;
                        });
                        cx /= connectedNodes.length;
                        cy /= connectedNodes.length;
                        
                        // Move company node toward centroid
                        companyNode.x += (cx - companyNode.x) * alpha * 0.8;
                        companyNode.y += (cy - companyNode.y) * alpha * 0.8;
                    }
                }
            });
        });

        // Modify the jitter for company nodes
        setInterval(() => {
            allNodes.forEach(node => {
                if (node.type === 'company' && !node.fx && !node.fy) {
                    // Find number of connections for this company
                    const connectionCount = companyLinks.filter(link => 
                        (link.source === node || link.target === node)).length;
                    
                    // Apply no jitter for exactly 2 connections to keep the line straight
                    if (connectionCount === 2) {
                        return; // Skip jitter completely
                    }
                    
                    // Apply very little jitter to companies with >2 connections
                    const jitterFactor = connectionCount > 2 ? 0.3 : 1.5;
                    
                    // Apply random small force to company nodes
                    node.x += (Math.random() - 0.5) * jitterFactor;
                    node.y += (Math.random() - 0.5) * jitterFactor;
                }
            });
            // Only do this if the simulation is already running
            if (simulation.alpha() > 0.05) simulation.tick();
        }, 100);

        // Draw the links first so they appear behind the nodes
        const linkElements = g.selectAll('.link')
            .data(allLinks)
            .enter().append('line')
            .attr('id', (d, i) => `link-${i}`)
            .attr('class', d => `link ${d.type}`)
            .attr('data-source', d => d.source.name)
            .attr('data-target', d => d.target.name)
            .each(function(d) {
                // Store the speed value as a data attribute for debugging
                if (d.type === 'ix-connection') {
                    let networkNode;
                    
                    // Ensure we have proper object references after D3 force layout
                    if (typeof d.source === 'object' && d.source.type === 'network') {
                        networkNode = d.source;
                    } else if (typeof d.target === 'object' && d.target.type === 'network') {
                        networkNode = d.target;
                    }
                    
                    if (networkNode && networkNode.speed) {
                        d3.select(this).attr('data-speed', networkNode.speed);
                    }
                }
            })
            .style('stroke', function(d) {
                // Only apply speed-based coloring to IX connections
                if (d.type !== 'ix-connection') return '#999';
                
                // Get the network node
                let networkNode;
                let speed = null;
                
                // Force-directed layouts can change source/target to objects
                if (typeof d.source === 'object' && d.source.type === 'network') {
                    networkNode = d.source;
                } else if (typeof d.target === 'object' && d.target.type === 'network') {
                    networkNode = d.target;
                } else {
                    console.warn('IX link without network node:', d);
                    return '#666';
                }
                
                // Extract the speed value
                if (networkNode && networkNode.speed) {
                    const speedStr = networkNode.speed;
                    // Try parsing the speed - ensure it's a valid number
                    speed = parseFloat(speedStr);
                    console.log(`Link ${networkNode.name} <-> ${networkNode.exchange}: Speed=${speedStr}, Parsed=${speed}`);
                }
                
                // Apply color based on speed
                if (speed === null || isNaN(speed)) {
                    return '#666'; // Default gray
                } else if (speed <= 1) {
                    return '#E6D72A'; // Yellow for ≤1 Gbps
                } else if (speed <= 10) {
                    return '#E67E22'; // Orange for 1.1-10 Gbps
                } else if (speed <= 100) {
                    return '#E74C3C'; // Red for 10.1-100 Gbps
                } else {
                    return '#000000'; // Black for >100 Gbps
                }
            })
            .style('stroke-opacity', function(d) {
                if (d.type !== 'ix-connection') return 0.3;
                
                // Get the network node and its speed
                let networkNode, speed = null;
                
                if (typeof d.source === 'object' && d.source.type === 'network') {
                    networkNode = d.source;
                } else if (typeof d.target === 'object' && d.target.type === 'network') {
                    networkNode = d.target;
                } else {
                    return 0.5;
                }
                
                if (networkNode && networkNode.speed) {
                    speed = parseFloat(networkNode.speed);
                }
                
                // Higher opacity for higher speeds
                if (speed === null || isNaN(speed)) return 0.5;
                if (speed > 100) return 0.8;
                if (speed > 10) return 0.7;
                if (speed > 1) return 0.6;
                return 0.5;
            })
            .style('stroke-width', function(d) {
                if (d.type !== 'ix-connection') return 1.5;
                
                // Get the network node and its speed
                let networkNode, speed = null;
                
                if (typeof d.source === 'object' && d.source.type === 'network') {
                    networkNode = d.source;
                } else if (typeof d.target === 'object' && d.target.type === 'network') {
                    networkNode = d.target;
                } else {
                    return 2;
                }
                
                if (networkNode && networkNode.speed) {
                    speed = parseFloat(networkNode.speed);
                }
                
                // Thicker lines for higher speeds
                if (speed === null || isNaN(speed)) return 2;
                if (speed > 100) return 3;
                if (speed > 10) return 2.5;
                return 2;
            });

        // Add a legend for connection speeds
        const speedLegend = d3.select('#visualization')
            .append('div')
            .attr('class', 'speed-legend')
            .html(`
                <div class="legend-title">Connection Speed</div>
                <div class="legend-item"><span class="color-box" style="background-color:#E6D72A"></span> ≤ 1 Gbps</div>
                <div class="legend-item"><span class="color-box" style="background-color:#E67E22"></span> 1.1-10 Gbps</div>
                <div class="legend-item"><span class="color-box" style="background-color:#E74C3C"></span> 10.1-100 Gbps</div>
                <div class="legend-item"><span class="color-box" style="background-color:#000000"></span> > 100 Gbps</div>
                <div class="legend-item"><span class="color-box" style="background-color:#666666"></span> Unknown</div>
            `);

        // Create node elements - attach to the transformed group
        const nodeElements = g.selectAll('.node')
            .data(allNodes)
            .enter().append('g')
            .attr('id', (d, i) => `node-${i}`)
            .attr('class', d => `node ${d.type}`)
            .attr('data-name', d => d.name)
            .attr('data-type', d => d.type)
            .attr('data-exchange', d => d.exchange || '')
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        // Add circles to nodes with different colors and sizes based on type
        nodeElements.append('circle')
            .attr('r', d => {
                if (d.type === 'ix') return 20;
                else if (d.type === 'network') return 8;
                else return 6;
            })
            .attr('class', d => d.type)
            .on('click', (event, d) => {
                event.stopPropagation(); // Stop propagation to prevent deselection
                
                // Remove selection from any previously selected node
                d3.selectAll('.node.selected').classed('selected', false);
                
                // Add selected class to this node
                d3.select(event.currentTarget.parentNode).classed('selected', true);
                
                highlightConnections(d);
                showNodeDetails(event, d);
            });

        // Add text labels to nodes
        nodeElements.append('text')
            .attr('dy', d => d.type === 'ix' ? 30 : 16)
            .attr('font-size', d => {
                if (d.type === 'ix') return '12px';
                else if (d.type === 'network') return '10px';
                else return '9px';
            })
            .text(d => d.name);

        // Create node visibility state tracker
        const visibilityState = {
            ixFilters: {}
        };
        
        // Initialize all IX filters as active
        ixData.forEach(d => {
            visibilityState.ixFilters[d.ix] = true;
        });

        // Populate IX filters in the left panel
        populateIxFilters(ixData, visibilityState);

        // Set up search functionality
        setupSearch();

        // Apply initial visibility based on filters
        applyFilters();

        // Function to set up search
        function setupSearch() {
            const searchInput = document.getElementById('search-input');
            const searchClear = document.getElementById('search-clear');
            const searchResults = document.getElementById('search-results');
            
            if (!searchInput || !searchClear || !searchResults) return;
            
            // Handle search input
            searchInput.addEventListener('input', performSearch);
            searchClear.addEventListener('click', clearSearch);
            
            function performSearch() {
                const term = searchInput.value.trim().toLowerCase();
                
                // Show/hide clear button
                searchClear.style.display = term ? 'block' : 'none';
                
                // Clear previous highlights
                clearSearchHighlights();
                
                if (!term) {
                    searchResults.textContent = '';
                    return;
                }
                
                // Find matching nodes
                const matches = allNodes.filter(node => 
                    node.name.toLowerCase().includes(term) && node.visible
                );
                
                // Update results count
                searchResults.textContent = `Found ${matches.length} matching node${matches.length !== 1 ? 's' : ''}`;
                
                // Highlight matching nodes
                matches.forEach(node => {
                    const nodeIndex = allNodes.indexOf(node);
                    d3.select(`#node-${nodeIndex}`)
                        .classed('search-match', true);
                });
                
                // If we have exactly one match, highlight it prominently
                if (matches.length === 1) {
                    const nodeIndex = allNodes.indexOf(matches[0]);
                    const matchNode = matches[0];
                    
                    d3.select(`#node-${nodeIndex}`)
                        .classed('search-highlight', true);
                    
                    // Optionally, show details for the single match
                    showNodeDetails(null, matchNode);
                    
                    // Center the view on the matched node
                    centerViewOnNode(matchNode);
                }
            }
            
            function clearSearch() {
                searchInput.value = '';
                searchClear.style.display = 'none';
                searchResults.textContent = '';
                clearSearchHighlights();
            }
        }
        
        // Function to clear search highlights
        function clearSearchHighlights() {
            d3.selectAll('.search-match').classed('search-match', false);
            d3.selectAll('.search-highlight').classed('search-highlight', false);
        }
        
        // Function to center the view on a specific node
        function centerViewOnNode(node) {
            const transform = d3.zoomTransform(svg.node());
            const scale = transform.k;
            const x = -node.x * scale + width / 2;
            const y = -node.y * scale + height / 2;
            
            svg.transition()
                .duration(500)
                .call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
        }

        // Function to populate IX filters
        function populateIxFilters(ixData, state) {
            const filterContainer = document.getElementById('ix-filters');
            
            // Sort IX data alphabetically
            const sortedIxData = [...ixData].sort((a, b) => a.ix.localeCompare(b.ix));
            
            sortedIxData.forEach(d => {
                const ixName = d.ix;
                
                const filterItem = document.createElement('div');
                filterItem.className = 'filter-item';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `filter-ix-${ixName.replace(/\s+/g, '-')}`;
                checkbox.className = 'filter-checkbox';
                checkbox.checked = state.ixFilters[ixName];
                checkbox.addEventListener('change', () => {
                    state.ixFilters[ixName] = checkbox.checked;
                    applyFilters();
                });
                
                const indicator = document.createElement('span');
                indicator.className = 'filter-indicator';
                
                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.className = 'filter-label';
                label.textContent = ixName;
                
                // Count nodes connected to this IX
                const connectedCount = networkNodes.filter(n => n.exchange === ixName).length;
                const count = document.createElement('span');
                count.className = 'filter-count';
                count.textContent = `(${connectedCount})`;
                
                filterItem.appendChild(checkbox);
                filterItem.appendChild(indicator);
                filterItem.appendChild(label);
                filterItem.appendChild(count);
                filterContainer.appendChild(filterItem);
            });
            
            // Add select/deselect all controls
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'filter-controls';
            
            const selectAllBtn = document.createElement('button');
            selectAllBtn.textContent = 'Select All';
            selectAllBtn.className = 'filter-btn';
            selectAllBtn.addEventListener('click', () => {
                Object.keys(state.ixFilters).forEach(ix => {
                    state.ixFilters[ix] = true;
                });
                document.querySelectorAll('.filter-checkbox').forEach(cb => {
                    cb.checked = true;
                });
                applyFilters();
            });
            
            const deselectAllBtn = document.createElement('button');
            deselectAllBtn.textContent = 'Deselect All';
            deselectAllBtn.className = 'filter-btn';
            deselectAllBtn.addEventListener('click', () => {
                Object.keys(state.ixFilters).forEach(ix => {
                    state.ixFilters[ix] = false;
                });
                document.querySelectorAll('.filter-checkbox').forEach(cb => {
                    cb.checked = false;
                });
                applyFilters();
            });
            
            controlsDiv.appendChild(selectAllBtn);
            controlsDiv.appendChild(deselectAllBtn);
            filterContainer.appendChild(controlsDiv);
        }
        
        // Function to apply filters to the visualization
        function applyFilters() {
            // Process nodes first - determine which nodes should be visible
            nodeElements.each(function(d) {
                let shouldShow = true;
                
                if (d.type === 'ix') {
                    // IX nodes: Show only if their filter is active
                    shouldShow = visibilityState.ixFilters[d.name] === true;
                } else if (d.type === 'network') {
                    // Network nodes: Show only if their IX filter is active
                    shouldShow = d.exchange ? visibilityState.ixFilters[d.exchange] === true : false;
                } else if (d.type === 'company') {
                    // Company nodes: Show if any of their connected network nodes are visible
                    // We'll handle this below after processing network nodes
                    shouldShow = false;
                }
                
                // Store visibility state on the node data object
                d.visible = shouldShow;
            });
            
            // Process company nodes - a company is visible if any of its connected network nodes are visible
            // First, get all visible network nodes
            const visibleNetworkNodes = allNodes.filter(n => n.type === 'network' && n.visible);
            
            // Then find companies connected to these visible network nodes
            companyNodes.forEach(company => {
                // Check if this company has any connections to visible network nodes
                const hasVisibleConnections = companyLinks.some(link => {
                    const networkNode = link.source.type === 'network' ? link.source : link.target;
                    const companyNode = link.source.type === 'company' ? link.source : link.target;
                    
                    return companyNode === company && networkNode.visible;
                });
                
                company.visible = hasVisibleConnections;
            });
            
            // Apply visibility classes to nodes
            nodeElements.classed('hidden', d => !d.visible);
            
            // Process links - a link is visible only if both its source and target are visible
            linkElements.classed('hidden', d => {
                return !d.source.visible || !d.target.visible;
            });
        }

        // Function to highlight connections
        function highlightConnections(node) {
            // Clear previous highlights
            clearHighlights();
            
            // Find all links connected to this node
            // Use id checking instead of object reference for more reliable matching
            const nodeIndex = allNodes.indexOf(node);
            
            const connectedLinks = allLinks.filter(link => {
                const sourceIndex = typeof link.source === 'object' ? 
                    allNodes.indexOf(link.source) : 
                    allNodes.findIndex(n => n.name === link.source);
                    
                const targetIndex = typeof link.target === 'object' ? 
                    allNodes.indexOf(link.target) : 
                    allNodes.findIndex(n => n.name === link.target);
                
                return sourceIndex === nodeIndex || targetIndex === nodeIndex;
            });
            
            // Find all nodes connected to this node via the links
            const connectedNodes = new Set();
            connectedLinks.forEach(link => {
                // Need to handle both object references and name-based references
                if ((typeof link.source === 'object' && link.source === node) || 
                    (typeof link.source === 'string' && link.source === node.name)) {
                    connectedNodes.add(typeof link.target === 'object' ? 
                        link.target : 
                        allNodes.find(n => n.name === link.target));
                } else {
                    connectedNodes.add(typeof link.source === 'object' ? 
                        link.source : 
                        allNodes.find(n => n.name === link.source));
                }
            });
            
            // Highlight the clicked node
            d3.select(`#node-${nodeIndex}`)
                .classed('highlighted-source', true);
                
            // Highlight connected nodes and apply the connected-node class for scaling
            connectedNodes.forEach(connectedNode => {
                if (connectedNode) {
                    const connectedNodeIndex = allNodes.indexOf(connectedNode);
                    if (connectedNodeIndex >= 0) {
                        d3.select(`#node-${connectedNodeIndex}`)
                            .classed('highlighted-connection', true)
                            .classed('connected-node', true); // Add class for scaling
                    }
                }
            });
            
            // Highlight the links
            connectedLinks.forEach(link => {
                const linkIndex = allLinks.indexOf(link);
                if (linkIndex >= 0) {
                    d3.select(`#link-${linkIndex}`)
                        .classed('highlighted-link', true);
                }
            });
            
            // Group connected nodes by type
            const networkNodesConnected = [...connectedNodes].filter(n => n && n.type === 'network');
            const companyNodesConnected = [...connectedNodes].filter(n => n && n.type === 'company');
            const ixNodesConnected = [...connectedNodes].filter(n => n && n.type === 'ix');
            
            // Sort the nodes by name for better readability
            networkNodesConnected.sort((a, b) => a.name.localeCompare(b.name));
            companyNodesConnected.sort((a, b) => a.name.localeCompare(b.name));
            ixNodesConnected.sort((a, b) => a.name.localeCompare(b.name));
            
            // Add detailed connection info to the node details
            addConnectionDetails(node, {
                networkNodes: networkNodesConnected,
                companyNodes: companyNodesConnected,
                ixNodes: ixNodesConnected,
                totalConnections: connectedNodes.size
            });
        }
        
        // Function to add connection details to the details panel
        function addConnectionDetails(node, connections) {
            const detailsDiv = document.getElementById('node-details');
            const { networkNodes, companyNodes, ixNodes, totalConnections } = connections;
            
            // Build connection details HTML
            let connectionDetails = `
                <hr>
                <h3>Connection Details</h3>
                <p><strong>Total connections:</strong> ${totalConnections}</p>
            `;
            
            // Only show sections that have connections
            if (networkNodes.length > 0) {
                connectionDetails += `
                    <div class="connection-section">
                        <h4>Network Connections (${networkNodes.length})</h4>
                        <div class="connected-nodes-list">
                `;
                
                networkNodes.forEach(n => {
                    connectionDetails += `
                        <div class="connected-node network-node" data-node-index="${allNodes.indexOf(n)}">
                            <span class="node-indicator"></span>
                            <span class="node-name">${n.name}</span>
                            ${n.asn ? `<span class="node-asn">ASN: ${n.asn}</span>` : ''}
                        </div>
                    `;
                });
                
                connectionDetails += `
                        </div>
                    </div>
                `;
            }
            
            if (companyNodes.length > 0) {
                connectionDetails += `
                    <div class="connection-section">
                        <h4>Company Connections (${companyNodes.length})</h4>
                        <div class="connected-nodes-list">
                `;
                
                companyNodes.forEach(n => {
                    connectionDetails += `
                        <div class="connected-node company-node" data-node-index="${allNodes.indexOf(n)}">
                            <span class="node-indicator"></span>
                            <span class="node-name">${n.name}</span>
                        </div>
                    `;
                });
                
                connectionDetails += `
                        </div>
                    </div>
                `;
            }
            
            if (ixNodes.length > 0) {
                connectionDetails += `
                    <div class="connection-section">
                        <h4>Internet Exchange Connections (${ixNodes.length})</h4>
                        <div class="connected-nodes-list">
                `;
                
                ixNodes.forEach(n => {
                    connectionDetails += `
                        <div class="connected-node ix-node" data-node-index="${allNodes.indexOf(n)}">
                            <span class="node-indicator"></span>
                            <span class="node-name">${n.name}</span>
                        </div>
                    `;
                });
                
                connectionDetails += `
                        </div>
                    </div>
                `;
            }
            
            // Append connection details to node details
            detailsDiv.innerHTML += connectionDetails;
            
            // Add click handlers to the connected node elements
            document.querySelectorAll('.connected-node').forEach(nodeElement => {
                nodeElement.addEventListener('click', () => {
                    const clickedNodeIndex = parseInt(nodeElement.getAttribute('data-node-index'));
                    const clickedNode = allNodes[clickedNodeIndex];
                    
                    // Show details for the clicked node
                    showNodeDetails(null, clickedNode);
                    highlightConnections(clickedNode);
                    
                    // Prevent event propagation
                    event.stopPropagation();
                });
            });
        }
        
        // Function to clear all highlights
        function clearHighlights() {
            d3.selectAll('.highlighted-source').classed('highlighted-source', false);
            d3.selectAll('.highlighted-connection').classed('highlighted-connection', false);
            d3.selectAll('.connected-node').classed('connected-node', false); // Clear connected-node class
            d3.selectAll('.highlighted-link').classed('highlighted-link', false);
            // Also clear any search highlights
            clearSearchHighlights();
            // Don't clear the selected node status here
        }

        // Add a click handler to the background to deselect
        svg.on('click', () => {
            d3.selectAll('.node.selected').classed('selected', false);
            d3.selectAll('.node.connected-node').classed('connected-node', false); // Clear connected-node class
            clearHighlights();
            
            // Clear node details
            const detailsDiv = document.getElementById('node-details');
            detailsDiv.innerHTML = '<p>Click on a node to see details</p>';
        });

        // Update positions on each simulation tick
        function ticked() {
            linkElements
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            nodeElements.attr('transform', d => `translate(${d.x},${d.y})`);
        }

        // Drag functions
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            
            // Special handling for company nodes
            if (d.type === 'company') {
                const connectionCount = companyLinks.filter(link => 
                    (link.source === d || link.target === d)).length;
                
                if (connectionCount === 2) {
                    // Immediately release nodes with exactly 2 connections
                    // They'll snap right back to the center of the line
                    d.fx = null;
                    d.fy = null;
                    simulation.alpha(0.3).restart();
                } 
                else if (connectionCount > 2) {
                    // Keep position fixed briefly for multi-connected companies
                    setTimeout(() => {
                        d.fx = null;
                        d.fy = null;
                        simulation.alpha(0.3).restart();
                    }, 1000);
                } else {
                    // Single-connection companies are free immediately
                    d.fx = null;
                    d.fy = null;
                }
            }
        }

        // Show node details when clicked
        function showNodeDetails(event, d) {
            const detailsDiv = document.getElementById('node-details');
            
            if (d.type === 'network') {
                detailsDiv.innerHTML = `
                    <h3>Network Node</h3>
                    <p><span class="detail-label">Peer Name:</span> <span class="detail-value">${d.name}</span></p>
                    <p><span class="detail-label">IPv4:</span> <span class="detail-value">${d.ipv4 || 'N/A'}</span></p>
                    <p><span class="detail-label">ASN:</span> <span class="detail-value">${d.asn || 'N/A'}</span></p>
                    <p><span class="detail-label">IPv6:</span> <span class="detail-value">${d.ipv6 || 'N/A'}</span></p>
                    <p><span class="detail-label">Speed:</span> <span class="detail-value">${d.speed || 'N/A'} Gbps</span></p>
                    <p><span class="detail-label">Internet Exchange:</span> <span class="detail-value">${d.exchange || 'N/A'}</span></p>
                `;
            } else if (d.type === 'ix') {
                // Find all network nodes connected to this IX
                const connectedNetworks = networkNodes.filter(n => n.exchange === d.name);
                
                detailsDiv.innerHTML = `
                    <h3>Internet Exchange</h3>
                    <p><span class="detail-label">Name:</span> <span class="detail-value">${d.name}</span></p>
                    <p><span class="detail-label">Connected Networks:</span> <span class="detail-value">${connectedNetworks.length}</span></p>
                `;
                
                // Add connected networks list if there are any
                if (connectedNetworks.length > 0) {
                    detailsDiv.innerHTML += `
                        <div class="connected-section">
                            <h4>Connected Networks</h4>
                            <div class="connected-nodes-list small-list">
                    `;
                    
                    // Sort networks alphabetically
                    connectedNetworks.sort((a, b) => a.name.localeCompare(b.name));
                    
                    // Show first 5 networks
                    const initialNetworks = connectedNetworks.slice(0, 5);
                    initialNetworks.forEach(network => {
                        const networkIndex = allNodes.indexOf(network);
                        detailsDiv.innerHTML += `
                            <div class="connected-node network-node" data-node-index="${networkIndex}">
                                <span class="node-indicator"></span>
                                <span class="node-name">${network.name}</span>
                            </div>
                        `;
                    });
                    
                    // Add "Show all" button if there are more than 5
                    if (connectedNetworks.length > 5) {
                        detailsDiv.innerHTML += `
                            <div class="show-more-btn" id="show-more-networks">
                                Show all ${connectedNetworks.length} networks
                            </div>
                        `;
                    }
                    
                    detailsDiv.innerHTML += `
                            </div>
                        </div>
                    `;
                }
                
                // Add "Show Internal Structure" button for specific IXs
                const specificIXs = ['CINX', 'DINX', 'NMBINX', 'JINX', 'JINX Voice'];
                if (specificIXs.includes(d.name)) {
                    // Get lowercase name for URL
                    const ixNameLower = d.name.toLowerCase().replace(/\s+/g, '');
                    
                    // Add button at the bottom
                    detailsDiv.innerHTML += `
                        <div class="internal-structure-container">
                            <a href="/structure/${ixNameLower}.html" class="structure-button">
                                Show Internal Structure
                            </a>
                        </div>
                    `;
                }
            } else {
                // For company nodes
                // Find all network nodes connected to this company
                const connectedLinks = companyLinks.filter(link => 
                    (link.source === d) || (link.target === d)
                );
                
                const connectedNetworks = new Set();
                connectedLinks.forEach(link => {
                    if (link.source === d) {
                        connectedNetworks.add(link.target);
                    } else {
                        connectedNetworks.add(link.source);
                    }
                });
                
                // Convert to array
                const connectedNetworksArray = [...connectedNetworks];
                
                detailsDiv.innerHTML = `
                    <h3>Company</h3>
                    <p><span class="detail-label">Name:</span> <span class="detail-value">${d.name}</span></p>
                    <p><span class="detail-label">Connected Networks:</span> <span class="detail-value">${connectedNetworksArray.length}</span></p>
                `;
                
                // Add connected networks list if there are any
                if (connectedNetworksArray.length > 0) {
                    detailsDiv.innerHTML += `
                        <div class="connected-section">
                            <h4>Connected Networks</h4>
                            <div class="connected-nodes-list small-list">
                    `;
                    
                    // Sort networks alphabetically
                    connectedNetworksArray.sort((a, b) => a.name.localeCompare(b.name));
                    
                    // Show all connected networks with their IX information
                    connectedNetworksArray.forEach(network => {
                        const networkIndex = allNodes.indexOf(network);
                        detailsDiv.innerHTML += `
                            <div class="connected-node network-node" data-node-index="${networkIndex}">
                                <div class="node-main-info">
                                    <span class="node-indicator"></span>
                                    <span class="node-name">${network.name}</span>
                                    ${network.asn ? `<span class="node-asn">ASN: ${network.asn}</span>` : ''}
                                </div>
                                <div class="node-ix-info">
                                    <span class="node-ix">${network.exchange || 'N/A'}</span>
                                </div>
                            </div>
                        `;
                    });
                    
                    detailsDiv.innerHTML += `
                            </div>
                        </div>
                    `;
                }
            }
            
            // Add click handlers to the connected node elements
            setTimeout(() => {
                document.querySelectorAll('.connected-node').forEach(nodeElement => {
                    nodeElement.addEventListener('click', () => {
                        const clickedNodeIndex = parseInt(nodeElement.getAttribute('data-node-index'));
                        const clickedNode = allNodes[clickedNodeIndex];
                        
                        // Show details for the clicked node
                        showNodeDetails(null, clickedNode);
                        highlightConnections(clickedNode);
                        
                        // Prevent event propagation
                        event.stopPropagation();
                    });
                });
                
                // Add click handler for "Show all" button
                const showMoreBtn = document.getElementById('show-more-networks');
                if (showMoreBtn) {
                    showMoreBtn.addEventListener('click', function() {
                        // Expand the list to show all networks
                        if (d.type === 'ix') {
                            const connectedNetworks = networkNodes.filter(n => n.exchange === d.name);
                            const connectedList = document.querySelector('.connected-nodes-list');
                            
                            // Clear the list
                            connectedList.innerHTML = '';
                            
                            // Add all networks
                            connectedNetworks.forEach(network => {
                                const networkIndex = allNodes.indexOf(network);
                                const networkElement = document.createElement('div');
                                networkElement.className = 'connected-node network-node';
                                networkElement.setAttribute('data-node-index', networkIndex);
                                
                                networkElement.innerHTML = `
                                    <span class="node-indicator"></span>
                                    <span class="node-name">${network.name}</span>
                                    ${network.asn ? `<span class="node-asn">ASN: ${network.asn}</span>` : ''}
                                `;
                                
                                connectedList.appendChild(networkElement);
                                
                                // Add click handler
                                networkElement.addEventListener('click', () => {
                                    showNodeDetails(null, network);
                                    highlightConnections(network);
                                });
                            });
                            
                            // Remove the show more button
                            this.remove();
                        }
                    });
                }
            }, 0);
            
            // Prevent the drag from starting when clicking for details
            if (event) event.stopPropagation();
        }
    }).catch(error => {
        console.error('Error loading the CSV files:', error);
    });
});