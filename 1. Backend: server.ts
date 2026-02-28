import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import path from "path";
import Database from "better-sqlite3";
import { GoogleGenAI } from "@google/genai";

// Initialize Database
const db = new Database("nexus.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    assignee TEXT,
    due_date TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );
`);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---

  // Projects
  app.get("/api/projects", (req, res) => {
    const projects = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
    res.json(projects);
  });

  app.post("/api/projects", (req, res) => {
    const { name, description } = req.body;
    const result = db.prepare("INSERT INTO projects (name, description) VALUES (?, ?)").run(name, description);
    res.json({ id: result.lastInsertRowid, name, description });
  });

  // Tasks
  app.get("/api/projects/:id/tasks", (req, res) => {
    const tasks = db.prepare("SELECT * FROM tasks WHERE project_id = ?").all(req.params.id);
    res.json(tasks);
  });

  app.post("/api/projects/:id/tasks", (req, res) => {
    const { title, description, priority, status } = req.body;
    const result = db.prepare("INSERT INTO tasks (project_id, title, description, priority, status) VALUES (?, ?, ?, ?, ?)")
      .run(req.params.id, title, description, priority || 'medium', status || 'todo');
    res.json({ id: result.lastInsertRowid, ...req.body });
    broadcast({ type: 'task_updated', projectId: req.params.id });
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const { status, priority } = req.body;
    if (status) db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(status, req.params.id);
    if (priority) db.prepare("UPDATE tasks SET priority = ? WHERE id = ?").run(priority, req.params.id);
    res.json({ success: true });
    broadcast({ type: 'task_updated' });
  });

  // AI Integration
  app.post("/api/ai/generate-tasks", async (req, res) => {
    const { projectDescription } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key not configured" });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Based on this project description: "${projectDescription}", generate a list of 5 essential tasks. Return only a JSON array of objects with "title" and "description" fields.`,
        config: { responseMimeType: "application/json" }
      });

      const tasks = JSON.parse(response.text || "[]");
      res.json(tasks);
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ error: "Failed to generate tasks" });
    }
  });

  // --- WebSocket Logic ---
  const clients = new Set<WebSocket>();
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });

  function broadcast(data: any) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Nexus AI Server running on http://localhost:${PORT}`);
  });
}

startServer();