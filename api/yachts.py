# Monaco Made Easy: which large yachts are in Monaco's harbours (TEST VERSION).
# Listens to the free aisstream.io AIS feed for up to ~45 seconds over Port Hercule, Fontvieille and the
# anchorage just outside, and returns what it heard, biggest first. Vercel's CDN keeps the answer for 15 minutes.
#
# Settings in Vercel (Settings -> Environment Variables):
#   AISSTREAM_KEY   the free API key from aisstream.io (never put it in the app or in chat)
#
# Only public AIS broadcast fields are kept: name, length, beam, type, flag (from the MMSI) and position.
from http.server import BaseHTTPRequestHandler
import json, os, time

URL = "wss://stream.aisstream.io/v0/stream"
BOX = [[43.722, 7.405], [43.750, 7.445]]           # Cap d'Ail port to Larvotto, incl. the anchorage
LISTEN = 45                                          # seconds

# Where a vessel is: inside one of the harbours, or at anchor offshore.
HARBOURS = {
    "Port Hercule": (43.7325, 7.4185, 43.7385, 7.4265),
    "Port de Fontvieille": (43.7275, 7.4155, 43.7310, 7.4205),
    "Port de Cap d’Ail": (43.7240, 7.4100, 43.7285, 7.4165),
}
MID = {"201": "Albania", "205": "Belgium", "209": "Cyprus", "210": "Cyprus", "212": "Cyprus", "215": "Malta", "229": "Malta", "248": "Malta", "249": "Malta", "256": "Malta",
       "211": "Germany", "218": "Germany", "219": "Denmark", "220": "Denmark", "224": "Spain", "225": "Spain", "226": "France", "227": "France", "228": "France",
       "232": "United Kingdom", "233": "United Kingdom", "234": "United Kingdom", "235": "United Kingdom", "237": "Greece", "239": "Greece", "240": "Greece", "241": "Greece",
       "244": "Netherlands", "245": "Netherlands", "246": "Netherlands", "247": "Italy", "254": "Monaco", "255": "Portugal (Madeira)", "257": "Norway", "258": "Norway", "259": "Norway",
       "261": "Poland", "263": "Portugal", "265": "Sweden", "266": "Sweden", "269": "Switzerland", "271": "Turkey", "308": "Bahamas", "309": "Bahamas", "311": "Bahamas",
       "310": "Bermuda", "319": "Cayman Islands", "338": "United States", "366": "United States", "367": "United States", "368": "United States", "369": "United States",
       "339": "Jamaica", "370": "Panama", "371": "Panama", "372": "Panama", "373": "Panama", "374": "Panama", "375": "St Vincent", "376": "St Vincent", "377": "St Vincent",
       "378": "British Virgin Islands", "538": "Marshall Islands", "636": "Liberia", "637": "Liberia", "235": "United Kingdom", "232": "United Kingdom", "319": "Cayman Islands"}


def where(lat, lng):
    for name, (s, w, n, e) in HARBOURS.items():
        if s <= lat <= n and w <= lng <= e:
            return name
    return "At anchor off Monaco"


def listen(key):
    from websockets.sync.client import connect
    seen = {}
    sub = {"APIKey": key, "BoundingBoxes": [BOX],
           "FilterMessageTypes": ["PositionReport", "ShipStaticData", "StandardClassBPositionReport", "StaticDataReport"]}
    end = time.time() + LISTEN
    msgs = 0
    with connect(URL, open_timeout=10, close_timeout=2) as ws:
        ws.send(json.dumps(sub))
        while time.time() < end:
            try:
                raw = ws.recv(timeout=max(0.5, end - time.time()))
            except TimeoutError:
                break
            m = json.loads(raw)
            if m.get("error"):
                raise RuntimeError("aisstream: " + str(m.get("error"))[:80])
            msgs += 1
            md, kind = m.get("MetaData", {}), m.get("MessageType")
            mmsi = str(md.get("MMSI") or "")
            if not mmsi:
                continue
            v = seen.setdefault(mmsi, {"mmsi": mmsi, "flag": MID.get(mmsi[:3])})
            nm = (md.get("ShipName") or "").strip()
            if nm:
                v["name"] = nm
            if md.get("latitude") is not None:
                v["lat"], v["lng"] = round(md["latitude"], 5), round(md["longitude"], 5)
                v["where"] = where(v["lat"], v["lng"])
            body = m.get("Message", {}).get(kind, {})
            dim, typ = None, None
            if kind == "ShipStaticData":
                dim, typ = body.get("Dimension"), body.get("Type")
                if (body.get("Name") or "").strip():
                    v["name"] = body["Name"].strip()
            elif kind == "StaticDataReport":
                rb = body.get("ReportB") or {}
                if rb.get("Valid"):
                    dim, typ = rb.get("Dimension"), rb.get("ShipType")
                ra = body.get("ReportA") or {}
                if ra.get("Valid") and (ra.get("Name") or "").strip():
                    v["name"] = ra["Name"].strip()
            if dim:
                L, B = (dim.get("A") or 0) + (dim.get("B") or 0), (dim.get("C") or 0) + (dim.get("D") or 0)
                if 0 < L < 500:
                    v["length"] = L
                if 0 < B < 80:
                    v["beam"] = B
            if typ is not None:
                v["type"] = typ
    out = sorted(seen.values(), key=lambda v: -(v.get("length") or 0))
    return out, msgs


class handler(BaseHTTPRequestHandler):
    def reply(self, status, obj, cache):
        data = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", cache)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        key = os.environ.get("AISSTREAM_KEY", "").strip()
        if not key:
            return self.reply(503, {"ok": False, "error": "no-key"}, "no-store")
        t0 = time.time()
        try:
            vessels, msgs = listen(key)
        except Exception as e:
            return self.reply(502, {"ok": False, "error": str(e)[:120] or "unavailable"}, "no-store")
        self.reply(200, {"ok": True, "listened_s": round(time.time() - t0), "messages": msgs, "count": len(vessels),
                         "with_length": sum(1 for v in vessels if v.get("length")), "vessels": vessels},
                   "public, s-maxage=900, stale-while-revalidate=3600")
