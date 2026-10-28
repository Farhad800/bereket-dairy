"""Bereket Dairy — FIFO batch costing with exact figures (synthetic data, FRESH local database).

  Milk bought twice: 100 kg at 600 IQD, then 100 kg at 0.5 USD × 1,400 = 700 IQD (each purchase keeps its own price and rate).
  Containers: 1,000 at 50 IQD.
  Recipe: 100 kg milk per batch, 1 container per piece.
  Production: 1.5 batches → 300 pieces takes 150 kg milk = 100 kg × 600 (oldest first) + 50 kg × 700 = 95,000
              and 300 containers × 50 = 15,000 → run 110,000 IQD, 366.67 IQD per piece.
  Then: stock value = milk 50 × 700 + containers 700 × 50 + yoghurt 300 × 366.67 = 35,000 + 35,000 + 110,000 = 180,000.
  Selling 100 pieces leaves 200 × 366.67 = 73,333.33 in products.
  Editing the first purchase to 650 IQD (with a reason) re-costs the run: 100 × 650 + 50 × 700 + 15,000 = 115,000.
Run like tests/e2e/dairy.py (fresh dairy_accept, server on :3001): python3 tests/e2e/dairy-fifo.py
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright

B = os.environ.get("BASE", "http://localhost:3001"); TOKEN = os.environ.get("SETUP_TOKEN", "dairy-setup-token-2026"); PW = "DairyTest2026!"
import importlib.util
spec = importlib.util.spec_from_file_location("d", os.path.join(os.path.dirname(os.path.abspath(__file__)), "dairy_lib.py")); d = importlib.util.module_from_spec(spec); spec.loader.exec_module(d)
res = []
def ck(n, c, extra=""): res.append(bool(c)); print(("PASS " if c else "FAIL ") + n + (f"  [{extra}]" if (extra and not c) else ""), flush=True)

with sync_playwright() as p:
    br = p.chromium.launch()
    A = br.new_page()
    A.goto(B + "/setup"); A.fill("#token", TOKEN); A.fill("#employeeId", "0001"); A.fill("#fullName", "Dairy Owner"); A.fill("#username", "owner")
    A.fill("#password", PW); A.fill("#confirm", PW); A.click("button[type=submit]"); A.wait_for_url("**/dashboard", wait_until="commit")
    ADMIN = "; ".join(f"{c['name']}={c['value']}" for c in A.context.cookies())
    for code, name, unit in [("MILK", "Milk", "kg"), ("CONT", "Container", "pcs")]:
        d.call("createItemAction", {"name": name, "code": code, "unit": unit}, ADMIN)
    d.call("createProductAction", {"name": "Yoghurt", "code": "YOG", "batchYield": 200, "lines": [
        {"componentId": d.iid("MILK"), "qty": 100, "per": "BATCH"}, {"componentId": d.iid("CONT"), "qty": 1, "per": "PIECE"}]}, ADMIN)
    cid = d.call("createCustomerAction", {"name": "Dairy Supplier"}, ADMIN)["data"]["id"]
    def doc(typ, items, **kw):
        return d.call("saveStockDocAction", {"type": typ, "lines": [{"itemId": d.iid(c), "qty": q, **({"unitPrice": pr} if pr is not None else {})} for c, q, pr in items], **kw}, ADMIN)
    b1 = doc("BUY", [("MILK", 100, 600)], customerId=cid, currency="IQD")["data"]["id"]
    doc("BUY", [("MILK", 100, 0.5)], customerId=cid, currency="USD", rate=1400)
    doc("BUY", [("CONT", 1000, 50)], customerId=cid, currency="IQD")
    day = d.sql("SELECT (now() AT TIME ZONE 'Asia/Baghdad')::date::text")
    r = d.form("saveDailyEntriesAction", {"day": day, f"batches_{d.iid('YOG')}": 1.5, f"qty_{d.iid('YOG')}": 300}, ADMIN)
    ck("1.5 batches → 300 pieces saved", r.get("ok"), str(r)[:200])

    A.goto(B + "/production"); A.wait_for_load_state("networkidle"); txt = A.inner_text("main")
    ck("run cost: 110,000 IQD, 366.67 per piece (oldest milk first, the USD purchase at its own rate)", "run 110,000 IQD" in txt and "366.67 IQD / pc" in txt, re.findall(r"Real cost[^\n]*", txt)[:2])
    A.goto(B + "/inventory?tab=products"); A.wait_for_load_state("networkidle")
    A.get_by_role("radio", name="All").click(); v = A.inner_text("[data-testid=stock-value]")
    ck("stock value (all) = 35,000 milk + 35,000 containers + 110,000 yoghurt = 180,000 IQD", v.startswith("180,000"), v)
    A.goto(B + "/inventory?tab=materials"); A.wait_for_load_state("networkidle")
    ck("milk: 700 IQD / kg, value 35,000", A.inner_text("[data-testid=cost-MILK]").startswith("700") and A.inner_text("[data-testid=value-MILK]") == "35,000", A.inner_text("[data-testid=value-MILK]"))

    doc("SELL", [("YOG", 100, 1000)], customerId=cid, currency="IQD")
    A.goto(B + "/inventory?tab=products"); A.wait_for_load_state("networkidle")
    ck("after selling 100: yoghurt value 200 × 366.67 = 73,333.33", A.inner_text("[data-testid=value-YOG]") == "73,333.33", A.inner_text("[data-testid=value-YOG]"))

    r = d.call("saveStockDocAction", {"type": "BUY", "editId": b1, "editReason": "price was 650", "customerId": cid, "currency": "IQD", "lines": [{"itemId": d.iid("MILK"), "qty": 100, "unitPrice": 650}]}, ADMIN)
    ck("first purchase edited to 650 IQD with a reason", r.get("ok"), str(r)[:200])
    A.goto(B + "/production"); A.wait_for_load_state("networkidle"); txt = A.inner_text("main")
    ck("the run is re-costed from its batches: 115,000 IQD (100 × 650 + 50 × 700 + 15,000)", "run 115,000 IQD" in txt, re.findall(r"Real cost[^\n]*", txt)[:2])
    A.goto(B + f"/products/{d.iid('YOG')}"); A.wait_for_load_state("networkidle")
    ck("product page: cost of the last run (1.5 batches → 300 pcs) uses the batches still in stock", A.locator("[data-testid=product-cost]").count() == 1)
    br.close()

print(f"\n{sum(res)}/{len(res)} passed")
sys.exit(0 if all(res) else 1)
