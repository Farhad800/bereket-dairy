"""Bereket Dairy acceptance tests (28 Oct 2026) — synthetic data on a FRESH local database only.

Covers the owner's dairy rules end to end, against the real running app:
  - batch recipes, kg / g / pieces, cartons optional, loss (batches × pieces per batch − pieces made);
  - production is refused if ANY ingredient or packaging item is short — nothing saved, every short item named;
  - stock never goes below zero: outputs, sales, corrections and edits of older documents are refused too;
  - same-moment saves can't take the same stock twice; a double-click / retry is applied once;
  - warehouse daily in / out report: opening + in − out = closing, filters by item, section, direction, employee, paper number;
  - FIFO: the oldest batch is used first, each purchase keeps its own price and rate;
  - roles: the warehouse sees quantities only (no prices in pages, reports, CSV, files, or by calling actions);
    the accountant sees money; removed modules (QC, service, machines, molds) are gone.

Run:  bash tests/e2e/reset-dairy-db.sh  →  start the app on :3001 with that database  →  python3 tests/e2e/dairy.py
"""
import os, re, json, subprocess, sys, threading, uuid, http.client, urllib.request
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

B = os.environ.get("BASE", "http://localhost:3001"); DB = os.environ.get("PGDB", "dairy_accept")
TOKEN = os.environ.get("SETUP_TOKEN", "dairy-setup-token-2026"); PW = "DairyTest2026!"
U = urlparse(B); ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
res = []
def ck(n, c, extra=""):
    res.append(bool(c)); print(("PASS " if c else "FAIL ") + n + (f"  [{extra}]" if (extra and not c) else ""), flush=True)
def sql(q): return subprocess.run(["su", "postgres", "-c", f"psql -d {DB} -tA -v ON_ERROR_STOP=1"], input=q, capture_output=True, text=True).stdout.strip()
def T(name): return '"' + name + '"'   # quoted identifier
def num(q): v = sql(q); return float(v) if v else 0.0
def stock(code): return num(f"SELECT COALESCE(SUM(m.qty),0) FROM {T('StockMovement')} m JOIN {T('Product')} p ON p.id=m.{T('productId')} WHERE p.code='{code}'")
def iid(code): return sql(f"SELECT id FROM {T('Product')} WHERE code='{code}'")
def count(table, where="true"): return int(num(f"SELECT count(*) FROM {T(table)} WHERE {where}"))

# ── server actions, addressed through the build's action manifest ───────────
MAN = json.load(open(os.path.join(ROOT, ".next/server/server-reference-manifest.json")))["node"]
ACT = {}
for aid, v in MAN.items():
    workers = v.get("workers", {})
    name = v.get("exportedName") or next(iter(workers.values())).get("exportedName")
    page = next((w for w in workers if "[" not in w), next(iter(workers)))
    path = re.sub(r"/\([^)]*\)", "", "/" + page.removeprefix("app/").removesuffix("/page")) or "/"
    ACT[name] = (aid, path)

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
def together(jobs):
    out = [None] * len(jobs); gate = threading.Barrier(len(jobs))
    def run(i, f): gate.wait(); out[i] = f()
    ts = [threading.Thread(target=run, args=(i, f)) for i, f in enumerate(jobs)]; [t.start() for t in ts]; [t.join() for t in ts]; return out
def get(path, cookie):
    req = urllib.request.Request(B + path, headers={"cookie": cookie})
    try:
        with urllib.request.urlopen(req) as r: return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e: return e.code, e.read().decode("utf-8", "replace")

def make_user(username, full, role):
    h = subprocess.run(["node", "-e", "console.log(require('bcryptjs').hashSync(process.argv[1],10))", PW], capture_output=True, text=True, cwd=ROOT).stdout.strip()
    sql(f"INSERT INTO {T('User')} (id,{T('employeeId')},{T('fullName')},username,{T('passwordHash')},{T('mustChangePassword')},{T('roleId')},{T('updatedAt')}) "
        f"SELECT 'u'||md5(random()::text),'E-{username}','{full}','{username}','{h}',false,id,now() FROM {T('Role')} WHERE name='{role}'")

with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    def login(username):
        ctx = br.new_context(); pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(B + "/login"); pg.fill("input[name=username]", username); pg.fill("input[name=password]", PW); pg.click("button[type=submit]")
        pg.wait_for_url("**/dashboard", wait_until="commit")
        return pg, "; ".join(f"{c['name']}={c['value']}" for c in ctx.cookies())

    # ── 1. first administrator, then one employee per role ────────────────
    A = br.new_page(); A.on("pageerror", lambda e: errs.append(str(e)))
    A.goto(B + "/setup"); A.fill("#token", TOKEN); A.fill("#employeeId", "0001"); A.fill("#fullName", "Dairy Owner"); A.fill("#username", "owner")
    A.fill("#password", PW); A.fill("#confirm", PW); A.click("button[type=submit]"); A.wait_for_url("**/dashboard", wait_until="commit")
    ADMIN = "; ".join(f"{c['name']}={c['value']}" for c in A.context.cookies())
    ck("setup: administrator created; app named Bereket Dairy", "Bereket Dairy" in A.content())
    roles = sql(f"SELECT string_agg(name, ',' ORDER BY name) FROM {T('Role')}")
    ck("roles: Accountant, Administrator, Production, Sales, Warehouse (no QC / service)", roles == "Accountant,Administrator,Production Team,Sales Manager,Warehouse Team", roles)
    for u, f, r in [("prod", "Peter Production", "Production Team"), ("wh", "Walid Warehouse", "Warehouse Team"), ("acc", "Amina Accountant", "Accountant")]: make_user(u, f, r)
    PP, PROD = login("prod"); WP, WH = login("wh"); AP, ACC = login("acc")

    # ── 2. items through the New item form (UI), the rest through the same action ─────
    A.goto(B + "/products/new-item"); A.wait_for_load_state("networkidle")
    A.get_by_label("Name").first.fill("Milk"); A.get_by_label("Code").fill("MILK"); A.get_by_label("Counted in").select_option("kg")
    A.get_by_label("Price", exact=True).fill("650") if A.get_by_label("Price", exact=True).count() else None
    A.get_by_role("button", name="Save item").click(); A.wait_for_url("**created=1", wait_until="commit"); A.wait_for_load_state("networkidle")
    ck("UI: new ingredient Milk (kg) saved", iid("MILK") != "" and sql(f"SELECT unit FROM {T('Product')} WHERE code='MILK'") == "kg")
    for code, name, unit, price in [("SUGAR", "Sugar", "kg", 1200), ("CULT", "Yoghurt culture", "kg", 900000), ("CONT", "500 g container", "pcs", 45),
                                    ("LID", "Lid", "pcs", 15), ("CARTON", "Carton x12", "pcs", 300), ("STRAW", "Strawberry flavour", "kg", 8000)]:
        r = call("createItemAction", {"name": name, "code": code, "unit": unit, "cost": {"price": price, "currency": "IQD"}}, ADMIN)
        if not r.get("ok"): print("  item:", r)
    ck("6 more items created", all(iid(c) for c in ["SUGAR", "CULT", "CONT", "LID", "CARTON", "STRAW"]))
    r = call("createItemAction", {"name": "Lid 2", "unit": "litre"}, ADMIN)
    ck("units are only kg or pieces (litres refused)", not r.get("ok"))

    # ── 3. a product with a batch recipe (the spec's example) ─────────────
    lines = [{"componentId": iid("MILK"), "qty": 10, "per": "BATCH"}, {"componentId": iid("SUGAR"), "qty": 0.5, "per": "BATCH"}, {"componentId": iid("CONT"), "qty": 1, "per": "PIECE"}]
    r = call("createProductAction", {"name": "Yoghurt 500 g", "code": "YOG500", "batchYield": 100, "lines": lines}, ADMIN)
    ck("product YOG500 created (1 batch = 10 kg milk + 0.5 kg sugar; 1 container per piece; 100 pcs per batch)", iid("YOG500") != "", str(r)[:200])
    r = call("createProductAction", {"name": "Bad", "code": "BAD1", "lines": [{"componentId": iid("CARTON"), "qty": 1, "per": "CARTON"}]}, ADMIN)
    ck("items per carton need the pieces per carton first", not r.get("ok") and "carton" in r.get("error", "").lower())
    r = call("createProductAction", {"name": "Bad2", "code": "BAD2", "lines": [{"componentId": iid("YOG500"), "qty": 1, "per": "PIECE"}]}, ADMIN)
    ck("a recipe can't use a finished product", not r.get("ok"))
    r = call("createProductAction", {"name": "Bad3", "code": "BAD3", "lines": [{"componentId": iid("CULT"), "qty": 0.0000001, "per": "BATCH"}]}, ADMIN)
    ck("recipe amounts: at most 1 mg", not r.get("ok"))

    # ── 4. opening stock by the warehouse (Input, no money) ───────────────
    def doc(cookie, typ, items, **kw):
        arg = {"type": typ, "lines": [{"itemId": iid(c), "qty": q, **({"unitPrice": pr} if pr is not None else {})} for c, q, pr in items], **kw}
        return call("saveStockDocAction", arg, cookie)
    r = doc(WH, "INPUT", [("MILK", 50, None), ("SUGAR", 2, None), ("CONT", 80, None)], reason="OPENING", reference="DN-001", party="Opening count")
    ck("warehouse Input (opening stock) saved", r.get("ok"), str(r)[:200])
    ck("stock now milk 50 kg · sugar 2 kg · containers 80", (stock("MILK"), stock("SUGAR"), stock("CONT")) == (50, 2, 80))
    r = doc(WH, "INPUT", [("MILK", 1, None)], reason="DAMAGE")
    ck("an Input can't use an outgoing reason", not r.get("ok"))
    r = doc(WH, "BUY", [("MILK", 1, 650)], customerId="x", currency="IQD")
    ck("warehouse can't make a purchase (no money permission)", not r.get("ok") and "permission" in r.get("error", "").lower())

    # ── 5. STRICT production: the spec's example ──────────────────────────
    def produce(cookie, rows, day=None, sid=None):
        f = {"day": day or sql("SELECT (now() AT TIME ZONE 'Asia/Baghdad')::date::text")}
        for code, b, q in rows: f[f"batches_{iid(code)}"] = b; f[f"qty_{iid(code)}"] = q
        if sid: f["submissionId"] = sid
        return form("saveDailyEntriesAction", f, cookie)
    before = (count("ProductionEntry"), count("StockMovement"))
    r = produce(PROD, [("YOG500", 1, 100)])
    err = r.get("error", "")
    ck("100 pieces refused: only 80 containers", not r.get("ok"), err)
    ck("…the message names the container, available 80 and needed 100", "CONT" in err and "80" in err and "100" in err and "Nothing was saved" in err, err)
    ck("…milk and sugar (enough) are not named", "MILK" not in err and "SUGAR" not in err, err)
    ck("…nothing saved: no entry, no movement; stock unchanged", (count("ProductionEntry"), count("StockMovement")) == before and (stock("MILK"), stock("SUGAR"), stock("CONT"), stock("YOG500")) == (50, 2, 80, 0))
    r = produce(PROD, [("YOG500", 1, 80)])
    ck("80 pieces from 1 batch saved", r.get("ok"), str(r)[:200])
    ck("…milk 40 · sugar 1.5 · containers 0 · yoghurt 80", (stock("MILK"), stock("SUGAR"), stock("CONT"), stock("YOG500")) == (40, 1.5, 0, 80))
    ck("…loss kept: 1 batch expected 100, made 80", sql(f"SELECT {T('expectedPerBatch')}||'|'||batches||'|'||quantity FROM {T('ProductionEntry')}") == "100|1.000|80")
    r = produce(PROD, [("YOG500", 1, 1)])
    ck("containers at zero: refused, named as out of stock", not r.get("ok") and "CONT" in r.get("error", "") and "out of stock" in r.get("error", ""), r.get("error", ""))
    r = produce(PROD, [("YOG500", 0, 5)])
    ck("batches are required (0 refused)", not r.get("ok"))
    r = produce(PROD, [("YOG500", 1.2345, 5)])
    ck("batches: at most 3 decimals", not r.get("ok"))
    r = produce(WH, [("YOG500", 1, 1)])
    ck("warehouse can't enter production", not r.get("ok") and "permission" in r.get("error", "").lower())

    # ── 6. grams, decimal batches and cartons ─────────────────────────────
    doc(WH, "INPUT", [("CONT", 5000, None), ("LID", 5000, None), ("CARTON", 500, None), ("MILK", 2000, None), ("SUGAR", 100, None), ("CULT", 0.01, None)], reason="OPENING")
    lines2 = [{"componentId": iid("MILK"), "qty": 500, "per": "BATCH"}, {"componentId": iid("SUGAR"), "qty": 20, "per": "BATCH"},
              {"componentId": iid("CULT"), "qty": 0.0004, "per": "BATCH"}, {"componentId": iid("CONT"), "qty": 1, "per": "PIECE"},
              {"componentId": iid("LID"), "qty": 1, "per": "PIECE"}, {"componentId": iid("CARTON"), "qty": 1, "per": "CARTON"}]
    r = call("createProductAction", {"name": "Yoghurt 1 kg", "code": "YOG1K", "batchYield": 950, "piecesPerCarton": 12, "lines": lines2}, ADMIN)
    ck("product YOG1K: 0.4 g culture per batch, 12 per carton", iid("YOG1K") != "", str(r)[:200])
    s0 = {c: stock(c) for c in ["MILK", "SUGAR", "CULT", "CONT", "LID", "CARTON"]}
    r = produce(PROD, [("YOG1K", 1.5, 1400)])
    ck("1.5 batches → 1,400 pieces saved", r.get("ok"), str(r)[:200])
    used = {c: round(s0[c] - stock(c), 6) for c in s0}
    ck("used: milk 750 · sugar 30 · culture 0.6 g · 1,400 containers & lids · 117 cartons (rounded up)", used == {"MILK": 750, "SUGAR": 30, "CULT": 0.0006, "CONT": 1400, "LID": 1400, "CARTON": 117}, str(used))
    ck("loss 1.5 × 950 = 1,425 expected − 1,400 = 25", r.get("data", {}).get("lost") == 25, str(r.get("data")))

    # ── 7. one save with two products that together need more than there is ───
    doc(WH, "OUTPUT", [("SUGAR", stock("SUGAR") - 25, None)], reason="COUNT", reference="CNT-1")
    ck("sugar counted down to 25 kg", stock("SUGAR") == 25)
    before = (count("ProductionEntry"), count("StockMovement"))
    r = produce(PROD, [("YOG1K", 1, 900), ("YOG500", 30, 10)])  # 20 + 15 = 35 kg sugar > 25
    ck("two products needing 35 kg sugar together (25 kg there): whole save refused", not r.get("ok") and "SUGAR" in r.get("error", "") and "35" in r.get("error", ""), r.get("error", ""))
    ck("…nothing from either product saved", (count("ProductionEntry"), count("StockMovement")) == before)

    # ── 8. same moment: two people can't take the same stock ──────────────
    # 25 kg sugar: each save of 1 batch YOG1K needs 20 kg → only one can succeed.
    out = together([lambda: produce(PROD, [("YOG1K", 1, 950)]), lambda: produce(PROD, [("YOG1K", 1, 950)])])
    oks = [o.get("ok") for o in out]
    ck("two simultaneous saves needing 20 kg each from 25 kg: exactly one succeeds", sorted(oks) == [False, True], str(out)[:300])
    ck("…sugar never below zero (5 kg left)", stock("SUGAR") == 5)
    # The same submission sent 3 times at once (double-click / retry) is applied once.
    doc(WH, "INPUT", [("SUGAR", 200, None)], reason="RETURN")
    n0 = count("ProductionEntry"); sid = str(uuid.uuid4())
    out = together([lambda: produce(PROD, [("YOG1K", 1, 940)], sid=sid)] * 3)
    ck("same submission ×3 at once: one entry, all three answers OK", count("ProductionEntry") == n0 + 1 and all(o.get("ok") for o in out), str(out)[:200])
    ck("…ingredients taken once (20 kg sugar)", stock("SUGAR") == 185)

    # ── 9. corrections ────────────────────────────────────────────────────
    eid = sql(f"SELECT id FROM {T('ProductionEntry')} WHERE quantity=940")
    y0, c0, l0 = stock("YOG1K"), stock("CONT"), stock("LID")
    r = form("correctEntryAction", {"entryId": eid, "batches": 1, "quantity": 900, "reason": "typing mistake"}, PROD)
    ck("correction 940 → 900 pieces: 40 pieces off, 40 containers / lids given back", r.get("ok") and (stock("YOG1K") - y0, stock("CONT") - c0, stock("LID") - l0) == (-40, 40, 40), str(r)[:200])
    cont = stock("CONT")
    r = form("correctEntryAction", {"entryId": eid, "batches": 1, "quantity": int(900 + cont + 1), "reason": "typing mistake"}, PROD)
    ck("correction up beyond the containers in stock: refused", not r.get("ok") and "CONT" in r.get("error", ""), r.get("error", ""))
    r = form("correctEntryAction", {"entryId": eid, "batches": 1, "quantity": 900, "reason": "no"}, PROD)
    ck("a reason of at least 3 letters is required / nothing changed is refused", not r.get("ok"))

    # ── 10. warehouse outputs, sales and older documents never go below zero ───
    r = doc(WH, "OUTPUT", [("MILK", stock("MILK") + 1, None)], reason="DAMAGE")
    ck("Output of more milk than in stock: refused, nothing saved", not r.get("ok") and "MILK" in r.get("error", ""), r.get("error", ""))
    r = doc(WH, "OUTPUT", [("MILK", 0.5, None)], reason="SAMPLE", party="Lab", reference="S-77")
    ck("Output of 500 g milk (0.5 kg) saved", r.get("ok"))
    r = doc(WH, "OUTPUT", [("CULT", 0.0001, None)], reason="SAMPLE")
    ck("Output of 0.1 g culture (mg precision) saved", r.get("ok") and abs(stock("CULT") - (0.01 - 0.0006 - 0.0004 * 2 - 0.0001)) < 1e-9, str(stock("CULT")))
    r = doc(WH, "OUTPUT", [("CONT", 1.5, None)], reason="DAMAGE")
    ck("pieces must be whole", not r.get("ok"))
    cid = call("createCustomerAction", {"name": "Market One"}, ACC).get("data", {}).get("id")
    r = doc(ACC, "SELL", [("YOG500", 81, 1000)], customerId=cid, currency="IQD")
    ck("sale of 81 yoghurt (80 in stock): refused, product named", not r.get("ok") and "YOG500" in r.get("error", ""), r.get("error", ""))
    r = doc(ACC, "SELL", [("YOG500", 30, 1000)], customerId=cid, currency="IQD")
    ck("sale of 30 saved", r.get("ok"), str(r)[:200])
    # 80 made, 30 sold → 50 left: taking the entry down to 20 would remove 60.
    r = form("correctEntryAction", {"entryId": sql(f"SELECT id FROM {T('ProductionEntry')} WHERE quantity=80"), "batches": 1, "quantity": 20, "reason": "typing mistake"}, PROD)
    ck("production corrected down below what was already sold: refused", not r.get("ok") and "YOG500" in r.get("error", ""), r.get("error", ""))
    # Buy strawberry 10 kg, use it, then try to edit the purchase down to 2 kg.
    r = doc(ACC, "BUY", [("STRAW", 10, 8000)], customerId=cid, currency="IQD"); buy = r.get("data", {}).get("id")
    doc(WH, "OUTPUT", [("STRAW", 6, None)], reason="DAMAGE")
    r = call("saveStockDocAction", {"type": "BUY", "editId": buy, "editReason": "wrong qty", "customerId": cid, "currency": "IQD", "lines": [{"itemId": iid("STRAW"), "qty": 2, "unitPrice": 8000}]}, ACC)
    ck("editing an older purchase down below what was already used: refused", not r.get("ok") and "STRAW" in r.get("error", ""), r.get("error", ""))
    r = call("saveStockDocAction", {"type": "BUY", "editId": buy, "editReason": "wrong qty", "customerId": cid, "currency": "IQD", "lines": [{"itemId": iid("STRAW"), "qty": 7, "unitPrice": 8000}]}, ACC)
    ck("…editing it to 7 kg (6 used) is fine, with the reason in the audit log", r.get("ok") and stock("STRAW") == 1 and count("AuditLog", f"action='stock.edit' AND reason='wrong qty'") == 1, str(r)[:200])
    ck("NO item has ever gone below zero (whole ledger, every point in time)", sql(f"SELECT count(*) FROM (SELECT SUM(qty) OVER (PARTITION BY {T('productId')} ORDER BY {T('createdAt')}, id) r FROM {T('StockMovement')}) x WHERE r < -0.0000001") == "0")

    # ── 11. FIFO: the oldest batch first, each purchase at its own price and rate ───
    doc(ACC, "BUY", [("LID", 1000, 20)], customerId=cid, currency="IQD")
    doc(ACC, "BUY", [("LID", 1000, 0.02)], customerId=cid, currency="USD", rate=1500)  # 30 IQD each
    sp = AP; sp.goto(B + "/products/" + iid("LID")); sp.wait_for_load_state("networkidle"); txt = sp.inner_text("main")
    ck("accountant: LID batches show the IQD purchase (20) and the USD one at its rate (0.02 × 1,500 = 30)", "20" in txt and "30" in txt and "1,500" in txt)

    # ── 12. warehouse daily report: opening + in − out = closing ──────────
    TODAY = sql("SELECT (now() AT TIME ZONE 'Asia/Baghdad')::date::text"); RANGE = f"from={TODAY}&to={TODAY}"
    st, html = get(f"/reports/warehouse-daily?{RANGE}&group=item", WH)
    ck("warehouse opens the daily in/out report", st == 200 and "Opening" in html and "Closing" in html)
    st, csv = get(f"/api/reports/warehouse-daily?{RANGE}&group=item", ACC)
    rows = [r.split(",") for r in csv.strip().split("\r\n")[1:]]
    good = all(abs(float(r[3]) + float(r[4]) - float(r[5]) - float(r[6])) < 1e-6 for r in rows if len(r) >= 7 and r[3].replace(".", "").replace("-", "").isdigit())
    ck("CSV: every item's opening + in − out = closing", st == 200 and good and len(rows) >= 8, csv[:300])
    milk = next((r for r in rows if "MILK" in r[1]), None)
    ck("…milk closing = its stock in the ledger", milk and abs(float(milk[6]) - stock("MILK")) < 1e-6, str(milk))
    st, csv = get(f"/api/reports/warehouse-daily?{RANGE}&group=movement&ref=S-77", ACC)
    ck("filter by paper number S-77: just that one line", st == 200 and len(csv.strip().split("\r\n")) == 2 and "Lab" in csv, csv[:300])
    uid = sql(f"SELECT id FROM {T('User')} WHERE username='wh'")
    st, csv = get(f"/api/reports/warehouse-daily?{RANGE}&group=movement&employee={uid}&direction=OUT", ACC)
    lines_ = csv.strip().split("\r\n")[1:]
    ck("filter employee = warehouse + direction OUT: only their outgoing lines", st == 200 and len(lines_) == count("StockMovement", f"{T('createdById')}='{uid}' AND qty<0"), str(len(lines_)))
    st, csv = get(f"/api/reports/warehouse-daily?{RANGE}&group=item&section=MATERIAL", ACC)
    ck("filter section: ingredients only (no YOG products)", st == 200 and "YOG" not in csv and "MILK" in csv)

    # ── 13. the warehouse never sees money ────────────────────────────────
    for path in ["/inventory?tab=materials", "/inventory?tab=products", f"/products/{iid('MILK')}", f"/products/{iid('YOG1K')}", f"/stock/{buy}",
                 f"/reports/warehouse-daily?{RANGE}&group=movement", "/production", "/dashboard"]:
        st, html = get(path, WH)
        leak = re.search(r"IQD|8,000|8000|\b650\b|900,000|Value \(IQD\)|Cost /", re.sub(r"<script[^>]*>[\s\S]*?</script>", "", html))
        flight = re.search(r'"(cost|costIqd|unitPrice|price|value|total)":\s*[0-9"]', html)
        ck(f"warehouse {path.split('?')[0]}: no prices or values (page and page data)", st == 200 and not leak and not flight, (leak.group(0) if leak else "") + (flight.group(0) if flight else "") + f" {st}")
    st, csv = get(f"/api/reports/warehouse-daily?{RANGE}&group=movement", WH)
    ck("warehouse CSV export of movements has no price columns", st == 200 and ",Price," not in csv and "Amount" not in csv and "8000" not in csv and "MILK" in csv, csv[:200])
    for path in ["/reports/trade", "/api/reports/trade", "/reports/cash", "/cash", "/customers"]:
        st, _ = get(path, WH)
        ck(f"warehouse can't open {path}", st in (403, 404) or "/forbidden" in _ or "Forbidden" in _, str(st))
    r = call("saveItemCostAction", {"id": iid("MILK"), "cost": {"price": 1, "currency": "IQD"}}, WH)
    ck("warehouse can't change a cost by calling the action", not r.get("ok"))
    st, html = get("/notifications", WH)
    ck("warehouse notifications carry no money", "IQD" not in re.sub(r"<script[^>]*>[\s\S]*?</script>", "", html))

    # ── 14. the accountant sees money ─────────────────────────────────────
    st, html = get("/inventory?tab=materials", ACC)
    ck("accountant: warehouse value in IQD", st == 200 and "Stock value" in html and "IQD" in html)
    st, csv = get(f"/api/reports/warehouse-daily?{RANGE}&group=movement", ACC)
    ck("accountant: movement report with price and amount (8,000 × 7 kg strawberry = 56,000)", st == 200 and ",Price," in csv and "Amount" in csv and "56000" in csv, csv[:300])
    st, html = get("/reports/trade", ACC)
    ck("accountant: buying & selling report", st == 200)
    st, html = get("/production", ACC)
    ck("accountant: real cost of each production run", "Real cost" in html)

    # ── 15. removed modules are gone ──────────────────────────────────────
    for path in ["/qc", "/service", "/assets", "/history", "/import", "/qc/entries/x", "/service/requests/new", "/assets/molds/x"]:
        st, _ = get(path, ADMIN)
        ck(f"{path} is gone (404)", st == 404, str(st))
    st, html = get("/dashboard", ADMIN)
    ck("no QC / service / machines / molds in the menu", not re.search(r'href="/(qc|service|assets|history)"', html))

    # ── 16. UI: production sheet, refusal shown on screen; loss on the record ───
    PP.goto(B + "/production/daily"); PP.wait_for_load_state("networkidle")
    row = PP.locator("li", has=PP.get_by_text("YOG1K"))
    row.locator("input[name^=batches_]").fill("100"); row.locator("input[name^=qty_]").fill("95000")
    PP.get_by_role("button", name="Save").click(); PP.get_by_text("Nothing was saved").wait_for(timeout=20000)
    msg = PP.inner_text("main")
    ck("UI: refusal on screen names the short items and says nothing was saved", "Nothing was saved" in msg and "MILK" in msg)
    PP.goto(B + "/production"); PP.wait_for_load_state("networkidle")
    ck("UI: production record shows loss per run and for the day", PP.locator("[data-testid=entry-loss]").count() >= 3 and PP.locator("[data-testid=day-loss]").count() == 1)
    WP.goto(B + "/inventory?tab=products"); WP.wait_for_load_state("networkidle")
    ck("UI: finished products show cartons + loose pieces", "cartons +" in WP.inner_text("main"))
    WP.goto(B + "/inventory?tab=materials"); WP.wait_for_load_state("networkidle")
    ck("UI: grams shown for small kg amounts (culture)", re.search(r"\d g", WP.inner_text("main")) is not None)
    WP.set_viewport_size({"width": 390, "height": 844}); WP.goto(B + "/inventory"); WP.wait_for_load_state("networkidle")
    ck("phone: warehouse page has no sideways scroll", WP.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"))
    AP.goto(B + "/set-locale?l=ar") if False else None
    ck("no browser errors", not errs, "; ".join(errs[:3]))
    br.close()

print(f"\n{sum(res)}/{len(res)} passed")
sys.exit(0 if all(res) else 1)
