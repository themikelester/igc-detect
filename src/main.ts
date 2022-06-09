
import { assert, assertDefined } from './util';
import { GITHUB_REVISION_URL, IS_DEVELOPMENT } from './version';
import { computeDerivedPoints, findLandings, findTakeoffs, Tracklog } from './tracklog';
import * as L from "leaflet";
import { parseIGC } from './igc';
import { createGpx } from './gpx';

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

        const googleTerrain = L.tileLayer('http://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',{
            maxZoom: 20,
            subdomains:['mt0','mt1','mt2','mt3']
        }).addTo(this.map);

        var tileOptions = {
            "Open streetmap": osm,
            "Google: Hybrid": googleHybrid,
            "Google: Satellite": googleSat,
            "Google: Terrain": googleTerrain,
        };
        L.control.layers(tileOptions).addTo(this.map);

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
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileReader = new FileReader();
            fileReader.readAsText(file);
            fileReader.onload = () => {
                const tracklog = parseIGC(files[i].name, fileReader.result as String);
                this.onTracklogLoaded(tracklog);
            }
        }
    }

    private onTracklogLoaded(tracklog: Tracklog) {
        computeDerivedPoints(tracklog);

        this.tracklogs.push(tracklog);
        console.log(tracklog);

        const takeoffIdxs = findTakeoffs(tracklog);
        const landingIdxs = findLandings(tracklog);

        createGpx( tracklog, takeoffIdxs );

        // Draw takeoff and landings as markers on the map
        for (let i = 0; i < takeoffIdxs.length; i++) {
            const point = tracklog.points[takeoffIdxs[i]];
            L.marker([point.latitude, point.longitude]).addTo(this.map);
        }

        for (let i = 0; i < landingIdxs.length; i++) {
            const point = tracklog.points[landingIdxs[i]];
            L.marker([point.latitude, point.longitude], { icon: this.landingIcon }).addTo(this.map);
        }

        const fullTrack = drawTrackSegment(tracklog, 0, tracklog.points.length, 'red');
        fullTrack.addTo(this.map);
        this.tracklogGroup.addLayer(fullTrack);

        // zoom the map to the tracklog
        this.map.fitBounds(this.tracklogGroup.getBounds());
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

function drawTrackSegment(tracklog: Tracklog, startIdx: number, endIdx: number, color: string) {
    const segment = tracklog.points.slice(startIdx, endIdx);
    const latlngs = segment.map(point => [point.latitude, point.longitude]) as L.LatLngTuple[];
    return L.polyline(latlngs, { color });
}
