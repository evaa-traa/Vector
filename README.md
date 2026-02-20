# Vector AI 🚀

Vector AI is a premium, self-hosted AI workspace that combines the conversational power of ChatGPT with the research capabilities of Perplexity. Built on top of **Flowise**, it provides a stunning, high-performance interface for both casual chat and professional document development.

![Vector AI Preview](https://img.shields.io/badge/Status-Active-brightgreen)
![Framework](https://img.shields.io/badge/Framework-React-blue)
![Backend](https://img.shields.io/badge/Backend-Node.js-66cc33)
![AI-Powered](https://img.shields.io/badge/Powered%20By-Flowise-orange)

---

## ✨ Key Features

### 💬 Advanced Chat Interface
- **SSE Streaming**: Ultra-fast, real-time response streaming for a seamless experience.
- **Live Activity Indicators**: See exactly what the AI is doing—whether it's "Thinking", "Searching", or using specific tools.
- **LaTeX & KaTeX**: Full support for mathematical equations, fractions, and scientific notation with beautiful rendering.
- **File Uploads**: Support for processing PDF and text files directly within the chat.
- **Speech-to-Text**: Built-in voice input for hands-free interaction.

### 🧪 Vector Labs (Workspaces)
- **Project-Based Editing**: Create and manage long-form documents in dedicated workspaces.
- **Surgical AI Edits**: Highlight specific sections of your text and have the AI refine just that selection.
- **Persistent State**: Projects are saved locally and persist through page refreshes and sessions.
- **Global Context**: The AI understands the full document while you edit, ensuring consistency.

### 📄 Export & Integration
- **Modern Word Export**: Export your documents to `.docx` with clean, modern typography (Arial/Inter style).
- **PDF Generation**: Quick PDF exports for sharing your work.
- **Model Selector**: Easily switch between different Flowise Chatflows for specialized tasks.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v18 or higher)
- A running **Flowise** instance (local, HF Spaces, or Railway)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-repo/vector-ai.git
cd vector-ai

# Install dependencies
npm install
```

### 3. Configuration
Create a `.env` file in the root directory:

```env
PORT=3000

# Primary Chat Models
MODEL_1_NAME="Vector GPT"
MODEL_1_ID="YOUR_CHATFLOW_ID_1"
MODEL_1_HOST="https://your-flowise.hf.space"

MODEL_2_NAME="Vector Research"
MODEL_2_ID="YOUR_CHATFLOW_ID_2"
MODEL_2_HOST="https://your-flowise.hf.space"

# Dedicated Labs Model (Optional - falls back to Model 1)
LABS_MODEL_NAME="Vector Editor"
LABS_MODEL_ID="YOUR_LABS_CHATFLOW_ID"
LABS_MODEL_HOST="https://your-flowise.hf.space"

# Optional: Flowise Authentication
# FLOWISE_API_KEY=your_api_key
```

### 4. Development & Build
```bash
# Run in development mode
npm run dev

# Build the frontend and run the production server
npm run build
npm start
```

---

## 🛠 Tech Stack

- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [Framer Motion](https://www.framer.com/motion/)
- **Backend**: [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)
- **Streaming**: Server-Sent Events (SSE)
- **AI Orchestration**: [Flowise](https://flowiseai.com/)
- **Rich Text**: [React Markdown](https://github.com/remarkjs/react-markdown) + [KaTeX](https://katex.org/)

---

## ☁️ Deployment

### Render / Railway / HF Spaces
This project is designed to be easily deployable as a single service:

1. **Build Command**: `npm install && npm run build`
2. **Start Command**: `npm start`
3. **Environment Variables**: Add your `MODEL_*` variables in the platform's dashboard.

---

## 📝 License
This project is licensed under the MIT License.
