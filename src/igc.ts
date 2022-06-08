import { Tracklog } from "./tracklog";
import { assertDefined } from "./util";

const kBRecordRegex = /^B(\d{2})(\d{2})(\d{2})(\d{2})(\d{5})([NS])(\d{3})(\d{5})([EW])([AV])(-\d{4}|\d{5})(-\d{4}|\d{5})/;

export function parseIGC(text: String) {
    const lines = text.split(/\r\n|\n/);

    const tracklog = new Tracklog();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Desc:    B Time   Latitude Longitude V Baro  Gps    
        // Bytes:   B HHMMSS DDMMmmmN DDDMMmmmW A PPPPP GGGGG
        // Idxs:    0 123456 78901234 567890123 4 56789 01234
        // ------------------------------------------------    
        // Example: B 144820 4247731N 00033427W A 00000 02526

        if (line[0] == 'B') {
            const matches = assertDefined(line.match(kBRecordRegex));

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

    return tracklog;
}