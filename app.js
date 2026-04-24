/**
 * NOTABLE PEOPLE OF UKRAINE - MAIN MAP SCRIPT
 * -------------------------------------------
 * This script initializes a Leaflet map, dynamically loads category data and 
 * person data from JSON files, and renders interactive clustered markers.
 */

// Wait for the HTML to fully load before running our script
document.addEventListener('DOMContentLoaded', function() {
    
    // ==========================================
    // 1. CONFIGURATION & STATE VARIABLES
    // ==========================================
    // These variables act as the "memory" of our app. 
    
    // Stores our dynamic dictionary of categories: { "Politics": ["All", "Law", "Gov"] }
    const subTopicsMap = {};

    // Stores the raw data of all 76k+ people so we don't have to re-download it
    let allPeople = []; 
    let peopleDetails = {};
    
    // Keeps track of how many people belong to each category so we can show numbers in the dropdowns
    let topicCounts = { main: {}, sub: {} };

    // Grabbing references to our HTML UI elements
    const mainFilter = document.getElementById('topic-filter');
    const subFilter = document.getElementById('sub-topic-filter');
    const subLabel = document.getElementById('sub-topic-label');

    // ==========================================
    // 2. MAP & CLUSTER INITIALIZATION
    // ==========================================
    
    // Define the strict physical boundaries of the map so users can't pan into endless gray space
    const southWest = L.latLng(-75, -200); 
    const northEast = L.latLng(85, 200);   
    const globeBounds = L.latLngBounds(southWest, northEast);

    // Initialize the main Leaflet map
    const map = L.map('map', {
        preferCanvas: true,
        center: [48.3794, 31.1656], // Centered roughly on Ukraine
        zoomDelta: 0.6,             // Makes zoom steps smoother
        zoomSnap: 0.15,
        wheelPxPerZoomLevel: 60,    // Controls mouse-wheel scroll speed
        zoom: 6,                    // Default starting zoom level
        minZoom: 2.25,              // Prevent zooming out too far
        maxBounds: globeBounds,     // Apply our borders
        maxBoundsViscosity: 1.0     // 1.0 means a hard, bouncy border
    });
    
    // Load the base map tiles (Carto Light for a clean, modern look)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, 
        attribution: '© OpenStreetMap contributors, © CARTO'
    }).addTo(map);

    // Initialize the clustering engine (groups nearby dots together into numbers)
    const markers = L.markerClusterGroup({
        spiderfyOnMaxZoom: false,    // We use a custom side-panel instead of Leaflet's default spider web layout
        showCoverageOnHover: false,  // Turn off the blue polygon area indicator
        zoomToBoundsOnClick: false,  // We handle zooming manually in Section 5
        animate: false,              // Keep core animations off for performance
        animateAddingMarkers: false, // CRITICAL: Must be false to prevent "ghost" markers when filtering
        maxClusterRadius: 140,       // How close dots need to be to group up (in pixels)
        
        // Custom logic to color the clusters based on how many people are inside them
        iconCreateFunction: function(cluster) {
            const count = cluster.getChildCount();
            let sizeClass = 'marker-cluster-';

            if (count < 50) sizeClass += 'small';
            else if (count < 500) sizeClass += 'medium';
            else sizeClass += 'large';

            return L.divIcon({
                html: `<div><span>${count}</span></div>`,
                className: `marker-cluster ${sizeClass}`,
                iconSize: L.point(40, 40)
            });
        }
    });

    // Add the cluster group to the map ONCE during startup
    map.addLayer(markers);
    
    // ==========================================
    // 3. CORE RENDERING ENGINE (CHUNKED)
    // ==========================================
    let currentRenderTimeout = null;

    function renderMarkers() {
        const mainTopic = mainFilter.value;
        const subTopic = subFilter.value;
        
        // Cancel any previous rendering cycle that might still be running
        if (currentRenderTimeout) clearTimeout(currentRenderTimeout);
        
        markers.clearLayers(); 

        const batchSize = 1000; // Draw 2000 markers at a time
        let index = 0;

        function processBatch() {
            const limit = Math.min(index + batchSize, allPeople.length);
            
            for (; index < limit; index++) {
                const person = allPeople[index];
                const pId = person[0];
                const pLat = person[1];
                const pLon = person[2];
                const pTopic = person[3];
                const pSubTopic = person[4];

                // Filtering
                if (mainTopic !== 'all' && pTopic !== mainTopic) continue;
                if (mainTopic !== 'all' && subTopic && subTopic !== 'All' && pSubTopic !== subTopic) continue;

                const dotIcon = L.divIcon({
                    className: 'custom-dot-marker',
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                });

                const marker = L.marker([pLat, pLon], { icon: dotIcon });
                marker.personData = { id: pId, topic: pTopic, sub_topic: pSubTopic }; 

                marker.bindPopup((layer) => generatePopupHTML(layer.personData));
                
                marker.on('click', (e) => {
                    document.querySelectorAll('.active-pulse').forEach(el => el.classList.remove('active-pulse'));
                    if (e.target._icon) e.target._icon.classList.add('active-pulse');
                });

                markers.addLayer(marker);
            }

            if (index < allPeople.length) {
                // Schedule the next batch in 1ms. This gives the browser time
                // to handle user clicks, animations, and map pans.
                currentRenderTimeout = setTimeout(processBatch, 1);
            } else {
                console.log("All markers rendered.");
            }
        }

        processBatch();
    }

    // ==========================================
    // 4. EVENT LISTENERS & UI LOGIC
    // ==========================================
    
    // Allow users to close side panels by pressing the Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const detailPanel = document.getElementById('person-detail-panel');
            const listPanel = document.getElementById('cluster-list-panel');

            if (detailPanel.classList.contains('open')) {
                detailPanel.classList.remove('open');
                document.querySelectorAll('.active-pulse').forEach(el => el.classList.remove('active-pulse'));
                map.closePopup();
            } 
            else if (listPanel.classList.contains('open')) {
                listPanel.classList.remove('open');
            }
        }
    });

    // When the user changes the Main Category dropdown...
    mainFilter.addEventListener('change', function(e) {
        const selectedMain = e.target.value;
        subFilter.innerHTML = ''; 
        
        if (selectedMain !== 'all' && subTopicsMap[selectedMain]) {
            subFilter.style.display = 'block';
            subLabel.style.display = 'inline-block';
            
            const subTopics = subTopicsMap[selectedMain];
            
            // Scenario A: Only 1 sub-topic exists (e.g., "All" and "Aviation"). Lock the dropdown.
            if (subTopics.length === 2) {
                const singleSubTopic = subTopics[1]; 
                const opt = document.createElement('option');
                opt.value = singleSubTopic;
                
                const count = topicCounts.sub[`${selectedMain}|${singleSubTopic}`] || 0;
                opt.innerText = `${singleSubTopic} (${count.toLocaleString()})`;
                
                subFilter.appendChild(opt);
                subFilter.disabled = true;       // Lock it
                subFilter.style.opacity = '1.0'; // Keep text bright
            } 
            // Scenario B: Multiple sub-topics exist. Build the dropdown normally.
            else {
                subFilter.disabled = false;
                subFilter.style.opacity = '1';
                subFilter.style.cursor = 'pointer';
                
                subTopics.forEach(st => {
                    const opt = document.createElement('option');
                    opt.value = st;
                    let count = 0;
                    
                    if (st === 'All') {
                        count = topicCounts.main[selectedMain] || 0;
                        opt.innerText = `All in ${selectedMain} (${count.toLocaleString()})`;
                    } else {
                        count = topicCounts.sub[`${selectedMain}|${st}`] || 0;
                        opt.innerText = `${st} (${count.toLocaleString()})`;
                    }
                    subFilter.appendChild(opt);
                });
                
                subFilter.value = 'All'; // Force reset to "All" whenever main category changes
            }
        } else {
            // Hide the sub-filter completely if "All People" is selected
            subFilter.style.display = 'none';
            subLabel.style.display = 'none';
            subFilter.disabled = false; 
        }
        
        renderMarkers(); // Redraw the map to reflect new filters
    });

    // Redraw map when sub-category changes
    subFilter.addEventListener('change', () => renderMarkers());

    // Dark Mode Toggle Logic
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            themeToggle.innerText = isDark ? '☀️ Switch to Light Mode' : '🌙 Switch to Dark Mode';
        });
    }

    // ==========================================
    // 5. CLUSTER & PANEL INTERACTION
    // ==========================================
    markers.on('clusterclick', function (a) {
        const cluster = a.layer;
        const bounds = cluster.getBounds();
        const isStacked = bounds.getNorthEast().equals(bounds.getSouthWest());

        if (isStacked || map.getZoom() === map.getMaxZoom()) {
            const clusterMarkers = cluster.getAllChildMarkers();
            const listContent = document.getElementById('list-content');
            const panel = document.getElementById('cluster-list-panel');
            
            // Look up the first person's details in our background dictionary
            const firstBasicData = clusterMarkers[0].personData;
            const firstDetails = peopleDetails[firstBasicData.id] || {}; // Fallback if still loading
            
            document.getElementById('panel-title').innerText = firstDetails.birthplace || "Location";
            document.getElementById('panel-subtitle').innerText = `${clusterMarkers.length} People Here`;
            
            listContent.innerHTML = '';
            
            clusterMarkers.forEach(marker => {
                const basicData = marker.personData; // {id, topic, sub_topic}
                const details = peopleDetails[basicData.id] || {};
                
                // Read from the details dictionary!
                const displayName = details.name_en || details.name_uk || details.name_ru || "Unknown Name";

                const item = document.createElement('div');
                item.className = 'list-item';
                item.innerHTML = `<div><strong>${displayName}</strong></div><div style="font-size:0.85em; color:gray;">${basicData.topic}</div>`;
                
                item.onclick = () => {
                    const detailPanel = document.getElementById('person-detail-panel');
                    const detailContent = document.getElementById('detail-content');
                    
                    document.getElementById('detail-name').innerText = displayName;
                    
                    // FIX: Generate the HTML directly instead of stealing the literal function text!
                    detailContent.innerHTML = generatePopupHTML(basicData); 
                    if(detailContent.querySelector('.popup-title')) detailContent.querySelector('.popup-title').remove();

                    detailPanel.classList.add('open');
                    document.querySelectorAll('.active-pulse').forEach(el => el.classList.remove('active-pulse'));
                    
                    const safeLeftPadding = Math.max(0, Math.min(820, window.innerWidth - 100));
                    const safeBottomPadding = Math.max(0, Math.min(window.innerHeight / 2, window.innerHeight - 100));
                    
                    map.flyTo(marker.getLatLng(), map.getZoom(), {
                        paddingBottomRight: [0, window.innerHeight / 2],
                        paddingTopLeft: [820, 0],
                        duration: 0.8
                    });

                    map.once('moveend', () => {
                        if (marker._icon) marker._icon.classList.add('active-pulse');
                    });
                };
                listContent.appendChild(item);
            });
            panel.classList.add('open');
        } else {
            const safeHorizontalPadding = Math.max(0, Math.min(370, (window.innerWidth - 50) / 2));
            map.flyToBounds(bounds, {
                padding: [safeHorizontalPadding, 20], 
                duration: 0.8,
                easeLinearity: 0.35
            });
        }
    });

    map.on('popupclose', () => {
        document.querySelectorAll('.active-pulse').forEach(el => el.classList.remove('active-pulse'));
    });

    map.on('click', () => closeAllPanels());

    // ==========================================
    // 6. CALCULATE DROPDOWN COUNTS
    // ==========================================
    function updateDropdownCounts() {
        let totalPeople = 0;
        topicCounts = { main: {}, sub: {} }; 

        allPeople.forEach(person => {
            totalPeople++;
            // FIX: Read the new array indices! [id, lat, lon, topic, sub_topic]
            const mainTopic = person[3] || 'Other';
            const subTopic = person[4] || 'Unknown';

            topicCounts.main[mainTopic] = (topicCounts.main[mainTopic] || 0) + 1;
            const subKey = `${mainTopic}|${subTopic}`;
            topicCounts.sub[subKey] = (topicCounts.sub[subKey] || 0) + 1;
        });

        mainFilter.innerHTML = '';
        mainFilter.add(new Option(`All People (${totalPeople.toLocaleString()})`, 'all'));

        const sortedMainTopics = Object.keys(subTopicsMap).sort();

        sortedMainTopics.forEach(topic => {
            const count = topicCounts.main[topic] || 0;
            if (count > 0) {
                mainFilter.add(new Option(`${topic} (${count.toLocaleString()})`, topic));
            }
        });

        if (topicCounts.main["Other"]) {
            mainFilter.add(new Option(`Other / Unknown (${topicCounts.main["Other"].toLocaleString()})`, 'Other'));
        }
    }

    // ==========================================
    // 7. INITIAL DATA LOAD (INSTANT FEEDBACK)
    // ==========================================
    Promise.all([
        fetch('data/map_lite.json').then(res => res.json()),
        fetch('data/topic_map.json').then(res => res.json())
    ])
    .then(([liteData, topicData]) => {
        allPeople = liteData;
        
        // 1. Build the Category Map
        for (const mainTopic in topicData) {
            subTopicsMap[mainTopic] = ["All", ...Object.keys(topicData[mainTopic])];
        }

        // 2. Build UI (this is fast)
        updateDropdownCounts(); 

        // 3. Start Drawing (this will now happen in the background via chunks)
        renderMarkers(); 

        // 4. Background load the heavy text
        fetch('data/people_details.json')
            .then(res => res.json())
            .then(detailsData => {
                peopleDetails = detailsData;
                console.log("Heavy details loaded in background.");
            });
    })
    .catch(err => console.error("Error loading JSON data:", err));

    // ==========================================
    // 8. GLOBAL UTILITIES
    // ==========================================
    // Made globally accessible so the "X" buttons in HTML can call it (`onclick="closeAllPanels()"`)
    window.closeAllPanels = function() {
        const detailPanel = document.getElementById('person-detail-panel');
        const listPanel = document.getElementById('cluster-list-panel');
        
        if (detailPanel) detailPanel.classList.remove('open');
        if (listPanel) listPanel.classList.remove('open');
        
        document.querySelectorAll('.active-pulse').forEach(el => el.classList.remove('active-pulse'));
        if (typeof map !== 'undefined') map.closePopup();
    };
});