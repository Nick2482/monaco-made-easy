# Monaco Made Easy: live ZOU! bus times for the hills above Monaco (La Turbie, Èze).
# Région Sud publishes real-time predictions for its ZOU! buses (GTFS-RT, Licence Ouverte 2.0).
# This function fetches that feed, keeps only the stops the app shows, and returns
# [trip_id, stop_id, predicted time (unix seconds)] for each. The app matches these against the
# timetable bundled in zou.js. Vercel's CDN keeps each answer for 30 seconds.
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
_cache = {"at": 0, "body": None}


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


def parse(feed):
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
                trip, ups, times = None, [], []
                for tf, tw, tv in fields(ev):
                    if tf == 1 and tw == 2:         # TripDescriptor.trip_id = 1
                        for df, dw, dv in fields(tv):
                            if df == 1 and dw == 2:
                                trip = dv.decode("utf-8", "replace")
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
                        if stop in STOPS and at:
                            ups.append([stop, at])
                # Skip broken predictions: every stop at the same time means the feed has no real data for this bus.
                if trip and ups and len(set(times)) > 1:
                    for stop, at in ups:
                        out.append([trip, stop, at])
    return stamp, out


def build():
    req = urllib.request.Request(FEED, headers=UA)
    with urllib.request.urlopen(req, timeout=15) as r:
        stamp, ups = parse(r.read())
    now = stamp or int(time.time())
    ups = [u for u in ups if u[2] > now - 600]   # buses that left more than 10 minutes ago don't matter
    return json.dumps({"t": stamp or int(time.time()), "u": ups}, separators=(",", ":")).encode()


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            if not _cache["body"] or time.time() - _cache["at"] > 20:
                _cache["body"] = build(); _cache["at"] = time.time()
            body = _cache["body"]
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
