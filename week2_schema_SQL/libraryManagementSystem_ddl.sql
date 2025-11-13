create database libraryManagementSystem;
use libraryManagementSystem;

CREATE TABLE Borrower
(
  userID INT NOT NULL,
  borrowerName INT NOT NULL,
  borrowerEmail INT NOT NULL,
  borrowerPass INT NOT NULL,
  PRIMARY KEY (userID)
);

CREATE TABLE Librarian
(
  librarianID INT NOT NULL,
  librarianName INT NOT NULL,
  librarianEmail INT NOT NULL,
  librarianPass INT NOT NULL,
  PRIMARY KEY (librarianID)
);

CREATE TABLE Book
(
  bookID INT NOT NULL,
  bookISBN INT NOT NULL,
  bookTitle INT NOT NULL,
  bookGenre INT NOT NULL,
  bookStatus INT NOT NULL,
  PRIMARY KEY (bookID)
);

CREATE TABLE bookAuthor
(
  bookAuthor INT NOT NULL,
  bookID INT NOT NULL,
  PRIMARY KEY (bookAuthor, bookID),
  FOREIGN KEY (bookID) REFERENCES Book(bookID)
);

CREATE TABLE Borrowing
(
  borrowID INT NOT NULL,
  borrowDate INT NOT NULL,
  returnDate INT NOT NULL,
  fine INT,
  bookID INT NOT NULL,
  userID INT NOT NULL,
  librarianID INT NOT NULL,
  PRIMARY KEY (borrowID),
  FOREIGN KEY (bookID) REFERENCES Book(bookID),
  FOREIGN KEY (userID) REFERENCES Borrower(userID),
  FOREIGN KEY (librarianID) REFERENCES Librarian(librarianID)
);

CREATE TABLE Manages
(
  librarianID INT NOT NULL,
  bookID INT NOT NULL,
  PRIMARY KEY (librarianID, bookID),
  FOREIGN KEY (librarianID) REFERENCES Librarian(librarianID),
  FOREIGN KEY (bookID) REFERENCES Book(bookID)
);