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

    // --- NEW SEARCH STATE FOR PAGINATION ---
    let currentSearchQuery = "";
    let currentPeopleLimit = 8;

    // --- REUSABLE SEARCH & RENDER ENGINE ---
    function performSearchAndRender() {
        searchResults.innerHTML = '';
        const queryWords = currentSearchQuery.split(/\s+/);
        const squeezedQueryWords = queryWords.map(squeeze);

        // MATCH ZONES
        const zoneMatches = zonesList.filter(z => {
            if (!z || typeof z !== 'string') return false; 
            const zLow = z.toLowerCase(), zSqueezed = squeeze(zLow);
            return queryWords.every(w => zLow.includes(w)) || squeezedQueryWords.every(w => zSqueezed.includes(w));
        }).slice(0, 1);

        // MATCH LOCATIONS
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

        // MATCH PEOPLE (Sorted by Remarkability, full array kept intact)
        const allPeopleMatches = (state.searchIndex && state.searchIndex.people ? state.searchIndex.people : [])
            .filter(p => {
                if (!p || !p[1]) return false;
                const searchString = p[1], squeezedSearchString = squeeze(searchString);
                return queryWords.every(w => searchString.includes(w)) || squeezedQueryWords.every(w => squeezedSearchString.includes(w));
            })
            .sort((a, b) => {
                const remarkA = state.peopleDetails[a[0]]?.remarkability || 0;
                const remarkB = state.peopleDetails[b[0]]?.remarkability || 0;
                return remarkB - remarkA;
            });

        // Slice based on the current pagination limit
        const peopleMatches = allPeopleMatches.slice(0, currentPeopleLimit);

        if (zoneMatches.length > 0 || locationMatches.length > 0 || peopleMatches.length > 0) {

            // RENDER ZONES 
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
                    state.globalSearchIds = null;
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

                    state.currentPanelPeople = peopleInZone.map(p => ({
                        id: p[0], categories: p[3], lat: p[1], lon: p[2]
                    }));

                    resetPanelControls();
                    applyPanelFiltersAndRender(map);
                    document.getElementById('cluster-list-panel').classList.add('open');
                };
                searchResults.appendChild(div);
            });

            // RENDER LOCATIONS 
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

            // RENDER PEOPLE 
            peopleMatches.forEach(person => {
                const [pId, searchString, defaultDisplayName, locKey, realBirthplace, country] = person;
                const details = state.peopleDetails[pId];
                
                // Using currentSearchQuery to highlight matching names
                const displayName = getLocalizedName(details, currentSearchQuery, defaultDisplayName);

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
                        
                        // THE FIX: Changed map.getMaxZoom() to 14
                        map.flyTo([pLat, pLon], 14, { paddingTopLeft: [820, 0], duration: 1.0 });

                        document.getElementById('detail-name').innerText = displayName;
                        const detailContent = document.getElementById('detail-content');
                        detailContent.innerHTML = generatePopupHTML({ id: id, categories: categories });
                        if(detailContent.querySelector('.popup-title')) detailContent.querySelector('.popup-title').remove();
                        document.getElementById('person-detail-panel').classList.add('open');
                    }
                };
                searchResults.appendChild(div);
            });

            // --- THE NEW "LOAD MORE" BUTTON ---
            if (allPeopleMatches.length > currentPeopleLimit) {
                const remaining = allPeopleMatches.length - currentPeopleLimit;
                const nextAmount = Math.min(8, remaining);
                
                const loadMoreBtn = document.createElement('div');
                loadMoreBtn.className = 'search-result-item';
                loadMoreBtn.style.textAlign = 'center';
                loadMoreBtn.style.fontWeight = 'bold';
                
                loadMoreBtn.innerHTML = `⬇ Load ${nextAmount} more people <span style="font-size:0.8em; font-weight:normal; opacity:0.7;">(${remaining} left)</span>`;
                
                loadMoreBtn.onclick = (e) => {
                    e.stopPropagation(); // Prevents the dropdown from closing
                    currentPeopleLimit += 8; // Increase the limit
                    performSearchAndRender(); // Re-render the dropdown with more people!
                    
                    // Automatically scroll down smoothly to reveal the new names
                    setTimeout(() => { searchResults.scrollBy({ top: 350, behavior: 'smooth' }); }, 10);
                    searchInput.focus(); // Keep the cursor active in the search bar
                };
                searchResults.appendChild(loadMoreBtn);
            }

            searchResults.style.display = 'block';
        } else {
            searchResults.innerHTML = '<div class="search-result-item" style="color:gray; cursor:default;">No results found...</div>';
            searchResults.style.display = 'block';
        }
    }

    searchInput.addEventListener('input', function(e) {
        currentSearchQuery = e.target.value.toLowerCase().trim();
        currentPeopleLimit = 8; // Always reset pagination to 8 on a brand new search

        let needsRender = false;

        // ⚡ THE FIX: The moment the user types or deletes a letter, clear the old global search!
        if (state.globalSearchIds !== null) {
            state.globalSearchIds = null;
            needsRender = true;
        }

        if (currentSearchQuery.length === 0) {
            // Also clear geographical zones if the search bar is completely empty
            if (state.activeZoneFilter !== 'all') {
                state.activeZoneFilter = 'all';
                needsRender = true;
            }
            
            if (needsRender) renderMarkers(); // Restore the map instantly
            
            closeAllPanels(map);
            searchResults.style.display = 'none';
            return;
        }

        // If we just broke the global search lock, restore the map to full population
        if (needsRender) renderMarkers();

        if (currentSearchQuery.length < 2) {
            searchResults.style.display = 'none';
            return;
        }

        performSearchAndRender();
    });

    document.addEventListener('click', function(e) {
        if (!document.getElementById('search-container').contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });

    // --- NEW: THE GLOBAL SEARCH EXECUTOR (BUTTON & ENTER KEY) ---
    function executeGlobalSearch() {
        const query = searchInput.value.toLowerCase().trim();
        searchResults.style.display = 'none';
        closeAllPanels(map);

        if (!query || query.length < 2) {
            state.globalSearchIds = null;
            state.activeZoneFilter = 'all';
            renderMarkers();
            return;
        }

        const queryWords = query.split(/\s+/);
        const squeezedQueryWords = queryWords.map(squeeze);

        // Fetch ALL matching people
        const allPeopleMatches = (state.searchIndex && state.searchIndex.people ? state.searchIndex.people : [])
            .filter(p => {
                if (!p || !p[1]) return false;
                const searchString = p[1], squeezedSearchString = squeeze(searchString);
                return queryWords.every(w => searchString.includes(w)) || squeezedQueryWords.every(w => squeezedSearchString.includes(w));
            })
            .sort((a, b) => {
                const remarkA = state.peopleDetails[a[0]]?.remarkability || 0;
                const remarkB = state.peopleDetails[b[0]]?.remarkability || 0;
                return remarkB - remarkA;
            });

        if (allPeopleMatches.length === 0) return;

        // 1. Tell the map to filter ONLY these people
        state.globalSearchIds = new Set(allPeopleMatches.map(p => p[0]));
        state.activeZoneFilter = 'all'; // Reset geographical limits
        renderMarkers();

        // 2. Build the array for the side panel and calculate the Map zoom bounds
        const bounds = L.latLngBounds();
        const matchedFullPeople = [];

        allPeopleMatches.forEach(pMatch => {
            const personData = state.allPeople.find(p => p[0] === pMatch[0]);
            if (personData) {
                bounds.extend([personData[1], personData[2]]);
                matchedFullPeople.push({
                    id: personData[0], categories: personData[3], lat: personData[1], lon: personData[2]
                });
            }
        });

        // 3. Fly the map to encompass all results and open the panel!
        if (matchedFullPeople.length > 0) {
            map.flyToBounds(bounds, { paddingTopLeft: [370, 20], paddingBottomRight: [20, 20], duration: 1.2, maxZoom: 12 });
            
            document.getElementById('panel-title').innerText = `Search: "${query}"`;
            document.getElementById('panel-subtitle').innerText = `${matchedFullPeople.length} People Found`;

            state.currentPanelPeople = matchedFullPeople;
            resetPanelControls();
            applyPanelFiltersAndRender(map);
            document.getElementById('cluster-list-panel').classList.add('open');
        }
    }

    // Attach to the Magnifying Glass Button
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', executeGlobalSearch);
    }

    // Attach to the 'Enter' key inside the text box
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            executeGlobalSearch();
        }
    });

} // <--- THE MISSING BRACKET IS NOW SAFELY HERE AT THE BOTTOM!