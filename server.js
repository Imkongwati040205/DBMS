const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const db = require("./database");

const app = express();
const uploadFolder = path.join(__dirname, "uploads");

fs.mkdirSync(uploadFolder, { recursive: true });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const allowedTypes = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

const storage = multer.diskStorage({
  destination: uploadFolder,
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${crypto.randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const expectedType = allowedTypes[extension];

    if (!expectedType || file.mimetype !== expectedType) {
      return callback(new Error("Only PDF, PNG, and JPG files are allowed."));
    }

    callback(null, true);
  }
});

app.get("/api/health", (req, res) => {
  res.json({ message: "Document system is running" });
});

app.get("/api/documents", (req, res) => {
  const documents = db.prepare(`
    SELECT id, original_name, size, uploaded_at
    FROM documents
    ORDER BY id DESC
  `).all();

  res.json(documents);
});

app.post("/api/documents", (req, res) => {
  upload.single("file")(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Choose a file to upload." });
    }

    try {
      const result = db.prepare(`
        INSERT INTO documents (original_name, stored_name, size)
        VALUES (?, ?, ?)
      `).run(req.file.originalname, req.file.filename, req.file.size);

      res.status(201).json({ id: Number(result.lastInsertRowid) });
    } catch (databaseError) {
      fs.unlinkSync(req.file.path);
      res.status(500).json({ error: "Could not save document details." });
    }
  });
});

app.get("/api/documents/:id/download", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid document ID." });
  }

  const doc = db.prepare(`
    SELECT original_name, stored_name
    FROM documents
    WHERE id = ?
  `).get(id);

  if (!doc) {
    return res.status(404).json
    ({ error: "Document not found." });
  }

  const filePath = path.join(uploadFolder, doc.stored_name);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File is missing from storage." });
  }

  res.download(filePath, doc.original_name);
});
app.delete("/api/documents/:id", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid document ID." });
  }

  const doc = db.prepare(
    "SELECT stored_name FROM documents WHERE id = ?"
  ).get(id);

  if (!doc) {
    return res.status(404).json({ error: "Document not found." });
  }

  try {
    const filePath = path.join(uploadFolder, doc.stored_name);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    db.prepare("DELETE FROM documents WHERE id = ?").run(id);
    return res.json({ message: "Document deleted." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not delete the document." });
  }
});
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});