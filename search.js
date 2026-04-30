// search.js
import { state } from './state.js';
import { map, renderMarkers } from './map.js';
import { closeAllPanels, generatePopupHTML, resetPanelControls, getLocalizedName, applyPanelFiltersAndRender } from './ui.js';

export function getGeoTree(person) {
    if (!person || !Array.isArray(person)) return [];
    for (let i = person.length - 1; i >= 3; i--) {
        const item = person[i];
        if (Array.isArray(item) && item.length > 0 && typeof item[0] === 'string') {
            return item;
        }
    }
    return [];
}

function squeeze(str) { return str.replace(/(.)\1+/g, '$1'); }

export function initSearch() {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    const zonesMap = new Map();

    if (state.searchIndex && state.searchIndex.locations) {
        if (state.searchIndex.locations.zones) {
            const zData = state.searchIndex.locations.zones;
            const zList = Array.isArray(zData) ? zData : Object.keys(zData);
            zList.forEach(z => {
                if (z && typeof z === 'string') zonesMap.set(z.trim(), "Region");
            });
        }
        
        Object.values(state.searchIndex.locations).forEach(loc => {
            if (Array.isArray(loc) && loc.length >= 3) {
                const region = loc[2];
                if (region && typeof region === 'string' && region.trim() !== '') {
                    zonesMap.set(region.trim(), "Region");
                }
            }
        });
    }

    state.allPeople.forEach(p => {
        const geoTree = getGeoTree(p);
        if (geoTree.length > 0) {
            const country = geoTree[geoTree.length - 1];
            geoTree.forEach(z => {
                if (z && typeof z === 'string' && z.trim() !== '') {
                    zonesMap.set(z.trim(), z === country ? "Country" : country);
                }
            });
        }
    });

    const zonesList = Array.from(zonesMap.keys());

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

        const queryWords = query.split(/\s+/);
        const squeezedQueryWords = queryWords.map(squeeze);

        // MATCH ZONES
        const zoneMatches = zonesList.filter(z => {
            if (!z || typeof z !== 'string') return false; 
            const zLow = z.toLowerCase(), zSqueezed = squeeze(zLow);
            return queryWords.every(w => zLow.includes(w)) || squeezedQueryWords.every(w => zSqueezed.includes(w));
        }).slice(0, 1); // <-- Changed from 2 to 1

        const locationsObj = (state.searchIndex && state.searchIndex.locations) ? state.searchIndex.locations : {};
        const locationMatches = Object.keys(locationsObj)
            .filter(key => {
                if (key === 'zones') return false;
                const locData = locationsObj[key];
                const realBirthplace = locData ? locData[3] : null;
                if (!realBirthplace || typeof realBirthplace !== 'string') return false;

                const rbLow = realBirthplace.toLowerCase(), rbSqueezed = squeeze(rbLow);
                return queryWords.every(w => rbLow.includes(w)) || squeezedQueryWords.every(w => rbSqueezed.includes(w));
            }).slice(0, 3);

        const peopleMatches = (state.searchIndex && state.searchIndex.people ? state.searchIndex.people : []).filter(p => {
            if (!p || !p[1]) return false;
            const searchString = p[1], squeezedSearchString = squeeze(searchString);
            return queryWords.every(w => searchString.includes(w)) || squeezedQueryWords.every(w => squeezedSearchString.includes(w));
        }).slice(0, 8);

        if (zoneMatches.length > 0 || locationMatches.length > 0 || peopleMatches.length > 0) {

            // RENDER ZONES 🌍
            zoneMatches.forEach(zone => {
                const zoneContext = zonesMap.get(zone) || "Region";
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.innerHTML = `🌍 <strong>${zone}</strong> <span style="font-size:0.8em; color:gray;">(${zoneContext})</span>`;

                div.onclick = () => {
                    searchResults.style.display = 'none';
                    searchInput.value = zone;
                    closeAllPanels(map);
                    state.activeZoneFilter = zone;
                    renderMarkers();

                    const peopleInZone = state.allPeople.filter(p => {
                        const geoTree = getGeoTree(p);
                        if (geoTree.includes(zone)) return true;
                        
                        if (state.searchIndex && state.searchIndex.locations) {
                            const locKey = typeof p[4] === 'string' ? p[4] : (typeof p[5] === 'string' ? p[5] : null);
                            if (locKey && state.searchIndex.locations[locKey]) {
                                return state.searchIndex.locations[locKey][2] === zone;
                            }
                        }
                        return false;
                    });
                    
                    if (peopleInZone.length === 0) return;

                    const bounds = L.latLngBounds();
                    peopleInZone.forEach(p => bounds.extend([p[1], p[2]]));
                    map.flyToBounds(bounds, { paddingTopLeft: [370, 20], paddingBottomRight: [20, 20], duration: 1.2 });

                    document.getElementById('panel-title').innerText = zone;
                    document.getElementById('panel-subtitle').innerText = `${peopleInZone.length} People Here`;

                    // Pass standard array to central pagination engine
                    state.currentPanelPeople = peopleInZone.map(p => ({
                        id: p[0], categories: p[3], lat: p[1], lon: p[2]
                    }));

                    resetPanelControls();
                    applyPanelFiltersAndRender(map);
                    document.getElementById('cluster-list-panel').classList.add('open');
                };
                searchResults.appendChild(div);
            });

            // RENDER LOCATIONS 📍
            locationMatches.forEach(locKey => {
                const [lat, lon, region, realBirthplace] = locationsObj[locKey];
                const div = document.createElement('div');
                div.className = 'search-result-item';
                const regionTag = region ? ` <span style="font-size:0.8em; color:gray;">(${region})</span>` : '';
                div.innerHTML = `📍 <strong>${realBirthplace}</strong>${regionTag}`;

                div.onclick = () => {
                    searchResults.style.display = 'none';
                    searchInput.value = realBirthplace;
                    closeAllPanels(map);
                    map.flyTo([lat, lon], 12, { paddingTopLeft: [350, 0], duration: 1.0 });

                    const peopleInLocation = (state.searchIndex.people || []).filter(p => p[3] === locKey);
                    
                    document.getElementById('panel-title').innerText = realBirthplace;
                    document.getElementById('panel-subtitle').innerText = `${peopleInLocation.length} People Here`;

                    // Pass standard array to central pagination engine safely
                    state.currentPanelPeople = [];
                    peopleInLocation.forEach(pMatch => {
                        const personData = state.allPeople.find(p => p[0] === pMatch[0]);
                        if (personData) {
                            state.currentPanelPeople.push({
                                id: personData[0], categories: personData[3], lat: personData[1], lon: personData[2]
                            });
                        }
                    });

                    resetPanelControls();
                    applyPanelFiltersAndRender(map);
                    document.getElementById('cluster-list-panel').classList.add('open');
                };
                searchResults.appendChild(div);
            });

            // RENDER PEOPLE 👤
            peopleMatches.forEach(person => {
                const [pId, searchString, defaultDisplayName, locKey, realBirthplace, country] = person;
                const details = state.peopleDetails[pId];
                const displayName = getLocalizedName(details, query, defaultDisplayName);

                const div = document.createElement('div');
                div.className = 'search-result-item';
                const displayLocation = (realBirthplace === country || !country || country === "Unknown") ? realBirthplace : `${realBirthplace}, ${country}`;
                div.innerHTML = `👤 <strong>${displayName}</strong> <span style="font-size:0.8em; color:gray;">(${displayLocation})</span>`;

                div.onclick = () => {
                    searchResults.style.display = 'none';
                    searchInput.value = displayName;

                    const personData = state.allPeople.find(p => p[0] === pId);
                    if (personData) {
                        const id = personData[0], pLat = personData[1], pLon = personData[2], categories = personData[3];
                        map.flyTo([pLat, pLon], map.getMaxZoom(), { paddingTopLeft: [820, 0], duration: 1.0 });

                        document.getElementById('detail-name').innerText = displayName;
                        const detailContent = document.getElementById('detail-content');
                        detailContent.innerHTML = generatePopupHTML({ id: id, categories: categories });
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