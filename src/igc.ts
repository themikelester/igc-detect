import { Tracklog } from "./tracklog";
import { assertDefined } from "./util";

// See https://xp-soaring.github.io/igc_file_format/igc_format_2008.html
const kBRecordRegex = /^B(\d{2})(\d{2})(\d{2})(\d{2})(\d{5})([NS])(\d{3})(\d{5})([EW])([AV])(-\d{4}|\d{5})(-\d{4}|\d{5})/;
const kDateRecordRegex = /^(HFDTE|HFDTEDATE:)(\d{2})(\d{2})(\d{2})/;
const kPilotRecordRegex = /^(HFPLTPILOT|HOPLTPILOT)[^:]*:(.*)/;

export function parseIGC(filename: String, text: String) {
    const lines = text.split(/\r\n|\n/);

    const tracklog = new Tracklog();

    let trackDate = new Date(); // Overridden by a HFDTE record if it exists

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Desc:    HFDTE Day Month Year
        // Bytes:   HFDTE DD  MM    YY
        // ------------------------------------------------    
        // Example: HFDTE 24  06    18
        if (line.startsWith("HFDTE") || line.startsWith("HFDTEDATE")) {
            const match = assertDefined(line.match(kDateRecordRegex));
            trackDate = toDate(match);
        }

        // Desc:    B Time   Latitude Longitude V Baro  Gps    
        // Bytes:   B HHMMSS DDMMmmmN DDDMMmmmW A PPPPP GGGGG
        // ------------------------------------------------    
        // Example: B 144820 4247731N 00033427W A 00000 02526
        if (line[0] == 'B') {
            const matches = line.match(kBRecordRegex);
            if( !matches ) { 
                console.warn( "Found bad B record: " + line );
                continue;
            }

            const hours = parseInt(matches[1]);
            const mins = parseInt(matches[2]);
            const secs = parseInt(matches[3]);
            const latitude = (parseInt(matches[4]) + parseInt(matches[5]) / 60000.0) * (matches[6] === 'S' ? -1 : 1);
            const longitude = (parseInt(matches[7]) + parseInt(matches[8]) / 60000.0) * (matches[9] === 'W' ? -1 : 1);
            const baroAlt = parseInt(matches[11]);
            const gpsAlt = parseInt(matches[12]);

            const date = new Date(trackDate);
            date.setUTCHours(hours, mins, secs);
            if (date < trackDate) {
                date.setDate(date.getDate() + 1)
                console.log('Day rollover detected at index ' + tracklog.points.length);
            }
            trackDate = date;

            tracklog.name = filename;
            tracklog.points.push({
                latitude,
                longitude,
                altitude: gpsAlt,
                time: date.getTime()
            });
        }
    }

    return tracklog;
}

function toDate(m: string[]): Date {
    var year = 2000 + parseInt(m[4], 10);
    var month = parseInt(m[3], 10);
    var day = parseInt(m[2], 10);
    return new Date(Date.UTC(year, month - 1, day));
}