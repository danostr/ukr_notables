// state.js
export const state = {
    allPeople: [],
    peopleDetails: {},
    searchIndex: { locations: {}, people: [] },
    subTopicsMap: {},
    topicCounts: { main: {}, sub: {} },
    activeZoneFilter: 'all',
    
    globalSearchIds: null, // <-- NEW: Holds a Set of IDs when a global search is triggered
    
    // --- PAGINATION & SIDE PANEL STATE ---
    currentPanelPeople: [],   
    filteredPanelPeople: [],  
    displayCount: 50,         
    ITEMS_PER_PAGE: 50        
};