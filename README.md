# ShopGPT

> AI-Powered Product Research — No BS, Just Facts.

A next-generation product recommendation engine that helps you make smarter shopping decisions with transparent scoring and real data.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

**Open http://localhost:3000** 🎉

---

## 🏗️ Architecture

```
Shop_GPT/
├── frontend/          # Next.js + TypeScript
│   └── src/app/       # App Router pages
├── backend/           # FastAPI + SQLite
│   └── app/
│       ├── routers/   # API endpoints
│       ├── services/  # Business logic
│       ├── models/    # SQLAlchemy models
│       └── schemas/   # Pydantic schemas
└── docker-compose.yml # Production setup
```

---

## 🔑 API Keys (Optional)

| Key | Purpose | Required? |
|-----|---------|-----------|
| `OPENAI_API_KEY` | AI-generated recommendations | No - uses fallback |
| `RAPIDAPI_KEY` | Real product data | No - uses demo data |
| `GOOGLE_CLIENT_ID` | OAuth sign-in | No - email auth works |

**Demo mode works without any API keys!**

---

## 🎨 Design

Neobrutalism-inspired UI with:
- Thick black borders
- Hard drop shadows
- Bold typography
- Pink (#E31B5B) accent color

---

## 📝 License

MIT
