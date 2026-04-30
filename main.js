// main.js
import { state } from './state.js';
import { map, renderMarkers } from './map.js';
import { initSearch } from './search.js';
import { updateDropdownCounts, closeAllPanels, handleEscape } from './ui.js'; // <-- Combined into one clean line!

document.addEventListener('DOMContentLoaded', () => {
// ... rest of your code ...
    
    const mainFilter = document.getElementById('topic-filter');
    const subFilter = document.getElementById('sub-topic-filter');
    const subLabel = document.getElementById('sub-topic-label');

    // 1. Initial Data Load
    Promise.all([
        fetch('data/map_lite.json').then(res => res.json()),
        fetch('data/topic_map.json').then(res => res.json())
    ])
    .then(([liteData, topicData]) => {
        state.allPeople = liteData;
        
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
            initSearch(); // Initialize search only AFTER data is loaded
            console.log("Background data and search index fully loaded!");
        })
        .catch(err => console.error("Error loading background data:", err));
        
    })
    .catch(err => console.error("Error loading JSON data:", err));

    // 2. Filter Listeners
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

    // 3. Theme Toggle & Escape Key
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            document.body.classList.toggle('dark-mode');
            renderMarkers(); // Redraws canvas circles for dark mode colors
            themeToggle.innerText = document.body.classList.contains('dark-mode') ? '☀️ Switch to Light Mode' : '🌙 Switch to Dark Mode';
        });
    }

    // ... Theme Toggle code ...

    // 3. Layered Escape Key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') handleEscape(map);
    });

    // 4. Bulletproof Close Buttons (Event Delegation)
    document.body.addEventListener('click', function(e) {
        const closeBtn = e.target.closest('[class*="close"]');
        if (!closeBtn) return;

        // If the clicked X is inside the Person panel, close ONLY the Person panel
        if (closeBtn.closest('#person-detail-panel')) {
            document.getElementById('person-detail-panel').classList.remove('open');
        } 
        // If the clicked X is inside the List panel, close BOTH the List panel AND the Person panel!
        else if (closeBtn.closest('#cluster-list-panel')) {
            document.getElementById('cluster-list-panel').classList.remove('open');
            
            // <-- ADD THIS LINE to also kill the person panel -->
            document.getElementById('person-detail-panel').classList.remove('open'); 
            
            document.querySelectorAll('.active-pulse').forEach(el => el.classList.remove('active-pulse'));
        }
    });
    // 5. Side Panel Search & Sort Logic
    const panelSearch = document.getElementById('panel-search');
    const panelSort = document.getElementById('panel-sort');

    if (panelSearch && panelSort) {
        // The Search Bar Filter
        panelSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            document.querySelectorAll('#list-content .list-item').forEach(item => {
                const name = item.getAttribute('data-name') || '';
                // If the name matches the typing, show it, otherwise hide it
                item.style.display = name.includes(query) ? 'block' : 'none'; 
            });
        });

        // The Sort Dropdown
        panelSort.addEventListener('change', (e) => {
            const sortType = e.target.value;
            const listContent = document.getElementById('list-content');
            
            // Grab all current HTML elements and convert to a sortable array
            const items = Array.from(listContent.querySelectorAll('.list-item'));

            items.sort((a, b) => {
                if (sortType === 'alpha') {
                    return a.getAttribute('data-name').localeCompare(b.getAttribute('data-name'));
                } else if (sortType === 'remarkability') {
                    // Sort Descending: Higher remarkability scores come first
                    return parseInt(b.getAttribute('data-remark')) - parseInt(a.getAttribute('data-remark'));
                }
                return 0;
            });

            // Re-appending them automatically forces the browser to draw them in the new sorted order
            items.forEach(item => listContent.appendChild(item));
        });
    }

}); // <-- End of main.js DOMContentLoaded block