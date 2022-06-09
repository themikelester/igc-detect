import xmlbuilder from "xmlbuilder";
import { Tracklog } from "./tracklog";

export function createGpx(tracklog: Tracklog, takeoffIdxs: number[]) {
    const gpx = xmlbuilder.create('root').element('gpx', { 'version': '1.1', 'creator': 'igc-detect', });

    for (let i = 0; i < takeoffIdxs.length; i++) {
        const point = tracklog.points[takeoffIdxs[i]];
        gpx.element('wpt', { 'lat': point.latitude, 'lon': point.longitude, 'name': '2018 Takeoff' });
    }

    const xml = gpx.end({ pretty: true });
    console.log(xml);
}