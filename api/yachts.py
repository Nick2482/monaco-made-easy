# Monaco Made Easy: the biggest yachts in Monaco's harbours right now.
# A listener in Supabase (edge function mme-yachts-listen, every 10 minutes) hears the yachts' own public AIS
# signals and remembers them in the mme_yachts table. This reads that table and keeps the answer on Vercel's
# CDN for 10 minutes, so the app makes one quick request.
# Only public AIS broadcast fields: name, length, beam, flag, type and which harbour. Nothing about owners or guests.
from http.server import BaseHTTPRequestHandler
import datetime, json, urllib.parse, urllib.request

SB = "https://oimcxmlewxjtcvrbpzop.supabase.co/rest/v1/mme_yachts"
SB_KEY = "sb_publishable_D1uaOD08d5u6aepRYDXetw_MrLZ2k9r"   # the public (publishable) key: read-only here
WINDOW_H = 3          # heard in the last 3 hours = still here
MIN_LEN = 20          # metres: smaller boats aren't what people come to see


def is_yacht(v):
    t = v.get("ship_type")
    # Leave out fishing, tugs, pilots, police, passenger ferries, cruise ships, cargo and tankers.
    return t is None or t == 0 or t in (36, 37) or 90 <= t <= 99


def load():
    since = (datetime.datetime.utcnow() - datetime.timedelta(hours=WINDOW_H)).strftime("%Y-%m-%dT%H:%M:%SZ")
    q = urllib.parse.urlencode({"select": "name,length,beam,flag,ship_type,place,lat,lng,last_seen", "last_seen": "gte." + since,
                                "order": "length.desc.nullslast", "limit": "200"})
    req = urllib.request.Request(SB + "?" + q, headers={"apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY, "User-Agent": "MonacoMadeEasy/1.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        rows = json.loads(r.read())
    big = [v for v in rows if is_yacht(v) and (v.get("length") or 0) >= MIN_LEN and v.get("name")]
    top = [{"name": v["name"], "length": v["length"], "beam": v.get("beam"), "flag": v.get("flag"), "place": v.get("place"),
            "lat": round(v["lat"], 4) if v.get("lat") is not None else None, "lng": round(v["lng"], 4) if v.get("lng") is not None else None} for v in big[:12]]
    updated = max([v["last_seen"] for v in rows], default=None)
    return {"ok": True, "top": top, "heard": len(rows), "updated": updated}


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
        try:
            self.reply(200, load(), "public, s-maxage=600, stale-while-revalidate=1800")
        except Exception:
            self.reply(502, {"ok": False, "error": "unavailable"}, "no-store")
