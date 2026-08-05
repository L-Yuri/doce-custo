"use client";

import { ChangeEvent, CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";

type Unit = "g" | "ml" | "un";
type Ingredient = { id: string; name: string; purchaseQty: number; purchaseCost: number; unit: Unit; wastePct: number };
type RecipeLine = { ingredientId: string; quantity: number };
type Product = {
  id: string;
  name: string;
  yield: number;
  packagingPerUnit: number;
  laborHours: number;
  otherBatchCost: number;
  desiredMargin: number;
  feePct: number;
  reservePct: number;
  recipe: RecipeLine[];
};
type Sale = { id: string; date: string; productId: string; quantity: number; unitPrice: number };
type Expense = { id: string; date: string; description: string; category: string; amount: number };
type Settings = { businessName: string; monthlyGoal: number; workDays: number; hourlyRate: number };
type AppData = { ingredients: Ingredient[]; products: Product[]; sales: Sale[]; expenses: Expense[]; settings: Settings };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const navItems = ["Visão geral", "Precificar", "Vendas", "Despesas", "Ajustes"];

const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const isoDate = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const initialData: AppData = {
  settings: { businessName: "Confeitaria da Ana", monthlyGoal: 6000, workDays: 22, hourlyRate: 18 },
  ingredients: [
    { id: "farinha", name: "Farinha de trigo", purchaseQty: 1000, purchaseCost: 6.9, unit: "g", wastePct: 2 },
    { id: "chocolate", name: "Chocolate em pó", purchaseQty: 500, purchaseCost: 18.9, unit: "g", wastePct: 1 },
    { id: "leite", name: "Leite integral", purchaseQty: 1000, purchaseCost: 5.6, unit: "ml", wastePct: 0 },
    { id: "ovos", name: "Ovos", purchaseQty: 12, purchaseCost: 10.8, unit: "un", wastePct: 4 },
    { id: "condensado", name: "Leite condensado", purchaseQty: 395, purchaseCost: 6.5, unit: "g", wastePct: 1 },
  ],
  products: [
    {
      id: "bolo-chocolate",
      name: "Bolo de chocolate 2 kg",
      yield: 1,
      packagingPerUnit: 6,
      laborHours: 2,
      otherBatchCost: 4.5,
      desiredMargin: 35,
      feePct: 4,
      reservePct: 3,
      recipe: [
        { ingredientId: "farinha", quantity: 500 },
        { ingredientId: "chocolate", quantity: 180 },
        { ingredientId: "leite", quantity: 450 },
        { ingredientId: "ovos", quantity: 5 },
        { ingredientId: "condensado", quantity: 790 },
      ],
    },
    {
      id: "bolo-pote",
      name: "Bolo de pote",
      yield: 12,
      packagingPerUnit: 1.25,
      laborHours: 1.5,
      otherBatchCost: 2,
      desiredMargin: 32,
      feePct: 4,
      reservePct: 3,
      recipe: [
        { ingredientId: "farinha", quantity: 350 },
        { ingredientId: "chocolate", quantity: 120 },
        { ingredientId: "leite", quantity: 300 },
        { ingredientId: "ovos", quantity: 4 },
        { ingredientId: "condensado", quantity: 395 },
      ],
    },
  ],
  sales: [
    { id: "s1", date: isoDate(-1), productId: "bolo-chocolate", quantity: 7, unitPrice: 132 },
    { id: "s2", date: isoDate(-3), productId: "bolo-chocolate", quantity: 5, unitPrice: 132 },
    { id: "s3", date: isoDate(-2), productId: "bolo-pote", quantity: 24, unitPrice: 12.5 },
  ],
  expenses: [
    { id: "e1", date: isoDate(-2), description: "Gás de cozinha", category: "Produção", amount: 115 },
    { id: "e2", date: isoDate(-4), description: "Energia elétrica", category: "Fixa", amount: 184 },
    { id: "e3", date: isoDate(-1), description: "Entrega por aplicativo", category: "Entrega", amount: 62 },
  ],
};

const ingredientCost = (ingredient: Ingredient) => {
  const usable = ingredient.purchaseQty * (1 - ingredient.wastePct / 100);
  return usable > 0 ? ingredient.purchaseCost / usable : 0;
};

function productCost(product: Product, ingredients: Ingredient[], hourlyRate: number) {
  const ingredientBatch = product.recipe.reduce((sum, line) => {
    const ingredient = ingredients.find((item) => item.id === line.ingredientId);
    return sum + (ingredient ? ingredientCost(ingredient) * line.quantity : 0);
  }, 0);
  const labor = product.laborHours * hourlyRate;
  const batchTotal = ingredientBatch + labor + product.otherBatchCost;
  const unitCost = batchTotal / Math.max(1, product.yield) + product.packagingPerUnit;
  const deductions = (product.desiredMargin + product.feePct + product.reservePct) / 100;
  const suggestedPrice = deductions < 0.95 ? unitCost / (1 - deductions) : unitCost;
  return { ingredientBatch, labor, batchTotal, unitCost, suggestedPrice };
}

export default function Home() {
  const [active, setActive] = useState("Visão geral");
  const [data, setData] = useState<AppData>(initialData);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [ingredientForm, setIngredientForm] = useState({ name: "", purchaseQty: 1000, purchaseCost: 0, unit: "g" as Unit, wastePct: 0 });
  const [productForm, setProductForm] = useState<Omit<Product, "id">>({
    name: "", yield: 1, packagingPerUnit: 0, laborHours: 1, otherBatchCost: 0,
    desiredMargin: 30, feePct: 4, reservePct: 3, recipe: [{ ingredientId: "farinha", quantity: 100 }],
  });
  const [saleForm, setSaleForm] = useState({ date: isoDate(), productId: "bolo-chocolate", quantity: 1, unitPrice: 0 });
  const [expenseForm, setExpenseForm] = useState({ date: isoDate(), description: "", category: "Produção", amount: 0 });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("doce-lucro-data-v1");
      if (saved) setData(JSON.parse(saved));
    } catch {
      setNotice("Não foi possível carregar o backup deste aparelho.");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("doce-lucro-data-v1", JSON.stringify(data));
  }, [data, ready]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (saleForm.unitPrice > 0) return;
    const product = data.products.find((item) => item.id === saleForm.productId);
    if (!product) return;
    setSaleForm((old) => ({ ...old, unitPrice: Number(productCost(product, data.ingredients, data.settings.hourlyRate).suggestedPrice.toFixed(2)) }));
  }, [data.ingredients, data.products, data.settings.hourlyRate, saleForm.productId, saleForm.unitPrice]);

  const currentMonth = isoDate().slice(0, 7);
  const stats = useMemo(() => {
    const sales = data.sales.filter((sale) => sale.date.startsWith(currentMonth));
    const expenses = data.expenses.filter((expense) => expense.date.startsWith(currentMonth));
    const revenue = sales.reduce((sum, sale) => sum + sale.quantity * sale.unitPrice, 0);
    const cogs = sales.reduce((sum, sale) => {
      const product = data.products.find((item) => item.id === sale.productId);
      return sum + (product ? sale.quantity * productCost(product, data.ingredients, data.settings.hourlyRate).unitCost : 0);
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
      const unitCost = productCost(product, data.ingredients, data.settings.hourlyRate).unitCost;
      return { name: product.name, quantity, profit: productRevenue - quantity * unitCost };
    }).filter((item) => item.quantity > 0).sort((a, b) => b.profit - a.profit);
    return { revenue, cogs, expenseTotal, totalSpend: cogs + expenseTotal, profit, progress, missing, remainingDays, dailyTarget: missing / remainingDays, ranking };
  }, [currentMonth, data]);

  const previewProduct: Product = { id: "preview", ...productForm };
  const previewCost = productCost(previewProduct, data.ingredients, data.settings.hourlyRate);
  const dateHeading = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase();

  const flash = (message: string) => setNotice(message);

  function addIngredient(event: FormEvent) {
    event.preventDefault();
    if (!ingredientForm.name.trim() || ingredientForm.purchaseQty <= 0 || ingredientForm.purchaseCost <= 0) return flash("Preencha nome, quantidade e valor da compra.");
    const ingredient: Ingredient = { id: uid(), ...ingredientForm, name: ingredientForm.name.trim() };
    setData((old) => ({ ...old, ingredients: [...old.ingredients, ingredient] }));
    setIngredientForm({ name: "", purchaseQty: 1000, purchaseCost: 0, unit: "g", wastePct: 0 });
    flash("Ingrediente salvo.");
  }

  function addProduct(event: FormEvent) {
    event.preventDefault();
    if (!productForm.name.trim() || productForm.recipe.some((line) => !line.ingredientId || line.quantity <= 0)) return flash("Informe o produto e todos os ingredientes da receita.");
    const product: Product = { id: uid(), ...productForm, name: productForm.name.trim() };
    setData((old) => ({ ...old, products: [...old.products, product] }));
    setSaleForm((old) => ({ ...old, productId: product.id, unitPrice: Number(previewCost.suggestedPrice.toFixed(2)) }));
    setProductForm({ name: "", yield: 1, packagingPerUnit: 0, laborHours: 1, otherBatchCost: 0, desiredMargin: 30, feePct: 4, reservePct: 3, recipe: [{ ingredientId: data.ingredients[0]?.id ?? "", quantity: 100 }] });
    flash("Produto precificado e salvo.");
  }

  function addSale(event: FormEvent) {
    event.preventDefault();
    if (!saleForm.productId || saleForm.quantity <= 0 || saleForm.unitPrice <= 0) return flash("Informe o produto, a quantidade e o preço vendido.");
    setData((old) => ({ ...old, sales: [{ id: uid(), ...saleForm }, ...old.sales] }));
    setSaleForm((old) => ({ ...old, quantity: 1 }));
    flash("Venda registrada. Seu painel já foi atualizado.");
  }

  function addExpense(event: FormEvent) {
    event.preventDefault();
    if (!expenseForm.description.trim() || expenseForm.amount <= 0) return flash("Informe a descrição e o valor da despesa.");
    setData((old) => ({ ...old, expenses: [{ id: uid(), ...expenseForm, description: expenseForm.description.trim() }, ...old.expenses] }));
    setExpenseForm((old) => ({ ...old, description: "", amount: 0 }));
    flash("Despesa registrada.");
  }

  const remove = (collection: "ingredients" | "products" | "sales" | "expenses", id: string) => {
    if (collection === "ingredients" && data.products.some((product) => product.recipe.some((line) => line.ingredientId === id))) return flash("Este ingrediente está sendo usado em uma receita.");
    if (collection === "products" && data.sales.some((sale) => sale.productId === id)) return flash("Este produto possui vendas e não pode ser excluído.");
    if (collection === "ingredients") setData((old) => ({ ...old, ingredients: old.ingredients.filter((item) => item.id !== id) }));
    if (collection === "products") setData((old) => ({ ...old, products: old.products.filter((item) => item.id !== id) }));
    if (collection === "sales") setData((old) => ({ ...old, sales: old.sales.filter((item) => item.id !== id) }));
    if (collection === "expenses") setData((old) => ({ ...old, expenses: old.expenses.filter((item) => item.id !== id) }));
    flash("Registro removido.");
  };

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `doce-lucro-backup-${isoDate()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    flash("Backup preparado.");
  }

  function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed.settings || !Array.isArray(parsed.ingredients)) throw new Error("invalid");
        setData(parsed);
        flash("Backup restaurado.");
      } catch {
        flash("Este arquivo não é um backup válido do Doce Lucro.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  const renderDashboard = () => (
    <>
      <section className="summary-grid" aria-label="Resumo financeiro">
        <article className="metric-card revenue"><span>Faturamento no mês</span><strong>{money.format(stats.revenue)}</strong><small>{stats.progress.toFixed(0)}% da meta mensal</small></article>
        <article className="metric-card"><span>Gastos totais</span><strong>{money.format(stats.totalSpend)}</strong><small>Produção + despesas registradas</small></article>
        <article className="metric-card profit"><span>Lucro líquido estimado</span><strong>{money.format(stats.profit)}</strong><small>{stats.revenue ? `${(stats.profit / stats.revenue * 100).toFixed(1)}% do faturamento` : "Registre sua primeira venda"}</small></article>
      </section>

      <section className="main-grid">
        <article className="panel goal-panel">
          <div className="panel-heading"><div><span className="section-label">META DE FATURAMENTO</span><h2>Seu caminho até {money.format(data.settings.monthlyGoal)}</h2></div><span className="status-pill">{stats.progress >= 100 ? "Meta alcançada" : "Em andamento"}</span></div>
          <div className="goal-content">
            <div className="donut dynamic-donut" style={{ "--progress": `${stats.progress * 3.6}deg` } as CSSProperties} aria-label={`${stats.progress.toFixed(0)} por cento da meta alcançada`}><span>{stats.progress.toFixed(0)}%<small>alcançado</small></span></div>
            <div className="goal-details">
              <div><span>Realizado</span><strong>{money.format(stats.revenue)}</strong></div>
              <div><span>Falta vender</span><strong>{money.format(stats.missing)}</strong></div>
              <div className="daily-target"><span>Meta por dia útil</span><strong>{money.format(stats.dailyTarget)}</strong><small>{stats.remainingDays} dias planejados restantes</small></div>
            </div>
          </div>
        </article>

        <article className="panel quick-panel">
          <span className="section-label">AÇÕES RÁPIDAS</span><h2>O que deseja fazer?</h2>
          <button type="button" onClick={() => setActive("Precificar")}><span>01</span><div><strong>Precificar um produto</strong><small>Calcule custo e preço de venda</small></div></button>
          <button type="button" onClick={() => setActive("Vendas")}><span>02</span><div><strong>Registrar uma venda</strong><small>Atualize faturamento e lucro</small></div></button>
          <button type="button" onClick={() => setActive("Despesas")}><span>03</span><div><strong>Adicionar uma despesa</strong><small>Não deixe nenhum gasto de fora</small></div></button>
        </article>
      </section>

      <section className="bottom-grid">
        <article className="panel product-panel">
          <div className="panel-heading"><div><span className="section-label">PRODUTOS</span><h2>O que mais gerou lucro</h2></div><button className="text-button" type="button" onClick={() => setActive("Vendas")}>Ver vendas</button></div>
          {stats.ranking.length ? stats.ranking.slice(0, 4).map((item, index) => (
            <div className="product-row" key={item.name}><span className="rank">{index + 1}</span><div><strong>{item.name}</strong><small>{item.quantity} unidades vendidas</small></div><div className="right"><strong>{money.format(item.profit)}</strong><small>lucro bruto</small></div></div>
          )) : <p className="empty-copy">Registre vendas para descobrir seus campeões de lucro.</p>}
        </article>
        <article className="panel insight-panel">
          <span className="insight-badge">LEITURA RÁPIDA</span>
          <h2>{stats.profit >= 0 ? "Seu negócio está gerando resultado positivo." : "Seus gastos estão acima do faturamento."}</h2>
          <p>{stats.ranking[0] ? `${stats.ranking[0].name} é o produto que mais contribuiu para o lucro neste mês. Use esse dado para planejar suas ofertas.` : "Cadastre produtos e vendas para receber uma leitura simples do seu resultado."}</p>
          <button className="secondary-button" type="button" onClick={() => setActive("Precificar")}>Revisar meus preços</button>
        </article>
      </section>
    </>
  );

  const renderPricing = () => (
    <div className="module-stack">
      <section className="module-header"><div><span className="section-label">PRECIFICAÇÃO COMPLETA</span><h2>Descubra o preço certo sem trabalhar no prejuízo</h2><p>Primeiro cadastre o que você compra. Depois monte a receita e deixe o sistema calcular.</p></div></section>
      <div className="pricing-grid">
        <form className="panel form-panel" onSubmit={addIngredient}>
          <div className="panel-heading"><div><span className="step-number">PASSO 1</span><h3>Novo ingrediente</h3></div><span className="soft-pill">{data.ingredients.length} cadastrados</span></div>
          <label>Ingrediente<input value={ingredientForm.name} onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })} placeholder="Ex.: Farinha de trigo" /></label>
          <div className="form-row three">
            <label>Quantidade comprada<input type="number" min="0" step="0.01" value={ingredientForm.purchaseQty} onChange={(e) => setIngredientForm({ ...ingredientForm, purchaseQty: Number(e.target.value) })} /></label>
            <label>Unidade<select value={ingredientForm.unit} onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value as Unit })}><option value="g">gramas</option><option value="ml">mililitros</option><option value="un">unidades</option></select></label>
            <label>Valor pago<input type="number" min="0" step="0.01" value={ingredientForm.purchaseCost || ""} onChange={(e) => setIngredientForm({ ...ingredientForm, purchaseCost: Number(e.target.value) })} placeholder="0,00" /></label>
          </div>
          <label>Perda estimada (%)<input type="number" min="0" max="80" step="0.1" value={ingredientForm.wastePct} onChange={(e) => setIngredientForm({ ...ingredientForm, wastePct: Number(e.target.value) })} /></label>
          <button className="primary-button full" type="submit">Salvar ingrediente</button>
        </form>

        <article className="panel ingredient-list">
          <span className="step-number">SEUS CUSTOS</span><h3>Ingredientes cadastrados</h3>
          <div className="table-scroll">
            {data.ingredients.map((item) => <div className="data-row" key={item.id}><div><strong>{item.name}</strong><small>{item.purchaseQty} {item.unit} por {money.format(item.purchaseCost)}</small></div><div className="right"><strong>{money.format(ingredientCost(item))}/{item.unit}</strong><button className="delete-button" type="button" onClick={() => remove("ingredients", item.id)}>Excluir</button></div></div>)}
          </div>
        </article>
      </div>

      <form className="panel product-form" onSubmit={addProduct}>
        <div className="panel-heading"><div><span className="step-number">PASSO 2</span><h3>Monte a receita do produto</h3></div><span className="soft-pill">Cálculo automático</span></div>
        <div className="form-row two"><label>Nome do produto<input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Ex.: Bolo de cenoura 2 kg" /></label><label>Rendimento da receita<input type="number" min="1" step="1" value={productForm.yield} onChange={(e) => setProductForm({ ...productForm, yield: Number(e.target.value) })} /></label></div>
        <fieldset><legend>Ingredientes utilizados</legend>
          {productForm.recipe.map((line, index) => <div className="recipe-line" key={index}><select aria-label={`Ingrediente ${index + 1}`} value={line.ingredientId} onChange={(e) => { const recipe = [...productForm.recipe]; recipe[index] = { ...recipe[index], ingredientId: e.target.value }; setProductForm({ ...productForm, recipe }); }}>{data.ingredients.map((item) => <option value={item.id} key={item.id}>{item.name} ({item.unit})</option>)}</select><input aria-label={`Quantidade ${index + 1}`} type="number" min="0.01" step="0.01" value={line.quantity} onChange={(e) => { const recipe = [...productForm.recipe]; recipe[index] = { ...recipe[index], quantity: Number(e.target.value) }; setProductForm({ ...productForm, recipe }); }} /><button type="button" aria-label="Remover ingrediente da receita" onClick={() => setProductForm({ ...productForm, recipe: productForm.recipe.filter((_, i) => i !== index) })}>×</button></div>)}
          <button className="add-line-button" type="button" onClick={() => setProductForm({ ...productForm, recipe: [...productForm.recipe, { ingredientId: data.ingredients[0]?.id ?? "", quantity: 100 }] })}>+ Adicionar ingrediente</button>
        </fieldset>
        <div className="form-row four"><label>Embalagem/unidade<input type="number" min="0" step="0.01" value={productForm.packagingPerUnit} onChange={(e) => setProductForm({ ...productForm, packagingPerUnit: Number(e.target.value) })} /></label><label>Horas de trabalho<input type="number" min="0" step="0.25" value={productForm.laborHours} onChange={(e) => setProductForm({ ...productForm, laborHours: Number(e.target.value) })} /></label><label>Outros custos/lote<input type="number" min="0" step="0.01" value={productForm.otherBatchCost} onChange={(e) => setProductForm({ ...productForm, otherBatchCost: Number(e.target.value) })} /></label><label>Margem desejada (%)<input type="number" min="0" max="80" value={productForm.desiredMargin} onChange={(e) => setProductForm({ ...productForm, desiredMargin: Number(e.target.value) })} /></label></div>
        <div className="form-row two compact"><label>Taxas de venda (%)<input type="number" min="0" max="30" step="0.1" value={productForm.feePct} onChange={(e) => setProductForm({ ...productForm, feePct: Number(e.target.value) })} /></label><label>Reserva para perdas (%)<input type="number" min="0" max="30" step="0.1" value={productForm.reservePct} onChange={(e) => setProductForm({ ...productForm, reservePct: Number(e.target.value) })} /></label></div>
        <div className="price-preview"><div><span>Custo dos ingredientes</span><strong>{money.format(previewCost.ingredientBatch)}</strong></div><div><span>Custo total por unidade</span><strong>{money.format(previewCost.unitCost)}</strong></div><div className="suggested"><span>Preço sugerido</span><strong>{money.format(previewCost.suggestedPrice)}</strong></div><button className="primary-button" type="submit">Salvar produto</button></div>
      </form>

      <section className="panel"><div className="panel-heading"><div><span className="section-label">PRODUTOS PRECIFICADOS</span><h3>Seu catálogo</h3></div></div><div className="catalog-grid">{data.products.map((product) => { const cost = productCost(product, data.ingredients, data.settings.hourlyRate); return <article className="catalog-card" key={product.id}><span>{product.yield} un. por receita</span><h4>{product.name}</h4><div><small>Custo unitário</small><strong>{money.format(cost.unitCost)}</strong></div><div><small>Preço sugerido</small><strong className="berry">{money.format(cost.suggestedPrice)}</strong></div><button className="delete-button" type="button" onClick={() => remove("products", product.id)}>Excluir</button></article>; })}</div></section>
    </div>
  );

  const renderSales = () => (
    <div className="module-stack"><section className="module-header"><div><span className="section-label">VENDAS</span><h2>Registre cada encomenda e veja o lucro real</h2><p>O custo do produto é descontado automaticamente no painel.</p></div></section><div className="record-grid">
      <form className="panel form-panel" onSubmit={addSale}><h3>Nova venda</h3><label>Produto<select value={saleForm.productId} onChange={(e) => { const product = data.products.find((item) => item.id === e.target.value); setSaleForm({ ...saleForm, productId: e.target.value, unitPrice: product ? Number(productCost(product, data.ingredients, data.settings.hourlyRate).suggestedPrice.toFixed(2)) : 0 }); }}>{data.products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label><div className="form-row three"><label>Data<input type="date" value={saleForm.date} onChange={(e) => setSaleForm({ ...saleForm, date: e.target.value })} /></label><label>Quantidade<input type="number" min="1" step="1" value={saleForm.quantity} onChange={(e) => setSaleForm({ ...saleForm, quantity: Number(e.target.value) })} /></label><label>Preço vendido/un.<input type="number" min="0" step="0.01" value={saleForm.unitPrice || ""} onChange={(e) => setSaleForm({ ...saleForm, unitPrice: Number(e.target.value) })} /></label></div><div className="form-total"><span>Total da venda</span><strong>{money.format(saleForm.quantity * saleForm.unitPrice)}</strong></div><button className="primary-button full" type="submit">Registrar venda</button></form>
      <article className="panel records-panel"><div className="panel-heading"><div><span className="section-label">HISTÓRICO</span><h3>Vendas recentes</h3></div><strong>{money.format(stats.revenue)}</strong></div>{data.sales.length ? data.sales.slice().sort((a,b) => b.date.localeCompare(a.date)).map((sale) => { const product = data.products.find((item) => item.id === sale.productId); return <div className="data-row" key={sale.id}><div><strong>{product?.name ?? "Produto removido"}</strong><small>{new Date(`${sale.date}T12:00:00`).toLocaleDateString("pt-BR")} · {sale.quantity} un.</small></div><div className="right"><strong>{money.format(sale.quantity * sale.unitPrice)}</strong><button className="delete-button" type="button" onClick={() => remove("sales", sale.id)}>Excluir</button></div></div>; }) : <p className="empty-copy">Nenhuma venda registrada.</p>}</article>
    </div></div>
  );

  const renderExpenses = () => (
    <div className="module-stack"><section className="module-header"><div><span className="section-label">DESPESAS</span><h2>Controle tudo o que sai do caixa</h2><p>Inclua gás, energia, aluguel, entregas, divulgação e outros gastos.</p></div></section><div className="record-grid">
      <form className="panel form-panel" onSubmit={addExpense}><h3>Nova despesa</h3><label>Descrição<input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="Ex.: Conta de energia" /></label><div className="form-row three"><label>Data<input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} /></label><label>Categoria<select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}><option>Produção</option><option>Fixa</option><option>Entrega</option><option>Marketing</option><option>Equipamento</option><option>Outros</option></select></label><label>Valor<input type="number" min="0" step="0.01" value={expenseForm.amount || ""} onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })} /></label></div><button className="primary-button full" type="submit">Registrar despesa</button></form>
      <article className="panel records-panel"><div className="panel-heading"><div><span className="section-label">HISTÓRICO</span><h3>Despesas recentes</h3></div><strong>{money.format(stats.expenseTotal)}</strong></div>{data.expenses.length ? data.expenses.slice().sort((a,b) => b.date.localeCompare(a.date)).map((expense) => <div className="data-row" key={expense.id}><div><strong>{expense.description}</strong><small>{expense.category} · {new Date(`${expense.date}T12:00:00`).toLocaleDateString("pt-BR")}</small></div><div className="right"><strong>{money.format(expense.amount)}</strong><button className="delete-button" type="button" onClick={() => remove("expenses", expense.id)}>Excluir</button></div></div>) : <p className="empty-copy">Nenhuma despesa registrada.</p>}</article>
    </div></div>
  );

  const renderSettings = () => (
    <div className="module-stack"><section className="module-header"><div><span className="section-label">AJUSTES</span><h2>Personalize o Doce Lucro</h2><p>Essas informações alimentam suas metas e o custo da mão de obra.</p></div></section><section className="panel settings-panel"><div className="form-row two"><label>Nome do negócio<input value={data.settings.businessName} onChange={(e) => setData({ ...data, settings: { ...data.settings, businessName: e.target.value } })} /></label><label>Meta mensal de faturamento<input type="number" min="0" step="50" value={data.settings.monthlyGoal} onChange={(e) => setData({ ...data, settings: { ...data.settings, monthlyGoal: Number(e.target.value) } })} /></label></div><div className="form-row two"><label>Dias de trabalho no mês<input type="number" min="1" max="31" value={data.settings.workDays} onChange={(e) => setData({ ...data, settings: { ...data.settings, workDays: Number(e.target.value) } })} /></label><label>Valor da sua hora de trabalho<input type="number" min="0" step="1" value={data.settings.hourlyRate} onChange={(e) => setData({ ...data, settings: { ...data.settings, hourlyRate: Number(e.target.value) } })} /></label></div><div className="backup-box"><div><strong>Backup dos seus dados</strong><p>Os dados ficam neste aparelho. Exporte uma cópia para não perder seus cadastros.</p></div><div className="backup-actions"><button className="secondary-button" type="button" onClick={exportData}>Exportar backup</button><label className="file-button">Restaurar backup<input type="file" accept="application/json" onChange={importData} /></label></div></div><button className="danger-button" type="button" onClick={() => { setData(initialData); flash("Dados de demonstração restaurados."); }}>Restaurar demonstração</button></section></div>
  );

  return (
    <main className="app-shell">
      <aside className="sidebar"><div className="brand"><span className="brand-mark">DL</span><div><strong>Doce Lucro</strong><small>Gestão para confeitaria</small></div></div><nav aria-label="Navegação principal">{navItems.map((item) => <button className={active === item ? "nav-item active" : "nav-item"} key={item} onClick={() => setActive(item)} type="button"><span className="nav-dot" />{item}</button>)}</nav><div className="sidebar-note"><span>Meta do mês</span><strong>{stats.progress.toFixed(0)}% alcançada</strong><div className="mini-progress"><span style={{ width: `${stats.progress}%` }} /></div><small>{stats.missing ? `Faltam ${money.format(stats.missing)}` : "Meta concluída!"}</small></div></aside>
      <section className="workspace"><header className="topbar"><div><p className="eyebrow">{dateHeading}</p><h1>{active === "Visão geral" ? `Bom trabalho, ${data.settings.businessName}!` : active}</h1><p>{active === "Visão geral" ? "Acompanhe o que entrou, o que saiu e quanto ficou para você." : "Seus dados são salvos automaticamente neste aparelho."}</p></div><div className="topbar-actions"><button className="settings-shortcut" type="button" onClick={() => setActive("Ajustes")}>Ajustes</button><button className="primary-button" type="button" onClick={() => setActive("Vendas")}>+ Registrar venda</button></div></header>{active === "Visão geral" && renderDashboard()}{active === "Precificar" && renderPricing()}{active === "Vendas" && renderSales()}{active === "Despesas" && renderExpenses()}{active === "Ajustes" && renderSettings()}</section>
      <nav className="mobile-nav" aria-label="Navegação móvel">{navItems.slice(0, 4).map((item) => <button className={active === item ? "active" : ""} key={item} onClick={() => setActive(item)} type="button"><span>{item.slice(0, 1)}</span>{item === "Visão geral" ? "Início" : item}</button>)}</nav>
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
