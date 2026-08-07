"use client";

import { ChangeEvent, CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";

type Unit = "g" | "ml" | "un";
type PurchaseUnit = Unit | "kg" | "l";
type MeasureKind = "weight" | "volume" | "count";
type ValuesTab = "ingredients" | "update" | "create";
type DetailView = { kind: "base" | "product"; id: string } | { kind: "spending" } | null;
type Ingredient = { id: string; name: string; purchaseQty: number; purchaseUnit: PurchaseUnit; purchaseCost: number; unit: Unit; wastePct: number };
type IngredientLine = { ingredientId: string; quantity: number };
type ComponentLine = { kind: "ingredient" | "base"; itemId: string; quantity: number };
type BaseRecipe = { id: string; name: string; yieldQty: number; unit: Unit; laborHours: number; otherBatchCost: number; recipe: IngredientLine[] };
type Product = {
  id: string; name: string; yield: number; packagingIngredientId: string; laborHours: number; otherBatchCost: number;
  sellingPrice: number; feePct: number; reservePct: number; recipe: ComponentLine[];
};
type Sale = { id: string; date: string; productId: string; quantity: number; unitPrice: number };
type Expense = { id: string; date: string; description: string; category: string; amount: number };
type Settings = { businessName: string; monthlyGoal: number; workDays: number; hourlyRate: number; targetMarkup: number };
type AppData = { ingredients: Ingredient[]; bases: BaseRecipe[]; products: Product[]; sales: Sale[]; expenses: Expense[]; settings: Settings };
type StoredIngredient = Omit<Ingredient, "purchaseUnit"> & { purchaseUnit?: PurchaseUnit };
type StoredProduct = Omit<Product, "recipe" | "packagingIngredientId" | "sellingPrice"> & { packagingIngredientId?: string; packagingPerUnit?: number; sellingPrice?: number; desiredMargin?: number; recipe: Array<ComponentLine | { ingredientId: string; quantity: number }> };
type StoredData = Partial<Omit<AppData, "ingredients" | "products">> & { ingredients?: StoredIngredient[]; products?: StoredProduct[] };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const unitMoney = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const quantityNumber = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const navItems = ["Visão geral", "Valores", "Minhas bases", "Minhas receitas", "Vendas", "Despesas", "Ajustes"];
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const isoDate = (offset = 0) => {
  const date = new Date(); date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const purchaseUnitFactor: Record<PurchaseUnit, number> = { g: 1, kg: 1000, ml: 1, l: 1000, un: 1 };
const purchaseUnitLabel = (unit: PurchaseUnit) => unit === "l" ? "L" : unit;
const canonicalUnitFor = (unit: PurchaseUnit): Unit => unit === "kg" ? "g" : unit === "l" ? "ml" : unit;
const purchaseUnitsFor = (unit: Unit): PurchaseUnit[] => unit === "g" ? ["g", "kg"] : unit === "ml" ? ["ml", "l"] : ["un"];
const measureKindFor = (unit: Unit): MeasureKind => unit === "g" ? "weight" : unit === "ml" ? "volume" : "count";
const toCanonicalQty = (quantity: number, unit: PurchaseUnit) => quantity * purchaseUnitFactor[unit];
const fromCanonicalQty = (quantity: number, unit: PurchaseUnit) => quantity / purchaseUnitFactor[unit];
const normalizedPurchaseUnit = (unit: Unit, purchaseUnit?: PurchaseUnit): PurchaseUnit => purchaseUnit && purchaseUnitsFor(unit).includes(purchaseUnit) ? purchaseUnit : unit;
const formatPurchaseQuantity = (ingredient: Ingredient) => `${quantityNumber.format(fromCanonicalQty(ingredient.purchaseQty, ingredient.purchaseUnit))} ${purchaseUnitLabel(ingredient.purchaseUnit)}`;
const normalizedName = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
const isPackagingIngredient = (ingredient: Ingredient) => ingredient.unit === "un" && normalizedName(ingredient.name).includes("embalagem");

const demoBase: BaseRecipe = {
  id: "brigadeiro-branco", name: "Brigadeiro branco", yieldQty: 900, unit: "g", laborHours: 0.5, otherBatchCost: 1.5,
  recipe: [{ ingredientId: "condensado", quantity: 790 }, { ingredientId: "creme", quantity: 200 }, { ingredientId: "manteiga", quantity: 25 }],
};

const shoppingListIngredients: Ingredient[] = [
  { id: "creme", name: "Creme de leite", purchaseQty: 200, purchaseUnit: "g", purchaseCost: 2.59, unit: "g", wastePct: 1 },
  { id: "morango", name: "Morango", purchaseQty: 665, purchaseUnit: "g", purchaseCost: 24, unit: "g", wastePct: 0 },
  { id: "condensado", name: "Leite condensado", purchaseQty: 395, purchaseUnit: "g", purchaseCost: 5.49, unit: "g", wastePct: 1 },
  { id: "banana", name: "Banana", purchaseQty: 1, purchaseUnit: "un", purchaseCost: 0.75, unit: "un", wastePct: 0 },
  { id: "acucar", name: "Açúcar", purchaseQty: 1000, purchaseUnit: "kg", purchaseCost: 5, unit: "g", wastePct: 0 },
  { id: "doce-leite", name: "Doce de leite", purchaseQty: 400, purchaseUnit: "g", purchaseCost: 14.99, unit: "g", wastePct: 0 },
  { id: "biscoito-canela", name: "Biscoito canela", purchaseQty: 354, purchaseUnit: "g", purchaseCost: 6.59, unit: "g", wastePct: 0 },
  { id: "biscoito-maizena", name: "Biscoito maizena", purchaseQty: 300, purchaseUnit: "g", purchaseCost: 6.49, unit: "g", wastePct: 0 },
  { id: "embalagem", name: "Embalagem", purchaseQty: 25, purchaseUnit: "un", purchaseCost: 32.9, unit: "un", wastePct: 0 },
  { id: "chantilly", name: "Chantilly", purchaseQty: 1000, purchaseUnit: "l", purchaseCost: 26.99, unit: "ml", wastePct: 0 },
  { id: "chocolate-gotas", name: "Chocolate gotas", purchaseQty: 2000, purchaseUnit: "kg", purchaseCost: 64.9, unit: "g", wastePct: 0 },
  { id: "canela-po", name: "Canela pó", purchaseQty: 30, purchaseUnit: "g", purchaseCost: 2.99, unit: "g", wastePct: 0 },
];

const initialData: AppData = {
  settings: { businessName: "Confeitaria da Ana", monthlyGoal: 6000, workDays: 22, hourlyRate: 18, targetMarkup: 2.5 },
  ingredients: [
    { id: "farinha", name: "Farinha de trigo", purchaseQty: 1000, purchaseUnit: "kg", purchaseCost: 6.9, unit: "g", wastePct: 2 },
    { id: "chocolate", name: "Chocolate em pó", purchaseQty: 500, purchaseUnit: "g", purchaseCost: 18.9, unit: "g", wastePct: 1 },
    { id: "leite", name: "Leite integral", purchaseQty: 1000, purchaseUnit: "l", purchaseCost: 5.6, unit: "ml", wastePct: 0 },
    { id: "ovos", name: "Ovos", purchaseQty: 12, purchaseUnit: "un", purchaseCost: 10.8, unit: "un", wastePct: 4 },
    { id: "manteiga", name: "Manteiga", purchaseQty: 200, purchaseUnit: "g", purchaseCost: 12, unit: "g", wastePct: 2 },
    ...shoppingListIngredients,
  ],
  bases: [demoBase],
  products: [
    {
      id: "bolo-chocolate", name: "Bolo de chocolate 2 kg", yield: 1, packagingIngredientId: "embalagem", laborHours: 2,
      otherBatchCost: 4.5, sellingPrice: 132, feePct: 4, reservePct: 3,
      recipe: [
        { kind: "ingredient", itemId: "farinha", quantity: 500 }, { kind: "ingredient", itemId: "chocolate", quantity: 180 },
        { kind: "ingredient", itemId: "leite", quantity: 450 }, { kind: "ingredient", itemId: "ovos", quantity: 5 },
        { kind: "base", itemId: "brigadeiro-branco", quantity: 500 },
      ],
    },
    {
      id: "bolo-pote", name: "Bolo de pote", yield: 12, packagingIngredientId: "embalagem", laborHours: 1.5,
      otherBatchCost: 2, sellingPrice: 12.5, feePct: 4, reservePct: 3,
      recipe: [
        { kind: "ingredient", itemId: "farinha", quantity: 350 }, { kind: "ingredient", itemId: "chocolate", quantity: 120 },
        { kind: "ingredient", itemId: "leite", quantity: 300 }, { kind: "ingredient", itemId: "ovos", quantity: 4 },
        { kind: "base", itemId: "brigadeiro-branco", quantity: 400 },
      ],
    },
  ],
  sales: [],
  expenses: [],
};

const ingredientCost = (ingredient: Ingredient) => {
  const usable = ingredient.purchaseQty * (1 - ingredient.wastePct / 100);
  return usable > 0 ? ingredient.purchaseCost / usable : 0;
};

function baseCost(base: BaseRecipe, ingredients: Ingredient[], hourlyRate: number) {
  const ingredientBatch = base.recipe.reduce((sum, line) => {
    const ingredient = ingredients.find((item) => item.id === line.ingredientId);
    return sum + (ingredient ? ingredientCost(ingredient) * line.quantity : 0);
  }, 0);
  const labor = base.laborHours * hourlyRate;
  const batchTotal = ingredientBatch + labor + base.otherBatchCost;
  return { ingredientBatch, labor, batchTotal, unitCost: batchTotal / Math.max(1, base.yieldQty) };
}

function productCost(product: Product, ingredients: Ingredient[], bases: BaseRecipe[], settings: Settings) {
  const componentBatch = product.recipe.reduce((sum, line) => {
    if (line.kind === "ingredient") {
      const ingredient = ingredients.find((item) => item.id === line.itemId);
      return sum + (ingredient ? ingredientCost(ingredient) * line.quantity : 0);
    }
    const base = bases.find((item) => item.id === line.itemId);
    return sum + (base ? baseCost(base, ingredients, settings.hourlyRate).unitCost * line.quantity : 0);
  }, 0);
  const labor = product.laborHours * settings.hourlyRate;
  const packagingIngredient = ingredients.find((item) => item.id === product.packagingIngredientId);
  const packagingPerUnit = packagingIngredient ? ingredientCost(packagingIngredient) : 0;
  const packagingBatch = packagingPerUnit * Math.max(1, product.yield);
  const batchTotal = componentBatch + packagingBatch + labor + product.otherBatchCost;
  const unitCost = batchTotal / Math.max(1, product.yield);
  const suggestedPrice = unitCost * Math.max(1, settings.targetMarkup);
  const sellingPrice = Math.max(0, product.sellingPrice);
  const actualMarkup = unitCost > 0 && sellingPrice > 0 ? sellingPrice / unitCost : 0;
  const grossProfit = sellingPrice > 0 ? sellingPrice - unitCost : 0;
  const grossMargin = sellingPrice > 0 ? grossProfit / sellingPrice * 100 : 0;
  const netProfit = sellingPrice > 0 ? sellingPrice * (1 - (product.feePct + product.reservePct) / 100) - unitCost : 0;
  return { componentBatch, packagingBatch, packagingPerUnit, labor, batchTotal, unitCost, suggestedPrice, sellingPrice, actualMarkup, grossProfit, grossMargin, netProfit };
}

function normalizeData(raw: StoredData): AppData {
  const ingredients: Ingredient[] = Array.isArray(raw.ingredients) ? raw.ingredients.map((ingredient) => ({
    ...ingredient,
    purchaseUnit: normalizedPurchaseUnit(ingredient.unit, ingredient.purchaseUnit),
  })) : initialData.ingredients;
  const hasDemoIngredients = ingredients.some((item) => item.id === "condensado") && ingredients.some((item) => item.id === "creme") && ingredients.some((item) => item.id === "manteiga");
  const bases = Array.isArray(raw.bases) ? raw.bases : (hasDemoIngredients ? [demoBase] : []);
  const defaultPackagingId = ingredients.find(isPackagingIngredient)?.id ?? "";
  const products: Product[] = Array.isArray(raw.products) ? raw.products.map((product) => ({
    ...product,
    sellingPrice: product.sellingPrice ?? 0,
    packagingIngredientId: product.packagingIngredientId && ingredients.some((item) => item.id === product.packagingIngredientId) ? product.packagingIngredientId : defaultPackagingId,
    recipe: (product.recipe ?? [])
      .map((line) => "kind" in line ? line : ({ kind: "ingredient", itemId: line.ingredientId, quantity: line.quantity } as ComponentLine))
      .filter((line) => line.kind !== "ingredient" || !ingredients.some((item) => item.id === line.itemId && isPackagingIngredient(item))),
  })) : initialData.products;
  return {
    ingredients, bases, products,
    sales: Array.isArray(raw.sales) ? raw.sales : [], expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
    settings: { ...initialData.settings, ...(raw.settings ?? {}), targetMarkup: raw.settings?.targetMarkup ?? initialData.settings.targetMarkup },
  };
}

function mergeShoppingListIngredients(data: AppData): AppData {
  const ingredients = [...data.ingredients];
  shoppingListIngredients.forEach((listed) => {
    const index = ingredients.findIndex((item) => item.id === listed.id || normalizedName(item.name) === normalizedName(listed.name));
    if (index < 0) ingredients.push(listed);
    else ingredients[index] = { ...ingredients[index], purchaseQty: listed.purchaseQty, purchaseUnit: listed.purchaseUnit, purchaseCost: listed.purchaseCost, unit: listed.unit };
  });
  const defaultPackagingId = ingredients.find(isPackagingIngredient)?.id ?? "";
  const products = data.products.map((product) => product.packagingIngredientId ? product : { ...product, packagingIngredientId: defaultPackagingId });
  return { ...data, ingredients, products };
}

function removeDemoTransactions(data: AppData): AppData {
  const demoSaleIds = ["s1", "s2", "s3"];
  const demoExpenseIds = ["e1", "e2", "e3"];
  return {
    ...data,
    sales: data.sales.filter((sale) => !demoSaleIds.includes(sale.id)),
    expenses: data.expenses.filter((expense) => !demoExpenseIds.includes(expense.id)),
  };
}

export default function Home() {
  const [active, setActive] = useState("Visão geral");
  const [data, setData] = useState<AppData>(initialData);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [valuesTab, setValuesTab] = useState<ValuesTab>("ingredients");
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [ingredientUnitFilter, setIngredientUnitFilter] = useState<"all" | Unit>("all");
  const [editingBaseId, setEditingBaseId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [baseFormOpen, setBaseFormOpen] = useState(false);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [detailView, setDetailView] = useState<DetailView>(null);
  const [costForm, setCostForm] = useState({ ingredientId: "condensado", purchaseQty: 395, purchaseUnit: "g" as PurchaseUnit, purchaseCost: 5.49 });
  const [ingredientForm, setIngredientForm] = useState({ name: "", purchaseQty: 1, purchaseUnit: "kg" as PurchaseUnit, purchaseCost: 0, unit: "g" as Unit, wastePct: 0 });
  const [baseForm, setBaseForm] = useState<Omit<BaseRecipe, "id">>({
    name: "", yieldQty: 0, unit: "g", laborHours: 0.5, otherBatchCost: 0,
    recipe: [{ ingredientId: "condensado", quantity: 395 }],
  });
  const [productForm, setProductForm] = useState<Omit<Product, "id">>({
    name: "", yield: 0, packagingIngredientId: "embalagem", laborHours: 1, otherBatchCost: 0,
    sellingPrice: 0, feePct: 4, reservePct: 3, recipe: [{ kind: "base", itemId: "brigadeiro-branco", quantity: 200 }],
  });
  const [saleForm, setSaleForm] = useState({ date: isoDate(), productId: "bolo-chocolate", quantity: 1, unitPrice: 0 });
  const [expenseForm, setExpenseForm] = useState({ date: isoDate(), description: "", category: "Produção", amount: 0 });

  useEffect(() => {
    try {
      const current = localStorage.getItem("doce-lucro-data-v5");
      const version4 = localStorage.getItem("doce-lucro-data-v4");
      const previous = localStorage.getItem("doce-lucro-data-v3") ?? localStorage.getItem("doce-lucro-data-v2") ?? localStorage.getItem("doce-lucro-data-v1");
      if (current) setData(normalizeData(JSON.parse(current)));
      else if (version4) setData(removeDemoTransactions(normalizeData(JSON.parse(version4))));
      else if (previous) setData(removeDemoTransactions(mergeShoppingListIngredients(normalizeData(JSON.parse(previous)))));
    } catch { setNotice("Não foi possível carregar o backup deste aparelho."); }
    finally { setReady(true); }
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem("doce-lucro-data-v5", JSON.stringify(data)); }, [data, ready]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 3200); return () => window.clearTimeout(timer); }, [notice]);
  useEffect(() => {
    if (saleForm.unitPrice > 0) return;
    const product = data.products.find((item) => item.id === saleForm.productId);
    if (product) { const cost = productCost(product, data.ingredients, data.bases, data.settings); setSaleForm((old) => ({ ...old, unitPrice: Number((product.sellingPrice || cost.suggestedPrice).toFixed(2)) })); }
  }, [data, saleForm.productId, saleForm.unitPrice]);

  const currentMonth = isoDate().slice(0, 7);
  const stats = useMemo(() => {
    const sales = data.sales.filter((sale) => sale.date.startsWith(currentMonth));
    const expenses = data.expenses.filter((expense) => expense.date.startsWith(currentMonth));
    const revenue = sales.reduce((sum, sale) => sum + sale.quantity * sale.unitPrice, 0);
    const cogs = sales.reduce((sum, sale) => {
      const product = data.products.find((item) => item.id === sale.productId);
      return sum + (product ? sale.quantity * productCost(product, data.ingredients, data.bases, data.settings).unitCost : 0);
    }, 0);
    const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const profit = revenue - cogs - expenseTotal;
    const progress = Math.min(100, data.settings.monthlyGoal > 0 ? revenue / data.settings.monthlyGoal * 100 : 0);
    const missing = Math.max(0, data.settings.monthlyGoal - revenue);
    const elapsed = Math.min(new Date().getDate(), data.settings.workDays - 1);
    const remainingDays = Math.max(1, data.settings.workDays - elapsed);
    const ranking = data.products.map((product) => {
      const productSales = sales.filter((sale) => sale.productId === product.id);
      const quantity = productSales.reduce((sum, sale) => sum + sale.quantity, 0);
      const productRevenue = productSales.reduce((sum, sale) => sum + sale.quantity * sale.unitPrice, 0);
      const unitCost = productCost(product, data.ingredients, data.bases, data.settings).unitCost;
      return { name: product.name, quantity, profit: productRevenue - quantity * unitCost };
    }).filter((item) => item.quantity > 0).sort((a, b) => b.profit - a.profit);
    return { revenue, cogs, expenseTotal, totalSpend: cogs + expenseTotal, profit, progress, missing, remainingDays, dailyTarget: missing / remainingDays, ranking };
  }, [currentMonth, data]);

  const selectedIngredient = data.ingredients.find((item) => item.id === costForm.ingredientId);
  const filteredIngredients = data.ingredients
    .filter((item) => item.name.toLocaleLowerCase("pt-BR").includes(ingredientSearch.trim().toLocaleLowerCase("pt-BR")))
    .filter((item) => ingredientUnitFilter === "all" || item.unit === ingredientUnitFilter)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const impactedBases = data.bases.filter((base) => base.recipe.some((line) => line.ingredientId === costForm.ingredientId));
  const impactedProducts = data.products.filter((product) => product.recipe.some((line) =>
    (line.kind === "ingredient" && line.itemId === costForm.ingredientId) || (line.kind === "base" && impactedBases.some((base) => base.id === line.itemId))
  ) || product.packagingIngredientId === costForm.ingredientId);
  const packagingIngredients = data.ingredients.filter(isPackagingIngredient);
  const simulatedCanonicalQty = toCanonicalQty(costForm.purchaseQty, costForm.purchaseUnit);
  const simulatedIngredient = selectedIngredient ? { ...selectedIngredient, purchaseQty: simulatedCanonicalQty, purchaseUnit: costForm.purchaseUnit, purchaseCost: costForm.purchaseCost } : undefined;
  const ingredientFormCanonicalQty = toCanonicalQty(ingredientForm.purchaseQty, ingredientForm.purchaseUnit);
  const ingredientPreview: Ingredient = { id: "preview", ...ingredientForm, purchaseQty: ingredientFormCanonicalQty };
  const previewBase: BaseRecipe = { id: "preview-base", ...baseForm };
  const previewBaseCost = baseCost(previewBase, data.ingredients, data.settings.hourlyRate);
  const previewProduct: Product = { id: "preview-product", ...productForm };
  const previewProductCost = productCost(previewProduct, data.ingredients, data.bases, data.settings);
  const dateHeading = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase();
  const flash = (message: string) => setNotice(message);

  function setIngredientMeasure(kind: MeasureKind) {
    if (kind === "weight") return setIngredientForm((old) => ({ ...old, unit: "g", purchaseUnit: "kg" }));
    if (kind === "volume") return setIngredientForm((old) => ({ ...old, unit: "ml", purchaseUnit: "l" }));
    setIngredientForm((old) => ({ ...old, unit: "un", purchaseUnit: "un" }));
  }

  function selectIngredientForUpdate(id: string) {
    const ingredient = data.ingredients.find((item) => item.id === id);
    if (ingredient) setCostForm({ ingredientId: id, purchaseQty: fromCanonicalQty(ingredient.purchaseQty, ingredient.purchaseUnit), purchaseUnit: ingredient.purchaseUnit, purchaseCost: ingredient.purchaseCost });
  }
  function updateIngredientCost(event: FormEvent) {
    event.preventDefault();
    if (!selectedIngredient || costForm.purchaseQty <= 0 || costForm.purchaseCost <= 0) return flash("Informe a quantidade e o novo valor da compra.");
    if (!purchaseUnitsFor(selectedIngredient.unit).includes(costForm.purchaseUnit)) return flash("Escolha uma unidade compatível com este ingrediente.");
    setData((old) => ({ ...old, ingredients: old.ingredients.map((item) => item.id === costForm.ingredientId ? { ...item, purchaseQty: toCanonicalQty(costForm.purchaseQty, costForm.purchaseUnit), purchaseUnit: costForm.purchaseUnit, purchaseCost: costForm.purchaseCost } : item) }));
    flash(`Custo atualizado. ${impactedBases.length} base(s) e ${impactedProducts.length} receita(s) recalculadas.`);
  }
  function addIngredient(event: FormEvent) {
    event.preventDefault();
    if (!ingredientForm.name.trim() || ingredientForm.purchaseQty <= 0 || ingredientForm.purchaseCost <= 0) return flash("Preencha nome, quantidade e valor da compra.");
    const ingredient: Ingredient = { id: uid(), ...ingredientForm, purchaseQty: toCanonicalQty(ingredientForm.purchaseQty, ingredientForm.purchaseUnit), name: ingredientForm.name.trim() };
    setData((old) => ({ ...old, ingredients: [...old.ingredients, ingredient] }));
    setIngredientForm({ name: "", purchaseQty: 1, purchaseUnit: "kg", purchaseCost: 0, unit: "g", wastePct: 0 });
    setCostForm({ ingredientId: ingredient.id, purchaseQty: fromCanonicalQty(ingredient.purchaseQty, ingredient.purchaseUnit), purchaseUnit: ingredient.purchaseUnit, purchaseCost: ingredient.purchaseCost });
    setIngredientSearch("");
    setIngredientUnitFilter("all");
    setValuesTab("ingredients");
    flash("Ingrediente salvo.");
  }
  function resetBaseForm() {
    setEditingBaseId(null);
    setBaseFormOpen(false);
    setBaseForm({ name: "", yieldQty: 0, unit: "g", laborHours: 0.5, otherBatchCost: 0, recipe: [{ ingredientId: data.ingredients[0]?.id ?? "", quantity: 100 }] });
  }
  function openNewBaseForm() {
    resetBaseForm();
    setBaseFormOpen(true);
  }
  function editBase(base: BaseRecipe) {
    const { id: _id, ...editableBase } = base;
    setEditingBaseId(base.id);
    setBaseFormOpen(true);
    setBaseForm({ ...editableBase, recipe: base.recipe.map((line) => ({ ...line })) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function saveBase(event: FormEvent) {
    event.preventDefault();
    if (!baseForm.name.trim() || baseForm.yieldQty <= 0 || baseForm.recipe.some((line) => !line.ingredientId || line.quantity <= 0)) return flash("Informe o nome, os ingredientes e quanto a base rendeu.");
    const base = { id: editingBaseId ?? uid(), ...baseForm, name: baseForm.name.trim() };
    setData((old) => ({ ...old, bases: editingBaseId ? old.bases.map((item) => item.id === editingBaseId ? base : item) : [...old.bases, base] }));
    const wasEditing = Boolean(editingBaseId);
    resetBaseForm();
    flash(wasEditing ? "Base atualizada. As receitas ligadas foram recalculadas." : "Base salva e disponível em Minhas receitas.");
  }
  function resetProductForm() {
    setEditingProductId(null);
    setProductFormOpen(false);
    setProductForm({ name: "", yield: 0, packagingIngredientId: packagingIngredients[0]?.id ?? "", laborHours: 1, otherBatchCost: 0, sellingPrice: 0, feePct: 4, reservePct: 3, recipe: [{ kind: data.bases.length ? "base" : "ingredient", itemId: data.bases[0]?.id ?? data.ingredients[0]?.id ?? "", quantity: 100 }] });
  }
  function openNewProductForm() {
    resetProductForm();
    setProductFormOpen(true);
  }
  function editProduct(product: Product) {
    const { id: _id, ...editableProduct } = product;
    setEditingProductId(product.id);
    setProductFormOpen(true);
    setProductForm({ ...editableProduct, recipe: product.recipe.map((line) => ({ ...line })) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function saveProduct(event: FormEvent) {
    event.preventDefault();
    if (!productForm.name.trim() || productForm.yield <= 0 || productForm.recipe.some((line) => !line.itemId || line.quantity <= 0)) return flash("Informe o produto, os componentes e quantos produtos a receita rendeu.");
    if (!productForm.packagingIngredientId || !packagingIngredients.some((item) => item.id === productForm.packagingIngredientId)) return flash("Cadastre ou selecione uma embalagem medida em unidades.");
    const product = { id: editingProductId ?? uid(), ...productForm, name: productForm.name.trim() };
    setData((old) => ({ ...old, products: editingProductId ? old.products.map((item) => item.id === editingProductId ? product : item) : [...old.products, product] }));
    setSaleForm((old) => ({ ...old, productId: product.id, unitPrice: Number((product.sellingPrice || previewProductCost.suggestedPrice).toFixed(2)) }));
    const wasEditing = Boolean(editingProductId);
    resetProductForm();
    flash(wasEditing ? "Receita atualizada e custos recalculados." : "Receita final precificada e salva.");
  }
  function addSale(event: FormEvent) {
    event.preventDefault(); if (!saleForm.productId || saleForm.quantity <= 0 || saleForm.unitPrice <= 0) return flash("Informe produto, quantidade e preço vendido.");
    setData((old) => ({ ...old, sales: [{ id: uid(), ...saleForm }, ...old.sales] })); setSaleForm((old) => ({ ...old, quantity: 1 })); flash("Venda registrada. Painel atualizado.");
  }
  function addExpense(event: FormEvent) {
    event.preventDefault(); if (!expenseForm.description.trim() || expenseForm.amount <= 0) return flash("Informe a descrição e o valor da despesa.");
    setData((old) => ({ ...old, expenses: [{ id: uid(), ...expenseForm, description: expenseForm.description.trim() }, ...old.expenses] })); setExpenseForm((old) => ({ ...old, description: "", amount: 0 })); flash("Despesa registrada.");
  }
  function remove(collection: "ingredients" | "bases" | "products" | "sales" | "expenses", id: string) {
    if (collection === "ingredients" && (data.bases.some((base) => base.recipe.some((line) => line.ingredientId === id)) || data.products.some((product) => product.packagingIngredientId === id || product.recipe.some((line) => line.kind === "ingredient" && line.itemId === id)))) return flash("Este ingrediente está sendo usado em uma base, receita ou como embalagem.");
    if (collection === "bases" && data.products.some((product) => product.recipe.some((line) => line.kind === "base" && line.itemId === id))) return flash("Esta base está sendo usada em uma receita final.");
    if (collection === "products" && data.sales.some((sale) => sale.productId === id)) return flash("Este produto possui vendas e não pode ser excluído.");
    if (collection === "ingredients") setData((old) => ({ ...old, ingredients: old.ingredients.filter((item) => item.id !== id) }));
    if (collection === "bases") setData((old) => ({ ...old, bases: old.bases.filter((item) => item.id !== id) }));
    if (collection === "products") setData((old) => ({ ...old, products: old.products.filter((item) => item.id !== id) }));
    if (collection === "sales") setData((old) => ({ ...old, sales: old.sales.filter((item) => item.id !== id) }));
    if (collection === "expenses") setData((old) => ({ ...old, expenses: old.expenses.filter((item) => item.id !== id) }));
    flash("Registro removido.");
  }
  function exportData() { const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `doce-lucro-backup-${isoDate()}.json`; link.click(); URL.revokeObjectURL(url); flash("Backup preparado."); }
  function importData(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { setData(normalizeData(JSON.parse(String(reader.result)))); flash("Backup restaurado."); } catch { flash("Arquivo de backup inválido."); } }; reader.readAsText(file); event.target.value = ""; }
  function purchaseUnitToggle(units: PurchaseUnit[], selected: PurchaseUnit, onSelect: (unit: PurchaseUnit) => void, label: string) {
    return <div className="purchase-unit-toggle" role="radiogroup" aria-label={label}>{units.map((unit) => <button type="button" role="radio" aria-checked={selected === unit} className={selected === unit ? "active" : ""} onClick={() => onSelect(unit)} key={unit}>{purchaseUnitLabel(unit)}</button>)}</div>;
  }

  function renderCostDetails() {
    if (!detailView) return null;
    const close = () => setDetailView(null);

    if (detailView.kind === "spending") {
      const monthSales = data.sales.filter((sale) => sale.date.startsWith(currentMonth));
      const monthExpenses = data.expenses.filter((expense) => expense.date.startsWith(currentMonth)).slice().sort((a, b) => b.date.localeCompare(a.date));
      const productionRows = data.products.map((product) => {
        const quantity = monthSales.filter((sale) => sale.productId === product.id).reduce((sum, sale) => sum + sale.quantity, 0);
        const unitCost = productCost(product, data.ingredients, data.bases, data.settings).unitCost;
        return { product, quantity, unitCost, subtotal: quantity * unitCost };
      }).filter((row) => row.quantity > 0);
      return <div className="detail-overlay" role="presentation" onMouseDown={close}><section className="cost-detail-modal spending-detail-modal" role="dialog" aria-modal="true" aria-labelledby="spending-detail-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="type-pill base-type">GASTOS DO MÊS</span><h2 id="spending-detail-title">Composição dos gastos totais</h2><p>Produção das vendas + despesas registradas neste mês.</p></div><button type="button" aria-label="Fechar detalhes" onClick={close}>×</button></header><div className="detail-totals spending-totals"><div><span>Custo de produção</span><strong>{money.format(stats.cogs)}</strong></div><div><span>Despesas registradas</span><strong>{money.format(stats.expenseTotal)}</strong></div><div className="cost-highlight"><span>Gastos totais</span><strong>{money.format(stats.totalSpend)}</strong></div></div><section className="spending-section"><div className="spending-section-heading"><div><span className="section-label">PRODUÇÃO</span><h3>Custo dos produtos vendidos</h3></div><strong>{money.format(stats.cogs)}</strong></div>{productionRows.length ? <div className="detail-cost-list">{productionRows.map((row) => <div className="detail-cost-row" key={row.product.id}><div><strong>{row.product.name}</strong><small>{quantityNumber.format(row.quantity)} vendido(s) × {money.format(row.unitCost)} de custo/un.</small></div><b>{money.format(row.subtotal)}</b></div>)}</div> : <p className="detail-empty">Nenhuma venda com custo de produção neste mês.</p>}</section><section className="spending-section"><div className="spending-section-heading"><div><span className="section-label">DESPESAS</span><h3>Despesas registradas</h3><p className="spending-section-help">Cada lançamento é identificado por descrição, categoria, data e valor.</p></div><strong>{money.format(stats.expenseTotal)}</strong></div>{monthExpenses.length ? <div className="detail-cost-list">{monthExpenses.map((expense) => <div className="detail-cost-row" key={expense.id}><div><strong>{expense.description}</strong><small>{expense.category} · {new Date(`${expense.date}T12:00:00`).toLocaleDateString("pt-BR")}</small></div><b>{money.format(expense.amount)}</b></div>)}</div> : <p className="detail-empty">Nenhuma despesa registrada neste mês.</p>}</section><div className="detail-modal-actions"><button className="secondary-button" type="button" onClick={() => { close(); setActive("Despesas"); }}>Gerenciar despesas</button><button className="primary-button" type="button" onClick={close}>Fechar detalhes</button></div></section></div>;
    }

    if (detailView.kind === "base") {
      const base = data.bases.find((item) => item.id === detailView.id);
      if (!base) return null;
      const cost = baseCost(base, data.ingredients, data.settings.hourlyRate);
      return <div className="detail-overlay" role="presentation" onMouseDown={close}><section className="cost-detail-modal" role="dialog" aria-modal="true" aria-labelledby="cost-detail-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="type-pill base-type">DETALHES DA BASE</span><h2 id="cost-detail-title">{base.name}</h2><p>Rendimento obtido: {quantityNumber.format(base.yieldQty)} {base.unit}</p></div><button type="button" aria-label="Fechar detalhes" onClick={close}>×</button></header><div className="detail-intro"><strong>Quanto custou cada quantidade usada</strong><span>O subtotal é a quantidade multiplicada pelo custo atual de cada ingrediente.</span></div><div className="detail-cost-list">{base.recipe.map((line, index) => { const ingredient = data.ingredients.find((item) => item.id === line.ingredientId); const unitCost = ingredient ? ingredientCost(ingredient) : 0; return <div className="detail-cost-row" key={`${base.id}-${line.ingredientId}-${index}`}><div><strong>{ingredient?.name ?? "Ingrediente removido"}</strong><small>{quantityNumber.format(line.quantity)} {ingredient?.unit ?? ""} × {unitMoney.format(unitCost)}/{ingredient?.unit ?? "un."}</small></div><b>{money.format(line.quantity * unitCost)}</b></div>; })}<div className="detail-cost-row auxiliary"><div><strong>Mão de obra</strong><small>{quantityNumber.format(base.laborHours)} h × {money.format(data.settings.hourlyRate)}/h</small></div><b>{money.format(cost.labor)}</b></div>{base.otherBatchCost > 0 && <div className="detail-cost-row auxiliary"><div><strong>Outros custos</strong><small>Valor informado para este preparo</small></div><b>{money.format(base.otherBatchCost)}</b></div>}</div><div className="detail-totals"><div><span>Custo total da base</span><strong>{money.format(cost.batchTotal)}</strong></div><div><span>Custo por {base.unit}</span><strong>{unitMoney.format(cost.unitCost)}</strong></div></div><button className="primary-button full" type="button" onClick={close}>Fechar detalhes</button></section></div>;
    }

    const product = data.products.find((item) => item.id === detailView.id);
    if (!product) return null;
    const cost = productCost(product, data.ingredients, data.bases, data.settings);
    const packaging = data.ingredients.find((item) => item.id === product.packagingIngredientId);
    return <div className="detail-overlay" role="presentation" onMouseDown={close}><section className="cost-detail-modal" role="dialog" aria-modal="true" aria-labelledby="cost-detail-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="type-pill product-type">DETALHES DA RECEITA</span><h2 id="cost-detail-title">{product.name}</h2><p>Rendimento obtido: {quantityNumber.format(product.yield)} produto(s)</p></div><button type="button" aria-label="Fechar detalhes" onClick={close}>×</button></header><div className="detail-intro"><strong>Quanto custou cada quantidade usada</strong><span>Ingredientes e bases usam os custos mais recentes cadastrados no aplicativo.</span></div><div className="detail-cost-list">{product.recipe.map((line, index) => { const item = line.kind === "base" ? data.bases.find((base) => base.id === line.itemId) : data.ingredients.find((ingredient) => ingredient.id === line.itemId); const unit = item && "unit" in item ? item.unit : ""; const unitCost = line.kind === "base" ? (item ? baseCost(item as BaseRecipe, data.ingredients, data.settings.hourlyRate).unitCost : 0) : (item ? ingredientCost(item as Ingredient) : 0); return <div className="detail-cost-row" key={`${product.id}-${line.itemId}-${index}`}><div><strong>{item?.name ?? "Item removido"}</strong><small>{line.kind === "base" ? "Base" : "Ingrediente"} · {quantityNumber.format(line.quantity)} {unit} × {unitMoney.format(unitCost)}/{unit}</small></div><b>{money.format(line.quantity * unitCost)}</b></div>; })}<div className="detail-cost-row auxiliary"><div><strong>{packaging?.name ?? "Embalagem"}</strong><small>{product.yield} un. × {unitMoney.format(cost.packagingPerUnit)}/un.</small></div><b>{money.format(cost.packagingBatch)}</b></div><div className="detail-cost-row auxiliary"><div><strong>Mão de obra</strong><small>{quantityNumber.format(product.laborHours)} h × {money.format(data.settings.hourlyRate)}/h</small></div><b>{money.format(cost.labor)}</b></div>{product.otherBatchCost > 0 && <div className="detail-cost-row auxiliary"><div><strong>Outros custos</strong><small>Valor informado para esta produção</small></div><b>{money.format(product.otherBatchCost)}</b></div>}</div><div className="detail-totals product-totals"><div><span>Custo total da produção</span><strong>{money.format(cost.batchTotal)}</strong></div><div className="cost-highlight"><span>Custo final por produto</span><strong>{money.format(cost.unitCost)}</strong></div><div className="highlight"><span>Sugerido · {data.settings.targetMarkup.toLocaleString("pt-BR")}x</span><strong>{money.format(cost.suggestedPrice)}</strong></div><div><span>Meu preço de venda</span><strong>{product.sellingPrice > 0 ? money.format(product.sellingPrice) : "Não definido"}</strong></div><div><span>Lucro estimado por produto</span><strong>{product.sellingPrice > 0 ? money.format(cost.netProfit) : "—"}</strong></div></div><div className="detail-percentages"><span>Meta: {data.settings.targetMarkup.toLocaleString("pt-BR")}x</span><span>Markup real: {product.sellingPrice > 0 ? `${cost.actualMarkup.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x` : "—"}</span><span>Margem bruta: {product.sellingPrice > 0 ? `${cost.grossMargin.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : "—"}</span><span>Taxas: {product.feePct}%</span><span>Reserva: {product.reservePct}%</span></div><button className="primary-button full" type="button" onClick={close}>Fechar detalhes</button></section></div>;
  }

  const renderDashboard = () => (
    <>
      <section className="summary-grid" aria-label="Resumo financeiro">
        <article className="metric-card revenue"><span>Faturamento no mês</span><strong>{money.format(stats.revenue)}</strong><small>{stats.progress.toFixed(0)}% da meta mensal</small></article>
        <article className="metric-card spending-card"><button className="metric-details-button" type="button" aria-label="Ver composição dos gastos totais" onClick={() => setDetailView({ kind: "spending" })}>+</button><span>Gastos totais</span><strong>{money.format(stats.totalSpend)}</strong><small>Produção + despesas registradas · toque no +</small></article>
        <article className="metric-card profit"><span>Lucro líquido estimado</span><strong>{money.format(stats.profit)}</strong><small>{stats.revenue ? `${(stats.profit / stats.revenue * 100).toFixed(1)}% do faturamento` : "Registre sua primeira venda"}</small></article>
      </section>
      <section className="main-grid">
        <article className="panel goal-panel"><div className="panel-heading"><div><span className="section-label">META DE FATURAMENTO</span><h2>Seu caminho até {money.format(data.settings.monthlyGoal)}</h2></div><span className="status-pill">{stats.progress >= 100 ? "Meta alcançada" : "Em andamento"}</span></div><div className="goal-content"><div className="donut dynamic-donut" style={{ "--progress": `${stats.progress * 3.6}deg` } as CSSProperties}><span>{stats.progress.toFixed(0)}%<small>alcançado</small></span></div><div className="goal-details"><div><span>Realizado</span><strong>{money.format(stats.revenue)}</strong></div><div><span>Falta vender</span><strong>{money.format(stats.missing)}</strong></div><div className="daily-target"><span>Meta por dia útil</span><strong>{money.format(stats.dailyTarget)}</strong><small>{stats.remainingDays} dias planejados restantes</small></div></div></div></article>
        <article className="panel quick-panel"><span className="section-label">AÇÕES RÁPIDAS</span><h2>O que deseja fazer?</h2><button type="button" onClick={() => { setActive("Valores"); setValuesTab("update"); }}><span>01</span><div><strong>Atualizar um custo</strong><small>Mude o preço de compra em segundos</small></div></button><button type="button" onClick={() => setActive("Minhas bases")}><span>02</span><div><strong>Consultar minhas bases</strong><small>Brigadeiros, massas e recheios</small></div></button><button type="button" onClick={() => setActive("Minhas receitas")}><span>03</span><div><strong>Ver receitas finais</strong><small>Custo e preço sempre atualizados</small></div></button></article>
      </section>
      <section className="bottom-grid"><article className="panel product-panel"><div className="panel-heading"><div><span className="section-label">PRODUTOS</span><h2>O que mais gerou lucro</h2></div><button className="text-button" type="button" onClick={() => setActive("Vendas")}>Ver vendas</button></div>{stats.ranking.length ? stats.ranking.slice(0, 4).map((item, index) => <div className="product-row" key={item.name}><span className="rank">{index + 1}</span><div><strong>{item.name}</strong><small>{item.quantity} unidades vendidas</small></div><div className="right"><strong>{money.format(item.profit)}</strong><small>lucro bruto</small></div></div>) : <p className="empty-copy">Registre vendas para descobrir seus campeões.</p>}</article><article className="panel insight-panel"><span className="insight-badge">CUSTOS CONECTADOS</span><h2>Um preço atualizado corrige toda a produção.</h2><p>Ingredientes alimentam suas bases; as bases alimentam as receitas finais. Você altera o valor uma vez e o Doce Lucro refaz todos os cálculos.</p><button className="secondary-button" type="button" onClick={() => { setActive("Valores"); setValuesTab("update"); }}>Atualizar ingrediente</button></article></section>
    </>
  );

  const renderCosts = () => (
    <div className="module-stack values-module">
      <section className="module-header values-header"><div><span className="section-label">INGREDIENTES E CUSTOS</span><h2>Seus preços de compra em um só lugar</h2><p>Consulte o último valor pago no mercado, atualize custos ou cadastre um novo ingrediente.</p></div></section>
      <nav className="values-tabs" role="tablist" aria-label="Opções de ingredientes e custos">
        <button type="button" role="tab" aria-selected={valuesTab === "ingredients"} className={valuesTab === "ingredients" ? "active" : ""} onClick={() => setValuesTab("ingredients")}><span>⌕</span>Meus ingredientes</button>
        <button type="button" role="tab" aria-selected={valuesTab === "update"} className={valuesTab === "update" ? "active" : ""} onClick={() => setValuesTab("update")}><span>↻</span>Atualizar custos</button>
        <button type="button" role="tab" aria-selected={valuesTab === "create"} className={valuesTab === "create" ? "active" : ""} onClick={() => setValuesTab("create")}><span>＋</span>Cadastrar ingrediente</button>
      </nav>

      {valuesTab === "ingredients" && <section className="panel ingredient-market-panel" role="tabpanel">
        <div className="panel-heading market-heading"><div><span className="step-number">CONSULTA RÁPIDA</span><h3>Meus ingredientes</h3><p>Veja quanto você pagou da última vez antes de comprar novamente.</p></div><span className="soft-pill">{filteredIngredients.length} de {data.ingredients.length}</span></div>
        <label className="ingredient-search"><span>Buscar ingrediente</span><div><b>⌕</b><input type="search" value={ingredientSearch} onChange={(e) => setIngredientSearch(e.target.value)} placeholder="Ex.: leite condensado" autoComplete="off" /></div></label>
        <div className="unit-filters" aria-label="Filtrar ingredientes por unidade">{([['all', 'Todos'], ['g', 'Gramas'], ['ml', 'Mililitros'], ['un', 'Unidades']] as const).map(([value, label]) => <button type="button" className={ingredientUnitFilter === value ? "active" : ""} aria-pressed={ingredientUnitFilter === value} onClick={() => setIngredientUnitFilter(value)} key={value}>{label}</button>)}</div>
        <div className="ingredient-market-list">{filteredIngredients.length ? filteredIngredients.map((item) => <article className="ingredient-market-card" key={item.id}><div className="ingredient-market-main"><span className="ingredient-unit-badge">{purchaseUnitLabel(item.purchaseUnit)}</span><div><strong>{item.name}</strong><small>Embalagem de {formatPurchaseQuantity(item)}</small></div></div><div className="last-price"><small>Último valor pago</small><strong>{money.format(item.purchaseCost)}</strong><span>{unitMoney.format(ingredientCost(item))}/{item.unit}</span></div><div className="ingredient-card-actions"><button className="update-button" type="button" onClick={() => { selectIngredientForUpdate(item.id); setValuesTab("update"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Atualizar preço</button><button className="delete-button" type="button" onClick={() => remove("ingredients", item.id)}>Excluir</button></div></article>) : <div className="ingredient-empty"><strong>Nenhum ingrediente encontrado</strong><p>Tente outro nome ou remova o filtro de unidade.</p></div>}</div>
      </section>}

      {valuesTab === "update" && <section className="cost-update-grid" role="tabpanel"><form className="panel form-panel cost-update-card" onSubmit={updateIngredientCost}><span className="step-number">ATUALIZAÇÃO RÁPIDA</span><h3>Atualizar custo de compra</h3><label>Escolha o ingrediente<select aria-label="Ingrediente para atualizar" value={costForm.ingredientId} onChange={(e) => selectIngredientForUpdate(e.target.value)}>{data.ingredients.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>{selectedIngredient && <div className="current-purchase"><span>Última compra registrada</span><strong>{formatPurchaseQuantity(selectedIngredient)} por {money.format(selectedIngredient.purchaseCost)}</strong><small>Custo atual: {unitMoney.format(ingredientCost(selectedIngredient))}/{selectedIngredient.unit}</small></div>}<div className="purchase-entry-grid"><label>Nova quantidade comprada<input type="number" inputMode="decimal" min="0.001" step="0.001" value={costForm.purchaseQty} onChange={(e) => setCostForm({ ...costForm, purchaseQty: Number(e.target.value) })} /></label><div className="unit-picker-field"><span>Unidade da compra</span>{selectedIngredient && purchaseUnitToggle(purchaseUnitsFor(selectedIngredient.unit), costForm.purchaseUnit, (purchaseUnit) => setCostForm({ ...costForm, purchaseUnit }), "Unidade da nova compra")}</div><label>Novo valor pago<input type="number" inputMode="decimal" min="0.01" step="0.01" value={costForm.purchaseCost} onChange={(e) => setCostForm({ ...costForm, purchaseCost: Number(e.target.value) })} /></label></div>{selectedIngredient && costForm.purchaseQty > 0 && <div className="purchase-conversion"><span>{quantityNumber.format(costForm.purchaseQty)} {purchaseUnitLabel(costForm.purchaseUnit)} equivalem a</span><strong>{quantityNumber.format(simulatedCanonicalQty)} {selectedIngredient.unit}</strong></div>}{simulatedIngredient && <div className="new-cost-preview"><span>Novo custo por {simulatedIngredient.unit}</span><strong>{unitMoney.format(ingredientCost(simulatedIngredient))}</strong></div>}<button className="primary-button full" type="submit">Salvar e recalcular tudo</button></form>
        <article className="panel impact-panel"><span className="step-number">ATUALIZAÇÃO EM CADEIA</span><h3>O que será recalculado</h3><div className="flow-card"><span>1</span><div><small>Ingrediente</small><strong>{selectedIngredient?.name ?? "Selecione um ingrediente"}</strong></div></div><div className="flow-arrow">↓</div><div className="flow-card"><span>2</span><div><small>Minhas bases</small><strong>{impactedBases.length ? impactedBases.map((item) => item.name).join(", ") : "Nenhuma base utiliza diretamente"}</strong></div></div><div className="flow-arrow">↓</div><div className="flow-card"><span>3</span><div><small>Minhas receitas</small><strong>{impactedProducts.length ? impactedProducts.map((item) => item.name).join(", ") : "Nenhuma receita afetada"}</strong></div></div><p className="impact-note">Os cálculos mudam automaticamente. A receita e as quantidades permanecem iguais.</p></article>
      </section>}

      {valuesTab === "create" && <section className="create-ingredient-grid" role="tabpanel"><form className="panel form-panel ingredient-create-card" onSubmit={addIngredient}><div><span className="step-number">NOVO CADASTRO</span><h3>Cadastrar ingrediente</h3><p className="form-intro">Informe como o produto é comprado. O sistema fará a conversão para a unidade usada nas receitas.</p></div><label>Nome do ingrediente<input value={ingredientForm.name} onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })} placeholder="Ex.: Leite em pó" /></label><fieldset className="measure-kind-field"><legend>Como este ingrediente é medido?</legend><div className="measure-kind-selector" role="radiogroup" aria-label="Tipo de medida do ingrediente">{([['weight', 'Peso', 'g ou kg'], ['volume', 'Volume', 'ml ou L'], ['count', 'Unidade', 'itens']] as const).map(([kind, label, hint]) => <button type="button" role="radio" aria-checked={measureKindFor(ingredientForm.unit) === kind} className={measureKindFor(ingredientForm.unit) === kind ? "active" : ""} onClick={() => setIngredientMeasure(kind)} key={kind}><strong>{label}</strong><small>{hint}</small></button>)}</div></fieldset><div className="purchase-entry-grid"><label>Quantidade comprada<input type="number" inputMode="decimal" min="0.001" step="0.001" value={ingredientForm.purchaseQty} onChange={(e) => setIngredientForm({ ...ingredientForm, purchaseQty: Number(e.target.value) })} /></label><div className="unit-picker-field"><span>Unidade da compra</span>{purchaseUnitToggle(purchaseUnitsFor(ingredientForm.unit), ingredientForm.purchaseUnit, (purchaseUnit) => setIngredientForm({ ...ingredientForm, purchaseUnit, unit: canonicalUnitFor(purchaseUnit) }), "Unidade de compra do ingrediente")}</div><label>Valor pago<input type="number" inputMode="decimal" min="0.01" step="0.01" value={ingredientForm.purchaseCost || ""} onChange={(e) => setIngredientForm({ ...ingredientForm, purchaseCost: Number(e.target.value) })} /></label></div><label>Perda estimada (%)<input type="number" inputMode="decimal" min="0" max="80" step="0.1" value={ingredientForm.wastePct} onChange={(e) => setIngredientForm({ ...ingredientForm, wastePct: Number(e.target.value) })} /></label>{ingredientForm.purchaseQty > 0 && <div className="purchase-conversion"><span>{quantityNumber.format(ingredientForm.purchaseQty)} {purchaseUnitLabel(ingredientForm.purchaseUnit)} equivalem a</span><strong>{quantityNumber.format(ingredientFormCanonicalQty)} {ingredientForm.unit}</strong></div>}{ingredientForm.purchaseQty > 0 && ingredientForm.purchaseCost > 0 && <div className="new-cost-preview"><span>Custo calculado por {ingredientForm.unit}</span><strong>{unitMoney.format(ingredientCost(ingredientPreview))}</strong></div>}<button className="primary-button full" type="submit">Cadastrar ingrediente</button></form><article className="panel value-help-card"><span className="step-number">COMPRA SEM DUPLICAR</span><h3>A embalagem pode mudar</h3><p>Cadastre “Farinha de trigo” uma única vez. Se depois comprar um saco de 10 kg, use Atualizar custos e informe 10 kg com o novo valor.</p><div><span>Exemplo</span><strong>10 kg = 10.000 g</strong><small>As bases e receitas continuam usando gramas e são recalculadas automaticamente.</small></div></article></section>}
    </div>
  );

  const renderBases = () => (
    <div className="module-stack">
      <section className="module-header"><div><span className="section-label">MINHAS BASES</span><h2>Recheios, massas e preparos que entram em outras receitas</h2><p>Monte a preparação primeiro. Ao terminar, informe quanto ela realmente rendeu.</p></div></section>
      <div className="creation-toolbar"><button className={baseFormOpen ? "creation-toggle active" : "creation-toggle"} type="button" onClick={() => baseFormOpen ? resetBaseForm() : openNewBaseForm()}><span>{baseFormOpen ? "×" : "+"}</span>{baseFormOpen ? "Fechar formulário" : "Cadastrar nova base"}</button><small>{data.bases.length} base(s) cadastrada(s)</small></div>
      <div className="production-grid">
        <form className={`panel product-form creation-form ${baseFormOpen ? "is-open" : "is-collapsed"}`} onSubmit={saveBase}>
          <div className="panel-heading"><div><span className="step-number">{editingBaseId ? "EDITAR BASE" : "NOVA BASE"}</span><h3>{editingBaseId ? "Editar preparação" : "Montar preparação"}</h3></div><span className="soft-pill">Custo automático</span></div>
          <label>Nome da base<input value={baseForm.name} onChange={(e) => setBaseForm({ ...baseForm, name: e.target.value })} placeholder="Ex.: Brigadeiro branco" /></label>
          <fieldset><legend>Ingredientes da base</legend>{baseForm.recipe.map((line, index) => <div className="recipe-line" key={index}><select aria-label={`Ingrediente da base ${index + 1}`} value={line.ingredientId} onChange={(e) => { const recipe = [...baseForm.recipe]; recipe[index] = { ...recipe[index], ingredientId: e.target.value }; setBaseForm({ ...baseForm, recipe }); }}>{data.ingredients.filter((item) => !isPackagingIngredient(item)).map((item) => <option value={item.id} key={item.id}>{item.name} ({item.unit})</option>)}</select><input aria-label={`Quantidade da base ${index + 1}`} type="number" min="0.01" step="0.01" value={line.quantity} onChange={(e) => { const recipe = [...baseForm.recipe]; recipe[index] = { ...baseForm.recipe[index], quantity: Number(e.target.value) }; setBaseForm({ ...baseForm, recipe }); }} /><button type="button" aria-label="Remover ingrediente da base" onClick={() => setBaseForm({ ...baseForm, recipe: baseForm.recipe.filter((_, i) => i !== index) })}>×</button></div>)}<button className="add-line-button" type="button" onClick={() => setBaseForm({ ...baseForm, recipe: [...baseForm.recipe, { ingredientId: data.ingredients.find((item) => !isPackagingIngredient(item))?.id ?? "", quantity: 100 }] })}>+ Adicionar ingrediente</button></fieldset>
          <div className="form-row two"><label>Horas de preparo<input type="number" min="0" step="0.25" value={baseForm.laborHours} onChange={(e) => setBaseForm({ ...baseForm, laborHours: Number(e.target.value) })} /></label><label>Outros custos<input type="number" min="0" step="0.01" value={baseForm.otherBatchCost} onChange={(e) => setBaseForm({ ...baseForm, otherBatchCost: Number(e.target.value) })} /></label></div>
          <div className="yield-result"><div><span className="step-number">RESULTADO DO PREPARO</span><strong>Quanto essa base rendeu?</strong><small>Depois de pronta, pese ou conte o total obtido. Assim, sobras e perdas entram no custo real.</small></div><div className="yield-inputs"><label>Quantidade obtida<input type="number" min="0.01" step="0.01" value={baseForm.yieldQty || ""} placeholder="Ex.: 850" onChange={(e) => setBaseForm({ ...baseForm, yieldQty: Number(e.target.value) })} /></label><label>Unidade<select value={baseForm.unit} onChange={(e) => setBaseForm({ ...baseForm, unit: e.target.value as Unit })}><option value="g">gramas</option><option value="ml">mililitros</option><option value="un">unidades</option></select></label></div></div>
          <div className="base-preview"><div><span>Custo do preparo</span><strong>{money.format(previewBaseCost.batchTotal)}</strong></div><div><span>Custo por {baseForm.unit}</span><strong>{baseForm.yieldQty > 0 ? money.format(previewBaseCost.unitCost) : "Informe o rendimento"}</strong></div></div>
          <div className="form-save-actions">{editingBaseId && <button className="secondary-button" type="button" onClick={resetBaseForm}>Cancelar edição</button>}<button className="primary-button" type="submit">{editingBaseId ? "Salvar alterações" : "Salvar em Minhas bases"}</button></div>
        </form>
        <section className="base-list">{data.bases.length ? data.bases.map((base) => { const cost = baseCost(base, data.ingredients, data.settings.hourlyRate); return <article className="panel recipe-detail-card" key={base.id}><div className="panel-heading"><div><span className="type-pill base-type">BASE</span><h3>{base.name}</h3><p>Rendimento obtido: {base.yieldQty} {base.unit}</p></div><div className="recipe-price"><small>Custo da base</small><strong>{money.format(cost.batchTotal)}</strong><span>{money.format(cost.unitCost)}/{base.unit}</span></div></div><div className="composition-list"><span>Composição</span>{base.recipe.map((line) => { const ingredient = data.ingredients.find((item) => item.id === line.ingredientId); return <div key={`${base.id}-${line.ingredientId}`}><span>{ingredient?.name ?? "Ingrediente removido"}</span><strong>{line.quantity} {ingredient?.unit ?? ""}</strong></div>; })}<div><span>Mão de obra</span><strong>{money.format(cost.labor)}</strong></div></div><div className="recipe-card-actions"><div className="recipe-primary-actions"><button className="secondary-button" type="button" onClick={() => editBase(base)}>Editar base</button><button className="details-button" type="button" onClick={() => setDetailView({ kind: "base", id: base.id })}>Detalhes</button></div><button className="delete-button" type="button" onClick={() => remove("bases", base.id)}>Excluir base</button></div></article>; }) : <article className="panel empty-state"><h3>Nenhuma base cadastrada</h3><p>Crie seu primeiro recheio ou preparo usando o formulário.</p></article>}</section>
      </div>
    </div>
  );

  function componentOptions(line: ComponentLine, index: number) {
    const value = `${line.kind}:${line.itemId}`;
    return <select aria-label={`Componente da receita ${index + 1}`} value={value} onChange={(e) => { const [kind, itemId] = e.target.value.split(":"); const recipe = [...productForm.recipe]; recipe[index] = { ...recipe[index], kind: kind as "ingredient" | "base", itemId }; setProductForm({ ...productForm, recipe }); }}><optgroup label="Minhas bases">{data.bases.map((item) => <option value={`base:${item.id}`} key={`base-${item.id}`}>{item.name} ({item.unit})</option>)}</optgroup><optgroup label="Ingredientes diretos">{data.ingredients.filter((item) => !isPackagingIngredient(item)).map((item) => <option value={`ingredient:${item.id}`} key={`ingredient-${item.id}`}>{item.name} ({item.unit})</option>)}</optgroup></select>;
  }

  const renderRecipes = () => (
    <div className="module-stack"><section className="module-header"><div><span className="section-label">MINHAS RECEITAS</span><h2>Produtos finais com custo e preço sempre atualizados</h2><p>Monte a receita primeiro. Ao terminar, informe quantos produtos ela realmente rendeu.</p></div></section><div className="creation-toolbar"><button className={productFormOpen ? "creation-toggle active" : "creation-toggle"} type="button" onClick={() => productFormOpen ? resetProductForm() : openNewProductForm()}><span>{productFormOpen ? "×" : "+"}</span>{productFormOpen ? "Fechar formulário" : "Cadastrar nova receita"}</button><small>{data.products.length} receita(s) cadastrada(s)</small></div><form className={`panel product-form creation-form ${productFormOpen ? "is-open" : "is-collapsed"}`} onSubmit={saveProduct}><div className="panel-heading"><div><span className="step-number">{editingProductId ? "EDITAR RECEITA FINAL" : "NOVA RECEITA FINAL"}</span><h3>{editingProductId ? "Editar produto" : "Montar produto"}</h3></div><span className="soft-pill">Ingredientes + bases</span></div><label>Nome do produto<input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Ex.: Bolo de leite Ninho 2 kg" /></label><fieldset><legend>Componentes utilizados</legend>{productForm.recipe.map((line, index) => <div className="recipe-line" key={index}>{componentOptions(line, index)}<input aria-label={`Quantidade do componente ${index + 1}`} type="number" min="0.01" step="0.01" value={line.quantity} onChange={(e) => { const recipe = [...productForm.recipe]; recipe[index] = { ...recipe[index], quantity: Number(e.target.value) }; setProductForm({ ...productForm, recipe }); }} /><button type="button" aria-label="Remover componente" onClick={() => setProductForm({ ...productForm, recipe: productForm.recipe.filter((_, i) => i !== index) })}>×</button></div>)}<button className="add-line-button" type="button" onClick={() => setProductForm({ ...productForm, recipe: [...productForm.recipe, { kind: data.bases.length ? "base" : "ingredient", itemId: data.bases[0]?.id ?? data.ingredients[0]?.id ?? "", quantity: 100 }] })}>+ Adicionar ingrediente ou base</button></fieldset><div className="packaging-rule"><div><span className="step-number">EMBALAGEM AUTOMÁTICA</span><strong>1 embalagem para cada produto final</strong><small>A quantidade será definida pelo rendimento informado no fim.</small></div><label>Embalagem usada<select value={productForm.packagingIngredientId} onChange={(e) => setProductForm({ ...productForm, packagingIngredientId: e.target.value })}>{packagingIngredients.map((item) => <option value={item.id} key={item.id}>{item.name} · {money.format(ingredientCost(item))}/un.</option>)}</select></label></div>{!packagingIngredients.length && <div className="form-warning">Cadastre em Valores um ingrediente em unidades com “Embalagem” no nome.</div>}<div className="form-row three"><label>Horas de trabalho<input type="number" min="0" step="0.25" value={productForm.laborHours} onChange={(e) => setProductForm({ ...productForm, laborHours: Number(e.target.value) })} /></label><label>Outros custos/lote<input type="number" min="0" step="0.01" value={productForm.otherBatchCost} onChange={(e) => setProductForm({ ...productForm, otherBatchCost: Number(e.target.value) })} /></label><label>Meu preço de venda<input type="number" min="0" step="0.01" value={productForm.sellingPrice || ""} placeholder={productForm.yield > 0 ? money.format(previewProductCost.suggestedPrice) : "Defina após o rendimento"} onChange={(e) => setProductForm({ ...productForm, sellingPrice: Number(e.target.value) })} /></label></div><div className="form-row two compact"><label>Taxas de venda (%)<input type="number" min="0" max="30" step="0.1" value={productForm.feePct} onChange={(e) => setProductForm({ ...productForm, feePct: Number(e.target.value) })} /></label><label>Reserva para perdas (%)<input type="number" min="0" max="30" step="0.1" value={productForm.reservePct} onChange={(e) => setProductForm({ ...productForm, reservePct: Number(e.target.value) })} /></label></div><div className="yield-result"><div><span className="step-number">RESULTADO DA PRODUÇÃO</span><strong>Quantos produtos esta receita rendeu?</strong><small>Informe o total realmente produzido. Se sobrou ou faltou, o custo por unidade será ajustado.</small></div><label>Produtos obtidos<input type="number" min="1" step="1" value={productForm.yield || ""} placeholder="Ex.: 18" onChange={(e) => setProductForm({ ...productForm, yield: Number(e.target.value) })} /></label><div className="yield-packaging-note"><span>Embalagens utilizadas</span><strong>{productForm.yield > 0 ? `${productForm.yield} unidades` : "Aguardando rendimento"}</strong></div></div><div className="price-preview"><div><span>Componentes</span><strong>{money.format(previewProductCost.componentBatch)}</strong></div><div><span>{productForm.yield > 0 ? `${productForm.yield} embalagens` : "Embalagens"}</span><strong>{money.format(previewProductCost.packagingBatch)}</strong></div><div className="cost-final"><span>Custo final por produto</span><strong>{productForm.yield > 0 ? money.format(previewProductCost.unitCost) : "—"}</strong></div><div className="suggested"><span>Sugerido · markup {data.settings.targetMarkup.toLocaleString("pt-BR")}x</span><strong>{productForm.yield > 0 ? money.format(previewProductCost.suggestedPrice) : "—"}</strong></div><div className="selling-price"><span>Meu preço de venda</span><strong>{productForm.sellingPrice > 0 ? money.format(productForm.sellingPrice) : "Defina seu preço"}</strong></div><div className="profit-preview"><span>Lucro estimado/un.</span><strong>{productForm.sellingPrice > 0 ? money.format(previewProductCost.netProfit) : "—"}</strong></div><div className="product-form-actions">{editingProductId && <button className="secondary-button" type="button" onClick={resetProductForm}>Cancelar edição</button>}<button className="primary-button" type="submit">{editingProductId ? "Salvar alterações" : "Salvar receita"}</button></div></div></form>
      <section className="recipe-catalog"><div className="panel-heading catalog-heading"><div><span className="section-label">PRODUTOS FINAIS</span><h2>Receitas cadastradas</h2></div><span className="soft-pill">{data.products.length} produtos</span></div>{data.products.map((product) => { const cost = productCost(product, data.ingredients, data.bases, data.settings); const packaging = data.ingredients.find((item) => item.id === product.packagingIngredientId); return <article className="panel recipe-detail-card product-detail" key={product.id}><div className="panel-heading"><div><span className="type-pill product-type">PRODUTO FINAL</span><h3>{product.name}</h3><p>Rende {product.yield} unidade(s)</p></div><div className="recipe-price product-price-summary"><small>Custo final</small><strong className="final-cost">{money.format(cost.unitCost)}</strong><span>por unidade</span><div><small>Meu preço</small><b>{product.sellingPrice > 0 ? money.format(product.sellingPrice) : "Definir"}</b></div><div><small>Sugerido · {data.settings.targetMarkup.toLocaleString("pt-BR")}x</small><b>{money.format(cost.suggestedPrice)}</b></div><div><small>Lucro estimado</small><b>{product.sellingPrice > 0 ? money.format(cost.netProfit) : "—"}</b></div></div></div><div className="composition-list"><span>Receita</span>{product.recipe.map((line, index) => { const item = line.kind === "base" ? data.bases.find((base) => base.id === line.itemId) : data.ingredients.find((ingredient) => ingredient.id === line.itemId); const unit = item && "unit" in item ? item.unit : ""; return <div key={`${product.id}-${index}`}><span><b>{line.kind === "base" ? "Base" : "Ingrediente"}</b> · {item?.name ?? "Item removido"}</span><strong>{line.quantity} {unit}</strong></div>; })}<div><span>Embalagens · {packaging?.name ?? "Não cadastrada"}</span><strong>{product.yield} un. · {money.format(cost.packagingBatch)}</strong></div><div><span>Mão de obra</span><strong>{money.format(cost.labor)}</strong></div></div><div className="recipe-card-actions"><div className="recipe-primary-actions"><button className="secondary-button" type="button" onClick={() => editProduct(product)}>Editar receita</button><button className="details-button" type="button" onClick={() => setDetailView({ kind: "product", id: product.id })}>Detalhes</button></div><button className="delete-button" type="button" onClick={() => remove("products", product.id)}>Excluir receita</button></div></article>; })}</section>
    </div>
  );

  const renderSales = () => <div className="module-stack"><section className="module-header"><div><span className="section-label">VENDAS</span><h2>Registre cada encomenda e veja o lucro real</h2><p>O custo atualizado da receita é descontado automaticamente.</p></div></section><div className="record-grid"><form className="panel form-panel" onSubmit={addSale}><h3>Nova venda</h3><label>Produto<select value={saleForm.productId} onChange={(e) => { const product = data.products.find((item) => item.id === e.target.value); setSaleForm({ ...saleForm, productId: e.target.value, unitPrice: product ? Number((product.sellingPrice || productCost(product, data.ingredients, data.bases, data.settings).suggestedPrice).toFixed(2)) : 0 }); }}>{data.products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label><div className="form-row three"><label>Data<input type="date" value={saleForm.date} onChange={(e) => setSaleForm({ ...saleForm, date: e.target.value })} /></label><label>Quantidade<input type="number" min="1" value={saleForm.quantity} onChange={(e) => setSaleForm({ ...saleForm, quantity: Number(e.target.value) })} /></label><label>Preço vendido/un.<input type="number" min="0" step="0.01" value={saleForm.unitPrice || ""} onChange={(e) => setSaleForm({ ...saleForm, unitPrice: Number(e.target.value) })} /></label></div><div className="form-total"><span>Total da venda</span><strong>{money.format(saleForm.quantity * saleForm.unitPrice)}</strong></div><button className="primary-button full" type="submit">Registrar venda</button></form><article className="panel records-panel"><div className="panel-heading"><div><span className="section-label">HISTÓRICO</span><h3>Vendas recentes</h3></div><strong>{money.format(stats.revenue)}</strong></div>{data.sales.slice().sort((a,b) => b.date.localeCompare(a.date)).map((sale) => { const product = data.products.find((item) => item.id === sale.productId); return <div className="data-row" key={sale.id}><div><strong>{product?.name ?? "Produto removido"}</strong><small>{new Date(`${sale.date}T12:00:00`).toLocaleDateString("pt-BR")} · {sale.quantity} un.</small></div><div className="right"><strong>{money.format(sale.quantity * sale.unitPrice)}</strong><button className="delete-button" type="button" onClick={() => remove("sales", sale.id)}>Excluir</button></div></div>; })}</article></div></div>;
  const renderExpenses = () => <div className="module-stack"><section className="module-header"><div><span className="section-label">DESPESAS</span><h2>Controle tudo o que sai do caixa</h2><p>Inclua gás, energia, aluguel, entregas, divulgação e outros gastos.</p></div></section><div className="record-grid"><form className="panel form-panel" onSubmit={addExpense}><h3>Nova despesa</h3><label>Descrição<input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="Ex.: Conta de energia" /></label><div className="form-row three"><label>Data<input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} /></label><label>Categoria<select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}><option>Produção</option><option>Fixa</option><option>Entrega</option><option>Marketing</option><option>Equipamento</option><option>Outros</option></select></label><label>Valor<input type="number" min="0" step="0.01" value={expenseForm.amount || ""} onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })} /></label></div><button className="primary-button full" type="submit">Registrar despesa</button></form><article className="panel records-panel"><div className="panel-heading"><div><span className="section-label">HISTÓRICO</span><h3>Despesas recentes</h3></div><strong>{money.format(stats.expenseTotal)}</strong></div>{data.expenses.slice().sort((a,b) => b.date.localeCompare(a.date)).map((expense) => <div className="data-row" key={expense.id}><div><strong>{expense.description}</strong><small>{expense.category} · {new Date(`${expense.date}T12:00:00`).toLocaleDateString("pt-BR")}</small></div><div className="right"><strong>{money.format(expense.amount)}</strong><button className="delete-button" type="button" onClick={() => remove("expenses", expense.id)}>Excluir</button></div></div>)}</article></div></div>;
  const renderSettings = () => <div className="module-stack"><section className="module-header"><div><span className="section-label">AJUSTES</span><h2>Personalize o Doce Lucro</h2></div></section><section className="panel settings-panel"><div className="form-row two"><label>Nome do negócio<input value={data.settings.businessName} onChange={(e) => setData({ ...data, settings: { ...data.settings, businessName: e.target.value } })} /></label><label>Meta mensal<input type="number" min="0" value={data.settings.monthlyGoal} onChange={(e) => setData({ ...data, settings: { ...data.settings, monthlyGoal: Number(e.target.value) } })} /></label></div><div className="form-row two"><label>Dias de trabalho no mês<input type="number" min="1" max="31" value={data.settings.workDays} onChange={(e) => setData({ ...data, settings: { ...data.settings, workDays: Number(e.target.value) } })} /></label><label>Valor da sua hora<input type="number" min="0" value={data.settings.hourlyRate} onChange={(e) => setData({ ...data, settings: { ...data.settings, hourlyRate: Number(e.target.value) } })} /></label></div><div className="markup-setting"><div><span className="section-label">META DE PRECIFICAÇÃO</span><h3>Markup padrão desejado</h3><p>O preço sugerido de todas as receitas será o custo final multiplicado por esta meta.</p></div><label>Multiplicador<input type="number" min="1" max="20" step="0.1" value={data.settings.targetMarkup} onChange={(e) => setData({ ...data, settings: { ...data.settings, targetMarkup: Math.max(1, Number(e.target.value)) } })} /></label><div className="markup-example"><span>Exemplo com custo de R$ 10,00</span><strong>{money.format(10 * data.settings.targetMarkup)}</strong><small>R$ 10,00 × {data.settings.targetMarkup.toLocaleString("pt-BR")}x</small></div></div><div className="backup-box"><div><strong>Backup dos seus dados</strong><p>Exporte uma cópia para não perder ingredientes, bases e receitas.</p></div><div className="backup-actions"><button className="secondary-button" type="button" onClick={exportData}>Exportar backup</button><label className="file-button">Restaurar backup<input type="file" accept="application/json" onChange={importData} /></label></div></div><button className="danger-button" type="button" onClick={() => { setData(initialData); localStorage.removeItem("doce-lucro-data-v1"); localStorage.removeItem("doce-lucro-data-v2"); localStorage.removeItem("doce-lucro-data-v3"); localStorage.removeItem("doce-lucro-data-v4"); localStorage.removeItem("doce-lucro-data-v5"); flash("Dados de exemplo restaurados sem movimentações financeiras."); }}>Restaurar dados de exemplo</button></section></div>;

  return (
    <main className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">DL</span><div><strong>Doce Lucro</strong><small>Gestão para confeitaria</small></div></div><nav aria-label="Navegação principal">{navItems.map((item) => <button className={active === item ? "nav-item active" : "nav-item"} key={item} onClick={() => setActive(item)} type="button"><span className="nav-dot" />{item}</button>)}</nav><div className="sidebar-note"><span>Meta do mês</span><strong>{stats.progress.toFixed(0)}% alcançada</strong><div className="mini-progress"><span style={{ width: `${stats.progress}%` }} /></div><small>{stats.missing ? `Faltam ${money.format(stats.missing)}` : "Meta concluída!"}</small></div></aside>
      <section className="workspace"><header className="topbar"><div><p className="eyebrow">{dateHeading}</p><h1>{active === "Visão geral" ? `Bom trabalho, ${data.settings.businessName}!` : active}</h1><p>{active === "Visão geral" ? "Acompanhe o que entrou, o que saiu e quanto ficou para você." : active === "Valores" ? "Consulte e atualize seus preços de compra." : "Alterações são salvas automaticamente neste aparelho."}</p></div><div className="topbar-actions"><button className="settings-shortcut" type="button" onClick={() => setActive("Ajustes")}>Ajustes</button><button className="primary-button" type="button" onClick={() => { setActive("Valores"); setValuesTab("update"); }}>Atualizar custo</button></div></header>{active === "Visão geral" && renderDashboard()}{active === "Valores" && renderCosts()}{active === "Minhas bases" && renderBases()}{active === "Minhas receitas" && renderRecipes()}{active === "Vendas" && renderSales()}{active === "Despesas" && renderExpenses()}{active === "Ajustes" && renderSettings()}</section>
      <nav className="mobile-nav five-items" aria-label="Navegação móvel">{["Visão geral", "Valores", "Minhas bases", "Minhas receitas", "Vendas"].map((item) => <button className={active === item ? "active" : ""} key={item} onClick={() => setActive(item)} type="button"><span>{item === "Valores" ? "$" : item.slice(0, 1)}</span>{item === "Visão geral" ? "Início" : item.replace("Minhas ", "")}</button>)}</nav>{notice && <div className="toast" role="status">{notice}</div>}{renderCostDetails()}</main>
  );
}
