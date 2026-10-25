# Monaco Made Easy Pro: checks a Stripe payment and hands out an unlock code.
#
# There are no accounts. After paying through the Stripe Payment Link, the buyer comes back to the app with
# the checkout session id. This function asks Stripe whether that session was paid and, if so, returns an
# unlock code made from the session id and a secret (so it can be checked later without a database).
#
# Settings (Vercel > Project > Settings > Environment Variables), never put in the code or in GitHub:
#   STRIPE_SECRET_KEY   a Stripe *restricted* key with only "Checkout Sessions: Read" permission
#   PRO_SECRET          any long random text, used to sign the unlock codes (never change it once sales start)
#   PRO_PAYMENT_LINK    optional: the Payment Link id(s) (plink_..., comma-separated), so only Pro payments unlock Pro
from http.server import BaseHTTPRequestHandler
import base64, hashlib, hmac, json, os, re, urllib.error, urllib.parse, urllib.request

ALPHA = "ABCDEFGHJKMNPQRSTVWXYZ23456789"  # no 0/O, 1/I/L, U
STRIPE = "https://api.stripe.com/v1/"


def enc(b, n):
    v = int.from_bytes(b, "big")
    out = ""
    for _ in range(n):
        v, r = divmod(v, len(ALPHA))
        out += ALPHA[r]
    return out


def secret():
    s = os.environ.get("PRO_SECRET", "").strip()
    if not s:
        raise RuntimeError("no-pro-secret")
    if len(s) < 16:
        raise RuntimeError("pro-secret-too-short")
    return s.encode()


def sign(r):
    return enc(hmac.new(secret(), ("mme-pro:" + r).encode(), hashlib.sha256).digest(), 6)


def code_for(session_id):
    r = enc(hashlib.sha256(session_id.encode()).digest(), 5)
    return "MME-%s-%s" % (r, sign(r))


def check_code(code):
    c = re.sub(r"[^A-Z0-9]", "", (code or "").upper())
    if c.startswith("MME"):
        c = c[3:]
    if len(c) != 11:
        return None
    r, s = c[:5], c[5:]
    return "MME-%s-%s" % (r, s) if hmac.compare_digest(sign(r), s) else None


def stripe_get(path, params=None):
    key = os.environ.get("STRIPE_SECRET_KEY", "").strip()
    if not key:
        raise RuntimeError("no-stripe-key")
    url = STRIPE + path + ("?" + urllib.parse.urlencode(params) if params else "")
    req = urllib.request.Request(url, headers={
        "Authorization": "Basic " + base64.b64encode((key + ":").encode()).decode(),
        "User-Agent": "MonacoMadeEasy/1.0 (+https://monacomadeeasy.com)"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


def is_pro_payment(s):
    if s.get("payment_status") != "paid":
        return False
    # One or more Payment Link ids, comma-separated (e.g. the old £ link and the new € link).
    links = [x.strip() for x in os.environ.get("PRO_PAYMENT_LINK", "").split(",") if x.strip()]
    return not links or s.get("payment_link") in links


# ---------- Google Play (purchases made inside the Play Store app) ----------
PLAY_PACKAGE = "com.monacomadeeasy.www.twa"
PLAY_SKUS = {"pro_unlock"}
PLAY_API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/%s/purchases/products/%s/tokens/%s"


def b64u(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def play_access_token():
    """OAuth token for the Play Developer API, from the service-account key kept in Vercel (PLAY_SA_KEY)."""
    raw = os.environ.get("PLAY_SA_KEY", "").strip()
    if not raw:
        raise RuntimeError("no-play-key")
    key = json.loads(raw)
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    import time
    now = int(time.time())
    head = b64u(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claim = b64u(json.dumps({"iss": key["client_email"], "scope": "https://www.googleapis.com/auth/androidpublisher",
                             "aud": "https://oauth2.googleapis.com/token", "iat": now, "exp": now + 600}).encode())
    pk = serialization.load_pem_private_key(key["private_key"].encode(), password=None)
    sig = b64u(pk.sign((head + "." + claim).encode(), padding.PKCS1v15(), hashes.SHA256()))
    data = urllib.parse.urlencode({"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": head + "." + claim + "." + sig}).encode()
    with urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=data), timeout=15) as r:
        return json.loads(r.read())["access_token"]


def play_check(sku, token):
    """Checks a Play purchase is real and paid, acknowledges it (or Google refunds it after 3 days), returns the order id."""
    at = play_access_token()
    url = PLAY_API % (PLAY_PACKAGE, urllib.parse.quote(sku), urllib.parse.quote(token, safe=""))
    hdr = {"Authorization": "Bearer " + at, "User-Agent": "MonacoMadeEasy/1.0"}
    with urllib.request.urlopen(urllib.request.Request(url, headers=hdr), timeout=15) as r:
        p = json.loads(r.read())
    if p.get("purchaseState") != 0:      # 0 = purchased, 1 = cancelled, 2 = pending
        return None, p.get("purchaseState")
    if p.get("acknowledgementState") == 0:
        req = urllib.request.Request(url + ":acknowledge", data=b"{}", headers=dict(hdr, **{"Content-Type": "application/json"}), method="POST")
        urllib.request.urlopen(req, timeout=15).read()
    return p.get("orderId") or token, 0


def handle(body):
    action = body.get("action")
    if action == "redeem":
        c = check_code(body.get("code"))
        return (200, {"ok": True, "code": c}) if c else (404, {"ok": False, "error": "bad-code"})
    if action == "claim":
        sid = str(body.get("session") or "")
        if not re.fullmatch(r"cs_(test|live)_[A-Za-z0-9]{10,200}", sid):
            return 400, {"ok": False, "error": "bad-session"}
        secret()  # check the settings before asking Stripe
        try:
            s = stripe_get("checkout/sessions/" + sid)
        except urllib.error.HTTPError as e:
            return 404, {"ok": False, "error": "stripe-%d" % e.code}
        if not is_pro_payment(s):
            return 402, {"ok": False, "error": "not-paid"}
        return 200, {"ok": True, "code": code_for(sid)}
    if action == "restore":
        email = str(body.get("email") or "").strip()
        if not re.fullmatch(r"[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,20}", email):
            return 400, {"ok": False, "error": "bad-email"}
        for e in dict.fromkeys([email, email.lower()]):
            res = stripe_get("checkout/sessions", {"customer_details[email]": e, "status": "complete", "limit": 20})
            for s in res.get("data", []):
                if is_pro_payment(s):
                    return 200, {"ok": True, "code": code_for(s["id"])}
        return 404, {"ok": False, "error": "no-purchase"}
    if action == "play":
        sku, token = str(body.get("sku") or ""), str(body.get("token") or "")
        if sku not in PLAY_SKUS or not re.fullmatch(r"[A-Za-z0-9._\-:]{20,600}", token):
            return 400, {"ok": False, "error": "bad-purchase"}
        secret()
        try:
            order, state = play_check(sku, token)
        except urllib.error.HTTPError as e:
            return 404, {"ok": False, "error": "play-%d" % e.code}
        if not order:
            return 402, {"ok": False, "error": "pending" if state == 2 else "not-paid"}
        return 200, {"ok": True, "code": code_for("play:" + order)}
    return 400, {"ok": False, "error": "bad-action"}


class handler(BaseHTTPRequestHandler):
    def reply(self, status, obj):
        data = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        try:
            n = min(int(self.headers.get("Content-Length") or 0), 4000)
            body = json.loads(self.rfile.read(n) or b"{}")
            if not isinstance(body, dict):
                raise ValueError
        except Exception:
            return self.reply(400, {"ok": False, "error": "bad-request"})
        try:
            status, obj = handle(body)
        except RuntimeError as e:
            status, obj = 503, {"ok": False, "error": str(e) or "not-configured"}
        except Exception:
            status, obj = 502, {"ok": False, "error": "unavailable"}
        self.reply(status, obj)

    def do_GET(self):
        # A quick health check that never shows the values themselves.
        key = os.environ.get("STRIPE_SECRET_KEY", "").strip()
        sec = os.environ.get("PRO_SECRET", "").strip()
        self.reply(405, {"ok": False, "error": "use-post",
                         "stripe_key": "missing" if not key else ("test" if "_test_" in key else "live"),
                         "pro_secret": "missing" if not sec else ("too short" if len(sec) < 16 else "ok"),
                         "play_key": "ok" if os.environ.get("PLAY_SA_KEY", "").strip().startswith("{") else "missing"})
