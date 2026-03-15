# 💸 SpendWise — Student Expense Tracker

> Track smarter. Split easier.

A fully functional **student expense tracking and roommate bill-splitting** web app — no backend required, runs entirely in the browser using localStorage.

[Live Demo](https://abhipal2219-tech.github.io/spendwise) &nbsp;|&nbsp; [GitHub](https://github.com/abhipal2219-tech/spendwise)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **Auth** | Register / Login with email & password |
| 💰 **Expense Tracking** | Add expenses by category, date & notes |
| 📊 **Analytics** | Weekly/Monthly bar charts, category breakdown, trend line |
| 👥 **Roommate Groups** | Create groups, invite by email |
| ✂️ **Bill Splitting** | Split any expense equally among group members |
| ⚖️ **Debt Simplification** | Auto-calculates who owes who & minimises transactions |
| ✅ **Settlements** | Mark debts as paid, full settlement history |
| 👤 **Profile** | Edit name, view stats, export CSV |

---

## 🚀 Getting Started

### Option 1 — Open directly
Just open `index.html` in your browser (use a local server for ES Modules).

### Option 2 — Local dev server
```bash
npm install
npm run dev
# → http://localhost:3000
```

### Option 3 — One-liner (no install)
```bash
npx serve . --single --listen 3000
```

**Demo login:** `test@demo.com` / `password123`

---

## 🏗️ Project Structure

```
spendwise/
├── index.html              ← Single Page App (all screens)
├── style.css               ← Full design system (dark Stitch UI)
├── package.json
├── README.md
└── src/
    ├── app.js              ← Main controller (navigation, rendering)
    ├── data/
    │   └── db.js           ← LocalStorage database (CRUD for all entities)
    └── services/
        ├── auth.service.js     ← Register, Login, Session
        ├── expense.service.js  ← Expense CRUD + analytics
        ├── group.service.js    ← Group management + invite
        └── split.service.js    ← Split logic + balance calculator
```

---

## 🌐 Deploy to GitHub Pages

1. Push to GitHub:
```bash
git init
git remote add origin https://github.com/abhipal2219-tech/spendwise.git
git add .
git commit -m "Initial commit — SpendWise v1.0"
git push -u origin main
```

2. Enable GitHub Pages:
   - Go to **Settings → Pages**
   - Source: `main` branch, `/ (root)` folder
   - Your app will be live at `https://abhipal2219-tech.github.io/spendwise`

---

## 🛠️ Tech Stack

- **HTML5** — Semantic SPA structure
- **CSS3** — Custom design system, glassmorphism, animations
- **Vanilla JS (ES Modules)** — No framework, no bundler
- **localStorage** — Client-side data persistence
- **Google Fonts** — Inter typeface

---

## 📱 Screens

| Screen | Description |
|---|---|
| Auth | Sign In / Register |
| Dashboard | Balance card, quick actions, recent transactions |
| Add Expense | Amount, category pills, date, notes |
| Analytics | Bar chart, category breakdown, trend line |
| Groups | Roommate groups list |
| Group Detail | Members, balances, shared expenses |
| Split Expense | Create a shared expense with split preview |
| Settlements | Pay/receive debts, settlement history |
| Profile | Edit profile, stats, export CSV |

---

## 📄 License

MIT © [abhipal2219-tech](https://github.com/abhipal2219-tech)
