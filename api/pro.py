# Monaco Made Easy Pro: checks a Stripe payment and hands out an unlock code.
#
# There are no accounts. After paying through the Stripe Payment Link, the buyer comes back to the app with
# the checkout session id. This function asks Stripe whether that session was paid and, if so, returns an
# unlock code made from the session id and a secret (so it can be checked later without a database).
#
# Settings (Vercel > Project > Settings > Environment Variables), never put in the code or in GitHub:
#   STRIPE_SECRET_KEY   a Stripe *restricted* key with only "Checkout Sessions: Read" permission
#   PRO_SECRET          any long random text, used to sign the unlock codes (never change it once sales start)
#   PRO_PAYMENT_LINK    optional: the Payment Link id (plink_...), so only Pro payments unlock Pro
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
    link = os.environ.get("PRO_PAYMENT_LINK", "")
    return not link or s.get("payment_link") == link


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
                         "pro_secret": "missing" if not sec else ("too short" if len(sec) < 16 else "ok")})
