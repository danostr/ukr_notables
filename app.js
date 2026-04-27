/**
 * NOTABLE PEOPLE OF UKRAINE - MAIN MAP SCRIPT (SUPERCLUSTER VERSION)
 * -------------------------------------------
 */

document.addEventListener('DOMContentLoaded', function() {
    
    // ==========================================
    // 1. CONFIGURATION & STATE VARIABLES
    // ==========================================
    const subTopicsMap = {};
    let allPeople = []; 
    let peopleDetails = {};
    let searchIndex = { locations: {}, people: [] }; // <-- ADD THIS
    let topicCounts = { main: {}, sub: {} };

    const mainFilter = document.getElementById('topic-filter');
    const subFilter = document.getElementById('sub-topic-filter');
    const subLabel = document.getElementById('sub-topic-label');

    // ==========================================
    // 2. MAP & CLUSTER INITIALIZATION
    // ==========================================
    const southWest = L.latLng(-75, -200); 
    const northEast = L.latLng(85, 200);   
    const globeBounds = L.latLngBounds(southWest, northEast);

    const map = L.map('map', {
        preferCanvas: true,
        center: [48.3794, 31.1656], 
        zoomDelta: 0.6,             
        zoomSnap: 0.15,
        wheelPxPerZoomLevel: 60,    
        zoom: 6,                    
        minZoom: 2.25,              
        maxBounds: globeBounds,     
        maxBoundsViscosity: 1.0     
    });
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, 
        attribution: '© OpenStreetMap contributors, © CARTO'
    }).addTo(map);

    const markersLayer = L.featureGroup().addTo(map);

    // Initialize Web Worker for Background Math!
    const clusterWorker = new Worker('worker.js');
    let workerMessageId = 0;
    const workerCallbacks = {};

    clusterWorker.onmessage = function(e) {
        const { id, result } = e.data;
        if (workerCallbacks[id]) {
            workerCallbacks[id](result);
            delete workerCallbacks[id];
        }
    };

    // Helper function to talk to the worker asynchronously
    function askWorker(type, payload) {
        return new Promise(resolve => {
            const id = workerMessageId++;
            workerCallbacks[id] = resolve;
            clusterWorker.postMessage({ type, payload, id });
        });
    }
    
    // ==========================================
    // 3. CORE RENDERING ENGINE (WEB WORKER)
    // ==========================================
    async function renderMarkers() {
        const mainTopic = mainFilter.value;
        const subTopic = subFilter.value;
        const geoJsonData = [];
        
        allPeople.forEach(person => {
            const pId = person[0], pLat = person[1], pLon = person[2], pTopic = person[3], pSubTopic = person[4];

            if (mainTopic !== 'all' && pTopic !== mainTopic) return;
            if (mainTopic !== 'all' && subTopic && subTopic !== 'All' && pSubTopic !== subTopic) return;

            geoJsonData.push({
                type: "Feature",
                properties: { id: pId, topic: pTopic, sub_topic: pSubTopic },
                geometry: { type: "Point", coordinates: [pLon, pLat] } 
            });
        });

        // Send data to the background worker
        await askWorker('load', { geoJsonData });
        updateScreen();
    }

    async function updateScreen() {
        // Expand the bounds by 50% to render markers "off-screen"
        const paddedBounds = map.getBounds().pad(0.5); 
        
        const bbox = [
            Math.max(-180, paddedBounds.getWest()), 
            Math.max(-90, paddedBounds.getSouth()), 
            Math.min(180, paddedBounds.getEast()), 
            Math.min(90, paddedBounds.getNorth())
        ];
        const zoom = map.getZoom();

        // Ask the worker for clusters (Wait for it...)
        const visibleClusters = await askWorker('getClusters', { bbox, zoom });

        // Once the worker responds, wipe screen and draw!
        markersLayer.clearLayers(); 

        visibleClusters.forEach(feature => {
            const [lon, lat] = feature.geometry.coordinates;
            
            if (feature.properties.cluster) {
                const count = feature.properties.point_count;
                let sizeClass = count < 50 ? 'small' : count < 500 ? 'medium' : 'large';
                
                const clusterIcon = L.divIcon({
                    html: `<div><span>${count}</span></div>`,
                    className: `marker-cluster marker-cluster-${sizeClass}`,
                    iconSize: L.point(40, 40)
                });
                
                const clusterMarker = L.marker([lat, lon], { icon: clusterIcon });
                clusterMarker.clusterId = feature.properties.cluster_id; 
                markersLayer.addLayer(clusterMarker);

            } else {
                // IT IS A SINGLE PERSON (Optimized for Canvas)
                const isDark = document.body.classList.contains('dark-mode');
                const personMarker = L.circleMarker([lat, lon], { 
                    radius: 6,
                    fillColor: isDark ? '#fbbf24' : '#1e40af', 
                    color: isDark ? '#111827' : '#ffffff',     
                    weight: 2,
                    fillOpacity: 1
                });

                personMarker.personData = feature.properties;
                personMarker.bindPopup((layer) => generatePopupHTML(layer.personData));
                markersLayer.addLayer(personMarker);
            }
        });
    }

    // Debounce the camera to keep things smooth
    let renderTimer;
    map.on('moveend', () => {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(updateScreen, 50); 
    });

    // ==========================================
    // 4. EVENT LISTENERS & UI LOGIC
    // ==========================================
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllPanels();
        }
    });

    mainFilter.addEventListener('change', function(e) {
        const selectedMain = e.target.value;
        subFilter.innerHTML = ''; 
        
        if (selectedMain !== 'all' && subTopicsMap[selectedMain]) {
            subFilter.style.display = 'block';
            subLabel.style.display = 'inline-block';
            
            const subTopics = subTopicsMap[selectedMain];
            
            if (subTopics.length === 2) {
                const singleSubTopic = subTopics[1]; 
                const opt = document.createElement('option');
                opt.value = singleSubTopic;
                const count = topicCounts.sub[`${selectedMain}|${singleSubTopic}`] || 0;
                opt.innerText = `${singleSubTopic} (${count.toLocaleString()})`;
                
                subFilter.appendChild(opt);
                subFilter.disabled = true;       
                subFilter.style.opacity = '1.0'; 
            } else {
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
                subFilter.value = 'All'; 
            }
        } else {
            subFilter.style.display = 'none';
            subLabel.style.display = 'none';
            subFilter.disabled = false; 
        }
        renderMarkers(); 
    });

    subFilter.addEventListener('change', () => renderMarkers());

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            document.body.classList.toggle('dark-mode');
            updateScreen();
            themeToggle.innerText = document.body.classList.contains('dark-mode') ? '☀️ Switch to Light Mode' : '🌙 Switch to Dark Mode';
        });
    }

    // ==========================================
    // 4.5 SEARCH BAR LOGIC (OPTIMIZED & LOCATION AWARE)
    // ==========================================
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.toLowerCase().trim();
        searchResults.innerHTML = '';

        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }

        // 1. Search Locations First (Max 3 results)
        const locationMatches = Object.keys(searchIndex.locations)
            .filter(loc => loc.toLowerCase().includes(query))
            .slice(0, 3);

        // 2. Search People (Max 7 results)
        // p[1] is our pre-lowercased mashup of all 3 languages!
        const peopleMatches = searchIndex.people
            .filter(p => p[1].includes(query))
            .slice(0, 7);

        if (locationMatches.length > 0 || peopleMatches.length > 0) {
            
            // Render Location Results
            locationMatches.forEach(loc => {
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.innerHTML = `📍 <strong>${loc}</strong> <span style="font-size:0.8em; color:gray;">(Location)</span>`;
                
                div.onclick = () => {
                    searchResults.style.display = 'none';
                    searchInput.value = loc;
                    closeAllPanels(); 
                    
                    const [lat, lon] = searchIndex.locations[loc];
                    
                    // Fly to location, but shift the camera right to make room for the side panel!
                    map.flyTo([lat, lon], 12, { 
                        paddingTopLeft: [350, 0], 
                        duration: 1.0 
                    });

                    // 1. Instantly find all people born in this exact location
                    const peopleInLocation = searchIndex.people.filter(p => p[3] === loc);
                    
                    // 2. Grab the panel elements
                    const listContent = document.getElementById('list-content');
                    const panel = document.getElementById('cluster-list-panel');
                    
                    document.getElementById('panel-title').innerText = loc;
                    document.getElementById('panel-subtitle').innerText = `${peopleInLocation.length} People Here`;
                    listContent.innerHTML = '';
                    
                    // 3. Build the list of names
                    peopleInLocation.forEach(pMatch => {
                        const [pId, searchString, displayName, birthplace] = pMatch;
                        
                        // Look up their basic category data from our active map array
                        const personData = allPeople.find(p => p[0] === pId);
                        if (!personData) return;
                        
                        const [id, pLat, pLon, pTopic, pSubTopic] = personData;
                        const basicData = { id: id, topic: pTopic, sub_topic: pSubTopic };

                        const item = document.createElement('div');
                        item.className = 'list-item';
                        item.innerHTML = `<div><strong>${displayName}</strong></div><div style="font-size:0.85em; color:gray;">${pTopic}</div>`;
                        
                        // Make clicking a name inside the panel open their profile
                        item.onclick = () => {
                            const detailPanel = document.getElementById('person-detail-panel');
                            const detailContent = document.getElementById('detail-content');
                            
                            document.getElementById('detail-name').innerText = displayName;
                            detailContent.innerHTML = generatePopupHTML(basicData); 
                            if(detailContent.querySelector('.popup-title')) detailContent.querySelector('.popup-title').remove();

                            detailPanel.classList.add('open');
                            
                            map.flyTo([pLat, pLon], map.getMaxZoom(), {
                                paddingTopLeft: [820, 0],
                                duration: 0.8
                            });
                        };
                        listContent.appendChild(item);
                    });
                    
                    // 4. Slide the panel open!
                    panel.classList.add('open');
                };
                searchResults.appendChild(div);
            });

            // Render People Results
            peopleMatches.forEach(person => {
                const [pId, searchString, displayName, birthplace] = person;
                
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.innerHTML = `👤 <strong>${displayName}</strong> <span style="font-size:0.8em; color:gray;">(${birthplace})</span>`;
                
                div.onclick = () => {
                    searchResults.style.display = 'none';
                    searchInput.value = displayName;

                    // Find coordinates in our active map arrays
                    const personData = allPeople.find(p => p[0] === pId);
                    
                    if (personData) {
                        const [id, pLat, pLon, pTopic, pSubTopic] = personData;
                        
                        map.flyTo([pLat, pLon], map.getMaxZoom(), { 
                            paddingTopLeft: [820, 0], 
                            duration: 1.0 
                        });

                        const detailPanel = document.getElementById('person-detail-panel');
                        const detailContent = document.getElementById('detail-content');
                        
                        document.getElementById('detail-name').innerText = displayName;
                        
                        const basicData = { id: id, topic: pTopic, sub_topic: pSubTopic };
                        detailContent.innerHTML = generatePopupHTML(basicData);
                        if(detailContent.querySelector('.popup-title')) detailContent.querySelector('.popup-title').remove();

                        detailPanel.classList.add('open');
                    }
                };
                searchResults.appendChild(div);
            });

            searchResults.style.display = 'block';
        } else {
            searchResults.innerHTML = '<div class="search-result-item" style="color:gray; cursor:default;">No results found...</div>';
            searchResults.style.display = 'block';
        }
    });

    document.addEventListener('click', function(e) {
        if (!document.getElementById('search-container').contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });

    // ==========================================
    // 5. CLUSTER & PANEL INTERACTION
    // ==========================================
    markersLayer.on('click', async function(e) {
        const marker = e.layer;
        
        if (marker.clusterId) {
            const clusterId = marker.clusterId;
            
            // Ask worker for expansion zoom
            const expansionZoom = await askWorker('getClusterExpansionZoom', { clusterId });
            
            if (expansionZoom > 19) {
                // Ask worker for the leaves
                const leaves = await askWorker('getLeaves', { clusterId, limit: Infinity }); 
                
                const listContent = document.getElementById('list-content');
                const panel = document.getElementById('cluster-list-panel');
                
                const firstDetails = peopleDetails[leaves[0].properties.id] || {};
                document.getElementById('panel-title').innerText = firstDetails.birthplace || "Location";
                document.getElementById('panel-subtitle').innerText = `${leaves.length} People Here`;
                
                listContent.innerHTML = '';
                
                leaves.forEach(leaf => {
                    const basicData = leaf.properties;
                    const details = peopleDetails[basicData.id] || {};
                    const displayName = details.name_en || details.name_uk || details.name_ru || "Unknown Name";

                    const item = document.createElement('div');
                    item.className = 'list-item';
                    item.innerHTML = `<div><strong>${displayName}</strong></div><div style="font-size:0.85em; color:gray;">${basicData.topic}</div>`;
                    
                    item.onclick = () => {
                        const detailPanel = document.getElementById('person-detail-panel');
                        const detailContent = document.getElementById('detail-content');
                        
                        document.getElementById('detail-name').innerText = displayName;
                        detailContent.innerHTML = generatePopupHTML(basicData); 
                        if(detailContent.querySelector('.popup-title')) detailContent.querySelector('.popup-title').remove();

                        detailPanel.classList.add('open');
                        
                        map.flyTo([leaf.geometry.coordinates[1], leaf.geometry.coordinates[0]], map.getMaxZoom(), {
                            paddingTopLeft: [820, 0],
                            duration: 0.8
                        });
                    };
                    listContent.appendChild(item);
                });
                panel.classList.add('open');
            } else {
                map.flyTo(marker.getLatLng(), expansionZoom, { duration: 0.5 });
            }
        }
    });

    map.on('click', (e) => {
        if (!e.originalEvent.target.closest('.leaflet-marker-icon') && !e.originalEvent.target.closest('.leaflet-popup')) {
            closeAllPanels();
        }
    });

    // ==========================================
    // 6. CALCULATE DROPDOWN COUNTS
    // ==========================================
    function updateDropdownCounts() {
        let totalPeople = 0;
        topicCounts = { main: {}, sub: {} }; 

        allPeople.forEach(person => {
            totalPeople++;
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
    // 7. INITIAL DATA LOAD 
    // ==========================================
    Promise.all([
        fetch('data/map_lite.json').then(res => res.json()),
        fetch('data/topic_map.json').then(res => res.json())
    ])
    .then(([liteData, topicData]) => {
        allPeople = liteData;
        
        for (const mainTopic in topicData) {
            subTopicsMap[mainTopic] = ["All", ...Object.keys(topicData[mainTopic])];
        }

        updateDropdownCounts(); 
        renderMarkers(); 

        // NEW: Background load BOTH the heavy text and the search index!
        Promise.all([
            fetch('data/people_details.json').then(res => res.json()),
            fetch('data/search_index.json').then(res => res.json())
        ])
        .then(([detailsData, searchData]) => {
            peopleDetails = detailsData;
            searchIndex = searchData; // Save the search index to our new variable
            console.log("Background data and search index fully loaded!");
        })
        .catch(err => console.error("Error loading background data:", err));
        
    })
    .catch(err => console.error("Error loading JSON data:", err));

    // ==========================================
    // 8. GLOBAL UTILITIES
    // ==========================================
    
    // FIX 2: Restored the missing popup builder function!
    window.generatePopupHTML = function(basicData) {
        const details = peopleDetails[basicData.id];
        
        if (!details) {
            return `<div class="popup-container"><p>Loading details...</p></div>`;
        }

        let wikiButtonsHTML = `<div class="wiki-button-container">`;
        if (details.wiki_en) wikiButtonsHTML += `<a href="${details.wiki_en}" target="_blank" class="wiki-btn btn-en">EN</a>`;
        if (details.wiki_uk) wikiButtonsHTML += `<a href="${details.wiki_uk}" target="_blank" class="wiki-btn btn-uk">UA</a>`;
        if (details.wiki_ru) wikiButtonsHTML += `<a href="${details.wiki_ru}" target="_blank" class="wiki-btn btn-ru">RU</a>`;
        wikiButtonsHTML += `</div>`;

        const subTopicText = (basicData.sub_topic && basicData.sub_topic !== 'Unknown') ? ` > ${basicData.sub_topic}` : '';
        const occupationsHTML = (details.occupations && details.occupations.length > 0) 
            ? `<p class="popup-detail"><b>Occupation:</b> ${details.occupations.join(', ')}</p>` 
            : '';

        const displayName = details.name_en || details.name_uk || details.name_ru || "Unknown Name";

        return `
            <div class="popup-container">
                <h3 class="popup-title">${displayName}</h3>
                <div class="popup-body">
                    <p class="popup-detail"><b>Birthplace:</b> ${details.birthplace || 'Unknown'}</p>
                    <p class="popup-detail"><b>Category:</b> <span class="popup-category">${basicData.topic}${subTopicText}</span></p>
                    ${occupationsHTML}
                    ${wikiButtonsHTML}
                </div>
            </div>
        `;
    }

    window.closeAllPanels = function() {
        const detailPanel = document.getElementById('person-detail-panel');
        const listPanel = document.getElementById('cluster-list-panel');
        
        if (detailPanel) detailPanel.classList.remove('open');
        if (listPanel) listPanel.classList.remove('open');
        
        document.querySelectorAll('.active-pulse').forEach(el => el.classList.remove('active-pulse'));
        if (typeof map !== 'undefined') map.closePopup();
    };
});