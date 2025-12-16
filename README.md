# NLOC Budget/Expense (Demo)

A simple church budget/expense tracking web app built as a static HTML/JS project.
Data is stored in the browser using `localStorage`.

## Features
- Login (demo users)
- Teams / Departments / Items / Budgets
- Expense entry (up to 5 line items)
- Budget validation
- Export expenses to CSV
- Backup / restore (stored in localStorage)

## Demo Accounts
- Admin: `admin / admin123`
- Team user example: `100 / team123`

## How to run (local)
1. Download or clone this repo
2. Open `index.html` in a browser

> Tip: For best results, use a local web server:
- VS Code extension: **Live Server**
- or Python: `python -m http.server 8000`

Then open: `http://localhost:8000`

## Data storage
- App data is saved in: `localStorage` key `nloc_bve_data`
- Backups are saved inside the same data structure

## Notes / Limitations
- This is a demo app; passwords are stored in the code (not secure).
- Data is per-browser/device (no cloud sync).
- 
## AI Assistance Disclosure
This project was created with the assistance of AI tools (including Canva AI and ChatGPT) and was reviewed, modified, and validated by the author.
All design decisions, configuration choices, and final implementation responsibility belong to the author.

## License
MIT (or choose your own)
