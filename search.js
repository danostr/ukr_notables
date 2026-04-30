// search.js
import { state } from './state.js';
import { map, renderMarkers } from './map.js';
import { closeAllPanels, generatePopupHTML, resetPanelControls } from './ui.js';

// --- SEARCH ENGINE HELPERS ---

// 1. Squeeze Typo Fixer: Reduces "shevvchenko" -> "shevchenko"
function squeeze(str) {
    return str.replace(/(.)\1+/g, '$1');
}

// 2. Language Detector: Chooses the name based on what alphabet the user is typing in
function getLocalizedName(details, query, fallback) {
    if (!details) return fallback;
    
    const isCyrillic = /[а-яіїєґё]/i.test(query);
    if (isCyrillic) {
        // User is typing in Cyrillic -> Prioritize UA/RU
        return details.name_uk || details.name_ru || details.name_en || fallback;
    } else {
        // User is typing in Latin -> Prioritize EN
        return details.name_en || details.name_uk || details.name_ru || fallback;
    }
}

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

        // --- SPLIT AND SQUEEZE THE QUERY ---
        const queryWords = query.split(/\s+/);
        const squeezedQueryWords = queryWords.map(squeeze);

        // 1. ZONES (Order-Agnostic & Typo-Tolerant)
        const zonesObj = state.searchIndex.locations.zones || {};
        const zonesList = Array.isArray(zonesObj) ? zonesObj : Object.keys(zonesObj);
        
        const zoneMatches = zonesList.filter(z => {
            const zLow = z.toLowerCase();
            const zSqueezed = squeeze(zLow);
            return queryWords.every(w => zLow.includes(w)) || 
                   squeezedQueryWords.every(w => zSqueezed.includes(w));
        }).slice(0, 1);

        // 2. LOCATIONS (Order-Agnostic & Typo-Tolerant)
        const locationMatches = Object.keys(state.searchIndex.locations)
            .filter(key => {
                if (key === 'zones') return false;
                const realBirthplace = state.searchIndex.locations[key][3];
                if (!realBirthplace) return false;
                
                const rbLow = realBirthplace.toLowerCase();
                const rbSqueezed = squeeze(rbLow);
                return queryWords.every(w => rbLow.includes(w)) || 
                       squeezedQueryWords.every(w => rbSqueezed.includes(w));
            }).slice(0, 3);

        // 3. PEOPLE (Order-Agnostic & Typo-Tolerant)
        const peopleMatches = state.searchIndex.people.filter(p => {
            const searchString = p[1];
            const squeezedSearchString = squeeze(searchString);
            
            return queryWords.every(w => searchString.includes(w)) || 
                   squeezedQueryWords.every(w => squeezedSearchString.includes(w));
        }).slice(0, 8);

        if (zoneMatches.length > 0 || locationMatches.length > 0 || peopleMatches.length > 0) {
            
            // --- RENDER ZONES 🌍 ---
            zoneMatches.forEach(zone => {
                const zoneContext = Array.isArray(zonesObj) ? "Region/Country" : (zonesObj[zone] || "Region"); 
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.innerHTML = `🌍 <strong>${zone}</strong> <span style="font-size:0.8em; color:gray;">(${zoneContext})</span>`;
                
                div.onclick = () => {
                    searchResults.style.display = 'none';
                    searchInput.value = zone;
                    closeAllPanels(map); 
                    state.activeZoneFilter = zone;
                    renderMarkers(); 

                    const peopleInZone = state.allPeople.filter(p => (p[5] || []).includes(zone));
                    if (peopleInZone.length === 0) return;

                    const bounds = L.latLngBounds();
                    peopleInZone.forEach(p => bounds.extend([p[1], p[2]]));
                    map.flyToBounds(bounds, { paddingTopLeft: [370, 20], paddingBottomRight: [20, 20], duration: 1.2 });

                    const listContent = document.getElementById('list-content');
                    document.getElementById('panel-title').innerText = zone;
                    document.getElementById('panel-subtitle').innerText = `${peopleInZone.length} People Here`;
                    listContent.innerHTML = '';
                    
                    peopleInZone.forEach(person => {
                        const pId = person[0];
                        const categories = person[3]; // Grab the multi-category array
                        const mainTopics = Array.from(new Set(categories.map(c => c[0]))).join(', ');
                        
                        const details = state.peopleDetails[pId] || {};
                        const displayName = getLocalizedName(details, query, "Unknown Name");

                        const item = document.createElement('div');
                        item.className = 'list-item';
                        item.setAttribute('data-name', displayName.toLowerCase());
                        item.setAttribute('data-remark', details.remarkability || 0); 

                        // Use mainTopics here!
                        item.innerHTML = `<div><strong>${displayName}</strong></div><div style="font-size:0.85em; color:gray;">${mainTopics}</div>`;
                        
                        item.onclick = () => {
                            document.getElementById('detail-name').innerText = displayName;
                            const detailContent = document.getElementById('detail-content');
                            
                            // Pass categories to the popup!
                            const basicData = { id: pId, categories: categories };
                            detailContent.innerHTML = generatePopupHTML(basicData); 
                            if(detailContent.querySelector('.popup-title')) detailContent.querySelector('.popup-title').remove();
                            document.getElementById('person-detail-panel').classList.add('open');
                            map.flyTo([person[1], person[2]], map.getMaxZoom(), { paddingTopLeft: [820, 0], duration: 0.8 });
                        };
                        listContent.appendChild(item);
                    });
                    resetPanelControls();
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

                    const peopleInLocation = state.searchIndex.people.filter(p => p[3] === locKey);
                    const listContent = document.getElementById('list-content');
                    document.getElementById('panel-title').innerText = realBirthplace;
                    document.getElementById('panel-subtitle').innerText = `${peopleInLocation.length} People Here`;
                    listContent.innerHTML = '';
                    
                    peopleInLocation.forEach(pMatch => {
                        const pId = pMatch[0];
                        const details = state.peopleDetails[pId] || {};
                        const displayName = getLocalizedName(details, query, "Unknown Name");

                        const personData = state.allPeople.find(p => p[0] === pId);
                        if (!personData) return;
                        
                        // Extract array perfectly matching map_lite.json
                        const [id, pLat, pLon, categories] = personData;
                        const mainTopics = Array.from(new Set(categories.map(c => c[0]))).join(', ');
                        const basicData = { id: id, categories: categories };

                        const item = document.createElement('div');
                        item.className = 'list-item';
                        item.setAttribute('data-name', displayName.toLowerCase());
                        item.setAttribute('data-remark', details.remarkability || 0);

                        item.innerHTML = `<div><strong>${displayName}</strong></div><div style="font-size:0.85em; color:gray;">${mainTopics}</div>`;
                        
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
                    resetPanelControls();
                    document.getElementById('cluster-list-panel').classList.add('open');
                };
                searchResults.appendChild(div);
            });

            // --- RENDER PEOPLE 👤 ---
            peopleMatches.forEach(person => {
                const [pId, searchString, defaultDisplayName, locKey, realBirthplace, country] = person;
                const details = state.peopleDetails[pId];
                
                // Dynamically translate names in the dropdown!
                const displayName = getLocalizedName(details, query, defaultDisplayName);

                const div = document.createElement('div');
                div.className = 'search-result-item';
                
                const displayLocation = (realBirthplace === country || !country || country === "Unknown") 
                    ? realBirthplace 
                    : `${realBirthplace}, ${country}`;

                div.innerHTML = `👤 <strong>${displayName}</strong> <span style="font-size:0.8em; color:gray;">(${displayLocation})</span>`;
                
                div.onclick = () => {
                    searchResults.style.display = 'none';
                    searchInput.value = displayName;

                    const personData = state.allPeople.find(p => p[0] === pId);
                    if (personData) {
                        const [id, pLat, pLon, categories] = personData;
                        map.flyTo([pLat, pLon], map.getMaxZoom(), { paddingTopLeft: [820, 0], duration: 1.0 });

                        document.getElementById('detail-name').innerText = displayName;
                        const detailContent = document.getElementById('detail-content');
                        
                        // Pass the categories properly
                        const basicData = { id: id, categories: categories };
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