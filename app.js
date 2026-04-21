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
        
        // NEW: Customizing the boundaries for Small, Medium, and Large clusters
        iconCreateFunction: function(cluster) {
            const count = cluster.getChildCount();
            let sizeClass = 'marker-cluster-';

            // Define your new boundaries here!
            if (count < 50) {
                sizeClass += 'small';     // Less than 50 people
            } else if (count < 500) {
                sizeClass += 'medium';    // Between 50 and 499 people
            } else {
                sizeClass += 'large';     // 500 people or more
            }

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
        
        console.log(`Filtering for: ${mainTopic} > ${subTopic || 'All'}`);
        markers.clearLayers(); 

        allPeople.forEach(person => {
            if (mainTopic !== 'all' && person.topic !== mainTopic) return;
            if (mainTopic !== 'all' && subTopic && subTopic !== 'All' && person.sub_topic !== subTopic) return;

            const match = person.coords.match(/Point\(([^ ]+) ([^ ]+)\)/);
            if (match) {
                const lon = parseFloat(match[1]);
                const lat = parseFloat(match[2]);

                let wikiLinksHTML = "";
                if (person.enWiki) wikiLinksHTML += `<a href="${person.enWiki}" target="_blank" style="text-decoration:none;">🇬🇧</a> `;
                if (person.ukWiki) wikiLinksHTML += `<a href="${person.ukWiki}" target="_blank" style="text-decoration:none;">🇺🇦</a> `;
                if (person.ruWiki) wikiLinksHTML += `<a href="${person.ruWiki}" target="_blank" style="text-decoration:none;">🇷🇺</a> `;

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

                // Create a custom div-based icon instead of the default image pin
                const dotIcon = L.divIcon({
                    className: 'custom-dot-marker',
                    iconSize: [12, 12], // Size of the dot in pixels
                    iconAnchor: [6, 6]  // Anchor the center of the dot to the coordinates
                });

                const marker = L.marker([lat, lon], { icon: dotIcon }).bindPopup(popupContent);
                markers.addLayer(marker);
            }
        });

        map.addLayer(markers);
        console.log(`Markers updated: ${markers.getLayers().length} people visible.`);
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

    subFilter.addEventListener('change', function() {
        renderMarkers(); 
    });

    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');
        
        if (document.body.classList.contains('dark-mode')) {
            themeToggle.innerText = '☀️ Switch to Light Mode';
        } else {
            themeToggle.innerText = '🌙 Switch to Dark Mode';
        }
    });

    // Listen for cluster clicks
    markers.on('clusterclick', function (a) {
        const cluster = a.layer;
        const bounds = cluster.getBounds();
        
        // Check if all markers in the cluster have the exact same coordinates
        const isStacked = bounds.getNorthEast().equals(bounds.getSouthWest());

        if (isStacked || map.getZoom() === map.getMaxZoom()) {
            // --- LOGIC FOR THE SIDE PANEL ---
            const clusterMarkers = cluster.getAllChildMarkers();
            const listContent = document.getElementById('list-content');
            const panel = document.getElementById('cluster-list-panel');
            
            document.getElementById('panel-title').innerText = `${clusterMarkers.length} People Here`;
            listContent.innerHTML = '';
            
            clusterMarkers.forEach(marker => {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = marker.getPopup().getContent();
                const name = tempDiv.querySelector('.popup-title').innerText;
                const category = tempDiv.querySelector('.popup-category').innerText;

                const item = document.createElement('div');
                item.className = 'list-item';
                item.innerHTML = `
                    <div style="font-weight:bold;">${name}</div>
                    <div style="font-size:0.85em; color:gray;">${category}</div>
                `;
                
                item.onclick = () => {
                    const detailPanel = document.getElementById('person-detail-panel');
                    const detailContent = document.getElementById('detail-content');
                    const content = marker.getPopup().getContent();
                    
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = content;
                    const name = tempDiv.querySelector('.popup-title').innerText;
                    
                    document.getElementById('detail-name').innerText = name;
                    detailContent.innerHTML = content; 
                    
                    // Cleanup duplicate name inside the content
                    if(detailContent.querySelector('.popup-title')) {
                        detailContent.querySelector('.popup-title').remove();
                    }

                    // Slide the detail panel out from behind the list
                    detailPanel.classList.add('open');
                    
                    // Center the person in the remaining map space
                    // 350 (List) + 350 (Detail) + 50 (Buffer) = 750px
                    map.flyTo(marker.getLatLng(), map.getZoom(), {
                        paddingTopLeft: [750, 0], 
                        duration: 0.5
                    });
                };
                listContent.appendChild(item);
            });

            panel.classList.add('open');
        } else {
            // --- LOGIC FOR SMOOTH ZOOMING ---
            // This animates the map to fit the markers inside the cluster
            map.flyToBounds(bounds, {
                padding: [370, 20], // Adds a little breathing room around the edges
                duration: 0.8,      // Animation time in seconds
                easeLinearity: 0.35
            });
        }
    });

    // Close the panel if the user clicks the map background
    map.on('click', () => {
        document.getElementById('cluster-list-panel').classList.remove('open');
    });

    // ==========================================
    // 5. DATA FETCH & EXECUTION
    // ==========================================
    console.log("Fetching categorized map data...");
    fetch('data/map_data_with_topics.json')
        .then(response => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.json();
        })
        .then(data => {
            allPeople = data;
            console.log(`Data successfully loaded. Total records: ${allPeople.length}`);
            renderMarkers(); 
        })
        .catch(err => {
            console.error("Error loading JSON data:", err);
            alert("Failed to load map data. Make sure you are running a local web server.");
        });
});

window.closeAllPanels = function() {
    // Slide detail back behind list first
    document.getElementById('person-detail-panel').classList.remove('open');
    
    // Then slide the list away
    setTimeout(() => {
        document.getElementById('cluster-list-panel').classList.remove('open');
    }, 150);
};