
import { assert, assertDefined } from './util';
import { GITHUB_REVISION_URL, IS_DEVELOPMENT } from './version';
import { computeDerivedPoints, debugLanding, findLandings, findTakeoffs, haversineDistance, Tracklog } from './tracklog';
import * as L from "leaflet";
import { parseIGC } from './igc';
import { createGpx } from './gpx';

const kShowLandings = false;

class Main {
    public paused: boolean = false;
    public tracklogs: Tracklog[] = [];
    public map: L.Map;
    public tracklogGroup: L.FeatureGroup = L.featureGroup();
    public landingIcon: L.Icon;

    constructor() {
        this.init();
    }

    public async init() {
        console.log(`Source for this build available at ${GITHUB_REVISION_URL}`);

        window.onresize = this._onResize.bind(this);
        this._onResize();

        // Map Setup
        this.map = L.map('map').setView([51.505, -0.09], 13);
        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        });

        const googleHybrid = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
        });

        const googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
        });

        const googleTerrain = L.tileLayer('http://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
        }).addTo(this.map);

        var tileOptions = {
            "Open streetmap": osm,
            "Google: Hybrid": googleHybrid,
            "Google: Satellite": googleSat,
            "Google: Terrain": googleTerrain,
        };
        L.control.layers(tileOptions).addTo(this.map);

        this.tracklogGroup.addTo(this.map);

        // Add a new icon for landings
        this.landingIcon = new L.Icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        // Listen for new igc files
        const fileChooser = assertDefined(document.getElementById('filechooser')) as HTMLInputElement;
        fileChooser.addEventListener("change", (event: Event) => {
            this.onFilesChanged(assertDefined(fileChooser.files));
        });
    }

    private _onResize() {
        // Handle canvas resize
    }

    private onFilesChanged(files: FileList) {
        this.tracklogGroup.clearLayers();

        const promises: Promise<Tracklog>[] = [];
        for (let i = 0; i < files.length; i++) {
            promises[i] = new Promise((resolve, reject) => {
                const file = files[i];
                const fileReader = new FileReader();
                fileReader.onload = () => {
                    const tracklog = parseIGC(files[i].name, fileReader.result as String);
                    this.onTracklogLoaded(tracklog);
                    resolve(tracklog);
                }
                fileReader.onerror = reject;
                fileReader.readAsText(file);
            });
        }
        Promise.all(promises).then(tracklogs => {
            this.onAllTracklogsLoaded(tracklogs);
        })
    }

    private onTracklogLoaded(tracklog: Tracklog) {
        computeDerivedPoints(tracklog);

        tracklog.takeoffs = findTakeoffs(tracklog);
        tracklog.landings = findLandings(tracklog);

        this.tracklogs.push(tracklog);
    }

    private onAllTracklogsLoaded(tracklogs: Tracklog[]) {
        const takeoffPoints = [];
        const landingPoints = [];

        for (let i = 0; i < tracklogs.length; i++) {
            const tracklog = tracklogs[i];

            for (let i = 0; i < tracklog.takeoffs.length; i++) {
                const point = tracklog.points[tracklog.takeoffs[i]];

                // Filter out duplicate takeoffs
                let duplicate = false;
                for (let i = 0; i < takeoffPoints.length; i++) {
                    const existing = takeoffPoints[i];
                    const distance = haversineDistance(existing.latitude, existing.longitude, point.latitude, point.longitude);
                    if (distance < 100 ) { duplicate = true; break; }
                }
                if( duplicate ) { continue; }

                takeoffPoints.push(point);

                L.marker([point.latitude, point.longitude])
                    .on('click', e => onMarkerClicked(tracklog, tracklog.takeoffs[i]))
                    .addTo(this.tracklogGroup);
            }

            if( kShowLandings )
            {
                for (let i = 0; i < tracklog.landings.length; i++) {
                    const point = tracklog.points[tracklog.landings[i]];
                    landingPoints.push(point);
                    L.marker([point.latitude, point.longitude], { icon: this.landingIcon })
                        .on('click', e => onMarkerClicked(tracklog, tracklog.landings[i]))
                        .addTo(this.tracklogGroup);
                }
            }

            const fullTrack = drawTrackSegment(tracklog, 0, tracklog.points.length, 'red');
            fullTrack.addTo(this.tracklogGroup);

            // zoom the map to the tracklog
            this.map.fitBounds(this.tracklogGroup.getBounds());
        }

        const gpxData = createGpx(takeoffPoints);
        const gpxBlob = new Blob([gpxData.toString()], { type: 'application/gpx+xml' });
        download({ filename: 'test.gpx', blob: gpxBlob });
    }
}

// Google Analytics
declare var gtag: (command: string, eventName: string, eventParameters: { [key: string]: string }) => void;

// Declare a "main" object for easy access.
declare global {
    interface Window {
        main: any;
    }
}

window.main = new Main();

// Debug utilities.
declare global {
    interface Window {
        debug: any;
    }
}

function onMarkerClicked(tracklog: Tracklog, index: number) {
    debugLanding(tracklog, index);
}

function drawTrackSegment(tracklog: Tracklog, startIdx: number, endIdx: number, color: string) {
    const segment = tracklog.points.slice(startIdx, endIdx);
    const latlngs = segment.map(point => [point.latitude, point.longitude]) as L.LatLngTuple[];
    return L.polyline(latlngs, { color });
}

async function download({ filename, blob }: { filename: string; blob: Blob }) {
    const a: HTMLAnchorElement = document.createElement('a');
    a.style.display = 'none';
    document.body.appendChild(a);

    const url: string = window.URL.createObjectURL(blob);

    a.href = url;
    a.download = `${filename}`;

    a.click();

    window.URL.revokeObjectURL(url);
    a.parentElement?.removeChild(a);
};
