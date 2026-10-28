# Bereket Dairy (28 Oct 2026): removes plastic-factory texts and adds the dairy ones in English, Arabic and Turkish.
# Run from the project root: python3 scripts/i18n/dairy.py  (safe to run again)
# Arabic and Turkish are machine-drafted and should be reviewed by a native speaker before go-live.
import json

LANGS = ["en", "ar", "tr"]
D = {l: json.load(open(f"messages/{l}.json", encoding="utf-8")) for l in LANGS}


def put(path, en, ar, tr):
    for l, v in (("en", en), ("ar", ar), ("tr", tr)):
        cur = D[l]
        parts = path.split(".")
        for p in parts[:-1]:
            cur = cur.setdefault(p, {})
        cur[parts[-1]] = v


def drop(path):
    for l in LANGS:
        cur = D[l]
        parts = path.split(".")
        for p in parts[:-1]:
            cur = cur.get(p, {})
        cur.pop(parts[-1], None)


# ───────── removed modules: machines, molds, technical service, maintenance history, QC, plastic import ─────────
for ns in ["sched", "svc", "hist", "qc", "imp", "iw"]:
    drop(ns)
for k in ["machine", "mold", "priority", "maint", "severity", "issue", "entryQc"]:
    drop(f"status.{k}")
for k in ["service", "history", "qc", "assets"]:
    drop(f"nav.{k}")
for k in ["criticalIssues", "machinesDown", "openMaintenance", "notInspected", "rejectedWeek", "openIssues"]:
    drop(f"dashboard.{k}")
for k in ["material", "color", "weightGrams", "cycleTime", "cycleTimeHint", "qcRequired", "qcRequiredHint", "qcRequiredShort", "molds", "machines",
          "machineCode", "machineName", "manufacturer", "model", "tonnage", "newMachine", "openMaintenance", "moldsMounted", "moldCode", "moldName",
          "cavities", "currentMachine", "newMold", "shots", "mold", "labels", "labelsN", "viewLabels", "addLabels", "moldOfProductHint",
          "productNameHint", "allMolds", "noMold", "existingLabels", "noLabelsYet", "pasteLabels", "pasteLabelsHint", "sameForAll", "saveLabels",
          "labelsSaved", "labelsSkipped", "label", "labelHint", "productNameFromLabel", "noLabel", "labelUsedBy", "unitWeight", "unitWeightHint"]:
    drop(f"md.{k}")
for k in ["reported", "pausedMsg", "startedMsg", "resumedMsg", "newBatchMsg", "completedMsg", "start", "reportTitle", "batch", "good", "defective",
          "addQuantity", "pause", "resume", "newBatch", "logDowntime", "logDowntimeHint", "complete", "pauseTitle", "category", "whatHappened",
          "createMaintenance", "machineDown", "breakdownHint", "pauseConfirm", "completeTitle", "completeHint", "completeNote", "correctLink",
          "correctHint", "goodDelta", "defectiveDelta", "deltaHint", "saveCorrection", "ofPlanned", "downtime", "minutes", "plannedWindow",
          "actualWindow", "batches", "noBatches", "qc", "open", "log", "correction", "ongoing", "shiftNow", "todayByMachine", "searchPlaceholder",
          "tab", "cat", "correctQty"]:
    drop(f"prod.{k}")
for k in ["shift", "alreadyShift", "onlyOrdered", "noOrdered", "shortage", "filter"]:
    drop(f"daily.{k}")
for k in ["label", "labelHint", "madeOf", "madeOfHint", "addMaterial", "packaging", "packagingHint", "addPackaging", "gPerPiece", "pcsPerPiece",
          "bagsPerCarton", "pcsPerCarton", "needWeight", "productsInOne", "packExample", "nameNoLabel", "nameWillBe", "nameTyped", "onePerPiece"]:
    drop(f"rc.{k}")
for k in ["whatIsIt", "bagWeight", "bagWeightHint"]:
    drop(f"item.{k}")
for k in ["adjustTitle", "adjustHint", "saveAdjustment", "stockState", "adjustQty", "adjustKind", "nothingAwaiting", "receive", "receipt",
          "newLocation", "locationName", "receiptsCount", "receiveTitle", "received", "receivedQuarantine", "waiting", "willQuarantine", "qtyReceived",
          "location", "overReason", "overHint", "overBlocked", "confirmReceipt", "kind", "productsInStock", "goingOut", "showEmpty", "outSaved",
          "saveOut", "adjustQtyHint", "viewEntry", "receiveMode", "useMode", "receivedSaved", "usedSaved", "receiveRefHint", "useRefHint",
          "saveReceive", "saveUse", "noStickers", "noPackaging", "searchStock", "ledgerNote"]:
    drop(f"wh.{k}")
for k in ["QC_REJECT", "OUT", "ADJUST", "RECEIVE"]:
    drop(f"wh.mv.{k}")
for k in ["stock", "stickers", "packaging"]:
    drop(f"wh.tab.{k}")
for k in ["machine", "mold", "labels", "maintenance", "qc", "service", "masterdata"]:
    drop(f"nt.{k}")
for k in ["out", "adjusted", "stickersIn", "materialsIn", "stickersUsed", "materialsUsed", "shortage", "packagingIn", "packagingUsed"]:
    drop(f"nt.stock.{k}")
for k in ["service", "quality"]:
    drop(f"rep.sec.{k}")
for k in ["maintenance", "mold-changes", "quality", "defects", "corrective", "movements", "stock"]:
    drop(f"rep.r.{k}")
for k in ["machine", "shift", "category", "list"]:
    drop(f"rep.group.{k}")
drop("rep.shift")
for k in ["QcInspection", "QualityIssue", "MaintenanceRequest", "ServiceReport", "PreventiveTask", "Machine", "Mold", "DefectCategory", "Supplier"]:
    drop(f"audit.entity.{k}")
for k in ["job", "batch", "downtime", "maintenance", "qc", "shipment", "machine", "mold", "location", "preventive", "service", "masterdata"]:
    drop(f"history.{k}")
for k in ["batches", "jobs", "machines", "molds", "issues", "inspections", "requests", "serviceReports", "shipments", "receipts"]:
    drop(f"search.kind.{k}")
for k in ["maintenance", "serviceReports", "inspections", "issues"]:
    drop(f"sys.count.{k}")
drop("sys.items.stickers")
drop("sys.itemsImportNow")
for k in ["schedule", "maintenance", "service", "qc", "shipments", "assets"]:
    drop(f"perm.resources.{k}")
for k in ["label", "made", "pack"]:
    drop(f"cost.why.{k}")
drop("md.kind.STICKER"); drop("md.kind.PACKAGING"); drop("md.kindPlural.STICKER"); drop("md.kindPlural.PACKAGING")
drop("sd.willGoMinus"); drop("sd.minusNow")
drop("imp"); drop("iw")

# ───────── names and branding ─────────
put("app.company", "Bereket Dairy", "بركات للألبان", "Bereket Süt")
put("app.system", "Dairy Factory Management System", "نظام إدارة مصنع الألبان", "Süt Fabrikası Yönetim Sistemi")
put("app.welcome", "Welcome to Bereket Dairy Factory Management System", "مرحباً بك في نظام إدارة مصنع بركات للألبان", "Bereket Süt Fabrikası Yönetim Sistemine hoş geldiniz")
put("app.tagline", "Production, warehouse, sales and money — one source of truth.", "الإنتاج والمخزن والمبيعات والأموال — مصدر واحد للحقيقة.", "Üretim, depo, satış ve para — tek doğru kaynak.")
put("install.title", "Add Bereket Dairy to your home screen", "أضف بركات للألبان إلى الشاشة الرئيسية", "Bereket Süt'ü ana ekranınıza ekleyin")
put("offline.body", "Bereket Dairy needs a connection to show live factory data. Reconnect and try again.", "يحتاج نظام بركات للألبان إلى اتصال لعرض بيانات المصنع المباشرة. أعد الاتصال وحاول مرة أخرى.", "Bereket Süt, canlı fabrika verilerini göstermek için bağlantıya ihtiyaç duyar. Yeniden bağlanıp tekrar deneyin.")

# ───────── navigation ─────────
put("nav.production", "Production", "الإنتاج", "Üretim")
put("nav.inventory", "Warehouse", "المخزن", "Depo")
put("nav.products", "Products & Recipes", "المنتجات والوصفات", "Ürünler ve Reçeteler")

# ───────── dashboard ─────────
put("dashboard.producedToday", "Produced today (pcs)", "إنتاج اليوم (قطعة)", "Bugün üretilen (adet)")
put("dashboard.batchesToday", "Batches made today", "الدفعات اليوم", "Bugünkü partiler")
put("dashboard.lossWeekPct", "Loss last 7 days", "الفاقد آخر 7 أيام", "Son 7 gün kayıp")
put("dashboard.stock", "Finished pieces in stock", "القطع الجاهزة في المخزن", "Stoktaki bitmiş ürün (adet)")
put("dashboard.outOfStock", "Recipe items out of stock", "مواد وصفات نفدت من المخزن", "Stokta olmayan reçete kalemleri")

# ───────── products, items and units ─────────
put("md.kind.PRODUCT", "Finished product", "منتج جاهز", "Bitmiş ürün")
put("md.kind.MATERIAL", "Ingredient / production item", "مادة خام / مستلزم إنتاج", "Hammadde / üretim malzemesi")
put("md.kindPlural.PRODUCT", "Finished products", "المنتجات الجاهزة", "Bitmiş ürünler")
put("md.kindPlural.MATERIAL", "Ingredients & production items", "المواد الخام ومستلزمات الإنتاج", "Hammaddeler ve üretim malzemeleri")
put("md.searchProducts", "Product name or code…", "اسم المنتج أو رمزه…", "Ürün adı veya kodu…")
put("md.showingFirst", "Showing the first {n} of {total}. Search to see the rest.", "عرض أول {n} من {total}. ابحث لرؤية الباقي.", "{total} içinden ilk {n} gösteriliyor. Diğerleri için arayın.")
put("md.recipeLink", "Recipe", "الوصفة", "Reçete")
put("md.recipe", "Recipe", "الوصفة", "Reçete")
put("md.noRecipeYet", "No recipe yet", "لا وصفة بعد", "Henüz reçete yok")
put("md.usedBy", "Used in these products' recipes", "مستخدم في وصفات هذه المنتجات", "Bu ürünlerin reçetelerinde kullanılıyor")
put("md.name2", "Second name (Arabic / Turkish / English)", "الاسم الثاني (عربي / تركي / إنجليزي)", "İkinci ad (Arapça / Türkçe / İngilizce)")

put("item.newButton", "New ingredient / item", "مادة / مستلزم جديد", "Yeni hammadde / malzeme")
put("item.newTitle", "New ingredient or production item", "مادة خام أو مستلزم إنتاج جديد", "Yeni hammadde veya üretim malzemesi")
put("item.intro", "Milk, cultures, sugar, flavours, cups, lids, labels, cartons… Type its name, how it is counted (kg or pieces) and its cost.", "حليب، خمائر، سكر، نكهات، علب، أغطية، ملصقات، كراتين… اكتب الاسم وطريقة العدّ (كغم أو قطعة) والكلفة.", "Süt, maya, şeker, aroma, kap, kapak, etiket, koli… Adını, nasıl sayıldığını (kg veya adet) ve maliyetini yazın.")
put("item.unitKg", "Kilograms (kg) — can be typed in grams", "كيلوغرام (كغم) — يمكن الإدخال بالغرام", "Kilogram (kg) — gram olarak da yazılabilir")
put("item.unitHint", "Weights are kept in kg to 1 mg, and can be typed in kg or g everywhere. Pieces are always whole.", "تُحفظ الأوزان بالكيلوغرام حتى 1 ملغم، ويمكن إدخالها بالكغم أو الغرام في كل مكان. القطع دائماً أعداد صحيحة.", "Ağırlıklar 1 mg hassasiyetle kg olarak tutulur ve her yerde kg veya g olarak yazılabilir. Adetler her zaman tam sayıdır.")
put("item.codeAuto", "Automatic if empty", "تلقائي إذا تُرك فارغاً", "Boş bırakılırsa otomatik")
put("item.created", "{code} saved. It is now in the warehouse and can be used in recipes, buying and stock movements.", "تم حفظ {code}. أصبح الآن في المخزن ويمكن استخدامه في الوصفات والشراء وحركات المخزن.", "{code} kaydedildi. Artık depoda ve reçetelerde, alımlarda ve stok hareketlerinde kullanılabilir.")

# ───────── recipe editor ─────────
put("rc.details", "Product", "المنتج", "Ürün")
put("rc.newIntro", "Type the product's name, how many pieces one batch gives, and its recipe: ingredients per batch and packaging per piece / carton.", "اكتب اسم المنتج، وكم قطعة تعطي الدفعة الواحدة، ووصفته: المواد لكل دفعة والتغليف لكل قطعة / كرتونة.", "Ürünün adını, bir partinin kaç adet verdiğini ve reçetesini yazın: parti başına hammaddeler, adet / koli başına ambalaj.")
put("rc.batchYield", "Pieces expected from one batch", "القطع المتوقعة من دفعة واحدة", "Bir partiden beklenen adet")
put("rc.batchYieldHint", "Used to show the loss: expected pieces from the batches minus the pieces produced.", "يُستخدم لإظهار الفاقد: القطع المتوقعة من الدفعات ناقص القطع المنتجة.", "Kaybı göstermek için kullanılır: partilerden beklenen adet eksi üretilen adet.")
put("rc.packedInCartons", "Packed in cartons", "يُعبّأ في كراتين", "Kolilere paketlenir")
put("rc.piecesPerCarton", "Pieces in one carton", "عدد القطع في الكرتونة", "Bir kolideki adet")
put("rc.cartonsOptional", "Optional. Stock is always kept in pieces; cartons are shown next to it (e.g. 12 cartons + 4 pcs).", "اختياري. يُحفظ المخزون دائماً بالقطعة؛ وتُعرض الكراتين بجانبه (مثلاً 12 كرتونة + 4 قطع).", "İsteğe bağlı. Stok her zaman adet olarak tutulur; koliler yanında gösterilir (ör. 12 koli + 4 adet).")
put("rc.noCartons", "Not in cartons", "بدون كراتين", "Kolisiz")
put("rc.batchTitle", "Ingredients per batch", "المواد لكل دفعة", "Parti başına hammaddeler")
put("rc.batchHint", "Milk, sugar, cultures, flavours… the amount in ONE batch, in kg or g (or pieces). Production takes this × the batches made.", "حليب، سكر، خمائر، نكهات… الكمية في دفعة واحدة، بالكغم أو الغرام (أو بالقطعة). يأخذ الإنتاج هذه الكمية × عدد الدفعات.", "Süt, şeker, maya, aroma… BİR partideki miktar, kg veya g (ya da adet). Üretim bunu × yapılan parti sayısı kadar düşer.")
put("rc.addIngredient", "Add ingredient", "إضافة مادة", "Hammadde ekle")
put("rc.pieceTitle", "Packaging per piece", "التغليف لكل قطعة", "Adet başına ambalaj")
put("rc.pieceHint", "Cups, lids, labels… the amount for ONE piece produced. Production takes this × the pieces made.", "علب، أغطية، ملصقات… الكمية لقطعة واحدة منتجة. يأخذ الإنتاج هذه الكمية × عدد القطع.", "Kap, kapak, etiket… üretilen BİR adet için miktar. Üretim bunu × üretilen adet kadar düşer.")
put("rc.addPieceItem", "Add item per piece", "إضافة مادة لكل قطعة", "Adet başına malzeme ekle")
put("rc.cartonTitle", "Per carton", "لكل كرتونة", "Koli başına")
put("rc.cartonHint", "Cartons, tape… the amount for ONE carton packed. A started carton counts as used.", "كراتين، شريط لاصق… الكمية لكرتونة واحدة. الكرتونة المبدوءة تُحسب مستخدمة.", "Koli, bant… paketlenen BİR koli için miktar. Başlanmış koli kullanılmış sayılır.")
put("rc.addCartonItem", "Add item per carton", "إضافة مادة لكل كرتونة", "Koli başına malzeme ekle")
put("rc.perBatch", "per batch", "لكل دفعة", "parti başına")
put("rc.perPiece", "per piece", "لكل قطعة", "adet başına")
put("rc.perCarton", "per carton", "لكل كرتونة", "koli başına")
put("rc.chooseItem", "Choose item…", "اختر المادة…", "Malzeme seçin…")
put("rc.save", "Save recipe", "حفظ الوصفة", "Reçeteyi kaydet")
put("rc.saved", "Saved. From now on production takes these from stock.", "تم الحفظ. من الآن يأخذ الإنتاج هذه المواد من المخزن.", "Kaydedildi. Bundan sonra üretim bunları stoktan düşer.")
put("rc.create", "Create product", "إنشاء المنتج", "Ürünü oluştur")
put("rc.created", "Product created. Production will now take its ingredients and packaging from stock.", "تم إنشاء المنتج. سيأخذ الإنتاج الآن مواده وتغليفه من المخزن.", "Ürün oluşturuldu. Üretim artık hammadde ve ambalajını stoktan düşecek.")
put("rc.preview", "What production will use", "ما سيستخدمه الإنتاج", "Üretimin kullanacağı")
put("rc.previewBatches", "batches", "دفعات", "parti")
put("rc.previewPieces", "pieces", "قطع", "adet")
put("rc.nothingUsed", "Nothing is taken from stock yet — add ingredients or packaging.", "لا يُؤخذ شيء من المخزن بعد — أضف مواد أو تغليفاً.", "Henüz stoktan bir şey düşülmüyor — hammadde veya ambalaj ekleyin.")
put("rc.inStockOnly", "only {n} in stock — production would be refused", "المتوفر {n} فقط — سيُرفض الإنتاج", "stokta yalnızca {n} — üretim reddedilir")
put("rc.previewNote", "Unsaved changes are included in the preview. Production is only saved if every item is in stock.", "التغييرات غير المحفوظة مشمولة في المعاينة. لا يُحفظ الإنتاج إلا إذا توفرت كل المواد في المخزن.", "Kaydedilmemiş değişiklikler önizlemeye dahildir. Üretim yalnızca tüm malzemeler stokta varsa kaydedilir.")
put("rc.cartonsUsed", "{n} cartons", "{n} كرتونة", "{n} koli")

# ───────── production ─────────
put("daily.title", "Production entry", "إدخال الإنتاج", "Üretim girişi")
put("daily.subtitle", "{date} · per product: batches made and pieces produced.", "{date} · لكل منتج: الدفعات المصنوعة والقطع المنتجة.", "{date} · ürün başına: yapılan parti ve üretilen adet.")
put("daily.help", "Type the batches made and the pieces that came out. Ingredients are taken by batches, cups/lids/cartons by pieces. If any item is short, nothing is saved and you are told what is missing.", "اكتب الدفعات المصنوعة والقطع الناتجة. تُؤخذ المواد حسب الدفعات، والعلب/الأغطية/الكراتين حسب القطع. إذا نقصت أي مادة لا يُحفظ شيء ويظهر لك ما هو ناقص.", "Yapılan partileri ve çıkan adetleri yazın. Hammaddeler partiye, kap/kapak/koli adete göre düşülür. Herhangi bir malzeme eksikse hiçbir şey kaydedilmez ve eksikler gösterilir.")
put("daily.batches", "Batches", "الدفعات", "Parti")
put("daily.produced", "Pieces produced", "القطع المنتجة", "Üretilen adet")
put("daily.pcs", "pcs", "قطعة", "adet")
put("daily.perBatch", "{n} pcs per batch", "{n} قطعة لكل دفعة", "parti başına {n} adet")
put("daily.todayAlready", "Already today", "مُدخل اليوم", "Bugün girilen")
put("daily.noRecipe", "No batch recipe yet — add it on the product page first.", "لا توجد وصفة دفعة بعد — أضفها في صفحة المنتج أولاً.", "Henüz parti reçetesi yok — önce ürün sayfasından ekleyin.")
put("daily.expected", "expected {n}", "المتوقع {n}", "beklenen {n}")
put("daily.lost", "lost {n} ({pct}%)", "الفاقد {n} ({pct}%)", "kayıp {n} (%{pct})")
put("daily.over", "{n} more than expected", "{n} أكثر من المتوقع", "beklenenden {n} fazla")
put("daily.notes", "Notes (optional)", "ملاحظات (اختياري)", "Notlar (isteğe bağlı)")
put("daily.summary", "{n} products · {batches} batches · {pcs} pcs", "{n} منتج · {batches} دفعة · {pcs} قطعة", "{n} ürün · {batches} parti · {pcs} adet")
put("daily.saved", "Saved {n} products: {batches} batches, {pcs} pieces. Stock was updated.", "تم حفظ {n} منتج: {batches} دفعة، {pcs} قطعة. تم تحديث المخزن.", "{n} ürün kaydedildi: {batches} parti, {pcs} adet. Stok güncellendi.")
put("daily.savedLoss", "Loss: {lost} pcs.", "الفاقد: {lost} قطعة.", "Kayıp: {lost} adet.")
put("daily.saveAll", "Save", "حفظ", "Kaydet")
put("prod.expected", "Expected from batches", "المتوقع من الدفعات", "Partilerden beklenen")
put("prod.lost", "Lost", "الفاقد", "Kayıp")
put("prod.lostOf", "{lost} of {expected} ({pct}%)", "{lost} من {expected} ({pct}%)", "{expected} içinden {lost} (%{pct})")
put("prod.history", "Production", "الإنتاج", "Üretim")
put("prod.correctHelp", "Stock changes by the difference — refused if there isn't enough stock, or if the pieces have already left the warehouse. Type 0 batches and 0 pieces to delete the entry.", "يتغير المخزون بالفرق — ويُرفض إذا لم يكفِ المخزون أو إذا خرجت القطع من المخزن. اكتب 0 دفعات و0 قطع لحذف الإدخال.", "Stok fark kadar değişir — yeterli stok yoksa veya adetler depodan çıkmışsa reddedilir. Girişi silmek için 0 parti ve 0 adet yazın.")

# ───────── warehouse ─────────
put("wh.tab.products", "Finished products", "المنتجات الجاهزة", "Bitmiş ürünler")
put("wh.tab.materials", "Ingredients & production items", "المواد الخام ومستلزمات الإنتاج", "Hammaddeler ve üretim malzemeleri")
put("wh.tab.movements", "Movements", "الحركات", "Hareketler")
put("wh.readOnlyNote", "Stock on hand. It only changes through stock documents (in, out, buy, sell) and production — and it never goes below zero.", "المخزون الحالي. يتغير فقط عبر مستندات المخزن (إدخال، إخراج، شراء، بيع) والإنتاج — ولا ينزل أبداً تحت الصفر.", "Eldeki stok. Yalnızca stok belgeleri (giriş, çıkış, alım, satış) ve üretimle değişir — ve asla sıfırın altına düşmez.")
put("wh.recordIn", "Record incoming", "تسجيل وارد", "Giriş kaydet")
put("wh.recordOut", "Record outgoing", "تسجيل صادر", "Çıkış kaydet")
put("wh.dailyReport", "Daily in/out report", "تقرير الوارد والصادر اليومي", "Günlük giriş/çıkış raporu")
put("wh.productsN", "Products", "المنتجات", "Ürünler")
put("wh.outOfStock", "Out of stock", "نفد من المخزن", "Stokta yok")
put("wh.noProducts", "No finished products yet. Add them on Products & Recipes.", "لا توجد منتجات جاهزة بعد. أضفها من المنتجات والوصفات.", "Henüz bitmiş ürün yok. Ürünler ve Reçeteler'den ekleyin.")
put("wh.noMaterials", "No ingredients or production items yet. Add them with New ingredient / item.", "لا توجد مواد أو مستلزمات بعد. أضفها من مادة / مستلزم جديد.", "Henüz hammadde veya malzeme yok. Yeni hammadde / malzeme ile ekleyin.")
put("wh.noStock", "No items match.", "لا توجد مواد مطابقة.", "Eşleşen malzeme yok.")
put("wh.cartonSplit", "{c} cartons + {p} pcs", "{c} كرتونة + {p} قطعة", "{c} koli + {p} adet")
put("wh.mv.PRODUCTION", "Produced", "منتج", "Üretildi")
put("wh.mv.USE", "Used by production", "مستخدم في الإنتاج", "Üretimde kullanıldı")
put("wh.mv.INPUT", "In", "وارد", "Giriş")
put("wh.mv.OUTPUT", "Out", "صادر", "Çıkış")
put("wh.moreInReport", "Showing the latest 300. Use the daily in/out report for older ones.", "عرض آخر 300. استخدم تقرير الوارد والصادر اليومي للأقدم.", "Son 300 gösteriliyor. Eskileri için günlük giriş/çıkış raporunu kullanın.")

# ───────── stock documents ─────────
put("sd.reason.OPENING", "Opening stock", "رصيد افتتاحي", "Açılış stoku")
put("sd.reason.RETURN", "Return", "مرتجع", "İade")
put("sd.reason.TRANSFER", "Transfer", "نقل", "Transfer")
put("sd.reason.COUNT", "Count correction", "تصحيح جرد", "Sayım düzeltmesi")
put("sd.reason.DAMAGE", "Damaged", "تالف", "Hasarlı")
put("sd.reason.EXPIRED", "Expired", "منتهي الصلاحية", "Son kullanma tarihi geçmiş")
put("sd.reason.SAMPLE", "Sample", "عينة", "Numune")
put("sd.reason.OTHER", "Other", "أخرى", "Diğer")
put("sd.help.INPUT", "Items coming into the warehouse without money: opening stock, returns, transfers, count corrections.", "مواد تدخل المخزن بدون مال: رصيد افتتاحي، مرتجعات، نقل، تصحيح جرد.", "Depoya parasız giren malzemeler: açılış stoku, iadeler, transferler, sayım düzeltmeleri.")
put("sd.help.OUTPUT", "Items leaving the warehouse without money: damaged, expired, samples, returns to supplier, transfers, count corrections.", "مواد تخرج من المخزن بدون مال: تالف، منتهي الصلاحية، عينات، إرجاع للمورد، نقل، تصحيح جرد.", "Depodan parasız çıkan malzemeler: hasarlı, son kullanma tarihi geçmiş, numune, tedarikçiye iade, transfer, sayım düzeltmesi.")
put("sd.source", "From (supplier / source)", "من (المورد / المصدر)", "Kimden (tedarikçi / kaynak)")
put("sd.destination", "To (destination / recipient)", "إلى (الجهة / المستلم)", "Kime (hedef / alıcı)")
put("sd.reference", "Paper number", "رقم المستند", "Belge numarası")
put("sd.referenceHint", "Delivery note, slip or other document number (optional).", "رقم إشعار التسليم أو الإيصال أو أي مستند (اختياري).", "İrsaliye, fiş veya başka bir belge numarası (isteğe bağlı).")
put("sd.noDoubleIn", "Bought goods are added by the accountant's purchase (Buy) — don't enter them here too.", "البضاعة المشتراة يضيفها المحاسب عبر الشراء — لا تُدخلها هنا أيضاً.", "Satın alınan mallar muhasebecinin alım (Alım) kaydıyla eklenir — burada tekrar girmeyin.")
put("sd.noDoubleOut", "Ingredients and packaging used by production leave automatically with the production entry — don't enter them here too.", "المواد والتغليف المستخدمة في الإنتاج تخرج تلقائياً مع إدخال الإنتاج — لا تُدخلها هنا أيضاً.", "Üretimde kullanılan hammadde ve ambalaj, üretim girişiyle otomatik düşülür — burada tekrar girmeyin.")
put("sd.notEnough", "Not enough stock: only {n} {unit}. This can't be saved.", "المخزون غير كافٍ: المتوفر {n} {unit} فقط. لا يمكن الحفظ.", "Yeterli stok yok: yalnızca {n} {unit}. Kaydedilemez.")
put("sd.papers", "Scanned papers", "المستندات الممسوحة", "Taranan belgeler")

# ───────── costs and batches ─────────
put("cost.productHint", "For a run of B batches giving N pieces: the same amounts production takes from stock — ingredients × batches, packaging × pieces, whole cartons — costed from the oldest batches still in stock (then at the latest cost), in IQD. Losses are inside the cost per piece.", "لدورة من B دفعة تعطي N قطعة: نفس الكميات التي يأخذها الإنتاج من المخزن — المواد × الدفعات، التغليف × القطع، كراتين كاملة — محسوبة من أقدم دفعات المخزن (ثم بآخر كلفة)، بالدينار العراقي. الفاقد داخل كلفة القطعة.", "B partiden N adet veren bir üretim için: üretimin stoktan düştüğü aynı miktarlar — hammadde × parti, ambalaj × adet, tam koliler — stoktaki en eski partilerden (sonra son maliyetle) IQD olarak. Kayıplar adet maliyetinin içindedir.")
put("cost.noRecipe", "This product has no recipe yet, so its cost can't be worked out.", "لا توجد وصفة لهذا المنتج بعد، لذا لا يمكن حساب كلفته.", "Bu ürünün henüz reçetesi yok, bu yüzden maliyeti hesaplanamaz.")
put("cost.why.batch", "per batch", "لكل دفعة", "parti başına")
put("cost.why.piece", "per piece", "لكل قطعة", "adet başına")
put("cost.why.carton", "per carton", "لكل كرتونة", "koli başına")
put("cost.usedRun", "Used in this run", "المستخدم في هذه الدورة", "Bu üretimde kullanılan")
put("cost.runTotal2", "Total for {b} batches → {n} pieces (IQD)", "المجموع لـ {b} دفعة ← {n} قطعة (دينار)", "{b} parti → {n} adet toplamı (IQD)")
put("cost.lastProduction", "Last production run of this product", "آخر دورة إنتاج لهذا المنتج", "Bu ürünün son üretimi")
put("cost.typeQty", "Type any batches and pieces", "اكتب أي عدد دفعات وقطع", "İstediğiniz parti ve adedi yazın")
put("lot.production", "Production {day} · {batches} batches", "إنتاج {day} · {batches} دفعة", "Üretim {day} · {batches} parti")
put("lot.src.SHORT", "Taken with no stock (should never happen)", "مأخوذ بدون مخزون (يجب ألا يحدث)", "Stoksuz alındı (olmamalı)")

# ───────── reports ─────────
put("rep.sec.production", "Production", "الإنتاج", "Üretim")
put("rep.sec.warehouse", "Warehouse", "المخزن", "Depo")
put("rep.group.item", "Per item (opening · in · out · closing)", "لكل مادة (افتتاحي · وارد · صادر · ختامي)", "Malzeme başına (açılış · giriş · çıkış · kapanış)")
put("rep.group.movement", "Every movement", "كل حركة", "Her hareket")
put("rep.r.production.title", "Production & loss", "الإنتاج والفاقد", "Üretim ve kayıp")
put("rep.r.production.desc", "Batches, pieces, expected pieces and loss by day, week, month or product.", "الدفعات والقطع والقطع المتوقعة والفاقد حسب اليوم أو الأسبوع أو الشهر أو المنتج.", "Gün, hafta, ay veya ürüne göre parti, adet, beklenen adet ve kayıp.")
put("rep.r.production-entries.title", "Production runs", "دورات الإنتاج", "Üretim kayıtları")
put("rep.r.production-entries.desc", "Every production entry: batches, pieces, loss and who entered it.", "كل إدخال إنتاج: الدفعات والقطع والفاقد ومن أدخله.", "Her üretim girişi: parti, adet, kayıp ve giren kişi.")
put("rep.r.consumption.title", "What production used", "ما استخدمه الإنتاج", "Üretimin kullandıkları")
put("rep.r.consumption.desc", "Ingredients and packaging taken from stock by production in the period.", "المواد والتغليف التي أخذها الإنتاج من المخزن خلال الفترة.", "Dönemde üretimin stoktan düştüğü hammadde ve ambalaj.")
put("rep.r.warehouse-daily.title", "Warehouse daily in / out", "الوارد والصادر اليومي للمخزن", "Depo günlük giriş / çıkış")
put("rep.r.warehouse-daily.desc", "Opening stock, in, out and closing stock per item — or every movement — by date, item, section, direction, employee and paper number.", "الرصيد الافتتاحي والوارد والصادر والرصيد الختامي لكل مادة — أو كل حركة — حسب التاريخ والمادة والقسم والاتجاه والموظف ورقم المستند.", "Malzeme başına açılış, giriş, çıkış ve kapanış stoku — veya her hareket — tarih, malzeme, bölüm, yön, çalışan ve belge numarasına göre.")
put("rep.col.batches", "Batches", "الدفعات", "Parti")
put("rep.col.expected", "Expected", "المتوقع", "Beklenen")
put("rep.col.lost", "Lost", "الفاقد", "Kayıp")
put("rep.col.lossPct", "Loss", "نسبة الفاقد", "Kayıp oranı")
put("rep.col.item", "Item", "المادة", "Malzeme")
put("rep.col.used", "Used", "المستخدم", "Kullanılan")
put("rep.col.unit", "Unit", "الوحدة", "Birim")
put("rep.col.section", "Section", "القسم", "Bölüm")
put("rep.col.opening", "Opening", "الافتتاحي", "Açılış")
put("rep.col.in", "In", "وارد", "Giriş")
put("rep.col.out", "Out", "صادر", "Çıkış")
put("rep.col.closing", "Closing", "الختامي", "Kapanış")
put("rep.kpi.batches", "Batches", "الدفعات", "Parti")
put("rep.kpi.lostPcs", "Pieces lost", "القطع المفقودة", "Kayıp adet")
put("rep.kpi.lossRate", "Loss rate", "نسبة الفاقد", "Kayıp oranı")
put("rep.kpi.itemsUsed", "Items used", "المواد المستخدمة", "Kullanılan malzeme")
put("rep.kpi.items", "Items", "المواد", "Malzemeler")
put("rep.kpi.itemsWithIn", "Items that came in", "مواد دخلت", "Giriş yapan malzeme")
put("rep.kpi.itemsWithOut", "Items that went out", "مواد خرجت", "Çıkış yapan malzeme")
put("rep.kpi.outOfStockAtEnd", "Out of stock at the end", "نفدت في نهاية الفترة", "Dönem sonunda stokta yok")
put("rep.kpi.inLines", "In lines", "سطور الوارد", "Giriş satırı")
put("rep.kpi.outLines", "Out lines", "سطور الصادر", "Çıkış satırı")
put("rep.f.allSections", "Both sections", "كلا القسمين", "Her iki bölüm")
put("rep.f.allItems", "All items", "كل المواد", "Tüm malzemeler")
put("rep.f.direction", "In / out", "وارد / صادر", "Giriş / çıkış")
put("rep.f.inAndOut", "In and out", "الوارد والصادر", "Giriş ve çıkış")
put("rep.f.employee", "Employee", "الموظف", "Çalışan")
put("rep.f.allEmployees", "All employees", "كل الموظفين", "Tüm çalışanlar")
put("rep.f.typeAndEnter", "Type, then Enter", "اكتب ثم اضغط Enter", "Yazın, sonra Enter")

# ───────── search, audit, admin, notifications ─────────
put("search.hint", "Find any order, product, ingredient, production run, stock document, customer or safe entry.", "ابحث عن أي طلب أو منتج أو مادة أو دورة إنتاج أو مستند مخزن أو زبون أو قيد صندوق.", "Herhangi bir sipariş, ürün, hammadde, üretim, stok belgesi, müşteri veya kasa kaydını bulun.")
put("search.kind.production", "Production runs", "دورات الإنتاج", "Üretim kayıtları")
put("sys.keptList", "employees and their logins, roles and permissions, departments and the audit log. Numbering starts again from 0001.", "الموظفون وحساباتهم، الأدوار والصلاحيات، الأقسام وسجل التدقيق. يبدأ الترقيم من جديد من 0001.", "çalışanlar ve girişleri, roller ve yetkiler, departmanlar ve denetim kaydı. Numaralandırma 0001'den yeniden başlar.")
put("sys.scopeOpsHint", "Orders, production, stock documents and safe entries. Products and items stay.", "الطلبات والإنتاج ومستندات المخزن وقيود الصندوق. تبقى المنتجات والمواد.", "Siparişler, üretim, stok belgeleri ve kasa kayıtları. Ürünler ve malzemeler kalır.")
put("sys.scopeAllHint", "Also deletes {products} products and items, and customers.", "يحذف أيضاً {products} منتج ومادة، والزبائن.", "Ayrıca {products} ürün ve malzemeyi ve müşterileri siler.")
put("sys.count.documents", "Stock documents", "مستندات المخزن", "Stok belgeleri")
put("sys.count.cash", "Safe entries", "قيود الصندوق", "Kasa kayıtları")
put("sys.itemsIntro", "Removes every product and item so the list can be entered again from scratch. Employees and the audit log stay.", "يحذف كل المنتجات والمواد لإدخال القائمة من جديد. يبقى الموظفون وسجل التدقيق.", "Listeyi baştan girebilmek için tüm ürün ve malzemeleri siler. Çalışanlar ve denetim kaydı kalır.")
put("sys.itemsWarning", "This can't be undone.", "لا يمكن التراجع عن هذا.", "Bu geri alınamaz.")
put("sys.itemsDone", "{n} items removed.", "تم حذف {n} مادة.", "{n} malzeme silindi.")
put("sys.items.materials", "Ingredients & items", "المواد والمستلزمات", "Hammadde ve malzemeler")
put("nt.production.saved.body", "{products} products · {batches} batches · {day} · by {by}", "{products} منتج · {batches} دفعة · {day} · بواسطة {by}", "{products} ürün · {batches} parti · {day} · {by} tarafından")
put("nt.production.corrected.body", "{before} → {after} pcs · {day} · {reason} · by {by}", "{before} ← {after} قطعة · {day} · {reason} · بواسطة {by}", "{before} → {after} adet · {day} · {reason} · {by} tarafından")
put("nt.production.deleted.body", "{before} pcs · {day} · {reason} · by {by}", "{before} قطعة · {day} · {reason} · بواسطة {by}", "{before} adet · {day} · {reason} · {by} tarafından")
put("perm.resources.warehouse", "Warehouse (quantities)", "المخزن (الكميات)", "Depo (miktarlar)")
put("perm.resources.products", "Products, items & recipes", "المنتجات والمواد والوصفات", "Ürünler, malzemeler ve reçeteler")

# Any remaining plastic wording.
def walk(o, fix):
    if isinstance(o, dict):
        return {k: walk(v, fix) for k, v in o.items()}
    return fix(o) if isinstance(o, str) else o

FIX = {
    "en": [("Bereket Plastic", "Bereket Dairy"), ("Bereket FMS", "Bereket Dairy")],
    "ar": [("بركات للبلاستيك", "بركات للألبان"), ("بركات بلاستيك", "بركات للألبان"), ("Bereket FMS", "بركات للألبان"), ("Bereket Plastic", "بركات للألبان")],
    "tr": [("Bereket Plastik", "Bereket Süt"), ("Bereket Plastic", "Bereket Süt"), ("Bereket FMS", "Bereket Süt")],
}
for l in LANGS:
    def fix(s, l=l):
        for a, b in FIX[l]:
            s = s.replace(a, b)
        return s
    D[l] = walk(D[l], fix)
    with open(f"messages/{l}.json", "w", encoding="utf-8") as f:
        json.dump(D[l], f, ensure_ascii=False, indent=2)
        f.write("\n")
print("dairy texts written")

# ───────── second pass: leftover plastic wording (28 Oct 2026) ─────────
D = {l: json.load(open(f"messages/{l}.json", encoding="utf-8")) for l in LANGS}
for k in ["allMachines"]: drop(f"rep.f.{k}")
for k in ["defectRate", "defectType", "job", "machine", "machineDown", "mold", "moldInstalled", "moldRemoved", "rejected", "shift", "technician", "outRejected", "qc",
          "request", "serviceReport", "hoursToFix", "preventive", "issues", "critical", "major", "minor", "unresolved", "resolved", "share", "inspections",
          "inspected", "rejectionRate", "actionTaken", "issueStatus", "severity", "issue", "minutes", "moldRemoved", "inProduced", "outShipped", "adjusted", "good"]:
    drop(f"rep.col.{k}")
for k in ["breakdownHours", "defectRate", "downHours", "machineDownRequests", "moldChanges", "rejectedPcs", "rejectionRate", "notInspected", "requests",
          "avgHoursToFix", "changeHours", "avgChangeMinutes", "issues", "critical", "unresolved", "resolvedRate", "actions", "issuesCovered", "issuesResolved",
          "inspections", "inspectedPcs", "outPcs", "stockNow"]:
    drop(f"rep.kpi.{k}")
for k in ["allPriorities", "allSeverities"]: drop(f"rep.f.{k}")
for k in ["receive", "use"]: drop(f"history.stock.{k}")
drop("history.product.bulk_create")
put("common.searchPlaceholder", "Search orders, products, documents…", "ابحث في الطلبات والمنتجات والمستندات…", "Sipariş, ürün, belge ara…")
put("push.askBody", "New orders, production, stock documents and safe entries will pop up even when the app is closed.", "ستظهر الطلبات الجديدة والإنتاج ومستندات المخزن وقيود الصندوق حتى عندما يكون التطبيق مغلقاً.", "Yeni siparişler, üretim, stok belgeleri ve kasa kayıtları uygulama kapalıyken bile görünür.")
put("cash.cat.MAINTENANCE", "Maintenance & spare parts", "صيانة وقطع غيار", "Bakım ve yedek parça")
for l in LANGS:
    with open(f"messages/{l}.json", "w", encoding="utf-8") as f:
        json.dump(D[l], f, ensure_ascii=False, indent=2)
        f.write("\n")
print("second pass written")
