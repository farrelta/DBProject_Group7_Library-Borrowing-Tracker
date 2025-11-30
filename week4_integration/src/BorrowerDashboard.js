import React, { useEffect, useState } from 'react';
import api from './api';
import './styles/Borrower.css';

export default function BorrowerDashboard() {
  const [books, setBooks] = useState([]);
  const [myBooks, setMyBooks] = useState([]); 
  
  // NEW: Search State
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchBooks(); fetchMyBooks(); }, []);

  const fetchBooks = async () => { try { const res = await api.get('/books'); setBooks(res.data); } catch(err) { console.error(err); } };
  const fetchMyBooks = async () => { try { const res = await api.get('/borrower/my-books'); setMyBooks(res.data); } catch(err) { console.error(err); } };

  const handleRequest = async (bookID) => {
    try { await api.post('/borrow', { bookID }); alert('Request sent!'); fetchBooks(); fetchMyBooks(); } 
    catch (err) { alert(err.response?.data?.error || 'Request failed'); }
  };

  const handleReturnRequest = async (borrowID) => {
    if(!window.confirm("Are you ready to return this book?")) return;
    try { await api.post('/borrower/request-return', { borrowID }); alert('Return requested!'); fetchMyBooks(); } 
    catch (err) { alert('Error requesting return'); }
  };

  // NEW: Filter Logic
  const filteredBooks = books.filter(book => {
    const lowerSearch = searchTerm.toLowerCase();
    return (
      book.bookTitle.toLowerCase().startsWith(lowerSearch) ||
      (book.bookAuthor && book.bookAuthor.toLowerCase().startsWith(lowerSearch))
    );
  });

  return (
    <div className="container">
      <h1>Borrower Dashboard</h1>

      <div className="section success">
        <h3>📖 My Active Books</h3>
        {myBooks.length === 0 ? <p>You have no borrowed books.</p> : (
          <ul className="book-list">
            {myBooks.map((item, index) => {
              const isOverdue = item.dueDate && new Date() > new Date(item.dueDate);
              const isReturnRequested = item.status === 'return_requested';
              return (
                <li key={index} className="book-list-item">
                  <div>
                    <strong>{item.bookTitle}</strong><br/>
                    Status: <span className={isReturnRequested ? 'text-warning ml-2' : 'text-bold ml-2'}>
                      {isReturnRequested ? ' WAITING FOR LIBRARIAN' : ` ${item.status.toUpperCase()}`}
                    </span>
                    {item.status === 'approved' && (
                      <div className="mt-2 text-muted">
                        Due: {item.dueDate ? item.dueDate.split('T')[0] : 'N/A'}
                        {isOverdue && <span className="text-danger ml-2">⚠️ OVERDUE</span>}
                      </div>
                    )}
                  </div>
                  {item.status === 'approved' && <button onClick={() => handleReturnRequest(item.borrowID)} className="btn-secondary btn-sm">Request Return</button>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <h3>Library Catalog</h3>

      {/* NEW: Search Input */}
      <input 
        type="text" 
        placeholder="🔍 Search by Title or Author..." 
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ width: '100%', padding: '12px', marginBottom: '20px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
      />

      <div className="catalog-grid">
        {filteredBooks.length === 0 ? <p className="text-muted text-center" style={{gridColumn: '1 / -1'}}>No books found matching your search.</p> : (
          filteredBooks.map(book => (
            <div key={book.bookID} className="book-card">
              <h4>{book.bookTitle}</h4>
              <p className="text-muted">by {book.bookAuthor || 'Unknown'}</p>
              <p className="text-muted">{book.bookGenre}</p>
              <p>Availability: <strong> {book.availableCopies} </strong> / {book.totalCopies} left</p>
              {book.availableCopies > 0 ? (
                <button onClick={() => handleRequest(book.bookID)} className="btn-primary">Request Copy</button>
              ) : <button disabled className="btn-disabled">Out of Stock</button>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}