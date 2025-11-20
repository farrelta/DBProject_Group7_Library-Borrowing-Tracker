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
    `INSERT INTO Borrower (borrowerName, borrowerEmail, borrowerPass)
     VALUES (?, ?, ?)`,
    [borrowerName, borrowerEmail, hash],
    err => {
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

      const token = generateToken({
        id: borrower.userID,
        role: "borrower"
      });

      res.json({
        message: "Login success",
        token,
        borrower: {
          id: borrower.userID,
          name: borrower.borrowerName
        }
      });
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
    `INSERT INTO Librarian (librarianName, librarianEmail, librarianPass)
     VALUES (?, ?, ?)`,
    [librarianName, librarianEmail, hash],
    err => {
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

      const token = generateToken({
        id: librarian.librarianID,
        role: "librarian"
      });

      res.json({
        message: "Login success",
        token,
        librarian: {
          id: librarian.librarianID,
          name: librarian.librarianName
        }
      });
    }
  );
});

// ---------------------------
// BOOK CRUD (LIBRARIAN ONLY)
// ---------------------------

// Get all books
app.get("/books", (req, res) => {
  db.query(`SELECT * FROM Book`, (err, rows) => {
    res.json(rows);
  });
});

// Add book (librarian only)
app.post("/books", auth("librarian"), (req, res) => {
  const { bookISBN, bookTitle, bookGenre, bookStatus } = req.body;

  db.query(
    `INSERT INTO Book (bookISBN, bookTitle, bookGenre, bookStatus)
     VALUES (?, ?, ?, ?)`,
    [bookISBN, bookTitle, bookGenre, bookStatus || "available"],
    err => {
      if (err) throw err;
      res.json({ message: "Book added" });
    }
  );
});

// Delete book (librarian only)
app.delete("/books/:id", auth("librarian"), (req, res) => {
  db.query(`DELETE FROM Book WHERE bookID = ?`, [req.params.id], err => {
    res.json({ message: "Book deleted" });
  });
});

// ---------------------------
// BORROWING (Borrower + Librarian)
// ---------------------------

// Borrow book (borrower)
app.post("/borrow", auth("borrower"), (req, res) => {
  const { bookID, librarianID } = req.body;

  db.query(`SELECT * FROM Book WHERE bookID = ?`, [bookID], (err, rows) => {
    if (rows[0].bookStatus !== "available")
      return res.status(400).json({ error: "Book not available" });

    db.query(`UPDATE Book SET bookStatus='borrowed' WHERE bookID=?`, [bookID]);

    db.query(
      `INSERT INTO Borrowing (borrowDate, bookID, userID, librarianID)
       VALUES (CURDATE(), ?, ?, ?)`,
      [bookID, req.user.id, librarianID],
      err => {
        res.json({ message: "Book borrowed" });
      }
    );
  });
});

// Return book (librarian updates)
app.post("/return", auth("librarian"), (req, res) => {
  const { borrowID } = req.body;

  db.query(
    `UPDATE Borrowing SET returnDate=CURDATE() WHERE borrowID=?`,
    [borrowID]
  );

  db.query(
    `UPDATE Book SET bookStatus='available' 
     WHERE bookID = (SELECT bookID FROM Borrowing WHERE borrowID=?)`,
    [borrowID]
  );

  res.json({ message: "Book returned" });
});

// ---------------------------
app.listen(process.env.PORT, () =>
  console.log("🚀 Server running on port " + process.env.PORT)
);
