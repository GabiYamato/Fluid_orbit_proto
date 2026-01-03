# ShopGPT

> **Decision Engine for Product Research** — An authenticated AI-powered product research web app that helps users choose between good options, not browse everything.

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local frontend development)
- Python 3.11+ (for local backend development)

### 1. Clone and Setup Environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 2. Start with Docker

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** (port 5432) - Metadata database
- **Redis** (port 6379) - Caching & rate limiting
- **Qdrant** (port 6333) - Vector database
- **Backend** (port 8000) - FastAPI server
- **Frontend** (port 3000) - Next.js app

### 3. Access the App

- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs
- Qdrant Dashboard: http://localhost:6333/dashboard

## Architecture

```
Frontend (Next.js) → API Gateway → FastAPI Backend
                                        ├── Auth Service
                                        ├── Query Service
                                        ├── RAG Pipeline
                                        └── Scoring Engine
                                              ↓
                                   ┌─────┬─────┬─────┐
                                   │ PG  │Redis│Qdrant│
                                   └─────┴─────┴─────┘
```

## Features

- ✅ Google OAuth + Email authentication
- ✅ Natural language product queries
- ✅ RAG-based recommendations with transparent scoring
- ✅ External API fallback for missing data
- ✅ Query history per user
- ✅ Rate limiting

## Development

### Backend (without Docker)

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend (without Docker)

```bash
cd frontend
npm install
npm run dev
```

## License

MIT
