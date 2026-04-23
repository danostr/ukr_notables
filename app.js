// Ensure the DOM is fully loaded before executing scripts
document.addEventListener('DOMContentLoaded', function() {
    
    // ==========================================
    // 1. CONFIGURATION & STATE
    // ==========================================
    const subTopicsMap = {
        "Politics & Society": ["All", "Government & Law", "Religion", "Activism & Media"],
        "Arts & Culture": ["All", "Literature", "Visual Arts", "Performing Arts", "Music", "TV & Internet Influencer", "Cinema & Filmmaking"],
        "Science & Education": ["All", "Science & Math", "Humanities", "Education", "Engineering & Tech"],
        "Medicine": ["All", "Healthcare"],
        "Sports": ["All", "Football", "Combat Sports", "Athletics & Gymnastics", "Winter Sports", "Water Sports", "Other Sports"],
        "Military": ["All", "Armed Forces"],
        "Business & Labor": ["All", "Business", "Transport & Aviation", "Labor & Agriculture"],
        "Other": ["All", "Unknown"]
    };

    let allPeople = []; 
    let topicCounts = { main: {}, sub: {} };

    const mainFilter = document.getElementById('topic-filter');
    const subFilter = document.getElementById('sub-topic-filter');
    const subLabel = document.getElementById('sub-topic-label');

    // ==========================================
    // 2. MAP INITIALIZATION
    // ==========================================
    const map = L.map('map').setView([48.3794, 31.1656], 6);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, // Reverted to 19 so deep clustering breaks properly
        attribution: '© OpenStreetMap contributors, © CARTO'
    }).addTo(map);

    // Initialize MarkerCluster with custom settings
    const markers = L.markerClusterGroup({
        spiderfyOnMaxZoom: false,    
        showCoverageOnHover: false, 
        zoomToBoundsOnClick: false,
        animate: true,
        animateAddingMarkers: true,
        maxClusterRadius: 120, 
        
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

            const match = person.coords.match(/Point\(([^ ]+) ([^ ]+)\)/);
            if (match) {
                const lon = parseFloat(match[1]);
                const lat = parseFloat(match[2]);

                let wikiButtonsHTML = `<div class="wiki-button-container">`;
                if (person.enWiki) wikiButtonsHTML += `<a href="${person.enWiki}" target="_blank" class="wiki-btn btn-en">EN</a>`;
                if (person.ukWiki) wikiButtonsHTML += `<a href="${person.ukWiki}" target="_blank" class="wiki-btn btn-uk">UA</a>`;
                if (person.ruWiki) wikiButtonsHTML += `<a href="${person.ruWiki}" target="_blank" class="wiki-btn btn-ru">RU</a>`;
                wikiButtonsHTML += `</div>`;

                const subTopicText = (person.sub_topic && person.sub_topic !== 'Unknown') ? ` > ${person.sub_topic}` : '';
                const occupationsText = (person.occupations && person.occupations.length > 0) ? person.occupations.join(', ') : '<i>Not specified</i>';

                const popupContent = `
                    <div class="popup-container">
                        <h3 class="popup-title">${person.name}</h3>
                        <div class="popup-body">
                            <p class="popup-detail"><b>Birthplace:</b> ${person.birthplace}</p>
                            <p class="popup-detail"><b>Category:</b> <span class="popup-category">${person.topic}${subTopicText}</span></p>
                            <p class="popup-detail"><b>Occupation:</b> ${occupationsText}</p>
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
                    // Clear pulse from all other markers
                    document.querySelectorAll('.active-pulse').forEach(el => el.classList.remove('active-pulse'));
                    // Add pulse to this marker
                    if (e.target._icon) e.target._icon.classList.add('active-pulse');
                });

                markers.addLayer(marker);
                visualizedCount++;
            }
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

            // 1. If the individual person panel is open, close ONLY it first
            if (detailPanel.classList.contains('open')) {
                detailPanel.classList.remove('open');
                
                // Clear the active pulse and popup since we stepped back
                document.querySelectorAll('.active-pulse').forEach(el => el.classList.remove('active-pulse'));
                map.closePopup();
            } 
            // 2. If the person panel is already closed, but the list panel is open, close the list panel
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
            subTopicsMap[selectedMain].forEach(st => {
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
        } else {
            subFilter.style.display = 'none';
            subLabel.style.display = 'none';
        }
        renderMarkers(); 
    });

    subFilter.addEventListener('change', () => renderMarkers());

    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');
        themeToggle.innerText = document.body.classList.contains('dark-mode') ? '☀️ Switch to Light Mode' : '🌙 Switch to Dark Mode';
    });

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
                const item = document.createElement('div');
                item.className = 'list-item';
                item.innerHTML = `<div><strong>${data.name}</strong></div><div style="font-size:0.85em; color:gray;">${data.topic}</div>`;
                
                // TRACKING CLUSTER LIST CLICKS
                item.onclick = () => {
                    const detailPanel = document.getElementById('person-detail-panel');
                    const detailContent = document.getElementById('detail-content');
                    
                    document.getElementById('detail-name').innerText = data.name;
                    detailContent.innerHTML = marker.getPopup().getContent(); 
                    if(detailContent.querySelector('.popup-title')) detailContent.querySelector('.popup-title').remove();

                    detailPanel.classList.add('open');
                    
                    // Clear pulse from all other markers
                    document.querySelectorAll('.active-pulse').forEach(el => el.classList.remove('active-pulse'));
                    
                    // DYNAMIC PADDING FIX: Prevent Leaflet from aborting on small windows
                    // It will use 820px, OR the window width minus 100px (whichever is smaller)
                    const safeLeftPadding = Math.max(0, Math.min(820, window.innerWidth - 100));
                    const safeBottomPadding = Math.max(0, Math.min(window.innerHeight / 2, window.innerHeight - 100));
                    
                    map.flyTo(marker.getLatLng(), map.getZoom(), {
                        paddingBottomRight: [0, window.innerHeight / 2],
                        paddingTopLeft: [820, 0],
                        duration: 0.5
                    });

                    // Wait for the map to finish moving and unclustering, then add pulse
                    map.once('moveend', () => {
                        if (marker._icon) marker._icon.classList.add('active-pulse');
                    });
                };
                listContent.appendChild(item);
            });
            panel.classList.add('open');
        } else {
            // DYNAMIC PADDING FIX FOR CLUSTERS:
            // Ensure horizontal padding never exceeds half the available screen width.
            const safeHorizontalPadding = Math.max(0, Math.min(370, (window.innerWidth - 50) / 2));

            map.flyToBounds(bounds, {
                padding: [safeHorizontalPadding, 20], 
                duration: 0.8,
                easeLinearity: 0.35
            });
        }
    });

    // Clear pulses when a popup is closed
    map.on('popupclose', () => {
        document.querySelectorAll('.active-pulse').forEach(el => el.classList.remove('active-pulse'));
    });

    map.on('click', () => closeAllPanels());

    // ==========================================
    // NEW: CALCULATE DROPDOWN COUNTS
    // ==========================================
    function updateDropdownCounts() {
        let totalPeople = 0;
        topicCounts = { main: {}, sub: {} }; // Reset counts

        // Count everyone
        allPeople.forEach(person => {
            totalPeople++;
            
            // Count Main Topics
            topicCounts.main[person.topic] = (topicCounts.main[person.topic] || 0) + 1;
            
            // Count Sub Topics (Stored as "MainTopic|SubTopic" to avoid overlap)
            const subKey = `${person.topic}|${person.sub_topic || 'Unknown'}`;
            topicCounts.sub[subKey] = (topicCounts.sub[subKey] || 0) + 1;
        });

        // Update the Main Filter text
        Array.from(mainFilter.options).forEach(opt => {
            const topic = opt.value;
            if (topic === 'all') {
                opt.innerText = `All People (${totalPeople.toLocaleString()})`;
            } else {
                const count = topicCounts.main[topic] || 0;
                // Only update the text if it doesn't already have a count (prevents appending twice)
                if (!opt.innerText.includes('(')) {
                    opt.innerText = `${opt.innerText} (${count.toLocaleString()})`;
                }
            }
        });
    }

    // ==========================================
    // 6. INITIAL LOAD
    // ==========================================
    fetch('data/map_data_with_topics.json')
        .then(response => response.json())
        .then(data => {
            allPeople = data;
            updateDropdownCounts();
            renderMarkers(); 
        })
        .catch(err => console.error("Error loading JSON data:", err));

    // ==========================================
    // 7. GLOBAL UTILITIES
    // ==========================================
    window.closeAllPanels = function() {
        document.getElementById('person-detail-panel').classList.remove('open');
        document.getElementById('cluster-list-panel').classList.remove('open');
        
        // Clear the active pulse globally and close any popups
        document.querySelectorAll('.active-pulse').forEach(el => el.classList.remove('active-pulse'));
        if (typeof map !== 'undefined') map.closePopup();
    };
}); // <-- This is the final closing bracket for DOMContentLoaded