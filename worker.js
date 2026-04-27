// worker.js

// Import Supercluster directly into the background worker
importScripts('https://unpkg.com/supercluster@8.0.1/dist/supercluster.min.js');

let index;

// Listen for messages from the main app.js
self.onmessage = function (e) {
    const { type, payload, id } = e.data;

    if (type === 'load') {
        // Initialize the math engine
        index = new Supercluster({
            radius: 180,
            maxZoom: 19,
            minPoints: 2
        });
        index.load(payload.geoJsonData);
        self.postMessage({ id, result: 'loaded' });
    } 
    else if (type === 'getClusters') {
        if (!index) return;
        const clusters = index.getClusters(payload.bbox, payload.zoom);
        self.postMessage({ id, result: clusters });
    }
    else if (type === 'getClusterExpansionZoom') {
        if (!index) return;
        const zoom = index.getClusterExpansionZoom(payload.clusterId);
        self.postMessage({ id, result: zoom });
    }
    else if (type === 'getLeaves') {
        if (!index) return;
        const leaves = index.getLeaves(payload.clusterId, payload.limit || Infinity);
        self.postMessage({ id, result: leaves });
    }
};