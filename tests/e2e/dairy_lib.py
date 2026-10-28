"""Shared helpers for the dairy test suites: SQL on the LOCAL test database, and calling server actions directly
(addressed through the build's action manifest), the way a browser, a double-click or a retry would."""
import os, re, json, subprocess, uuid, http.client
from urllib.parse import urlparse

B = os.environ.get("BASE", "http://localhost:3001"); DB = os.environ.get("PGDB", "dairy_accept")
U = urlparse(B); ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def sql(q): return subprocess.run(["su", "postgres", "-c", f"psql -d {DB} -tA -v ON_ERROR_STOP=1"], input=q, capture_output=True, text=True).stdout.strip()
def T(name): return '"' + name + '"'
def iid(code): return sql(f"SELECT id FROM {T('Product')} WHERE code='{code}'")

MAN = json.load(open(os.path.join(ROOT, ".next/server/server-reference-manifest.json")))["node"]
ACT = {}
for aid, v in MAN.items():
    workers = v.get("workers", {})
    name = v.get("exportedName") or next(iter(workers.values())).get("exportedName")
    page = next((w for w in workers if "[" not in w), next(iter(workers)))
    ACT[name] = (aid, re.sub(r"/\([^)]*\)", "", "/" + page.removeprefix("app/").removesuffix("/page")) or "/")

def post(action, data, ctype, cookie):
    aid, path = ACT[action]
    c = http.client.HTTPConnection(U.hostname, U.port, timeout=120)
    c.request("POST", path, body=data, headers={"content-type": ctype, "accept": "text/x-component", "next-action": aid, "origin": B, "cookie": cookie,
              "next-router-state-tree": "%5B%22%22%2C%7B%7D%2Cnull%2Cnull%2Ctrue%5D"})
    r = c.getresponse(); txt = r.read().decode("utf-8", "replace"); c.close()
    m = re.search(r'^1:(\{.*\})\s*$', txt, re.M)
    try: return json.loads(m.group(1)) if m else {"ok": False, "error": f"HTTP {r.status}: {txt[:200]}"}
    except Exception: return {"ok": False, "error": txt[:300]}

def form(action, fields, cookie):
    """(prev, FormData) actions."""
    b = "----dairy" + uuid.uuid4().hex[:12]; parts = []
    for k, v in list(fields.items()) + [("0", None)]:
        name = "0" if k == "0" else f"_1_{k}"; val = '[null,"$K1"]' if k == "0" else str(v)
        parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{val}\r\n')
    return post(action, ("".join(parts) + f"--{b}--\r\n").encode(), f"multipart/form-data; boundary={b}", cookie)

def call(action, arg, cookie): return post(action, json.dumps([arg]).encode(), "text/plain;charset=UTF-8", cookie)
