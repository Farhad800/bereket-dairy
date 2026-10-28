# Quick guide for each role

Sign in with your own username. Your first password is temporary — choose your own. On a phone, tap **Install**
(or browser menu → *Add to Home Screen*) to use it like an app. Change language with the globe icon (English, العربية, Türkçe).
Everyone can *see* orders, production, the warehouse and reports; buttons appear only for what your role may do.
Search any number, product or item from the box at the top.

**Units:** ingredients are counted in **kg** (milk is always per kg) or **pieces**. Where kg is used you can type grams instead —
amounts down to 1 mg (0.000001 kg) are kept exactly. Finished products are counted in **pieces**; if a product is packed in cartons, stock is also shown as *cartons + loose pieces*.

**The stock rule:** nothing can take stock below zero. If you try, nothing is saved and the message tells you which item is short:
how much is needed, how much is in stock and how much is missing. Record the missing stock first (Input or Buy), then try again.

## Administrator / Accountant — products and recipes (once per product)

1. **Products & Recipes → New ingredient / item** for each ingredient and production item: milk (kg), sugar (kg), cultures (kg — type grams), cups, lids, labels, cartons (pieces). Leave the code empty for an automatic one.
2. **Products & Recipes → New product** (e.g. *Yoghurt 500 g cup*, *Yoghurt bowl*):
   - **Pieces expected from one batch** — used to show the loss.
   - **Packed in cartons** — tick it and enter *pieces in one carton* if the product goes into cartons; leave it off otherwise.
   - **Ingredients per batch** — e.g. milk 100 kg, sugar 5 kg, culture 20 g.
   - **Packaging per piece** — e.g. 1 cup, 1 lid, 1 label.
   - **Per carton** — e.g. 1 carton (only when packed in cartons).
   - The preview shows what any number of batches and pieces will use and warns if stock isn't enough.
3. A bowl is one product of its own. A recipe can't use a finished product.

## Warehouse Team

**Warehouse** has two sections: *Finished Products* and *Ingredients & Production Items*, plus *Movements*.

- **Record incoming** (Stock Movements → New → **Input**): reason (opening stock, return, transfer in, count correction, other), *From*, **paper number** (delivery note / slip), the items and amounts, a note, and a photo of the paper if you have one. Goods that were **bought** are entered by the accountant as a Buy — don't enter them again.
- **Record outgoing** (→ **Output**): reason (return, transfer out, count correction, damage, expired, sample, other), *To*, paper number, items. Refused if the stock isn't there.
- **Daily in/out report** (Warehouse → *Daily in/out report*, or Reports): for a day or a period, each item's opening, in, out and closing, or every movement. Filter by section, item, direction, employee or paper number. *CSV* downloads it.
- You see quantities only — no prices or values. That is by design.

## Production Team

1. **Production** → today's sheet. For each product you made, enter **Batches** (e.g. 1.5) and **Pieces produced**.
2. The sheet shows the expected pieces and the **loss** as you type (e.g. *expected 1,425 · lost 25 (1.8 %)*).
3. **Save**. The ingredients, packaging and cartons are taken from stock automatically.
   If any item is short, **nothing is saved** — the message lists each missing item. Tell the warehouse or the accountant.
4. Mistake? Open the entry → **Correct**, enter the right batches and pieces and a reason. Stock is given back or taken for the difference.
   A correction is refused if it would take stock below zero (for example, if the pieces were already sold).

There is one shift; the day is the factory's calendar day (Asia/Baghdad time).

## Accountant — purchases, sales, money

- **Buy**: supplier, their invoice number, items, price per unit, currency (IQD, USD, EUR with the rate of the day). Each purchase is a cost lot; production uses the oldest first (FIFO).
- **Sell**: customer, products, prices, discounts; refused if a product is short. Payments, receipts, balances and statements work as before.
- **Warehouse** shows cost per unit and stock value in IQD; **Reports** show the real cost of each production run, buying & selling, and the safe.
- **Safe**: money in/out, exchanges, transfers, expense categories.

## Sales Manager

- **Orders → New order**: type the amount next to each product you need and **Save order**. Production sees it as *In open orders* on the daily sheet.
- **Reports → Demand** shows what is ordered against what is in stock.

## Reports

Production (batches, pieces, loss), production entries, consumption (what production used), orders, demand, warehouse daily in/out, trade and cash.
Money columns appear only for money roles. *CSV* needs the export permission.
