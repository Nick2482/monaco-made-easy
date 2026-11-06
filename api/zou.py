# Monaco Made Easy: live ZOU! bus times for the hills above Monaco (La Turbie, Èze).
# Région Sud publishes real-time predictions for its ZOU! buses (GTFS-RT, Licence Ouverte 2.0).
# This function fetches that feed, keeps only the stops the app shows, and returns
# [trip_id, stop_id, predicted time (unix seconds)] for each. The app matches these against the
# timetable bundled in zou.js. Vercel's CDN keeps each answer for 30 seconds.
# With ?coast=1 it returns the coastal buses 600 and 601 at every stop from Èze to Menton instead,
# as [trip_id, stop_id, time, route_id]: the published timetable is missing most buses towards Nice,
# so the route planner uses these live times for that direction.
from http.server import BaseHTTPRequestHandler
import json, time, urllib.request

FEED = "https://proxy-data.zou.maregionsud.fr/GTFS-RT/GTFS-RT_trips_ZOU_proximite.pb"
UA = {"User-Agent": "MonacoMadeEasy/1.0 (+https://monacomadeeasy.com)"}
# The boarding points in zou.js (Monaco Place d'Armes and Office de Tourisme, La Turbie Mairie,
# Èze Village, Èze-sur-Mer station).
STOPS = {
    "ZOP:01546-9800000", "ZOP:01793-9800000", "ZOP:04434-9800000",
    "ZOP:03864-0615000", "ZOP:03444-0615000",
    "ZOP:00593-0605900", "ZOP:00612-0605900", "ZOP:00653-0605900",
}
# Towns along the coast, by the code at the end of ZOU! stop ids: Monaco, Cap d'Ail, Roquebrune, Menton, Èze.
COAST_TOWNS = ("-9800000", "-0603200", "-0610400", "-0608300", "-0605900")
COAST_ROUTES = {"ZOP:600", "ZOP:601"}
_cache = {}


# ---- A tiny protocol-buffer reader: just the GTFS-RT fields we need. ----
def varint(b, i):
    n = s = 0
    while True:
        c = b[i]; i += 1
        n |= (c & 0x7F) << s
        if c < 0x80:
            return n, i
        s += 7


def fields(b):
    i, end = 0, len(b)
    while i < end:
        key, i = varint(b, i)
        f, w = key >> 3, key & 7
        if w == 0:
            v, i = varint(b, i)
        elif w == 2:
            ln, i = varint(b, i)
            v = b[i:i + ln]; i += ln
        elif w == 1:
            v = b[i:i + 8]; i += 8
        elif w == 5:
            v = b[i:i + 4]; i += 4
        else:
            raise ValueError("bad wire type")
        yield f, w, v


def event_time(b):   # StopTimeEvent: delay = 1, time = 2
    for f, w, v in fields(b):
        if f == 2 and w == 0:
            return v
    return None


def parse(feed, coast=False):
    out, stamp = [], 0
    for f, w, v in fields(feed):
        if f == 1 and w == 2:                       # FeedHeader
            for hf, hw, hv in fields(v):
                if hf == 3 and hw == 0:
                    stamp = hv
        elif f == 2 and w == 2:                     # FeedEntity
            for ef, ew, ev in fields(v):
                if ef != 3 or ew != 2:              # trip_update
                    continue
                trip, route, ups, times = None, None, [], []
                for tf, tw, tv in fields(ev):
                    if tf == 1 and tw == 2:         # TripDescriptor: trip_id = 1, route_id = 5
                        for df, dw, dv in fields(tv):
                            if df == 1 and dw == 2:
                                trip = dv.decode("utf-8", "replace")
                            elif df == 5 and dw == 2:
                                route = dv.decode("utf-8", "replace")
                    elif tf == 2 and tw == 2:       # StopTimeUpdate
                        stop, arr, dep = None, None, None
                        for sf, sw, sv in fields(tv):
                            if sf == 4 and sw == 2:
                                stop = sv.decode("utf-8", "replace")
                            elif sf == 2 and sw == 2:
                                arr = event_time(sv)
                            elif sf == 3 and sw == 2:
                                dep = event_time(sv)
                        at = dep or arr
                        if at:
                            times.append(at)
                        if at and stop and (stop.endswith(COAST_TOWNS) if coast else stop in STOPS):
                            ups.append([stop, at])
                # Skip broken predictions: every stop at the same time means the feed has no real data for this bus.
                if trip and ups and len(set(times)) > 1:
                    if coast:
                        if route and route not in COAST_ROUTES:
                            continue
                        for stop, at in ups:
                            out.append([trip, stop, at, route or ""])
                    else:
                        for stop, at in ups:
                            out.append([trip, stop, at])
    return stamp, out


def build(coast=False):
    req = urllib.request.Request(FEED, headers=UA)
    with urllib.request.urlopen(req, timeout=15) as r:
        stamp, ups = parse(r.read(), coast)
    now = stamp or int(time.time())
    ups = [u for u in ups if u[2] > now - 600]   # buses that left more than 10 minutes ago don't matter
    return json.dumps({"t": stamp or int(time.time()), "u": ups}, separators=(",", ":")).encode()


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            coast = "coast=1" in (self.path or "")
            c = _cache.setdefault(coast, {"at": 0, "body": None})
            if not c["body"] or time.time() - c["at"] > 20:
                c["body"] = build(coast); c["at"] = time.time()
            body = c["body"]
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "public, max-age=20, s-maxage=30, stale-while-revalidate=60")
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)[:200]}).encode())
