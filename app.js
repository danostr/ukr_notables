// Ensure the DOM is fully loaded before executing scripts
document.addEventListener('DOMContentLoaded', function() {
    
    // ==========================================
    // 1. CONFIGURATION & STATE
    // ==========================================
    const subTopicsMap = {};

    let allPeople = []; 
    let topicCounts = { main: {}, sub: {} };

    const mainFilter = document.getElementById('topic-filter');
    const subFilter = document.getElementById('sub-topic-filter');
    const subLabel = document.getElementById('sub-topic-label');

    // ==========================================
    // 2. MAP INITIALIZATION
    // ==========================================
    const southWest = L.latLng(-75, -200); 
    const northEast = L.latLng(85, 200);   
    const globeBounds = L.latLngBounds(southWest, northEast);

    const map = L.map('map', {
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

    // Initialize MarkerCluster with custom settings
    const markers = L.markerClusterGroup({
        spiderfyOnMaxZoom: false,    
        showCoverageOnHover: false, 
        zoomToBoundsOnClick: false,
        animate: false,
        animateAddingMarkers: false,
        maxClusterRadius: 140, 
        
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
    
    // ==========================================
    // 3. CORE RENDERING ENGINE
    // ==========================================
    function renderMarkers() {
        const mainTopic = mainFilter.value;
        const subTopic = subFilter.value;
        
        markers.clearLayers(); 

        let visualizedCount = 0;

        allPeople.forEach(person => {
            if (mainTopic !== 'all' && person.topic !== mainTopic) return;
            if (mainTopic !== 'all' && subTopic && subTopic !== 'All' && person.sub_topic !== subTopic) return;

            // Universal Coordinate Parser
            let lat, lon;
            if (typeof person.coords === 'string') {
                const match = person.coords.match(/Point\(([^ ]+) ([^ ]+)\)/);
                if (match) {
                    lon = parseFloat(match[1]);
                    lat = parseFloat(match[2]);
                } else { return; }
            } else if (Array.isArray(person.coords)) {
                lat = parseFloat(person.coords[0]);
                lon = parseFloat(person.coords[1]);
            } else { return; }

            let wikiButtonsHTML = `<div class="wiki-button-container">`;
            if (person.wiki_en) wikiButtonsHTML += `<a href="${person.wiki_en}" target="_blank" class="wiki-btn btn-en">EN</a>`;
            if (person.wiki_uk) wikiButtonsHTML += `<a href="${person.wiki_uk}" target="_blank" class="wiki-btn btn-uk">UA</a>`;
            if (person.wiki_ru) wikiButtonsHTML += `<a href="${person.wiki_ru}" target="_blank" class="wiki-btn btn-ru">RU</a>`;
            wikiButtonsHTML += `</div>`;

            const subTopicText = (person.sub_topic && person.sub_topic !== 'Unknown') ? ` > ${person.sub_topic}` : '';
            
            const occupationsHTML = (person.occupations && person.occupations.length > 0) 
                ? `<p class="popup-detail"><b>Occupation:</b> ${person.occupations.join(', ')}</p>` 
                : '';

            // 1. Prioritize Names for the Popup
            const displayName = person.name_en || person.name_uk || person.name_ru || "Unknown Name";

            const popupContent = `
                <div class="popup-container">
                    <h3 class="popup-title">${displayName}</h3>
                    <div class="popup-body">
                        <p class="popup-detail"><b>Birthplace:</b> ${person.birthplace || 'Unknown'}</p>
                        <p class="popup-detail"><b>Category:</b> <span class="popup-category">${person.topic}${subTopicText}</span></p>
                        ${occupationsHTML}
                        ${wikiButtonsHTML}
                    </div>
                </div>
            `;

            const dotIcon = L.divIcon({
                className: 'custom-dot-marker',
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            });

            const marker = L.marker([lat, lon], { icon: dotIcon }).bindPopup(popupContent);
            marker.personData = person; 
            
            // TRACKING DIRECT MARKER CLICKS
            marker.on('click', function(e) {
                document.querySelectorAll('.active-pulse').forEach(el => el.classList.remove('active-pulse'));
                if (e.target._icon) e.target._icon.classList.add('active-pulse');
            });

            markers.addLayer(marker);
            visualizedCount++;
        });

        map.addLayer(markers);
        console.log(`Currently visualized people: ${visualizedCount}`);
    }

    // ==========================================
    // 4. EVENT LISTENERS
    // ==========================================
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
            } 
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
            themeToggle.innerText = document.body.classList.contains('dark-mode') ? '☀️ Switch to Light Mode' : '🌙 Switch to Dark Mode';
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
            
            const firstPerson = clusterMarkers[0].personData;
            document.getElementById('panel-title').innerText = firstPerson.birthplace || "Location";
            document.getElementById('panel-subtitle').innerText = `${clusterMarkers.length} People Here`;
            
            listContent.innerHTML = '';
            
            clusterMarkers.forEach(marker => {
                const data = marker.personData;
                
                // 2. Prioritize Names for the Side Panel list!
                const displayName = data.name_en || data.name_uk || data.name_ru || "Unknown Name";

                const item = document.createElement('div');
                item.className = 'list-item';
                item.innerHTML = `<div><strong>${displayName}</strong></div><div style="font-size:0.85em; color:gray;">${data.topic}</div>`;
                
                // TRACKING CLUSTER LIST CLICKS
                item.onclick = () => {
                    const detailPanel = document.getElementById('person-detail-panel');
                    const detailContent = document.getElementById('detail-content');
                    
                    document.getElementById('detail-name').innerText = displayName;
                    detailContent.innerHTML = marker.getPopup().getContent(); 
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
            const mainTopic = person.topic || 'Other';
            topicCounts.main[mainTopic] = (topicCounts.main[mainTopic] || 0) + 1;
            const subKey = `${mainTopic}|${person.sub_topic || 'Unknown'}`;
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
    // 7. INITIAL LOAD
    // ==========================================
    Promise.all([
        fetch('data/map_data_with_topics.json').then(res => res.json()),
        fetch('data/topic_map.json').then(res => res.json())
    ])
    .then(([peopleData, topicData]) => {
        allPeople = peopleData;
        
        for (const mainTopic in topicData) {
            subTopicsMap[mainTopic] = ["All", ...Object.keys(topicData[mainTopic])];
        }

        updateDropdownCounts();
        renderMarkers(); 
    })
    .catch(err => console.error("Error loading JSON data:", err));

    // ==========================================
    // 8. GLOBAL UTILITIES
    // ==========================================
    window.closeAllPanels = function() {
        const detailPanel = document.getElementById('person-detail-panel');
        const listPanel = document.getElementById('cluster-list-panel');
        
        if (detailPanel) detailPanel.classList.remove('open');
        if (listPanel) listPanel.classList.remove('open');
        
        document.querySelectorAll('.active-pulse').forEach(el => el.classList.remove('active-pulse'));
        if (typeof map !== 'undefined') map.closePopup();
    };
});