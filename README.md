# FoodieQR Multi-Hotel MVP (Full Code)

## What you get
- Multi-hotel (up to ~5 hotels comfortably) using SQLite
- Hotel Admin login (per hotel) to edit profile, add tables, add categories/items
- Kitchen dashboard (login via same page using KITCHEN user)
- Customer flow: Scan -> Menu -> Cart -> Checkout -> Track -> Feedback

## Setup (Windows)
1. Install Node.js LTS
2. In this folder:
   - `npm install`
   - Copy `.env.example` -> `.env`
   - `npm run seed`
   - `npm run dev`
3. Open:
   - Scan page: `http://localhost:3000/scan.html`
   - Admin login: `http://localhost:3000/admin-login.html`

## Seeded logins
- Hotel A admin: admin@hotel-a.com / admin123
- Hotel B admin: admin@hotel-b.com / admin123
- Hotel A kitchen: kitchen@hotel-a.com / kitchen123
