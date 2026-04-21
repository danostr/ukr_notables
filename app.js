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

    const mainFilter = document.getElementById('topic-filter');
    const subFilter = document.getElementById('sub-topic-filter');
    const subLabel = document.getElementById('sub-topic-label');

    // ==========================================
    // 2. MAP INITIALIZATION
    // ==========================================
    const map = L.map('map').setView([48.3794, 31.1656], 6);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors, © CARTO'
    }).addTo(map);

    // Initialize MarkerCluster with custom settings
    const markers = L.markerClusterGroup({
        spiderfyOnMaxZoom: false,    
        showCoverageOnHover: false, 
        zoomToBoundsOnClick: false,
        maxClusterRadius: 150, 
        
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

        allPeople.forEach(person => {
            if (mainTopic !== 'all' && person.topic !== mainTopic) return;
            if (mainTopic !== 'all' && subTopic && subTopic !== 'All' && person.sub_topic !== subTopic) return;

            const match = person.coords.match(/Point\(([^ ]+) ([^ ]+)\)/);
            if (match) {
                const lon = parseFloat(match[1]);
                const lat = parseFloat(match[2]);

                let wikiLinksHTML = "";
                if (person.enWiki) wikiLinksHTML += `<a href="${person.enWiki}" target="_blank">🇬🇧</a> `;
                if (person.ukWiki) wikiLinksHTML += `<a href="${person.ukWiki}" target="_blank">🇺🇦</a> `;
                if (person.ruWiki) wikiLinksHTML += `<a href="${person.ruWiki}" target="_blank">🇷🇺</a> `;

                const subTopicText = (person.sub_topic && person.sub_topic !== 'Unknown') ? ` > ${person.sub_topic}` : '';
                const occupationsText = (person.occupations && person.occupations.length > 0) ? person.occupations.join(', ') : '<i>Not specified</i>';

                const popupContent = `
                    <div class="popup-container">
                        <h3 class="popup-title">${person.name}</h3>
                        <p class="popup-detail"><b>Birthplace:</b> ${person.birthplace}</p>
                        <p class="popup-detail"><b>Category:</b> <span class="popup-category">${person.topic}${subTopicText}</span></p>
                        <p class="popup-detail"><b>Occupation:</b> ${occupationsText}</p>
                        <hr class="popup-divider">
                        <div class="popup-links">${wikiLinksHTML}</div>
                    </div>
                `;

                const dotIcon = L.divIcon({
                    className: 'custom-dot-marker',
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                });

                const marker = L.marker([lat, lon], { icon: dotIcon }).bindPopup(popupContent);
                
                // CRITICAL: Attach the full data object to the marker for later use
                marker.personData = person; 
                
                markers.addLayer(marker);
            }
        });

        map.addLayer(markers);
    }

    // ==========================================
    // 4. EVENT LISTENERS
    // ==========================================
    
    mainFilter.addEventListener('change', function(e) {
        const selectedMain = e.target.value;
        subFilter.innerHTML = ''; 
        if (selectedMain !== 'all' && subTopicsMap[selectedMain]) {
            subFilter.style.display = 'block';
            subLabel.style.display = 'inline-block';
            subTopicsMap[selectedMain].forEach(st => {
                const opt = document.createElement('option');
                opt.value = st;
                opt.innerText = st === 'All' ? `All in ${selectedMain}` : st;
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
            
            // NEW: Set Title (City/Region) and Subtitle (Count)
            const firstPerson = clusterMarkers[0].personData;
            document.getElementById('panel-title').innerText = firstPerson.birthplace || "Location";
            document.getElementById('panel-subtitle').innerText = `${clusterMarkers.length} People Here`;
            
            listContent.innerHTML = '';
            
            clusterMarkers.forEach(marker => {
                const data = marker.personData;
                const item = document.createElement('div');
                item.className = 'list-item';
                item.innerHTML = `<div><strong>${data.name}</strong></div><div style="font-size:0.85em; color:gray;">${data.topic}</div>`;
                
                item.onclick = () => {
                    const detailPanel = document.getElementById('person-detail-panel');
                    const detailContent = document.getElementById('detail-content');
                    
                    document.getElementById('detail-name').innerText = data.name;
                    detailContent.innerHTML = marker.getPopup().getContent(); 
                    if(detailContent.querySelector('.popup-title')) detailContent.querySelector('.popup-title').remove();

                    detailPanel.classList.add('open');
                    
                    map.flyTo(marker.getLatLng(), map.getZoom(), {
                        paddingBottomRight: [0, window.innerHeight / 2],
                        paddingTopLeft: [820, 0], // Adjusted for 20px gap
                        duration: 0.5
                    });
                };
                listContent.appendChild(item);
            });
            panel.classList.add('open');
        } else {
            map.flyToBounds(bounds, {
                padding: [370, 20], 
                duration: 0.8,
                easeLinearity: 0.35
            });
        }
    });

    map.on('click', () => closeAllPanels());

    // ==========================================
    // 6. INITIAL LOAD
    // ==========================================
    fetch('data/map_data_with_topics.json')
        .then(response => response.json())
        .then(data => {
            allPeople = data;
            renderMarkers(); 
        })
        .catch(err => console.error("Error loading JSON data:", err));
});

// ==========================================
// 7. GLOBAL UTILITIES
// ==========================================
window.closeAllPanels = function() {
    document.getElementById('person-detail-panel').classList.remove('open');
    document.getElementById('cluster-list-panel').classList.remove('open');
};