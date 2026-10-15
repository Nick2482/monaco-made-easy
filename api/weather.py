# Monaco Made Easy: the weather for Monaco, from MET Norway (the Norwegian Meteorological Institute).
#
# Phones ask this function, not MET Norway directly: it identifies the app to MET Norway as their terms ask, trims
# the forecast to the next 24 hours, and Vercel keeps the answer for 30 minutes so MET Norway is asked rarely.
# Data: MET Norway, CC BY 4.0 (credited in the app). No settings needed.
from http.server import BaseHTTPRequestHandler
import json, urllib.request

URL = "https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=43.7375&lon=7.4235&altitude=40"
UA = "MonacoMadeEasy/1.0 (+https://www.monacomadeeasy.com; hello@monacomadeeasy.com)"


def trim(data):
    hours = []
    for ts in data.get("properties", {}).get("timeseries", [])[:30]:
        d = ts.get("data", {})
        now = d.get("instant", {}).get("details", {})
        n1 = d.get("next_1_hours") or d.get("next_6_hours") or {}
        det = n1.get("details", {})
        if "air_temperature" not in now:
            continue
        hours.append({
            "t": ts.get("time"),
            "temp": round(now["air_temperature"]),
            "wind": round(now.get("wind_speed", 0) * 3.6),        # km/h
            "gust": round(now.get("wind_speed_of_gust", 0) * 3.6) if "wind_speed_of_gust" in now else None,
            "sym": n1.get("summary", {}).get("symbol_code"),
            "rain": det.get("precipitation_amount"),
            "pop": det.get("probability_of_precipitation"),
        })
        if len(hours) >= 24:
            break
    return {"ok": True, "updated": data.get("properties", {}).get("meta", {}).get("updated_at"), "hours": hours,
            "credit": "MET Norway"}


class handler(BaseHTTPRequestHandler):
    def reply(self, status, obj, cache):
        body = json.dumps(obj, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", cache)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        try:
            req = urllib.request.Request(URL, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as r:
                out = trim(json.loads(r.read()))
            if not out["hours"]:
                raise ValueError("empty")
            self.reply(200, out, "public, max-age=600, s-maxage=1800, stale-while-revalidate=3600")
        except Exception:
            self.reply(502, {"ok": False, "error": "unavailable"}, "public, s-maxage=120")
