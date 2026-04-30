/**
 * main.js
 */
import { state } from './state.js';
import { map, renderMarkers } from './map.js';
import { initSearch } from './search.js';
import { updateDropdownCounts, closeAllPanels, handleEscape, applyPanelFiltersAndRender } from './ui.js'; 

document.addEventListener('DOMContentLoaded', () => {
    
    const mainFilter = document.getElementById('topic-filter');
    const subFilter = document.getElementById('sub-topic-filter');
    const subLabel = document.getElementById('sub-topic-label');

    Promise.all([
        fetch('data/map_lite.json').then(res => res.json()),
        fetch('data/topic_map.json').then(res => res.json())
    ])
    .then(([liteData, topicData]) => {
        state.allPeople = liteData.map(person => {
            if (typeof person[3] === 'string') {
                return [
                    person[0], person[1], person[2],
                    [[person[3], person[4] || 'Unknown']],
                    person[5], person[6] || []
                ];
            } else if (!person[3]) {
                person[3] = [["Other", "Unknown"]];
            }
            return person;
        });
        
        for (const mainTopic in topicData) {
            state.subTopicsMap[mainTopic] = ["All", ...Object.keys(topicData[mainTopic])];
        }

        updateDropdownCounts(mainFilter); 
        renderMarkers(); 

        Promise.all([
            fetch('data/people_details.json').then(res => res.json()),
            fetch('data/search_index.json').then(res => res.json())
        ])
        .then(([detailsData, searchData]) => {
            state.peopleDetails = detailsData;
            state.searchIndex = searchData; 
            initSearch(); 
            console.log("Background data and search index fully loaded!");
        })
        .catch(err => console.error("Error loading background data:", err));
    })
    .catch(err => console.error("Error loading JSON data:", err));

    mainFilter.addEventListener('change', function(e) {
        const selectedMain = e.target.value;
        subFilter.innerHTML = ''; 
        
        if (selectedMain !== 'all' && state.subTopicsMap[selectedMain]) {
            subFilter.style.display = 'block';
            subLabel.style.display = 'inline-block';
            
            const subTopics = state.subTopicsMap[selectedMain];
            
            if (subTopics.length === 2) {
                const singleSubTopic = subTopics[1]; 
                const opt = document.createElement('option');
                opt.value = singleSubTopic;
                const count = state.topicCounts.sub[`${selectedMain}|${singleSubTopic}`] || 0;
                opt.innerText = `${singleSubTopic} (${count.toLocaleString()})`;
                subFilter.appendChild(opt);
                subFilter.disabled = true;       
                subFilter.style.opacity = '1.0'; 
            } else {
                subFilter.disabled = false;
                subFilter.style.opacity = '1';
                subFilter.style.cursor = 'pointer';
                
                subTopics.forEach(st => {
                    const opt = document.createElement('option');
                    opt.value = st;
                    let count = 0;
                    if (st === 'All') {
                        count = state.topicCounts.main[selectedMain] || 0;
                        opt.innerText = `All (${count.toLocaleString()})`;
                    } else {
                        count = state.topicCounts.sub[`${selectedMain}|${st}`] || 0;
                        opt.innerText = `${st} (${count.toLocaleString()})`;
                    }
                    subFilter.appendChild(opt);
                });
                subFilter.value = 'All'; 
            }
        } else {
            subFilter.style.display = 'none';
            subLabel.style.display = 'none';
            subFilter.disabled = false; 
        }
        renderMarkers(); 
    });

    subFilter.addEventListener('change', () => renderMarkers());

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            document.body.classList.toggle('dark-mode');
            renderMarkers(); 
            themeToggle.innerText = document.body.classList.contains('dark-mode') ? '☀️ Switch to Light Mode' : '🌙 Switch to Dark Mode';
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') handleEscape(map);
    });

    document.body.addEventListener('click', function(e) {
        const closeBtn = e.target.closest('[class*="close"]');
        if (!closeBtn) return;

        if (closeBtn.closest('#person-detail-panel')) {
            document.getElementById('person-detail-panel').classList.remove('open');
        } else if (closeBtn.closest('#cluster-list-panel')) {
            document.getElementById('cluster-list-panel').classList.remove('open');
            document.getElementById('person-detail-panel').classList.remove('open'); 
            document.querySelectorAll('.active-pulse').forEach(el => el.classList.remove('active-pulse'));
        }
    });

    // Wire up Search & Sort logic to the central in-memory engine!
    const panelSearch = document.getElementById('panel-search');
    const panelSort = document.getElementById('panel-sort');
    if (panelSearch && panelSort) {
        panelSearch.addEventListener('input', () => applyPanelFiltersAndRender(map));
        panelSort.addEventListener('change', () => applyPanelFiltersAndRender(map));
    }
});