/**
 * worker.js
 * A background thread to handle heavy spatial clustering math.
 * Ensures the main UI thread never freezes when processing thousands of coordinates.
 */

importScripts('https://unpkg.com/supercluster@8.0.1/dist/supercluster.min.js');

let index;

self.onmessage = function (e) {
    const { type, payload, id } = e.data;

    // Initialize map data into the Supercluster tree
    if (type === 'load') {
        index = new Supercluster({
            radius: 180, // High radius for clean, un-cluttered marker distribution
            maxZoom: 19,
            minPoints: 2
        });
        index.load(payload.geoJsonData);
        self.postMessage({ id, result: 'loaded' });
    } 
    // Fetch clustered blocks for the current screen view
    else if (type === 'getClusters') {
        if (!index) return;
        const clusters = index.getClusters(payload.bbox, payload.zoom);
        self.postMessage({ id, result: clusters });
    }
    // Calculate how far to zoom in to break a cluster open
    else if (type === 'getClusterExpansionZoom') {
        if (!index) return;
        const zoom = index.getClusterExpansionZoom(payload.clusterId);
        self.postMessage({ id, result: zoom });
    }
    // Fetch all individual people inside a specific cluster
    else if (type === 'getLeaves') {
        if (!index) return;
        const leaves = index.getLeaves(payload.clusterId, payload.limit || Infinity);
        self.postMessage({ id, result: leaves });
    }
};