"use client";

import { useState } from "react";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const navItems = ["Visão geral", "Precificar", "Vendas", "Despesas"];

export default function Home() {
  const [active, setActive] = useState("Visão geral");

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">DL</span>
          <div>
            <strong>Doce Lucro</strong>
            <small>Gestão para confeitaria</small>
          </div>
        </div>

        <nav aria-label="Navegação principal">
          {navItems.map((item) => (
            <button
              className={active === item ? "nav-item active" : "nav-item"}
              key={item}
              onClick={() => setActive(item)}
              type="button"
            >
              <span className="nav-dot" />
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-note">
          <span>Meta do mês</span>
          <strong>62% alcançada</strong>
          <div className="mini-progress"><span /></div>
          <small>Continue: faltam R$ 2.280</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">QUARTA-FEIRA, 5 DE AGOSTO</p>
            <h1>Bom trabalho, Confeitaria da Ana!</h1>
            <p>Acompanhe o que entrou, o que saiu e quanto ficou para você.</p>
          </div>
          <button className="primary-button" type="button" onClick={() => setActive("Vendas")}>+ Registrar venda</button>
        </header>

        {active === "Visão geral" ? (
          <>
            <section className="summary-grid" aria-label="Resumo financeiro">
              <article className="metric-card revenue">
                <span>Faturamento no mês</span>
                <strong>{money.format(3720)}</strong>
                <small>+ 18% comparado ao mês passado</small>
              </article>
              <article className="metric-card">
                <span>Gastos totais</span>
                <strong>{money.format(2034)}</strong>
                <small>Ingredientes, embalagens e despesas</small>
              </article>
              <article className="metric-card profit">
                <span>Lucro líquido estimado</span>
                <strong>{money.format(1686)}</strong>
                <small>45,3% do seu faturamento</small>
              </article>
            </section>

            <section className="main-grid">
              <article className="panel goal-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-label">META DE FATURAMENTO</span>
                    <h2>Seu caminho até R$ 6.000</h2>
                  </div>
                  <span className="status-pill">No ritmo certo</span>
                </div>
                <div className="goal-content">
                  <div className="donut" aria-label="62 por cento da meta alcançada"><span>62%<small>alcançado</small></span></div>
                  <div className="goal-details">
                    <div><span>Realizado</span><strong>{money.format(3720)}</strong></div>
                    <div><span>Falta vender</span><strong>{money.format(2280)}</strong></div>
                    <div className="daily-target"><span>Meta por dia útil</span><strong>{money.format(142.5)}</strong><small>16 dias restantes</small></div>
                  </div>
                </div>
              </article>

              <article className="panel quick-panel">
                <span className="section-label">AÇÕES RÁPIDAS</span>
                <h2>O que deseja fazer?</h2>
                <button type="button" onClick={() => setActive("Precificar")}><span>01</span><div><strong>Precificar um bolo</strong><small>Descubra o preço certo de venda</small></div></button>
                <button type="button" onClick={() => setActive("Vendas")}><span>02</span><div><strong>Registrar uma venda</strong><small>Atualize seu faturamento e lucro</small></div></button>
                <button type="button" onClick={() => setActive("Despesas")}><span>03</span><div><strong>Adicionar uma despesa</strong><small>Não deixe nenhum gasto de fora</small></div></button>
              </article>
            </section>

            <section className="bottom-grid">
              <article className="panel product-panel">
                <div className="panel-heading"><div><span className="section-label">PRODUTOS</span><h2>O que mais gerou lucro</h2></div><button className="text-button" type="button">Ver todos</button></div>
                <div className="product-row"><span className="rank">1</span><div><strong>Bolo de chocolate 2 kg</strong><small>12 unidades vendidas</small></div><div className="right"><strong>{money.format(576)}</strong><small>lucro</small></div></div>
                <div className="product-row"><span className="rank">2</span><div><strong>Kit festa brigadeiro</strong><small>8 unidades vendidas</small></div><div className="right"><strong>{money.format(336)}</strong><small>lucro</small></div></div>
                <div className="product-row"><span className="rank">3</span><div><strong>Bolo de pote</strong><small>24 unidades vendidas</small></div><div className="right"><strong>{money.format(264)}</strong><small>lucro</small></div></div>
              </article>

              <article className="panel insight-panel">
                <span className="insight-badge">INSIGHT DA SEMANA</span>
                <h2>Seu bolo de chocolate é o campeão de lucro.</h2>
                <p>Ele representa 34% do seu resultado. Uma promoção de indicação pode aumentar as encomendas sem reduzir sua margem.</p>
                <button className="secondary-button" type="button" onClick={() => setActive("Precificar")}>Ver composição do preço</button>
              </article>
            </section>
          </>
        ) : (
          <section className="empty-panel">
            <span className="section-label">MÓDULO EM CONSTRUÇÃO</span>
            <h2>{active}</h2>
            <p>Esta área receberá os formulários e cálculos na próxima etapa.</p>
            <button className="secondary-button" type="button" onClick={() => setActive("Visão geral")}>Voltar ao painel</button>
          </section>
        )}
      </section>

      <nav className="mobile-nav" aria-label="Navegação móvel">
        {navItems.map((item) => (
          <button className={active === item ? "active" : ""} key={item} onClick={() => setActive(item)} type="button">
            <span>{item.slice(0, 1)}</span>{item === "Visão geral" ? "Início" : item}
          </button>
        ))}
      </nav>
    </main>
  );
}
