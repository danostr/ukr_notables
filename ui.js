// ui.js
import { state } from './state.js';

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

    // Format ONLY the first assigned category cleanly
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

        // --- DEFENSIVE DATA FIX ---
        if (typeof categories === 'string') {
            categories = [[categories, person[4] || 'Unknown']];
        } else if (!categories) {
            categories = [["Other", "Unknown"]];
        }

        // Use Sets so a person isn't counted twice in "Science" if they are a Physicist AND a Mathematician
        const uniqueMains = new Set();
        // ... rest of your code stays exactly the same ...
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
// ... existing ui.js code ...

export function handleEscape(mapInstance) {
    const detailPanel = document.getElementById('person-detail-panel');
    const listPanel = document.getElementById('cluster-list-panel');

    // Layer 1: If the Person profile is open, close ONLY it.
    if (detailPanel && detailPanel.classList.contains('open')) {
        detailPanel.classList.remove('open');
        return; // Stop here! Don't close the list underneath it.
    }

    // Layer 2: If the Person profile is closed, but the List is open, close the List.
    if (listPanel && listPanel.classList.contains('open')) {
        listPanel.classList.remove('open');
        document.querySelectorAll('.active-pulse').forEach(el => el.classList.remove('active-pulse'));
        return; // Stop here!
    }

    // Layer 3: Otherwise, close any open map popups.
    if (mapInstance) mapInstance.closePopup();
}

export function resetPanelControls() {
    const search = document.getElementById('panel-search');
    const sort = document.getElementById('panel-sort');
    
    if (search) search.value = '';
    
    if (sort) {
        // Change default from 'alpha' to 'remarkability'
        sort.value = 'remarkability';
        sort.dispatchEvent(new Event('change')); 
    }
}