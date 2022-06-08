
import { assert, assertDefined } from './util';
import { GITHUB_REVISION_URL, IS_DEVELOPMENT } from './version';
import { computeDerivedPoints, findTakeoffs, Tracklog } from './tracklog';
import * as L from "leaflet";

class Main {
    public paused: boolean = false;
    public tracklogs: Tracklog[] = [];
    public map: L.Map;

    constructor() {
        this.init();
    }

    public async init() {
        console.log(`Source for this build available at ${GITHUB_REVISION_URL}`);

        window.onresize = this._onResize.bind(this);
        this._onResize();

        // Map Setup
        this.map = L.map('map').setView([51.505, -0.09], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(this.map);

        // Listen for new igc files
        const fileChooser = assertDefined(document.getElementById('filechooser')) as HTMLInputElement;
        fileChooser.addEventListener("change", (event: Event) => {
            this.onFilesChanged(assertDefined(fileChooser.files));
        });
    }

    private _onResize() {
        // Handle canvas resize
    }

    private async onFilesChanged(files: FileList) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileReader = new FileReader();
            const igcText = await fileReader.readAsText(file);
            fileReader.onload = () => this.parseIGC(fileReader.result as String);
        }
    }

    private parseIGC(text: String) {
        const lines = text.split(/\r\n|\n/);

        const tracklog = new Tracklog();

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // B Time   Latitude Longitude V Baro  Gps    
            // B HHMMSS DDMMmmmN DDDMMmmmW A PPPPP GGGGG
            // 0 123456 78901234 567890123 4 56789 01234    
            // B 144820 4247731N 00033427W A 00000 02526
            if (line[0] == 'B') {
                const B_RECORD_RE = /^B(\d{2})(\d{2})(\d{2})(\d{2})(\d{5})([NS])(\d{3})(\d{5})([EW])([AV])(-\d{4}|\d{5})(-\d{4}|\d{5})/;

                const matches = assertDefined(line.match(B_RECORD_RE));

                const hours = parseInt(matches[1]);
                const mins = parseInt(matches[2]);
                const secs = parseInt(matches[3]);
                const latitude = (parseInt(matches[4]) + parseInt(matches[5]) / 60000.0) * (matches[6] === 'S' ? -1 : 1);
                const longitude = (parseInt(matches[7]) + parseInt(matches[8]) / 60000.0) * (matches[9] === 'W' ? -1 : 1);
                const baroAlt = parseInt(matches[11]);
                const gpsAlt = parseInt(matches[12]);

                const date = new Date();
                date.setUTCHours(hours, mins, secs);

                tracklog.points.push({
                    latitude,
                    longitude,
                    altitude: gpsAlt,
                    time: date.getTime()
                });
            }
        }

        computeDerivedPoints(tracklog);

        this.tracklogs.push(tracklog);
        console.log(tracklog);

        const latlngs = tracklog.points.map(point => [point.latitude, point.longitude]) as L.LatLngTuple[];
        const polyline = L.polyline(latlngs, { color: 'red' }).addTo(this.map);

        const takeoffIdxs = findTakeoffs(tracklog);
        console.log(takeoffIdxs);
        for (let i = 0; i < takeoffIdxs.length; i++) {
            const point = tracklog.points[takeoffIdxs[i]];
            L.marker([point.latitude, point.longitude]).addTo(this.map);
        }

        // zoom the map to the polyline
        this.map.fitBounds(polyline.getBounds());
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

