# Dairy adaptation — what changed from Bereket Plastic FMS

Bereket Dairy started from a copy of the Bereket Plastic FMS code (commit `93b0bac` of `Farhad800/berecket`, recorded as commit `5ea96c7` here).
The plastic repository, its Vercel project `bereket-fms`, its database and its file store were **not changed**, connected to or migrated.
No real data, passwords or secrets were copied: the dairy database starts empty and all test data is synthetic.

## 1. Removed

| Removed | Notes |
|---|---|
| Machines, molds, mold changes | Models `Machine`, `Mold`; enums `MachineStatus`, `MoldStatus`; menu, pages, reports, search |
| Technical service | `MaintenanceRequest`, `ServiceReport`, `PreventiveTask`, `Priority`, `MaintenanceStatus` |
| Quality control | `QcInspection`, `QualityIssue`, `CorrectiveAction`, `DefectCategory`, `QcDecision`, `Severity`, `IssueStatus`, `EntryQcStatus`; QC stock moves |
| Shifts A/B/C | `Shift` enum; one shift — a production day is the calendar day |
| Plastic item fields | Product `material`, `color`, `weightGrams`, `cycleTimeSec`, `qcRequired`, `moldId`, `labelId`, `unitWeightKg` (nylon bag weight) |
| Labels as a separate kind; raw material / packaging kinds | Now two kinds only (below) |
| Excel import/workbook for items, bulk master data import | `exceljs` dependency removed. Items are added one by one (New ingredient / item). |
| QC and Technical Service roles | Roles are Administrator, Accountant, Sales Manager, Production Team, Warehouse Team |

## 2. Schema changes (dairy database, migration `20261028120000_dairy_init`)

| Model / enum | Change |
|---|---|
| `ItemKind` | `PRODUCT` (finished products, pieces) · `MATERIAL` (ingredients & production items: kg or pieces) — these are the two warehouse sections |
| `Product` | adds `batchYield` (pieces expected from one batch); keeps `piecesPerCarton` (optional — products not packed in cartons leave it empty); `unit` is `pcs` or `kg` only |
| `ComponentBasis` | `BATCH` (per batch: milk, sugar, cultures) · `PIECE` (per piece: cup, lid, label) · `CARTON` (per carton: carton, tape — needs pieces per carton) |
| `ProductComponent.qty` | `Decimal(18,6)` — 0.000001 kg = 1 mg is the smallest amount |
| `ProductionEntry` | `batches Decimal(12,3)` (required, > 0), `quantity Int` (pieces produced), `expectedPerBatch Int?` (the batch yield at the time, so the loss stays correct if the recipe changes later); no `shift`, no `qcStatus` |
| `StockMovement.qty` | `Decimal(18,6)` |
| `StockMoveType` | `PRODUCTION`, `USE`, `INPUT`, `OUTPUT`, `BUY`, `SELL` |
| `StockDoc` | adds `reference` (paper number: delivery note, slip); keeps source/destination party |
| `Attachment` | only on stock documents (scanned papers) |
| Base data (`20261028120100_dairy_base_data`) | main safe (IQD/USD/EUR) and 8 expense categories |

## 3. Production and stock rules

- **Recipe per batch, divided per cup:** ingredients are entered for one batch; packaging per piece; cartons per carton.
- **Production entry:** batches and pieces for each product. Use = batches × ingredients per batch + pieces × items per piece + cartons × items per carton
  (cartons = pieces ÷ pieces per carton, rounded up — a started carton counts).
- **Loss** = batches × pieces per batch − pieces produced (shown live on the sheet, kept on the entry, in the production report).
- **Never below zero, at all times:** production, warehouse Output and Sell are refused when any item would go below zero. The message gives the reason and names each item:
  `Production: not enough stock. Nothing was saved. • CONT Container — needs 100, in stock 80, short 20`.
  A sheet with several products is saved **all or nothing**.
- **Atomic and concurrency-safe:** one transaction per save; item rows locked in a fixed order before the check; movements time-stamped after the lock.
- **Idempotent:** each submission has a key; repeats are answered without saving twice.
- **Edits to older documents** (purchase reduced, production corrected down, sale increased) are checked against the running balance from that document's time on.
- **FIFO and accounting kept:** purchases are lots at their own price and rate; production takes the oldest first; product runs are costed from the lots they used; sales take product lots FIFO.

## 4. Warehouse

- Two sections: **Finished Products** (pieces; cartons + loose pieces when packed in cartons) and **Ingredients & Production Items** (kg shown with g / mg precision, or pieces).
- Daily entries: **Input** reasons — opening stock, return, transfer in, count correction, other. **Output** reasons — return, transfer out, count correction, damage, expired, sample, other. Each has source/destination, paper number, note and scanned papers.
- **Daily in/out report:** per item (opening, in, out, closing) or per movement; filters for date, section, item, direction, employee and paper number; CSV.
- Warehouse staff see quantities only. Accountants (and anyone with `stock:buy`, `stock:sell` or `cash:view`) also see prices and values.

## 5. Design

- Black and white only: the colour palettes are mapped to greys; status is shown by text, icons and weight, errors carry `role="alert"`.
- The logo `public/brand/bereket-dairy-logo.jpg` is a byte-identical copy of the supplied file; app icons are generated from it by `scripts/make-icons.mjs` without changing the artwork.
- Printed receipts are black only. PWA name, manifest and offline page say Bereket Dairy.

## 6. Open questions / follow-ups

1. Arabic and Turkish texts need review by native speakers.
2. The Excel item workbook import was removed. If the factory needs to load a long ingredient list at once, a dairy-specific import can be added.
3. A private Blob store still has to be created for the `bereket-dairy` Vercel project (DEPLOYMENT.md §4).
4. Mark the dairy environment variables as Sensitive; decide how preview deployments get their database (DEPLOYMENT.md §2).
5. Both repositories are public; the plastic repository's `PROGRESS.md` contains an administrator password (SECURITY.md).
6. Should loss above a set percentage notify someone? Not built; easy to add.
7. Expiry dates / lot numbers per ingredient batch are not tracked (FIFO lots are cost lots). Tell us if traceability by lot is required.
