# 📐 Math Tutor AI Agent

## Your Personal Math Genius 🚀

[... existing content unchanged until ## 🏗️ Architecture ...]

## 🏗️ Architecture

- **Frontend**: React + Vite + KaTeX for beautiful math rendering
- **Backend**: Specialized multimodal math AI agent (WebSocket + REST)
- **Communication**: Real-time streaming + tool calling

## ☁️ Cloud Run Deployment

**Yes, frontend deployable to Google Cloud Run (free tier OK for demo)!**

### Prerequisites

```bash
gcloud auth login
gcloud config set project math-tutor-live
gcloud components install docker  # if needed
```

### Build & Test

```bash
npm run build:prod     # Builds with prod backend URL
npm run preview        # Test local server http://localhost:4173
```

Docker test:

```bash
npm run docker:test    # Builds/runs container :8080
```

### Deploy

```bash
npm run push           # Tag/push to GCR
npm run deploy         # Deploy/update Cloud Run service
```

**Env Var**: `VITE_API_BASE_URL=https://mathtutor-agent-backend-1087118236338.us-central1.run.app`

**Free Tier**: ~2M reqs/month free. Monitor billing.

## 📱 Screenshots

[unchanged]

[... rest unchanged]
