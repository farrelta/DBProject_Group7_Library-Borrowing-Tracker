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
// CONFIG & HELPERS
// ---------------------------
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key_123";

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

function auth(role) {
  return (req, res, next) => {
    const header = req.headers["authorization"];
    if (!header) return res.status(401).json({ error: "No token provided" });

    const token = header.split(" ")[1];
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) return res.status(403).json({ error: "Invalid token" });

      if (role && decoded.role !== role) {
        console.log(`⚠️ AUTH ERROR: User is '${decoded.role}', but Endpoint requires '${role}'`);
        return res.status(403).json({ error: "Forbidden: Incorrect Role" });
      }

      req.user = decoded;
      next();
    });
  };
}

// ---------------------------
// AUTHENTICATION
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
    
    const token = generateToken({ id: rows[0].userID, role: "borrower" });
    // UPDATED: Return the name as well
    res.json({ message: "Login success", token, name: rows[0].borrowerName });
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
    
    const token = generateToken({ id: rows[0].librarianID, role: "librarian" });
    // UPDATED: Return the name as well
    res.json({ message: "Login success", token, name: rows[0].librarianName });
  });
});

// ---------------------------
// BOOK MANAGEMENT
// ---------------------------
app.get("/books", (req, res) => {
  const sql = `
    SELECT b.*, 
    (SELECT borrowID FROM Borrowing br 
     WHERE br.bookID = b.bookID 
     AND br.status IN ('pending', 'approved', 'return_requested') 
     LIMIT 1) as currentBorrowID
    FROM Book b
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/books", auth("librarian"), (req, res) => {
  const { bookISBN, bookTitle, bookGenre, bookAuthor, quantity } = req.body;
  if (!bookISBN || !bookTitle || !quantity) return res.status(400).json({ error: "Fields required" });
  const qty = parseInt(quantity);

  db.query(
    `INSERT INTO Book (bookISBN, bookTitle, bookAuthor, bookGenre, bookStatus, totalCopies, availableCopies) 
     VALUES (?, ?, ?, ?, 'available', ?, ?)`,
    [bookISBN, bookTitle, bookAuthor, bookGenre, qty, qty],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Book added" });
    }
  );
});

app.delete("/books/:id", auth("librarian"), (req, res) => {
  const bookID = req.params.id;
  db.query(`SELECT * FROM Book WHERE bookID = ?`, [bookID], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows.length === 0) return res.status(404).json({ error: "Book not found" });
    
    const book = rows[0];
    if (book.availableCopies < book.totalCopies) {
      return res.status(400).json({ error: "Cannot delete: Copies are currently borrowed." });
    }

    db.query(`DELETE FROM Borrowing WHERE bookID = ?`, [bookID], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.query(`DELETE FROM Book WHERE bookID = ?`, [bookID], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Deleted" });
      });
    });
  });
});

app.put("/books/:id", auth("librarian"), (req, res) => {
  const bookID = req.params.id;
  const { bookISBN, bookTitle, bookAuthor, bookGenre, totalCopies } = req.body;
  db.query(`SELECT * FROM Book WHERE bookID = ?`, [bookID], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const currentBook = rows[0];
    const newTotal = parseInt(totalCopies);
    const borrowed = currentBook.totalCopies - currentBook.availableCopies;
    if (newTotal < borrowed) return res.status(400).json({ error: "Total cannot be less than borrowed amount" });

    const newAvailable = newTotal - borrowed;
    const sql = `UPDATE Book SET bookISBN=?, bookTitle=?, bookAuthor=?, bookGenre=?, totalCopies=?, availableCopies=? WHERE bookID=?`;
    db.query(sql, [bookISBN, bookTitle, bookAuthor, bookGenre, newTotal, newAvailable, bookID], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Updated" });
    });
  });
});

// ---------------------------
// BORROWING
// ---------------------------
app.post("/borrow", auth("borrower"), (req, res) => {
  const { bookID } = req.body;
  db.query(`SELECT * FROM Book WHERE bookID = ?`, [bookID], (err, rows) => {
    if (rows.length === 0) return res.status(404).json({ error: "Book not found" });
    const book = rows[0];

    if (book.availableCopies < 1) return res.status(400).json({ error: "Out of Stock" });

    const newStatus = (book.availableCopies - 1 === 0) ? 'borrowed' : 'available';
    db.query(`UPDATE Book SET availableCopies=availableCopies-1, bookStatus=? WHERE bookID=?`, [newStatus, bookID], (err) => {
        if(err) return res.status(500).json({ error: err.message });
        db.query(`INSERT INTO Borrowing (borrowDate, bookID, userID, status) VALUES (CURDATE(), ?, ?, 'pending')`,
          [bookID, req.user.id], 
          (err) => {
             if(err) return res.status(500).json({ error: err.message });
             res.json({ message: "Request sent" });
          }
        );
    });
  });
});

app.get("/borrow/requests", auth("librarian"), (req, res) => {
  const sql = `SELECT br.borrowID, b.bookTitle, u.borrowerName, br.status FROM Borrowing br JOIN Book b ON br.bookID=b.bookID JOIN Borrower u ON br.userID=u.userID WHERE br.status IN ('pending', 'return_requested')`;
  db.query(sql, (err, rows) => { res.json(rows); });
});

app.post("/borrow/approve", auth("librarian"), (req, res) => {
  const { borrowID, days } = req.body;
  db.query(`UPDATE Borrowing SET status='approved', librarianID=?, dueDate=DATE_ADD(CURDATE(), INTERVAL ? DAY) WHERE borrowID=?`, 
    [req.user.id, days || 7, borrowID], 
    (err) => { res.json({ message: "Approved" }); }
  );
});

app.post("/return", auth("librarian"), (req, res) => {
  const { borrowID } = req.body;
  db.query(`UPDATE Borrowing SET returnDate=CURDATE(), status='returned', fine=GREATEST(0, DATEDIFF(CURDATE(), dueDate))*5 WHERE borrowID=?`, [borrowID], (err) => {
    if(err) return res.status(500).json({error: err.message});
    db.query(`SELECT bookID FROM Borrowing WHERE borrowID=?`, [borrowID], (err, rows) => {
      const bookID = rows[0].bookID;
      db.query(`UPDATE Book SET availableCopies=availableCopies+1, bookStatus='available' WHERE bookID=?`, [bookID], () => {
         db.query(`SELECT fine FROM Borrowing WHERE borrowID=?`, [borrowID], (err, f) => {
            const fine = f[0]?.fine || 0;
            res.json({ message: fine > 0 ? `Returned with Fine: ${fine}` : "Returned" });
         });
      });
    });
  });
});

app.get("/borrower/my-books", auth("borrower"), (req, res) => {
  const sql = `SELECT br.borrowID, b.bookTitle, br.dueDate, br.status FROM Borrowing br JOIN Book b ON br.bookID=b.bookID WHERE br.userID=? AND br.status IN ('approved', 'pending', 'return_requested')`;
  db.query(sql, [req.user.id], (err, rows) => { res.json(rows); });
});

app.post("/borrower/request-return", auth("borrower"), (req, res) => {
  const { borrowID } = req.body;
  db.query(`UPDATE Borrowing SET status='return_requested' WHERE borrowID=? AND status='approved'`, [borrowID], (err, result) => {
     if(result.affectedRows === 0) return res.status(400).json({error: "Invalid request"});
     res.json({ message: "Return requested" });
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));