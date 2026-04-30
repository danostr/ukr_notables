/**
 * ui.js
 * Handles DOM manipulation, panel toggling, dropdown generation, and HTML rendering.
 */
import { state } from './state.js';

// Centralized localization handler
export function getLocalizedName(details, query, fallback) {
    if (!details) return fallback;
    const isCyrillic = /[а-яіїєґё]/i.test(query);
    if (isCyrillic) return details.name_uk || details.name_ru || details.name_en || fallback;
    return details.name_en || details.name_uk || details.name_ru || fallback;
}

export function generatePopupHTML(basicData) {
    const details = state.peopleDetails[basicData.id];
    if (!details) return `<div class="popup-container"><p>Loading details...</p></div>`;

    let wikiButtonsHTML = `<div class="wiki-button-container">`;
    if (details.wiki_en) wikiButtonsHTML += `<a href="${details.wiki_en}" target="_blank" class="wiki-btn btn-en">EN</a>`;
    if (details.wiki_uk) wikiButtonsHTML += `<a href="${details.wiki_uk}" target="_blank" class="wiki-btn btn-uk">UA</a>`;
    if (details.wiki_ru) wikiButtonsHTML += `<a href="${details.wiki_ru}" target="_blank" class="wiki-btn btn-ru">RU</a>`;
    wikiButtonsHTML += `</div>`;

    const occupationsHTML = (details.occupations && details.occupations.length > 0) 
        ? `<p class="popup-detail"><b>Occupation:</b> ${details.occupations.join(', ')}</p>` : '';

    const displayName = details.name_en || details.name_uk || details.name_ru || "Unknown Name";

    const firstCategory = (basicData.categories && basicData.categories.length > 0) ? basicData.categories[0] : ["Other", "Unknown"];
    const categoriesHTML = `<span class="popup-category" style="display:inline-block; margin-bottom:4px;">${firstCategory[0]}${firstCategory[1] !== 'Unknown' ? ` > ${firstCategory[1]}` : ''}</span>`;

    return `
        <div class="popup-container">
            <h3 class="popup-title">${displayName}</h3>
            <div class="popup-body">
                <p class="popup-detail"><b>Birthplace:</b> ${details.birthplace || 'Unknown'}</p>
                <div style="margin-bottom: 8px;">${categoriesHTML}</div>
                ${occupationsHTML}
                ${wikiButtonsHTML}
            </div>
        </div>
    `;
}

export function closeAllPanels(mapInstance) {
    const detailPanel = document.getElementById('person-detail-panel');
    const listPanel = document.getElementById('cluster-list-panel');
    
    if (detailPanel) detailPanel.classList.remove('open');
    if (listPanel) listPanel.classList.remove('open');
    
    document.querySelectorAll('.active-pulse').forEach(el => el.classList.remove('active-pulse'));
    if (mapInstance) mapInstance.closePopup();
}

export function updateDropdownCounts(mainFilter) {
    let totalPeople = 0;
    state.topicCounts = { main: {}, sub: {} }; 

    state.allPeople.forEach(person => {
        totalPeople++;
        let categories = person[3]; 

        const uniqueMains = new Set();
        const uniqueSubs = new Set();

        categories.forEach(c => {
            uniqueMains.add(c[0]);
            uniqueSubs.add(`${c[0]}|${c[1]}`);
        });

        uniqueMains.forEach(main => {
            state.topicCounts.main[main] = (state.topicCounts.main[main] || 0) + 1;
        });
        uniqueSubs.forEach(subKey => {
            state.topicCounts.sub[subKey] = (state.topicCounts.sub[subKey] || 0) + 1;
        });
    });

    mainFilter.innerHTML = '';
    mainFilter.add(new Option(`All People (${totalPeople.toLocaleString()})`, 'all'));

    Object.keys(state.subTopicsMap).sort().forEach(topic => {
        const count = state.topicCounts.main[topic] || 0;
        if (count > 0) mainFilter.add(new Option(`${topic} (${count.toLocaleString()})`, topic));
    });

    if (state.topicCounts.main["Other"]) {
        mainFilter.add(new Option(`Other / Unknown (${state.topicCounts.main["Other"].toLocaleString()})`, 'Other'));
    }
}

export function handleEscape(mapInstance) {
    const detailPanel = document.getElementById('person-detail-panel');
    const listPanel = document.getElementById('cluster-list-panel');

    if (detailPanel && detailPanel.classList.contains('open')) {
        detailPanel.classList.remove('open');
        return;
    }

    if (listPanel && listPanel.classList.contains('open')) {
        listPanel.classList.remove('open');
        document.querySelectorAll('.active-pulse').forEach(el => el.classList.remove('active-pulse'));
        return;
    }

    if (mapInstance) mapInstance.closePopup();
}

// --- PAGINATION & SIDE PANEL ENGINE ---

export function resetPanelControls() {
    const search = document.getElementById('panel-search');
    const sort = document.getElementById('panel-sort');
    if (search) search.value = '';
    if (sort) sort.value = 'remarkability';
}

export function applyPanelFiltersAndRender(mapInstance) {
    const query = (document.getElementById('panel-search')?.value || '').toLowerCase().trim();
    const sortType = document.getElementById('panel-sort')?.value || 'remarkability';
    
    // 1. Filter the raw data array in memory
    let filtered = state.currentPanelPeople.filter(person => {
        if (!query) return true;
        const details = state.peopleDetails[person.id] || {};
        const nameEn = (details.name_en || '').toLowerCase();
        const nameUk = (details.name_uk || '').toLowerCase();
        const nameRu = (details.name_ru || '').toLowerCase();
        return nameEn.includes(query) || nameUk.includes(query) || nameRu.includes(query);
    });
    
    // 2. Sort the array in memory
    filtered.sort((a, b) => {
        const detailsA = state.peopleDetails[a.id] || {};
        const detailsB = state.peopleDetails[b.id] || {};
        if (sortType === 'remarkability') {
            return (detailsB.remarkability || 0) - (detailsA.remarkability || 0);
        } else {
            const nameA = getLocalizedName(detailsA, query, "Unknown Name").toLowerCase();
            const nameB = getLocalizedName(detailsB, query, "Unknown Name").toLowerCase();
            return nameA.localeCompare(nameB);
        }
    });
    
    // 3. Reset pagination chunk and trigger DOM render
    state.filteredPanelPeople = filtered;
    state.displayCount = state.ITEMS_PER_PAGE;
    renderPanelList(mapInstance, query);
}

export function renderPanelList(mapInstance, query = "") {
    const listContent = document.getElementById('list-content');
    listContent.innerHTML = '';
    
    // Slice exactly 50 people for peak DOM performance
    const chunk = state.filteredPanelPeople.slice(0, state.displayCount);
    
    chunk.forEach(person => {
        const details = state.peopleDetails[person.id] || {};
        const displayName = getLocalizedName(details, query, "Unknown Name");
        const primaryTopic = (person.categories && person.categories.length > 0 && typeof person.categories[0] !== 'string') ? person.categories[0][0] : "Other";
        
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `<div><strong>${displayName}</strong></div><div style="font-size:0.85em; color:gray;">${primaryTopic}</div>`;
        
        item.onclick = () => {
            document.getElementById('detail-name').innerText = displayName;
            const detailContent = document.getElementById('detail-content');
            detailContent.innerHTML = generatePopupHTML({ id: person.id, categories: person.categories });
            if(detailContent.querySelector('.popup-title')) detailContent.querySelector('.popup-title').remove();
            document.getElementById('person-detail-panel').classList.add('open');
            
            if (mapInstance && person.lat && person.lon) {
                mapInstance.flyTo([person.lat, person.lon], mapInstance.getMaxZoom(), { paddingTopLeft: [820, 0], duration: 0.8 });
            }
        };
        listContent.appendChild(item);
    });

    // Dynamically append the Load More button if there are people left in the array
    if (state.filteredPanelPeople.length > state.displayCount) {
        const remaining = state.filteredPanelPeople.length - state.displayCount;
        const nextAmount = Math.min(state.ITEMS_PER_PAGE, remaining);
        
        const btn = document.createElement('button');
        btn.className = 'load-more-btn'; // <-- Assign the new CSS class
        btn.innerHTML = `Load ${nextAmount} more <span style="font-size: 0.8em; opacity: 0.7;">(${remaining} left)</span>`;
        
        btn.onclick = () => {
            state.displayCount += state.ITEMS_PER_PAGE;
            renderPanelList(mapInstance, query); 
        };
        listContent.appendChild(btn);
    }
}