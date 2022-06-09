export class TrackPoint {
    longitude: number; // In decimal degrees
    latitude: number; // In decimal degrees
    altitude: number; // In meters
    time: number; // Milliseconds since the epoch

    // Derived data
    distance: number; // Difference from last point in meters
    elapsed: number; // Difference in seconds from last point
    speed: number; // Km/h
};

export class Tracklog {
    name: String;
    points: TrackPoint[] = [];
    takeoffs: number[] = [];
    landings: number[] = [];
}

// Return the distance (in meters) between two coordinates (in decimal degrees)
function haversineDistance(latA: number, lonA: number, latB: number, lonB: number): number {
    var radius = 6371000; // Earth radius in meters     

    // Convert latitude and longitude to radians
    const deltaLatitude = (latB - latA) * Math.PI / 180;
    const deltaLongitude = (lonB - lonA) * Math.PI / 180;

    const halfChordLength = Math.cos(
        latA * Math.PI / 180) * Math.cos(latB * Math.PI / 180)
        * Math.sin(deltaLongitude / 2) * Math.sin(deltaLongitude / 2)
        + Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2);

    const angularDistance = 2 * Math.atan2(Math.sqrt(halfChordLength), Math.sqrt(1 - halfChordLength));

    return radius * angularDistance;
}

export function computeDerivedPoints(tracklog: Tracklog) {
    if (tracklog.points.length == 0) return;

    for (let i = 1; i < tracklog.points.length; i++) {
        let prevPoint = tracklog.points[i - 1];
        let curPoint = tracklog.points[i];

        curPoint.distance = haversineDistance(prevPoint.latitude, prevPoint.longitude,
            curPoint.latitude, curPoint.longitude);

        const timeDeltaMs = curPoint.time - prevPoint.time;
        curPoint.elapsed = timeDeltaMs / 1000.0;

        const timeDeltaHr = curPoint.elapsed / 60.0 / 60.0;
        const distanceKm = curPoint.distance / 1000.0;
        curPoint.speed = distanceKm / timeDeltaHr;
    }

    tracklog.points = tracklog.points.filter((p, i) =>
        p.speed < 110 &&
        p.distance < 100 &&
        (p.speed - tracklog.points[Math.max(i - 1, 0)].speed) < 40
    );
}

export function findTakeoffs(tracklog: Tracklog): number[] {
    if (tracklog.points.length == 0) return [];

    const takeoffPoints = [];
    for (let i = 1; i < tracklog.points.length; i++) {
        let prevPoint = tracklog.points[i - 1];
        let curPoint = tracklog.points[i];

        // Consider a sample if there is a large change in speed
        const potentialTakeoff = (curPoint.speed - prevPoint.speed > 5);

        if (potentialTakeoff) {
            // When speed averages <2kmh for at least 1 minute or 2 samples, 
            // and then averages >12kmh for more than 30 seconds
            // Compute average speed for previous minute
            const prevAverageSpeed = averageSpeed(tracklog, i, -60, 2);
            const nextAverageSpeed = averageSpeed(tracklog, i, 30, 4);

            if (prevAverageSpeed < 2.0 && nextAverageSpeed > 12.0) {
                takeoffPoints.push(i);
            }
        }
    }

    return takeoffPoints;
}

export function findLandings(tracklog: Tracklog): number[] {
    if (tracklog.points.length == 0) return [];

    const landingPoints = [];
    for (let i = 1; i < tracklog.points.length; i++) {
        let prevPoint = tracklog.points[i - 1];
        let curPoint = tracklog.points[i];

        // Consider a sample if there is a large change in speed
        const potentialLanding = (prevPoint.speed - curPoint.speed > 5);

        if (potentialLanding) {
            // When the previous speed averages >12kmh for more than 30 seconds
            // and then speed averages <5kmh for at least 1 minute or 2 samples,
            const prevAverageSpeed = averageSpeed(tracklog, i, -30, 4);
            const nextAverageSpeed = averageSpeed(tracklog, i, 60, 2);

            if (prevAverageSpeed > 12.0 && nextAverageSpeed < 5.0) {
                landingPoints.push(i);
            }
        }
    }

    return landingPoints;
}

export function debugLanding(tracklog: Tracklog, i: number) {
    const nearby = tracklog.points.slice(i - 16, i + 16);
    console.log(tracklog);
    console.log(nearby.map(({ latitude, longitude, altitude, ...keep }) => Object.assign({}, keep, { time: new Date(keep.time) })));

    // When the previous speed averages >12kmh for more than 30 seconds
    // and then speed averages <5kmh for at least 1 minute or 2 samples,
    const prevAverageSpeed = averageSpeed(tracklog, i, -30, 4);
    const nextAverageSpeed = averageSpeed(tracklog, i, 60, 2);

    console.log(prevAverageSpeed, nextAverageSpeed);
}

function averageSpeed(tracklog: Tracklog, startIdx: number, durationSec: number, minSamples: number = 2) {
    let i = startIdx;

    let elapsedTotal = 0;
    let sampleCount = 0;
    let samples = [];

    while (elapsedTotal < Math.abs(durationSec) || sampleCount < minSamples) {
        i += (durationSec < 0 ? -1 : 1);
        if (i < 0 || i >= tracklog.points.length) break;

        const point = tracklog.points[i];

        samples[sampleCount++] = {
            speed: point.speed,
            elapsed: point.elapsed
        };

        elapsedTotal += point.elapsed;
    }

    let averageSpeed = 0;
    for (let i = 0; i < sampleCount; i++) {
        const weight = samples[i].elapsed / elapsedTotal;
        averageSpeed += samples[i].speed * weight;
    }

    return averageSpeed;
}