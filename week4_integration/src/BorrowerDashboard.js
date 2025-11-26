import React, { useEffect, useState } from 'react';
import api from './api';

export default function BorrowerDashboard() {
  const [books, setBooks] = useState([]);
  const [myBooks, setMyBooks] = useState([]); // Store my active borrowings

  useEffect(() => {
    fetchBooks();
    fetchMyBooks();
  }, []);

  const fetchBooks = async () => {
    try {
      const res = await api.get('/books');
      setBooks(res.data);
    } catch(err) { console.error(err); }
  };

  const fetchMyBooks = async () => {
    try {
      const res = await api.get('/borrower/my-books');
      setMyBooks(res.data);
    } catch(err) { console.error(err); }
  };

  const handleRequest = async (bookID) => {
    try {
      await api.post('/borrow', { bookID });
      alert('Request sent!');
      fetchBooks();
      fetchMyBooks();
    } catch (err) {
      alert(err.response?.data?.error || 'Request failed');
    }
  };

  return (
    <div className="container">
      <h1>Borrower Dashboard</h1>

      {/* NEW SECTION: MY BOOKS */}
      <div className="section" style={{borderColor: '#28a745'}}>
        <h3>📖 My Active Books</h3>
        {myBooks.length === 0 ? <p>You have no borrowed books.</p> : (
          <ul>
            {myBooks.map((item, index) => (
              <li key={index} style={{borderBottom: '1px solid #eee', padding: '10px'}}>
                <strong>{item.bookTitle}</strong> 
                <br/>
                Status: {item.status}
                {item.status === 'approved' && (
                  <span style={{color: 'red', marginLeft: '10px'}}>
                     (Due: {item.dueDate ? item.dueDate.split('T')[0] : 'N/A'})
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <h3>Library Catalog</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
        {books.map(book => (
          <div key={book.bookID} style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px' }}>
            <h4>{book.bookTitle}</h4>
            <p>Status: 
              <span style={{
                fontWeight: 'bold', 
                color: book.bookStatus === 'available' ? 'green' : 'red'
              }}> {book.bookStatus.toUpperCase()}</span>
            </p>
            {book.bookStatus === 'available' ? (
              <button onClick={() => handleRequest(book.bookID)}>Request Approval</button>
            ) : (
              <button disabled style={{backgroundColor: '#ccc'}}>Unavailable</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}