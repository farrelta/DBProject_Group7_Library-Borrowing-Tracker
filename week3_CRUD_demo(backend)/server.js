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

// 1. GET ALL BOOKS
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

// 2. ADD BOOK
app.post("/books", auth("librarian"), (req, res) => {
  const { bookISBN, bookTitle, bookGenre, bookAuthor, quantity } = req.body;
  if (!bookISBN || !bookTitle || !quantity) return res.status(400).json({ error: "ISBN, Title, and Quantity are required" });

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

// 3. DELETE BOOK (Hard Delete + History Clear)
app.delete("/books/:id", auth("librarian"), (req, res) => {
  const bookID = req.params.id;

  db.query(`SELECT * FROM Book WHERE bookID = ?`, [bookID], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows.length === 0) return res.status(404).json({ error: "Book not found" });

    const book = rows[0];

    // Check availability against total to see if copies are missing
    if (book.availableCopies < book.totalCopies) {
      return res.status(400).json({ 
        error: "Cannot delete: One or more copies are currently borrowed or pending approval." 
      });
    }

    db.query(`DELETE FROM Borrowing WHERE bookID = ?`, [bookID], (err) => {
      if (err) return res.status(500).json({ error: "Failed to clear history: " + err.message });

      db.query(`DELETE FROM Book WHERE bookID = ?`, [bookID], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Book and its history permanently deleted." });
      });
    });
  });
});

// 4. UPDATE BOOK
app.put("/books/:id", auth("librarian"), (req, res) => {
  const bookID = req.params.id;
  const { bookISBN, bookTitle, bookAuthor, bookGenre, totalCopies } = req.body;

  db.query(`SELECT * FROM Book WHERE bookID = ?`, [bookID], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows.length === 0) return res.status(404).json({ error: "Book not found" });

    const currentBook = rows[0];
    const newTotal = parseInt(totalCopies);
    const currentlyBorrowed = currentBook.totalCopies - currentBook.availableCopies;

    if (newTotal < currentlyBorrowed) {
      return res.status(400).json({ 
        error: `Cannot reduce total copies to ${newTotal}. ${currentlyBorrowed} copies are currently borrowed.` 
      });
    }

    const newAvailable = newTotal - currentlyBorrowed;

    const sql = `
      UPDATE Book 
      SET bookISBN=?, bookTitle=?, bookAuthor=?, bookGenre=?, totalCopies=?, availableCopies=? 
      WHERE bookID=?
    `;

    db.query(
      sql, 
      [bookISBN, bookTitle, bookAuthor, bookGenre, newTotal, newAvailable, bookID], 
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Book updated successfully" });
      }
    );
  });
});

// ---------------------------
// BORROWING FLOW
// ---------------------------

// A. Borrower Requests Book (UPDATED: Decrements Quantity)
app.post("/borrow", auth("borrower"), (req, res) => {
  const { bookID } = req.body;
  
  db.query(`SELECT * FROM Book WHERE bookID = ?`, [bookID], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows.length === 0) return res.status(404).json({ error: "Book not found" });

    const book = rows[0];

    // 1. Check if ANY copies are left
    if (book.availableCopies < 1) {
      return res.status(400).json({ error: "Sorry, all copies are currently borrowed or reserved." });
    }

    // 2. Decrement Logic
    // If copies go to 0, status becomes 'borrowed' (unavailable). Else stays 'available'.
    const newStatus = (book.availableCopies - 1 === 0) ? 'borrowed' : 'available';

    // 3. Update Book Table (Subtract 1)
    db.query(
      `UPDATE Book SET availableCopies = availableCopies - 1, bookStatus = ? WHERE bookID = ?`, 
      [newStatus, bookID],
      (err) => {
        if (err) return res.status(500).json({ error: "Failed to update book: " + err.message });

        // 4. Create Borrow Record
        db.query(
          `INSERT INTO Borrowing (borrowDate, bookID, userID, status) VALUES (CURDATE(), ?, ?, 'pending')`,
          [bookID, req.user.id],
          (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Request sent. A copy has been reserved for you." });
          }
        );
      }
    );
  });
});

// B. Librarian Views Requests
app.get("/borrow/requests", auth("librarian"), (req, res) => {
  const sql = `
    SELECT br.borrowID, b.bookTitle, u.borrowerName, br.borrowDate, br.status 
    FROM Borrowing br
    JOIN Book b ON br.bookID = b.bookID
    JOIN Borrower u ON br.userID = u.userID
    WHERE br.status IN ('pending', 'return_requested') 
    ORDER BY br.status ASC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// C. Librarian Approves (UPDATED: Does NOT change book status again)
app.post("/borrow/approve", auth("librarian"), (req, res) => {
  const { borrowID, days } = req.body;
  const librarianID = req.user.id;
  const daysToBorrow = days || 7;

  // We only update the Borrowing table here.
  // We do NOT update the Book table because the copy was reserved (-1) when the user Requested it.
  db.query(
    `UPDATE Borrowing 
     SET status='approved', librarianID=?, dueDate = DATE_ADD(CURDATE(), INTERVAL ? DAY) 
     WHERE borrowID=?`,
    [librarianID, daysToBorrow, borrowID],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Approved" });
    }
  );
});

// D. Librarian Returns Book (UPDATED: Adds Quantity Back)
app.post("/return", auth("librarian"), (req, res) => {
  const { borrowID } = req.body;
  const FINE_PER_DAY = 5;

  const updateSql = `
    UPDATE Borrowing 
    SET returnDate = CURDATE(), 
        status = 'returned',
        fine = GREATEST(0, DATEDIFF(CURDATE(), dueDate)) * ? 
    WHERE borrowID = ?
  `;

  db.query(updateSql, [FINE_PER_DAY, borrowID], (err) => {
    if (err) return res.status(500).json({ error: err.message });

    // 1. Find the book ID
    db.query(`SELECT bookID FROM Borrowing WHERE borrowID=?`, [borrowID], (err, rows) => {
        if (rows.length === 0) return res.json({ message: "Returned (Book ID not found)" });
        const bookID = rows[0].bookID;

        // 2. INCREMENT QUANTITY (+1) and ensure status is 'available'
        db.query(
            `UPDATE Book SET availableCopies = availableCopies + 1, bookStatus='available' WHERE bookID = ?`,
            [bookID],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                
                // 3. Return response with fine info
                db.query(`SELECT fine FROM Borrowing WHERE borrowID = ?`, [borrowID], (err, fRows) => {
                    const fineAmount = fRows[0]?.fine || 0;
                    const msg = fineAmount > 0 ? `Book returned. ⚠️ LATE FEE APPLIED: ${fineAmount}` : "Book returned successfully.";
                    res.json({ message: msg });
                });
            }
        );
    });
  });
});

// E. Borrower Views My Books
app.get("/borrower/my-books", auth("borrower"), (req, res) => {
  const sql = `
    SELECT br.borrowID, b.bookTitle, br.dueDate, br.status 
    FROM Borrowing br
    JOIN Book b ON br.bookID = b.bookID
    WHERE br.userID = ? AND br.status IN ('approved', 'pending')
  `;
  db.query(sql, [req.user.id], (err, rows) => {
    res.json(rows);
  });
});

// F. Borrower Requests Return
app.post("/borrower/request-return", auth("borrower"), (req, res) => {
  const { borrowID } = req.body;
  const sql = `UPDATE Borrowing SET status = 'return_requested' WHERE borrowID = ? AND status = 'approved'`;
  db.query(sql, [borrowID], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(400).json({ error: "Cannot request return (Invalid ID or not currently borrowed)" });
    res.json({ message: "Return requested. Please return the book to the desk." });
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));