import xmlbuilder from "xmlbuilder";
import { TrackPoint } from "./tracklog";

export function createGpx(waypoints: TrackPoint[]) {
    const gpx = xmlbuilder.create('root').element('gpx', { 'version': '1.1', 'creator': 'igc-detect', });

    for (let i = 0; i < waypoints.length; i++) {
        const point = waypoints[ i ];
        gpx.element('wpt', { 'lat': point.latitude, 'lon': point.longitude })
            .element('name').text( '2018 Takeoff' );
    }

    const xml = gpx.end({ pretty: true });
    return xml;
}