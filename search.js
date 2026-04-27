// search.js
import { state } from './state.js';
import { map, renderMarkers } from './map.js';
import { closeAllPanels, generatePopupHTML } from './ui.js';

export function initSearch() {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.toLowerCase().trim();
        searchResults.innerHTML = '';

        if (query.length === 0 && state.activeZoneFilter !== 'all') {
            state.activeZoneFilter = 'all';
            renderMarkers(); 
            closeAllPanels(map);
            searchResults.style.display = 'none';
            return;
        }

        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }

        // 1. ZONES
        const zonesList = state.searchIndex.locations.zones || state.searchIndex.zones || [];
        const zoneMatches = zonesList.filter(z => z.toLowerCase().includes(query)).slice(0, 3);

        // 2. LOCATIONS (Filter by the real birthplace string, which is item [3])
        const locationMatches = Object.keys(state.searchIndex.locations)
            .filter(key => {
                if (key === 'zones') return false;
                const realBirthplace = state.searchIndex.locations[key][3];
                return realBirthplace && realBirthplace.toLowerCase().includes(query);
            })
            .slice(0, 3);

        // 3. PEOPLE
        const peopleMatches = state.searchIndex.people.filter(p => p[1].includes(query)).slice(0, 7);

        if (zoneMatches.length > 0 || locationMatches.length > 0 || peopleMatches.length > 0) {
            
            // --- RENDER ZONES 🌍 ---
            zoneMatches.forEach(zone => {
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.innerHTML = `🌍 <strong>${zone}</strong> <span style="font-size:0.8em; color:gray;">(Region/Country)</span>`;
                
                div.onclick = () => {
                    searchResults.style.display = 'none';
                    searchInput.value = zone;
                    closeAllPanels(map); 
                    
                    state.activeZoneFilter = zone;
                    renderMarkers(); 

                    // Check the geographic tree array (item 6)
                    const peopleInZone = state.allPeople.filter(p => (p[6] || []).includes(zone));
                    if (peopleInZone.length === 0) return;

                    const bounds = L.latLngBounds();
                    peopleInZone.forEach(p => bounds.extend([p[1], p[2]]));
                    map.flyToBounds(bounds, { paddingTopLeft: [370, 20], paddingBottomRight: [20, 20], duration: 1.2 });

                    const listContent = document.getElementById('list-content');
                    document.getElementById('panel-title').innerText = zone;
                    document.getElementById('panel-subtitle').innerText = `${peopleInZone.length} People Here`;
                    listContent.innerHTML = '';
                    
                    peopleInZone.forEach(person => {
                        const searchRecord = state.searchIndex.people.find(sp => sp[0] === person[0]);
                        const displayName = searchRecord ? searchRecord[2] : "Unknown";

                        const item = document.createElement('div');
                        item.className = 'list-item';
                        item.innerHTML = `<div><strong>${displayName}</strong></div><div style="font-size:0.85em; color:gray;">${person[3]}</div>`;
                        
                        item.onclick = () => {
                            document.getElementById('detail-name').innerText = displayName;
                            const detailContent = document.getElementById('detail-content');
                            const basicData = { id: person[0], topic: person[3], sub_topic: person[4] };
                            detailContent.innerHTML = generatePopupHTML(basicData); 
                            if(detailContent.querySelector('.popup-title')) detailContent.querySelector('.popup-title').remove();

                            document.getElementById('person-detail-panel').classList.add('open');
                            map.flyTo([person[1], person[2]], map.getMaxZoom(), { paddingTopLeft: [820, 0], duration: 0.8 });
                        };
                        listContent.appendChild(item);
                    });
                    document.getElementById('cluster-list-panel').classList.add('open');
                };
                searchResults.appendChild(div);
            });

            // --- RENDER LOCATIONS 📍 ---
            locationMatches.forEach(locKey => {
                const [lat, lon, region, realBirthplace] = state.searchIndex.locations[locKey];
                const div = document.createElement('div');
                div.className = 'search-result-item';
                const regionTag = region ? ` <span style="font-size:0.8em; color:gray;">(${region})</span>` : '';
                div.innerHTML = `📍 <strong>${realBirthplace}</strong>${regionTag}`;
                
                div.onclick = () => {
                    searchResults.style.display = 'none';
                    searchInput.value = realBirthplace;
                    closeAllPanels(map); 
                    
                    map.flyTo([lat, lon], 12, { paddingTopLeft: [350, 0], duration: 1.0 });

                    // Find people using the invisible unique key!
                    const peopleInLocation = state.searchIndex.people.filter(p => p[3] === locKey);
                    
                    const listContent = document.getElementById('list-content');
                    document.getElementById('panel-title').innerText = realBirthplace;
                    document.getElementById('panel-subtitle').innerText = `${peopleInLocation.length} People Here`;
                    listContent.innerHTML = '';
                    
                    peopleInLocation.forEach(pMatch => {
                        const [pId, searchString, displayName, uniqueLocKey, bPlace] = pMatch;
                        const personData = state.allPeople.find(p => p[0] === pId);
                        if (!personData) return;
                        
                        const [id, pLat, pLon, pTopic, pSubTopic] = personData;
                        const basicData = { id: id, topic: pTopic, sub_topic: pSubTopic };

                        const item = document.createElement('div');
                        item.className = 'list-item';
                        item.innerHTML = `<div><strong>${displayName}</strong></div><div style="font-size:0.85em; color:gray;">${pTopic}</div>`;
                        
                        item.onclick = () => {
                            document.getElementById('detail-name').innerText = displayName;
                            const detailContent = document.getElementById('detail-content');
                            detailContent.innerHTML = generatePopupHTML(basicData); 
                            if(detailContent.querySelector('.popup-title')) detailContent.querySelector('.popup-title').remove();

                            document.getElementById('person-detail-panel').classList.add('open');
                            map.flyTo([pLat, pLon], map.getMaxZoom(), { paddingTopLeft: [820, 0], duration: 0.8 });
                        };
                        listContent.appendChild(item);
                    });
                    document.getElementById('cluster-list-panel').classList.add('open');
                };
                searchResults.appendChild(div);
            });

            // --- RENDER PEOPLE 👤 ---
            peopleMatches.forEach(person => {
                const [pId, searchString, displayName, locKey, realBirthplace] = person;
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.innerHTML = `👤 <strong>${displayName}</strong> <span style="font-size:0.8em; color:gray;">(${realBirthplace})</span>`;
                
                div.onclick = () => {
                    searchResults.style.display = 'none';
                    searchInput.value = displayName;

                    const personData = state.allPeople.find(p => p[0] === pId);
                    if (personData) {
                        const [id, pLat, pLon, pTopic, pSubTopic] = personData;
                        map.flyTo([pLat, pLon], map.getMaxZoom(), { paddingTopLeft: [820, 0], duration: 1.0 });

                        document.getElementById('detail-name').innerText = displayName;
                        const detailContent = document.getElementById('detail-content');
                        const basicData = { id: id, topic: pTopic, sub_topic: pSubTopic };
                        detailContent.innerHTML = generatePopupHTML(basicData);
                        if(detailContent.querySelector('.popup-title')) detailContent.querySelector('.popup-title').remove();

                        document.getElementById('person-detail-panel').classList.add('open');
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
}