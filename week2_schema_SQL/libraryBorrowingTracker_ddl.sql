CREATE DATABASE librarydb;
USE librarydb;

CREATE TABLE Borrower (
  userID INT AUTO_INCREMENT PRIMARY KEY,
  borrowerName VARCHAR(100),
  borrowerEmail VARCHAR(100) UNIQUE,
  borrowerPass VARCHAR(255)
);

CREATE TABLE Librarian (
  librarianID INT AUTO_INCREMENT PRIMARY KEY,
  librarianName VARCHAR(100),
  librarianEmail VARCHAR(100) UNIQUE,
  librarianPass VARCHAR(255)
);

CREATE TABLE Book (
  bookID INT AUTO_INCREMENT PRIMARY KEY,
  bookISBN VARCHAR(20),
  bookTitle VARCHAR(255),
  bookAuthor VARCHAR(255),
  bookGenre VARCHAR(100),
  bookStatus ENUM('available', 'pending', 'borrowed') DEFAULT 'available',
  totalCopies INT DEFAULT 1,
  availableCopies INT DEFAULT 1
);

CREATE TABLE Borrowing (
  borrowID INT AUTO_INCREMENT PRIMARY KEY,
  borrowDate DATE,
  returnDate DATE,
  fine DECIMAL(10,2) DEFAULT 0.00,
  bookID INT,
  userID INT,
  librarianID INT,
  dueDate DATE,
  status ENUM('pending', 'approved', 'return_requested', 'returned') DEFAULT 'pending',
  FOREIGN KEY (bookID) REFERENCES Book(bookID),
  FOREIGN KEY (userID) REFERENCES Borrower(userID) ON DELETE CASCADE,
  FOREIGN KEY (librarianID) REFERENCES Librarian(librarianID) ON DELETE SET NULL
);
