# Monaco Made Easy: always-fresh Monaco bus timetable.
# The Compagnie des Autobus de Monaco publishes a new timetable (GTFS) on France's open data portal
# every couple of weeks. This Vercel function fetches the latest one, turns it into the compact format
# the app uses, and lets Vercel's CDN keep the result for half a day. The app falls back to the
# timetable bundled in bus.js if this ever fails.
from http.server import BaseHTTPRequestHandler
import csv, io, json, zipfile, urllib.request, collections

DATASET_API = "https://www.data.gouv.fr/api/1/datasets/gtfs-3/"
FALLBACK_ZIP = "https://www.data.gouv.fr/api/1/datasets/r/2f510784-2957-48e3-b01c-b0e4f9938da7"
UA = {"User-Agent": "MonacoMadeEasy/1.0 (+https://going-going-gone.uk)"}


def get(url, timeout=20):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def latest_zip_url():
    try:
        meta = json.loads(get(DATASET_API))
        res = [r for r in meta.get("resources", [])
               if (r.get("format") or "").lower() in ("gtfs", "zip") or (r.get("url") or "").lower().endswith(".zip")]
        res.sort(key=lambda r: r.get("last_modified") or r.get("created_at") or "", reverse=True)
        if res:
            return res[0]["url"]
    except Exception:
        pass
    return FALLBACK_ZIP


def title(s):
    small = {"de", "des", "du", "la", "le", "les", "et"}
    out = []
    for i, w in enumerate(s.lower().split(" ")):
        out.append("-".join(p if (p in small and i) else p[:1].upper() + p[1:] for p in w.split("-")))
    s = " ".join(out)
    for a, b in (("D'armes", "d'Armes"), ("Ste-", "Sainte-"), ("St-", "Saint-"), ("Iii", "III"), (" Ii", " II"), ("Hopital", "Hôpital"),
                 ("Cimetiere", "Cimetière"), ("Athanee", "Athanée"), ("Honore", "Honoré"), ("Devote", "Dévote"), ("Cremaillere", "Crémaillère"),
                 ("Etats-Unis", "États-Unis"), ("Ier", "1er"), ("C.cial", "Centre Commercial"), ("Mc Bar", "MC Bar"), ("Ciii", "Charles III")):
        s = s.replace(a, b)
    return s


def convert(zf):
    def rows(n):
        with zf.open(n) as f:
            return list(csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig")))
    routes, stops, cal, trips = rows("routes.txt"), rows("stops.txt"), rows("calendar.txt"), rows("trips.txt")
    st = collections.defaultdict(list)
    for r in rows("stop_times.txt"):
        st[r["trip_id"]].append(r)
    shapes = collections.defaultdict(list)
    if "shapes.txt" in zf.namelist():
        for r in rows("shapes.txt"):
            shapes[r["shape_id"]].append((int(r["shape_pt_sequence"]), float(r["shape_pt_lat"]), float(r["shape_pt_lon"])))
    R = [{"id": r["route_id"], "n": r["route_short_name"], "name": r["route_long_name"].replace("  ", " "),
          "c": "#" + (r.get("route_color") or "0b2545"), "t": "#" + (r.get("route_text_color") or "ffffff")} for r in routes]
    ridx = {r["id"]: i for i, r in enumerate(R)}
    S = [[title(s["stop_name"]), round(float(s["stop_lat"]), 6), round(float(s["stop_lon"]), 6)] for s in stops]
    sidx = {s["stop_id"]: i for i, s in enumerate(stops)}
    SV, svidx = [], {}
    for c in cal:
        days = "".join(c[d] for d in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"))
        svidx[c["service_id"]] = len(SV)
        SV.append([days, c["start_date"], c["end_date"]])

    def mins(tm):
        h, m, s = map(int, tm.split(":"))
        return h * 60 + m + (1 if s >= 30 else 0)

    def simplify(pts):
        out = [pts[0]]
        for p in pts[1:]:
            if abs(p[0] - out[-1][0]) + abs(p[1] - out[-1][1]) > 0.00012:
                out.append(p)
        if out[-1] != pts[-1]:
            out.append(pts[-1])
        return out

    P, pidx, SH, shidx = [], {}, [], {}
    for tr in trips:
        if tr["service_id"] not in svidx or tr["route_id"] not in ridx:
            continue
        times = sorted(st[tr["trip_id"]], key=lambda r: int(r["stop_sequence"]))
        if len(times) < 2:
            continue
        seq = tuple(sidx[r["stop_id"]] for r in times)
        key = (tr["route_id"], tr.get("direction_id", ""), seq)
        if key not in pidx:
            sh = tr.get("shape_id", "")
            if sh not in shidx:
                pts = [(p[1], p[2]) for p in sorted(shapes.get(sh, []))]
                shidx[sh] = len(SH)
                SH.append([v for p in simplify(pts) for v in (round(p[0] * 1e6), round(p[1] * 1e6))] if pts else [])
            pidx[key] = len(P)
            P.append({"r": ridx[tr["route_id"]], "d": int(tr.get("direction_id") or 0), "h": title(tr.get("trip_headsign", "")),
                      "s": list(seq), "sh": shidx[sh], "t": []})
        P[pidx[key]]["t"].append([svidx[tr["service_id"]]] + [mins(r["departure_time"]) for r in times])
    for p in P:
        p["t"].sort(key=lambda x: x[1])
    return {"source": "Compagnie des Autobus de Monaco open data (Licence Ouverte 2.0)",
            "valid": [min(s[1] for s in SV), max(s[2] for s in SV)],
            "routes": R, "stops": S, "services": SV, "patterns": P, "shapes": SH}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            data = convert(zipfile.ZipFile(io.BytesIO(get(latest_zip_url(), timeout=40))))
            if not data["patterns"]:
                raise ValueError("empty timetable")
            body = json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            # Phones keep it for an hour; Vercel's CDN for 12 hours, then refreshes in the background.
            self.send_header("Cache-Control", "public, max-age=3600, s-maxage=43200, stale-while-revalidate=604800")
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            body = json.dumps({"error": "timetable unavailable"}).encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
