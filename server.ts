import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

import { parseDBML } from "./src/lib/parsers/dbmlParser.js";
import { calculateLayout } from "./src/lib/layout.js";

const DATA_FILE = path.join(__dirname, 'data.json');

function readSchemaFiles() {
  const schemaPart1 = fs.readFileSync(path.join(__dirname, 'src/initial_schema_part1.dbml'), 'utf-8');
  const schemaPart2 = fs.readFileSync(path.join(__dirname, 'src/initial_schema_part2.dbml'), 'utf-8');
  const schemaPart3 = fs.readFileSync(path.join(__dirname, 'src/initial_schema_part3.dbml'), 'utf-8');
  const schemaPart4 = fs.readFileSync(path.join(__dirname, 'src/initial_schema_part4.dbml'), 'utf-8');
  return [schemaPart1, schemaPart2, schemaPart3, schemaPart4].join('\n\n');
}

if (fs.existsSync(DATA_FILE)) {
  const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
  if (fileContent.trim().startsWith('Table')) {
    console.log('Raw DBML detected in data.json, converting to JSON...');
    const schema = parseDBML(fileContent);
    const { nodes, edges } = calculateLayout(schema);
    const data = { schema, nodes, edges, notes: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('Conversion complete.');
  }
}

if (!fs.existsSync(DATA_FILE)) {
  console.log('Initializing data.json from schema files...');
  const fullSchema = readSchemaFiles();
  const schema = parseDBML(fullSchema);
  const { nodes, edges } = calculateLayout(schema);
  const data = { schema, nodes, edges, notes: [] };
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log('Initialization complete.');
} else {
  try {
    const content = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    if (!content.schema || (Array.isArray(content.schema.tables) && content.schema.tables.length === 0)) {
       console.log('Empty data.json detected, re-initializing from schema files...');
       const fullSchema = readSchemaFiles();
       const schema = parseDBML(fullSchema);
       const { nodes, edges } = calculateLayout(schema);
       const data = { schema, nodes, edges, notes: [] };
       fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
       console.log('Re-initialization complete.');
    }
  } catch (e) {
    console.error('Error checking data.json:', e);
  }
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('update-data', (data) => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data));
      socket.broadcast.emit('data-updated', data);
    } catch (e) {
      console.error('Failed to save data via socket:', e);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.get("/api/data", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to read data' });
  }
});

app.post("/api/data", (req, res) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body));
    io.emit('data-updated', req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
