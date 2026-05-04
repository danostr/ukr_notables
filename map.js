// map.js
import { state } from './state.js';
import { generatePopupHTML, closeAllPanels, resetPanelControls, applyPanelFiltersAndRender, silentPreload } from './ui.js';
import { getGeoTree } from './search.js'; 

const globeBounds = L.latLngBounds(L.latLng(-75, -200), L.latLng(85, 200));

export const map = L.map('map', {
    preferCanvas: true, center: [48.3794, 31.1656], zoomDelta: 0.6, 
    zoomSnap: 0.15, wheelPxPerZoomLevel: 60, zoom: 6, minZoom: 2.25, 
    maxBounds: globeBounds, maxBoundsViscosity: 1.0     
    // FIX 1: Removed the override! Leaflet will now natively close popups ONLY on a true click, not a drag.
});

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap contributors, © CARTO'
}).addTo(map);

export const markersLayer = L.featureGroup().addTo(map);

const clusterWorker = new Worker('worker.js');
let workerMessageId = 0;
const workerCallbacks = {};

clusterWorker.onmessage = function(e) {
    const { id, result } = e.data;
    if (workerCallbacks[id]) {
        workerCallbacks[id](result);
        delete workerCallbacks[id];
    }
};

function askWorker(type, payload) {
    return new Promise(resolve => {
        const id = workerMessageId++;
        workerCallbacks[id] = resolve;
        clusterWorker.postMessage({ type, payload, id });
    });
}

export async function renderMarkers() {
    const mainTopic = document.getElementById('topic-filter').value;
    const subTopic = document.getElementById('sub-topic-filter').value;
    const geoJsonData = [];
    
    state.allPeople.forEach(person => {
        const pId = person[0], pLat = person[1], pLon = person[2];
        const categories = person[3]; 
        const geoTree = getGeoTree(person); 
        if (state.globalSearchIds && !state.globalSearchIds.has(pId)) return;

        let matchesTopic = false;
        if (mainTopic === 'all') {
            matchesTopic = true;
        } else {
            if (subTopic && subTopic !== 'All') {
                matchesTopic = categories.some(c => c[0] === mainTopic && c[1] === subTopic);
            } else {
                matchesTopic = categories.some(c => c[0] === mainTopic);
            }
        }

        if (!matchesTopic) return;

        if (state.activeZoneFilter !== 'all') {
            let inZone = geoTree.includes(state.activeZoneFilter);
            if (!inZone && state.searchIndex && state.searchIndex.locations) {
                const locKey = typeof person[4] === 'string' ? person[4] : (typeof person[5] === 'string' ? person[5] : null);
                if (locKey && state.searchIndex.locations[locKey]) {
                    inZone = (state.searchIndex.locations[locKey][2] === state.activeZoneFilter);
                }
            }
            if (!inZone) return;
        }

        geoJsonData.push({
            type: "Feature", properties: { id: pId, categories: categories },
            geometry: { type: "Point", coordinates: [pLon, pLat] } 
        });
    });

    await askWorker('load', { geoJsonData });
    updateScreen();
}

async function updateScreen() {
    const paddedBounds = map.getBounds().pad(0.5); 
    const bbox = [
        Math.max(-180, paddedBounds.getWest()), Math.max(-90, paddedBounds.getSouth()), 
        Math.min(180, paddedBounds.getEast()), Math.min(90, paddedBounds.getNorth())
    ];
    
    const visibleClusters = await askWorker('getClusters', { bbox, zoom: map.getZoom() });
    
    // FIX 2: Find the currently open popup marker BEFORE we wipe the map
    let activeMarkerId = null;
    let activeMarkerLayer = null;

    map.eachLayer(layer => {
        if (layer instanceof L.Popup && layer._source && layer._source.personData) {
            activeMarkerId = layer._source.personData.id;
            activeMarkerLayer = layer._source;
        }
    });

    // FIX 3: Clear all markers EXCEPT the active one! (Kills the flicker completely)
    markersLayer.eachLayer(layer => {
        if (layer !== activeMarkerLayer) {
            markersLayer.removeLayer(layer);
        }
    });

    visibleClusters.forEach(feature => {
        const [lon, lat] = feature.geometry.coordinates;
        
        if (feature.properties.cluster) {
            const count = feature.properties.point_count;
            let sizeClass = count < 50 ? 'small' : count < 500 ? 'medium' : 'large';
            
            const clusterIcon = L.divIcon({
                html: `<div><span>${count}</span></div>`, className: `marker-cluster marker-cluster-${sizeClass}`,
                iconSize: L.point(40, 40)
            });
            
            const clusterMarker = L.marker([lat, lon], { icon: clusterIcon });
            clusterMarker.clusterId = feature.properties.cluster_id; 
            markersLayer.addLayer(clusterMarker);
        } else {
            // FIX 4: If this feature is the marker we safely preserved, DO NOT recreate it!
            if (activeMarkerId === feature.properties.id) {
                if (activeMarkerLayer && activeMarkerLayer.bringToFront) {
                    activeMarkerLayer.bringToFront(); // Force it to the top layer
                }
                return;
            }

            const isDark = document.body.classList.contains('dark-mode');
            const personMarker = L.circleMarker([lat, lon], { 
                radius: 6, fillColor: isDark ? '#fbbf24' : '#1e40af', 
                color: isDark ? '#111827' : '#ffffff', weight: 2, fillOpacity: 1
            });

            personMarker.personData = feature.properties;
            personMarker.bindPopup((layer) => generatePopupHTML(layer.personData));
            markersLayer.addLayer(personMarker);

            const details = state.peopleDetails[feature.properties.id] || {};
            if (details.image) silentPreload(details.image);
        }
    });
}

let renderTimer;
map.on('moveend', () => {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(updateScreen, 50); 
});

map.on('click', (e) => {
    if (!e.originalEvent.target.closest('.leaflet-marker-icon') && !e.originalEvent.target.closest('.leaflet-popup')) {
        const detailPanel = document.getElementById('person-detail-panel');
        const listPanel = document.getElementById('cluster-list-panel');
        if (detailPanel) detailPanel.classList.remove('open');
        if (listPanel) listPanel.classList.remove('open');
        document.querySelectorAll('.active-pulse').forEach(el => el.classList.remove('active-pulse'));
        
        // Note: Leaflet will now handle closing the map popup natively!
    }
});

markersLayer.on('click', async function(e) {
    const marker = e.layer;
    if (!marker.clusterId) return;

    const clusterId = marker.clusterId;
    const expansionZoom = await askWorker('getClusterExpansionZoom', { clusterId });
    
    if (expansionZoom > 19) {
        const leaves = await askWorker('getLeaves', { clusterId, limit: Infinity }); 
        const panel = document.getElementById('cluster-list-panel');
        
        const firstDetails = state.peopleDetails[leaves[0].properties.id] || {};
        document.getElementById('panel-title').innerText = firstDetails.birthplace || "Location";
        document.getElementById('panel-subtitle').innerText = `${leaves.length} People Here`;
        
        state.currentPanelPeople = leaves.map(leaf => ({
            id: leaf.properties.id,
            categories: leaf.properties.categories,
            lat: leaf.geometry.coordinates[1],
            lon: leaf.geometry.coordinates[0]
        }));

        resetPanelControls();
        applyPanelFiltersAndRender(map);
        
        // FIX 5: Explicitly close map popups when opening the side panel
        map.closePopup();
        
        panel.classList.add('open');
    } else {
        map.flyTo(marker.getLatLng(), expansionZoom, { duration: 0.5 });
    }
});