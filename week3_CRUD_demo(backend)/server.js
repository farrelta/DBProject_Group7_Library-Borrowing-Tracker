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
// AUTHENTICATION (Borrower & Librarian)
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
  db.query(`SELECT * FROM Borrower WHERE borrowerEmail = ?`, [borrowerEmail], async (err, rows) => {
    if (err || rows.length === 0) return res.status(400).json({ error: "Borrower not found" });
    const match = await bcrypt.compare(borrowerPass, rows[0].borrowerPass);
    if (!match) return res.status(400).json({ error: "Wrong password" });
    res.json({ message: "Login success", token: generateToken({ id: rows[0].userID, role: "borrower" }) });
  });
});

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
  db.query(`SELECT * FROM Librarian WHERE librarianEmail = ?`, [librarianEmail], async (err, rows) => {
    if (err || rows.length === 0) return res.status(400).json({ error: "Librarian not found" });
    const match = await bcrypt.compare(librarianPass, rows[0].librarianPass);
    if (!match) return res.status(400).json({ error: "Wrong password" });
    res.json({ message: "Login success", token: generateToken({ id: rows[0].librarianID, role: "librarian" }) });
  });
});

// ---------------------------
// BOOK MANAGEMENT
// ---------------------------

// 1. GET ALL BOOKS (With your specific subquery for Borrow ID)
app.get("/books", (req, res) => {
  const sql = `
    SELECT b.*, 
    (SELECT borrowID FROM Borrowing br 
     WHERE br.bookID = b.bookID 
     AND br.status IN ('pending', 'approved') 
     LIMIT 1) as currentBorrowID
    FROM Book b
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 2. ADD BOOK (Librarian Only)
app.post("/books", auth("librarian"), (req, res) => {
  const { bookISBN, bookTitle, bookGenre } = req.body;
  
  // Validation to prevent empty additions
  if (!bookISBN || !bookTitle) return res.status(400).json({ error: "ISBN and Title are required" });

  db.query(
    `INSERT INTO Book (bookISBN, bookTitle, bookGenre, bookStatus) VALUES (?, ?, ?, 'available')`,
    [bookISBN, bookTitle, bookGenre],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Book added" });
    }
  );
});

// 3. DELETE BOOK (Fixed: Deletes history first)
app.delete("/books/:id", auth("librarian"), (req, res) => {
  const bookID = req.params.id;
  // Clear history first
  db.query(`DELETE FROM Borrowing WHERE bookID = ?`, [bookID], (err) => {
    if (err) return res.status(500).json({ error: "Failed to clear history: " + err.message });
    // Then delete book
    db.query(`DELETE FROM Book WHERE bookID = ?`, [bookID], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Book and history deleted" });
    });
  });
});

// ---------------------------
// BORROWING FLOW
// ---------------------------

// A. Borrower Requests Book
app.post("/borrow", auth("borrower"), (req, res) => {
  const { bookID } = req.body;
  db.query(`SELECT * FROM Book WHERE bookID = ?`, [bookID], (err, rows) => {
    if (rows.length === 0) return res.status(404).json({ error: "Book not found" });
    if (rows[0].bookStatus !== "available") return res.status(400).json({ error: "Book not available" });

    db.query(`UPDATE Book SET bookStatus='pending' WHERE bookID=?`, [bookID]);
    db.query(
      `INSERT INTO Borrowing (borrowDate, bookID, userID, status) VALUES (CURDATE(), ?, ?, 'pending')`,
      [bookID, req.user.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Request sent" });
      }
    );
  });
});

// B. Librarian Views Requests
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

// C. Librarian Approves (With Due Date Calculation)
app.post("/borrow/approve", auth("librarian"), (req, res) => {
  const { borrowID, days } = req.body;
  const librarianID = req.user.id;
  const daysToBorrow = days || 7;

  db.query(
    `UPDATE Borrowing 
     SET status='approved', librarianID=?, dueDate = DATE_ADD(CURDATE(), INTERVAL ? DAY) 
     WHERE borrowID=?`,
    [librarianID, daysToBorrow, borrowID],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.query(
        `UPDATE Book SET bookStatus='borrowed' WHERE bookID = (SELECT bookID FROM Borrowing WHERE borrowID=?)`,
        [borrowID]
      );
      res.json({ message: "Approved" });
    }
  );
});

// D. Librarian Returns Book
app.post("/return", auth("librarian"), (req, res) => {
  const { borrowID } = req.body;
  db.query(
    `UPDATE Borrowing SET returnDate=CURDATE(), status='returned' WHERE borrowID=?`,
    [borrowID],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.query(
        `UPDATE Book SET bookStatus='available' WHERE bookID = (SELECT bookID FROM Borrowing WHERE borrowID=?)`,
        [borrowID]
      );
      res.json({ message: "Returned" });
    }
  );
});

// E. Borrower Views My Books
app.get("/borrower/my-books", auth("borrower"), (req, res) => {
  const sql = `
    SELECT b.bookTitle, br.dueDate, br.status 
    FROM Borrowing br
    JOIN Book b ON br.bookID = b.bookID
    WHERE br.userID = ? AND br.status IN ('approved', 'pending')
  `;
  db.query(sql, [req.user.id], (err, rows) => {
    res.json(rows);
  });
});

// ---------------------------
// START SERVER
// ---------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));