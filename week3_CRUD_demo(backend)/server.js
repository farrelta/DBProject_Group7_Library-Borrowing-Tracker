require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------
// Helpers
// ---------------------------
function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "8h" });
}

function auth(role) {
  return (req, res, next) => {
    const header = req.headers["authorization"];
    if (!header) return res.status(401).json({ error: "No token" });

    const token = header.split(" ")[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return res.status(403).json({ error: "Invalid token" });

      if (role && decoded.role !== role)
        return res.status(403).json({ error: "Forbidden" });

      req.user = decoded;
      next();
    });
  };
}

// ---------------------------
// BORROWER AUTH
// ---------------------------
app.post("/borrower/register", async (req, res) => {
  const { borrowerName, borrowerEmail, borrowerPass } = req.body;
  const hash = await bcrypt.hash(borrowerPass, 10);

  db.query(
    `INSERT INTO Borrower (borrowerName, borrowerEmail, borrowerPass) VALUES (?, ?, ?)`,
    [borrowerName, borrowerEmail, hash],
    (err) => {
      if (err) return res.status(400).json({ error: "Email already used" });
      res.json({ message: "Borrower registered" });
    }
  );
});

app.post("/borrower/login", (req, res) => {
  const { borrowerEmail, borrowerPass } = req.body;

  db.query(
    `SELECT * FROM Borrower WHERE borrowerEmail = ?`,
    [borrowerEmail],
    async (err, rows) => {
      if (err || rows.length === 0)
        return res.status(400).json({ error: "Borrower not found" });

      const borrower = rows[0];
      const match = await bcrypt.compare(borrowerPass, borrower.borrowerPass);
      if (!match) return res.status(400).json({ error: "Wrong password" });

      const token = generateToken({ id: borrower.userID, role: "borrower" });
      res.json({ message: "Login success", token });
    }
  );
});

// ---------------------------
// LIBRARIAN AUTH
// ---------------------------
app.post("/librarian/register", async (req, res) => {
  const { librarianName, librarianEmail, librarianPass } = req.body;
  const hash = await bcrypt.hash(librarianPass, 10);

  db.query(
    `INSERT INTO Librarian (librarianName, librarianEmail, librarianPass) VALUES (?, ?, ?)`,
    [librarianName, librarianEmail, hash],
    (err) => {
      if (err) return res.status(400).json({ error: "Email already used" });
      res.json({ message: "Librarian registered" });
    }
  );
});

app.post("/librarian/login", (req, res) => {
  const { librarianEmail, librarianPass } = req.body;

  db.query(
    `SELECT * FROM Librarian WHERE librarianEmail = ?`,
    [librarianEmail],
    async (err, rows) => {
      if (err || rows.length === 0)
        return res.status(400).json({ error: "Librarian not found" });

      const librarian = rows[0];
      const match = await bcrypt.compare(librarianPass, librarian.librarianPass);
      if (!match) return res.status(400).json({ error: "Wrong password" });

      const token = generateToken({ id: librarian.librarianID, role: "librarian" });
      res.json({ message: "Login success", token });
    }
  );
});

// ---------------------------
// BOOK MANAGEMENT
// ---------------------------
app.get("/books", (req, res) => {
  db.query(`SELECT * FROM Book`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/books", auth("librarian"), (req, res) => {
  const { bookISBN, bookTitle, bookGenre } = req.body;
  db.query(
    `INSERT INTO Book (bookISBN, bookTitle, bookGenre, bookStatus) VALUES (?, ?, ?, 'available')`,
    [bookISBN, bookTitle, bookGenre],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Book added" });
    }
  );
});

app.delete("/books/:id", auth("librarian"), (req, res) => {
  db.query(`DELETE FROM Book WHERE bookID = ?`, [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Book deleted" });
  });
});

// ---------------------------
// NEW: APPROVAL WORKFLOW
// ---------------------------

// 1. Borrower Requests a Book
app.post("/borrow", auth("borrower"), (req, res) => {
  const { bookID } = req.body;

  db.query(`SELECT * FROM Book WHERE bookID = ?`, [bookID], (err, rows) => {
    if (rows.length === 0) return res.status(404).json({ error: "Book not found" });
    if (rows[0].bookStatus !== "available")
      return res.status(400).json({ error: "Book not available" });

    // Mark book as pending so others can't take it
    db.query(`UPDATE Book SET bookStatus='pending' WHERE bookID=?`, [bookID]);

    // Create borrowing record with 'pending' status (Librarian ID is NULL for now)
    db.query(
      `INSERT INTO Borrowing (borrowDate, bookID, userID, status) VALUES (CURDATE(), ?, ?, 'pending')`,
      [bookID, req.user.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Request sent. Waiting for approval." });
      }
    );
  });
});

// 2. Librarian Sees Requests
app.get("/borrow/requests", auth("librarian"), (req, res) => {
  const sql = `
    SELECT br.borrowID, b.bookTitle, u.borrowerName, br.borrowDate 
    FROM Borrowing br
    JOIN Book b ON br.bookID = b.bookID
    JOIN Borrower u ON br.userID = u.userID
    WHERE br.status = 'pending'
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 3. Librarian Approves Request
app.post("/borrow/approve", auth("librarian"), (req, res) => {
  const { borrowID } = req.body;
  const librarianID = req.user.id; // Get ID from logged-in token

  // Update Borrowing: set status to approved and assign Librarian
  db.query(
    `UPDATE Borrowing SET status='approved', librarianID=? WHERE borrowID=?`,
    [librarianID, borrowID],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });

      // Update Book status to 'borrowed'
      db.query(
        `UPDATE Book SET bookStatus='borrowed' 
         WHERE bookID = (SELECT bookID FROM Borrowing WHERE borrowID=?)`,
        [borrowID]
      );

      res.json({ message: "Borrowing approved" });
    }
  );
});

// 4. Return Book (Librarian)
app.post("/return", auth("librarian"), (req, res) => {
  const { borrowID } = req.body;

  db.query(
    `UPDATE Borrowing SET returnDate=CURDATE(), status='returned' WHERE borrowID=?`,
    [borrowID],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });

      // Make book available again
      db.query(
        `UPDATE Book SET bookStatus='available' 
         WHERE bookID = (SELECT bookID FROM Borrowing WHERE borrowID=?)`,
        [borrowID]
      );

      res.json({ message: "Book returned successfully" });
    }
  );
});

// ---------------------------
// SERVER START
// ---------------------------
app.listen(process.env.PORT || 5000, () =>
  console.log("🚀 Server running on port " + (process.env.PORT || 5000))
);