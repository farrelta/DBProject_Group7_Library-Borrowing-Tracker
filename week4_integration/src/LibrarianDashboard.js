import React, { useEffect, useState } from 'react';
import api from './api';

export default function LibrarianDashboard() {
  const [books, setBooks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [newBook, setNewBook] = useState({ bookISBN: '', bookTitle: '', bookGenre: '' });
  const [returnId, setReturnId] = useState('');

  useEffect(() => {
    fetchBooks();
    fetchRequests();
  }, []);

  const handleApprove = async (borrowID) => {
    // 1. Ask Librarian for the duration
    const daysStr = prompt("Enter number of days for borrowing:", "7");
    if (daysStr === null) return; // Cancelled
    
    const days = parseInt(daysStr);
    if (isNaN(days) || days <= 0) return alert("Invalid number of days");

    try {
      // 2. Send borrowID AND days to backend
      await api.post('/borrow/approve', { borrowID, days });
      alert('Request Approved!');
      fetchRequests(); 
      fetchBooks();    
    } catch (err) { alert('Error approving request'); }
  };

  const fetchBooks = async () => {
    const res = await api.get('/books');
    setBooks(res.data);
  };

  const fetchRequests = async () => {
    const res = await api.get('/borrow/requests');
    setRequests(res.data);
  };

  const handleAddBook = async (e) => {
    e.preventDefault();
    try {
      await api.post('/books', newBook);
      alert('Book added');
      setNewBook({ bookISBN: '', bookTitle: '', bookGenre: '' }); // Clear form
      fetchBooks();
    } catch (err) { alert('Error adding book'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this book?")) return;
    try {
      await api.delete(`/books/${id}`);
      fetchBooks();
    } catch (err) { alert('Error deleting book'); }
  };

  const handleReturn = async () => {
    if(!returnId) return alert("Please enter a Borrow ID");
    try {
      await api.post('/return', { borrowID: returnId });
      alert('Book Returned Successfully');
      setReturnId('');
      fetchBooks();
    } catch (err) { alert('Error returning book'); }
  };

  return (
    <div className="container">
      <h1>Librarian Dashboard</h1>

      {/* --- SECTION 1: APPROVALS --- */}
      <div className="section" style={{border: '2px solid #ffc107'}}>
        <h3>🔔 Pending Approvals</h3>
        {requests.length === 0 ? <p>No pending requests.</p> : (
          <table style={{width: '100%', borderCollapse: 'collapse'}}>
            <thead>
              <tr style={{background: '#f8f9fa', textAlign: 'left'}}>
                <th style={{padding: '8px'}}>ID</th>
                <th>Borrower</th>
                <th>Book</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(req => (
                <tr key={req.borrowID} style={{borderBottom: '1px solid #eee'}}>
                  <td style={{padding: '8px'}}>{req.borrowID}</td>
                  <td>{req.borrowerName}</td>
                  <td>{req.bookTitle}</td>
                  <td>
                    <button onClick={() => handleApprove(req.borrowID)} style={{backgroundColor: '#28a745'}}>
                      Approve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* --- SECTION 2: RETURNS --- */}
      <div className="section">
        <h3>↩️ Process Return</h3>
        <div style={{display: 'flex', gap: '10px'}}>
          <input 
            placeholder="Enter Borrow ID (from user)" 
            value={returnId} 
            onChange={e => setReturnId(e.target.value)} 
          />
          <button onClick={handleReturn} style={{backgroundColor: '#17a2b8'}}>Return Book</button>
        </div>
      </div>

      {/* --- SECTION 3: ADD BOOK --- */}
      <div className="section">
        <h3>📚 Add New Book</h3>
        <form onSubmit={handleAddBook} style={{display: 'flex', gap: '10px'}}>
          <input placeholder="ISBN" value={newBook.bookISBN} onChange={e => setNewBook({...newBook, bookISBN: e.target.value})} required />
          <input placeholder="Title" value={newBook.bookTitle} onChange={e => setNewBook({...newBook, bookTitle: e.target.value})} required />
          <input placeholder="Genre" value={newBook.bookGenre} onChange={e => setNewBook({...newBook, bookGenre: e.target.value})} required />
          <button type="submit">Add</button>
        </form>
      </div>

      {/* --- SECTION 4: CATALOG --- */}
      <h3>All Books</h3>
      <ul>
        {books.map(book => (
          <li key={book.bookID} style={{padding: '10px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <span>
              <strong>{book.bookTitle}</strong> 
              <span style={{fontSize: '0.9em', color: '#555'}}> ({book.bookStatus})</span>
              
              {/* NEW: Display Borrow ID if it exists */}
              {book.currentBorrowID && (
                <span style={{
                   marginLeft: '15px', 
                   backgroundColor: '#e2e6ea', 
                   padding: '2px 8px', 
                   borderRadius: '4px', 
                   fontSize: '0.85em', 
                   color: '#333', 
                   border: '1px solid #ccc'
                }}>
                  🆔 Borrow ID: <strong>{book.currentBorrowID}</strong>
                </span>
              )}
            </span>

            <button onClick={() => handleDelete(book.bookID)} style={{backgroundColor: '#dc3545', padding: '5px 10px', fontSize: '0.8em'}}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}