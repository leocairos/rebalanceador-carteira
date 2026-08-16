# Rebalanceador de Carteira

Simulador de rebalanceamento de carteira de investimentos, com a carteira gerida em USD.

## Funcionalidades
- Cadastro de ativos com valor atual (USD) e peso-alvo (%)
- Visualização da alocação atual vs. meta
- Simulação de aporte em USD ou BRL, com conversão via cotação informada
- Objetivo do aporte: **Reajustar com novos alvos** ou **Manter proporção atual**
- Ordem de rebalanceamento (compra/venda) sem aporte

Simulação educacional — não considera custos de transação, spread cambial, impostos ou liquidez.

## Rodando localmente

```bash
npm install
npm run dev
```

Abra http://localhost:5173

## Deploy na Vercel

### Opção 1 — CLI
```bash
npm i -g vercel
vercel
```
Siga o prompt (aceite os defaults — a Vercel detecta Vite automaticamente).

### Opção 2 — Painel da Vercel
1. Suba este repositório no GitHub (veja abaixo)
2. Em vercel.com → **Add New... → Project**
3. Importe o repositório
4. Framework Preset: **Vite** (detectado automaticamente)
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Deploy

## Subindo para o GitHub

```bash
git init
git add .
git commit -m "Rebalanceador de carteira"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/rebalanceador-carteira.git
git push -u origin main
```

## Stack
- React 18 + Vite 5 (sem dependências externas de UI)
- Estilos inline + CSS-in-JS simples (nenhum framework CSS necessário)
