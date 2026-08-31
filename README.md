<div align="center">

# 📚 AI-Powered eBook Creator

**A full-stack MERN application that lets you write, structure, and export professional eBooks with the power of Google Gemini AI.**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Gemini AI](https://img.shields.io/badge/Google-Gemini_2.5_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

[Live Demo](#) · [Report Bug](https://github.com/neelamberkumar99/AI-Powered-eBook-Creator/issues) · [Request Feature](https://github.com/neelamberkumar99/AI-Powered-eBook-Creator/issues)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Folder Structure](#-folder-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running Locally](#running-locally)
- [API Reference](#-api-reference)
- [Screenshots](#-screenshots)
- [Deployment](#-deployment)
  - [Frontend — Vercel](#frontend--vercel)
  - [Backend — Render](#backend--render)
- [Future Improvements](#-future-improvements)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Overview

AI-Powered eBook Creator is a full-stack web application that combines a rich markdown editor with Google Gemini AI to help authors, educators, and content creators **build complete eBooks from scratch — without ever leaving their browser**.

Users can:
- Generate a structured chapter outline from a single topic prompt using AI
- Write and edit chapter content with a full markdown editor
- Let AI generate complete, style-aware chapter content on demand
- Upload a custom cover image
- Export finished books as professionally formatted **PDF** or **DOCX** files

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **JWT Authentication** | Secure register/login with bcrypt password hashing and stateless JWT tokens |
| 📋 **AI Outline Generation** | Enter a topic, style, and chapter count — Gemini 2.5 Flash returns a structured chapter plan |
| ✍️ **AI Chapter Writing** | One-click AI generation of full chapter content in a chosen writing style |
| 📝 **Markdown Editor** | Rich `@uiw/react-md-editor` with live preview inside the editor panel |
| 🖱️ **Drag-and-Drop Reordering** | Reorder chapters via `@dnd-kit` with smooth animations |
| 🖼️ **Cover Image Upload** | Upload a cover image (`multer`) — embedded in exported documents |
| 📄 **PDF Export** | Fully typeset PDF using `pdfkit` with serif body font, cover page, and chapter breaks |
| 📃 **DOCX Export** | Word-compatible `.docx` export via `docx.js` with cover image, title page, and inline formatting |
| 👤 **User Profile** | View and update display name; avatar support |
| 📚 **Book Dashboard** | Card-grid view of all your books with create, edit, view, and delete actions |
| 🔒 **Protected Routes** | All book/editor/profile routes are guarded by a React auth context |
| 📱 **Responsive Design** | Mobile-friendly sidebar, collapsible navigation, and adaptive grid layouts |

---

## 🛠 Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **Vite 8** | Build tool & dev server |
| **React Router DOM v7** | Client-side routing |
| **Tailwind CSS v4** | Utility-first styling |
| **@uiw/react-md-editor** | Markdown editing with live preview |
| **@dnd-kit** | Drag-and-drop chapter reordering |
| **Axios** | HTTP client with interceptors |
| **Lucide React** | Icon library |
| **React Hot Toast** | Toast notification system |

### Backend
| Technology | Purpose |
|---|---|
| **Node.js + Express 5** | REST API server |
| **MongoDB + Mongoose 9** | Database and ODM |
| **@google/genai** | Google Gemini 2.5 Flash AI integration |
| **jsonwebtoken** | JWT-based stateless auth |
| **bcryptjs** | Password hashing |
| **pdfkit** | Server-side PDF generation |
| **docx** | Server-side DOCX generation |
| **markdown-it** | Markdown parsing for export rendering |
| **multer** | Multipart file upload for cover images |
| **dotenv** | Environment variable management |
| **nodemon** | Dev auto-reload |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (React + Vite)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Landing  │  │Dashboard │  │  Editor  │  │ ViewBook   │  │
│  │  Page    │  │  Page    │  │  Page    │  │  Page      │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│       │              │              │               │        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              AuthContext + Axios Interceptors        │    │
│  └─────────────────────────────────────────────────────┘    │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS (Bearer JWT)
┌───────────────────────────▼─────────────────────────────────┐
│                  SERVER (Express 5 + Node.js)                │
│                                                              │
│  /api/auth     /api/books    /api/ai       /api/export       │
│  ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌─────────────┐  │
│  │  Auth    │  │  Book    │  │   AI    │  │   Export    │  │
│  │Controller│  │Controller│  │Controller│  │  Controller │  │
│  └──────────┘  └──────────┘  └─────────┘  └─────────────┘  │
│       │              │              │               │        │
│  ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌─────────────┐  │
│  │   User   │  │   Book   │  │ Gemini  │  │ pdfkit/docx │  │
│  │  Model   │  │  Model   │  │  2.5    │  │  markdown-it│  │
│  └──────────┘  └──────────┘  └─────────┘  └─────────────┘  │
│                      │                                       │
└──────────────────────┼───────────────────────────────────────┘
                       │
              ┌────────▼────────┐
              │  MongoDB Atlas  │
              │  (Cloud DB)     │
              └─────────────────┘
```

**Request flow:**
1. React sends requests via Axios with JWT in `Authorization: Bearer <token>` header
2. Express `authMiddleware` validates the JWT on protected routes
3. Controllers delegate to services (book) or directly call Gemini / pdfkit / docx
4. MongoDB Atlas stores Users and Books with embedded chapter arrays

---

## 📁 Folder Structure

```
AI-Powered eBook Creator/
│
├── backend/                          # Node.js + Express API
│   ├── config/
│   │   └── db.js                     # MongoDB connection
│   ├── controllers/
│   │   ├── authcontroller.js         # Register, login, profile CRUD
│   │   ├── bookcontroller.js         # Book CRUD + cover upload
│   │   ├── aicontroller.js           # Gemini outline & chapter generation
│   │   └── exportcontroller.js       # PDF & DOCX generation (835 lines)
│   ├── middleware/
│   │   ├── authMiddleware.js         # JWT protect middleware
│   │   └── uploadMiddleware.js       # Multer file upload config
│   ├── models/
│   │   ├── User.js                   # User schema (bcrypt pre-save hook)
│   │   └── Book.js                   # Book schema with embedded chapters
│   ├── routes/
│   │   ├── authRoutes.js             # /api/auth/*
│   │   ├── BookRoutes.js             # /api/books/*
│   │   ├── aiRoutes.js               # /api/ai/*
│   │   └── exportRoutes.js           # /api/export/*
│   ├── services/
│   │   └── bookservice.js            # Book data-access layer
│   ├── uploads/                      # Uploaded cover images (gitignored)
│   ├── .env.example                  # Environment variable template
│   ├── package.json
│   └── server.js                     # Express entry point
│
└── frontend/ebook/                   # React + Vite SPA
    ├── public/
    └── src/
        ├── components/
        │   ├── auth/
        │   │   └── protectedRoute.jsx      # Route guard component
        │   ├── cards/
        │   │   └── BookCard.jsx            # Dashboard book card
        │   ├── editor/
        │   │   ├── BookDetailsTab.jsx      # Book metadata form
        │   │   ├── ChapterEditorTab.jsx    # Markdown editor tab
        │   │   ├── ChapterSidebar.jsx      # DnD chapter list
        │   │   └── SimpleMDEditor.jsx      # Wrapper for uiw md-editor
        │   ├── landing/
        │   │   ├── Hero.jsx               # Landing hero section
        │   │   ├── Features.jsx           # Features section
        │   │   ├── Testimonials.jsx       # Social proof section
        │   │   └── Footer.jsx             # Site footer
        │   ├── layout/
        │   │   ├── Navbar.jsx             # Top navigation bar
        │   │   └── DashboardLayout.jsx    # Dashboard wrapper layout
        │   ├── module/
        │   │   └── CreateBookModal.jsx    # New book creation modal
        │   ├── ui/
        │   │   ├── Button.jsx             # Reusable button component
        │   │   ├── InputField.jsx         # Form input field
        │   │   ├── Modal.jsx              # Generic modal wrapper
        │   │   ├── Droupdown.jsx          # Dropdown menu
        │   │   └── selectfield.jsx        # Select input component
        │   └── view/
        │       └── ViewBook.jsx           # Read-only book viewer
        ├── context/
        │   └── Authcontext.jsx            # Auth state + login/logout
        ├── pages/
        │   ├── LandingPages.jsx           # Public landing page
        │   ├── LoginPages.jsx             # Login form
        │   ├── SignupPages.jsx            # Registration form
        │   ├── DashboardPages.jsx         # Book library dashboard
        │   ├── EditorPage.jsx             # Main editor (408 lines)
        │   ├── ViewBookPages.jsx          # Read-only book view
        │   └── profilePages.jsx           # User profile settings
        ├── utils/
        │   ├── Apipath.js                 # Base URL + all API path constants
        │   ├── axiosdistance.js           # Axios instance + interceptors
        │   ├── data.js                    # Static data (styles, etc.)
        │   └── halper.js                  # Utility helpers
        ├── App.jsx                        # Router + route definitions
        ├── main.jsx                       # React DOM entry point
        └── index.css                      # Global styles
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- **MongoDB Atlas** account (free tier works)
- **Google AI Studio** API key ([get one here](https://aistudio.google.com/apikey))

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/neelamberkumar99/AI-Powered-eBook-Creator.git
cd AI-Powered-eBook-Creator
```

**2. Install backend dependencies**
```bash
cd backend
npm install
```

**3. Install frontend dependencies**
```bash
cd ../frontend/ebook
npm install
```

### Environment Variables

Copy the example file and fill in your values:

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and configure:

```env
# MongoDB Atlas connection string
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority&appName=<appName>

# JWT signing secret — use a long random string (min 32 chars)
JWT_SECRET=<your_strong_random_secret>

# Server port
PORT=8000

# Google Gemini API key — from https://aistudio.google.com/apikey
GEMINI_API_KEY=<your_gemini_api_key>
```

> **⚠️ Never commit your `.env` file.** It is already in `.gitignore`.

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | ✅ | MongoDB Atlas connection string |
| `JWT_SECRET` | ✅ | Secret for signing JWT tokens |
| `PORT` | ✅ | Express server port (default: 8000) |
| `GEMINI_API_KEY` | ✅ | Google Gemini AI API key |

### Running Locally

**Start the backend (from `/backend`):**
```bash
npm run dev       # nodemon auto-reload
# or
npm start         # production mode
```
> Server runs at `http://localhost:8000`

**Start the frontend (from `/frontend/ebook`):**
```bash
npm run dev
```
> App runs at `http://localhost:5173`

Both servers must be running simultaneously for the app to function.

---

## 📡 API Reference

All API routes (except auth) require the `Authorization: Bearer <token>` header.

### Authentication — `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | ❌ | Register a new user |
| `POST` | `/api/auth/login` | ❌ | Login and receive JWT |
| `GET` | `/api/auth/profile` | ✅ | Get current user profile |
| `PUT` | `/api/auth/profile` | ✅ | Update user display name |

**Register / Login request body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Login response:**
```json
{
  "message": "User logged in successfully",
  "_id": "...",
  "name": "John Doe",
  "email": "john@example.com",
  "token": "<JWT>"
}
```

---

### Books — `/api/books`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/books` | ✅ | Create a new book |
| `GET` | `/api/books` | ✅ | Get all books for current user |
| `GET` | `/api/books/:id` | ✅ | Get a specific book by ID |
| `PUT` | `/api/books/:id` | ✅ | Update book content/metadata |
| `DELETE` | `/api/books/:id` | ✅ | Delete a book |
| `POST` | `/api/books/cover/:id` | ✅ | Upload cover image (`multipart/form-data`) |

**Create book request body:**
```json
{
  "title": "My First Book",
  "author": "John Doe",
  "subtitle": "A Beginner's Guide",
  "chapters": [
    { "title": "Introduction", "description": "...", "content": "" }
  ]
}
```

---

### AI — `/api/ai`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/ai/generate-outline` | ✅ | Generate chapter outline from topic |
| `POST` | `/api/ai/generate-chapter-content` | ✅ | Generate full chapter content |

**Generate outline request body:**
```json
{
  "topic": "Machine Learning for Beginners",
  "style": "informative",
  "numChapters": 5,
  "description": "A practical introduction for developers"
}
```

**Generate outline response:**
```json
{
  "chapters": [
    { "title": "What is Machine Learning?", "description": "..." },
    { "title": "Supervised Learning", "description": "..." }
  ]
}
```

**Generate chapter content request body:**
```json
{
  "chapterTitle": "What is Machine Learning?",
  "chapterDescription": "Overview and key concepts",
  "style": "informative"
}
```

---

### Export — `/api/export`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/export/:id/pdf` | ✅ | Download book as PDF (binary blob) |
| `GET` | `/api/export/:id/docx` | ✅ | Download book as Word document (binary blob) |

Both export endpoints stream a binary file response with appropriate `Content-Disposition` headers.

---

## 📸 Screenshots

> *Replace the placeholders below with actual screenshots of your running app.*

| Page | Preview |
|---|---|
| **Landing Page** | *(Hero section with features, testimonials)* |
| **Dashboard** | *(Grid of book cards with create/delete actions)* |
| **Editor** | *(Split sidebar + markdown editor + AI generate button)* |
| **Book View** | *(Read-only book reader with chapters)* |
| **Export** | *(PDF/DOCX download via dropdown)* |

To add screenshots:
1. Take screenshots of each page
2. Save them to `docs/screenshots/`
3. Reference them with: `![Dashboard](docs/screenshots/dashboard.png)`

---

## 🌐 Deployment

### Frontend — Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo
3. Set **Root Directory** to `frontend/ebook`
4. Set **Framework Preset** to `Vite`
5. Add environment variable:
   ```
   VITE_API_BASE_URL=https://your-backend.onrender.com
   ```
6. Update `frontend/ebook/src/utils/Apipath.js`:
   ```js
   export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
   ```
7. Click **Deploy**

---

### Backend — Render

1. Go to [render.com](https://render.com) → **New Web Service**
2. Connect your GitHub repo
3. Configure:
   | Setting | Value |
   |---|---|
   | **Root Directory** | `backend` |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
   | **Environment** | `Node` |

4. Add all environment variables from your `.env`:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `PORT` = `10000` (Render default)
   - `GEMINI_API_KEY`

5. Click **Create Web Service**

> **Note:** Render free-tier services spin down after inactivity. Consider using a cron job or [UptimeRobot](https://uptimerobot.com) to keep your backend awake.

---

## 🔮 Future Improvements

- [ ] **Rich Text Editor** — Switch from raw Markdown to a WYSIWYG editor (e.g., TipTap or Quill)
- [ ] **AI Streaming** — Stream chapter generation token-by-token for real-time feedback
- [ ] **Collaborative Editing** — Multi-user book editing with WebSockets
- [ ] **Pro Tier & Payments** — Stripe integration (User model already has `isPro` field)
- [ ] **Custom Export Themes** — Multiple PDF/DOCX themes (academic, fiction, technical)
- [ ] **Table of Contents** — Auto-generated TOC page in exported documents
- [ ] **Image Embedding** — Support for inline images within chapter content
- [ ] **Version History** — Git-like chapter revision history
- [ ] **Public Book Sharing** — Shareable read-only links for published books
- [ ] **Epub Export** — Standard ebook format support (.epub)
- [ ] **Dark Mode** — System-aware theme toggle
- [ ] **AI Style Presets** — Pre-built style profiles (academic, business, storytelling)

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make** your changes with clear, descriptive commits
4. **Test** that both backend and frontend run correctly
5. **Push** to your fork
   ```bash
   git push origin feature/your-feature-name
   ```
6. **Open** a Pull Request against `main`

### Development Guidelines

- Follow existing code style and naming conventions
- Keep controllers thin — use services for data logic
- Never hardcode secrets — use `process.env.*` exclusively
- Add meaningful comments for complex logic
- Test export functionality after any backend changes

### Reporting Issues

Please use [GitHub Issues](https://github.com/neelamberkumar99/AI-Powered-eBook-Creator/issues) to report bugs or request features. Include:
- Steps to reproduce
- Expected vs actual behavior
- Browser/Node.js version

---

## 📄 License

This project is licensed under the **ISC License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ by [Neelamber Kumar](https://github.com/neelamberkumar99)**

*If this project helped you, please consider giving it a ⭐ on GitHub!*

</div>
