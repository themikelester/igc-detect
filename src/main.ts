
import { assert, assertDefined } from './util';
import { GITHUB_REVISION_URL, IS_DEVELOPMENT } from './version';

class Main {
    public toplevel: HTMLElement;
    public canvas: HTMLCanvasElement;
    public paused: boolean = false;

    constructor() {
        this.init();
    }

    public async init() {
        console.log(`Source for this build available at ${GITHUB_REVISION_URL}`);

        this.toplevel = document.createElement('div');
        document.body.appendChild(this.toplevel);

        this.canvas = document.createElement('canvas');

        // Initialize Viewer

        this.toplevel.appendChild(this.canvas);
        window.onresize = this._onResize.bind(this);
        this._onResize();

        const fileChooser = assertDefined(document.getElementById('filechooser')) as HTMLInputElement;
        fileChooser.addEventListener("change", (event: Event) => {
            this.onFilesChanged(assertDefined(fileChooser.files));
        });

        this._updateLoop(window.performance.now());
    }

    public setPaused(v: boolean): void {
        if (this.paused === v)
            return;

        this.paused = true;
        if (!this.paused)
            window.requestAnimationFrame(this._updateLoop);
    }

    private _updateLoop = (time: number) => {
        if (this.paused)
            return;

        window.requestAnimationFrame(this._updateLoop);
    };

    private _onResize() {
        // Handle canvas resize
    }

    private async onFilesChanged(files: FileList) {
        const fileReader = new FileReader();

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const igcText = await fileReader.readAsText(file);
            fileReader.onload = () => this.parseIGC(fileReader.result as String);
        }
    }

    private parseIGC(text: String) {
        const lines = text.split(/\r\n|\n/);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            console.log(line);

            // B Time   Latitude Longitude V Baro  Gps    
            // B HHMMSS DDMMmmmN DDDMMmmmW A PPPPP GGGGG
            // 0 123456 78901234 567890123 4 56789 01234    
            // B 144820 4247731N 00033427W A 00000 02526
            if (line[0] == 'B') {
                const time = line.substring(1, 7);
                const lat = line.substring(7, 15);
                const lon = line.substring(15, 24);

                const fixValid = line.substring(24, 25) == 'A';
                const baroAlt = line.substring(25, 30);
                const gpsAlt = line.substring(30, 37);

                const latValid = lat[7] == 'N' || lat[7] == 'S';
                const lonValid = lon[8] == 'E' || lon[8] == 'W';
                assert( latValid && lonValid && fixValid, "Invalid B record found: " + line );

                console.log(time, lat, lon, fixValid, baroAlt, gpsAlt);
            }
        }
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

