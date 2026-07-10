// state.js
export const state = {
    allPeople: [],
    peopleDetails: {},
    searchIndex: { locations: {}, people: [] },
    subTopicsMap: {},
    topicCounts: { main: {}, sub: {} },
    activeZoneFilter: 'all',
    
    // --- PAGINATION & SIDE PANEL STATE ---
    currentPanelPeople: [],   // The raw list of people loaded into the side panel
    filteredPanelPeople: [],  // The list after the user types in the panel search bar
    displayCount: 50,         // How many people are currently rendered on the DOM
    ITEMS_PER_PAGE: 50        // Chunk size limit
};