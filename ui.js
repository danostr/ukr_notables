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

    const subTopicText = (basicData.sub_topic && basicData.sub_topic !== 'Unknown') ? ` > ${basicData.sub_topic}` : '';
    const occupationsHTML = (details.occupations && details.occupations.length > 0) 
        ? `<p class="popup-detail"><b>Occupation:</b> ${details.occupations.join(', ')}</p>` : '';

    const displayName = details.name_en || details.name_uk || details.name_ru || "Unknown Name";

    return `
        <div class="popup-container">
            <h3 class="popup-title">${displayName}</h3>
            <div class="popup-body">
                <p class="popup-detail"><b>Birthplace:</b> ${details.birthplace || 'Unknown'}</p>
                <p class="popup-detail"><b>Category:</b> <span class="popup-category">${basicData.topic}${subTopicText}</span></p>
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
        const mainTopic = person[3] || 'Other';
        const subTopic = person[4] || 'Unknown';

        state.topicCounts.main[mainTopic] = (state.topicCounts.main[mainTopic] || 0) + 1;
        const subKey = `${mainTopic}|${subTopic}`;
        state.topicCounts.sub[subKey] = (state.topicCounts.sub[subKey] || 0) + 1;
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