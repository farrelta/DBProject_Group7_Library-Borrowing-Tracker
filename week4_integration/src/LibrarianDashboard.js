import React, { useEffect, useState, useRef } from 'react';
import api from './api';

export default function LibrarianDashboard() {
  const [books, setBooks] = useState([]);
  const [requests, setRequests] = useState([]);
  
  // State for Form
  const [formData, setFormData] = useState({ 
    bookISBN: '', bookTitle: '', bookAuthor: '', bookGenre: '', quantity: 1 
  });
  
  // State for Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  const [returnId, setReturnId] = useState('');

  const formRef = useRef(null);

  useEffect(() => {
    fetchBooks();
    fetchRequests();
  }, []);

  const fetchBooks = async () => {
    const res = await api.get('/books');
    setBooks(res.data);
  };

  const fetchRequests = async () => {
    const res = await api.get('/borrow/requests');
    setRequests(res.data);
  };

  // --- FORM HANDLING ---
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await api.put(`/books/${editId}`, { 
            ...formData, 
            totalCopies: formData.quantity 
        });
        alert('Book Updated Successfully');
        cancelEdit(); 
      } else {
        await api.post('/books', formData);
        alert('Book Added Successfully');
        setFormData({ bookISBN: '', bookTitle: '', bookAuthor: '', bookGenre: '', quantity: 1 });
      }
      fetchBooks();
    } catch (err) {
      alert(err.response?.data?.error || 'Operation failed');
    }
  };

  const startEdit = (book) => {
    setIsEditing(true);
    setEditId(book.bookID);
    setFormData({
      bookISBN: book.bookISBN,
      bookTitle: book.bookTitle,
      bookAuthor: book.bookAuthor || '',
      bookGenre: book.bookGenre,
      quantity: book.totalCopies 
    });
    
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditId(null);
    setFormData({ bookISBN: '', bookTitle: '', bookAuthor: '', bookGenre: '', quantity: 1 });
  };

  const handleDelete = async (id, available, total) => {
    if (available < total) {
      const missing = total - available;
      alert(`⚠️ Cannot delete!\n\n${missing} copy(ies) are out.`);
      return;
    }
    if (!window.confirm("Are you sure? This will PERMANENTLY delete the book.")) return;
    
    try {
      await api.delete(`/books/${id}`);
      fetchBooks();
    } catch (err) { alert(err.response?.data?.error); }
  };

  const handleApprove = async (borrowID) => {
    const daysStr = prompt("Enter number of days:", "7");
    if (!daysStr) return;
    try {
      await api.post('/borrow/approve', { borrowID, days: parseInt(daysStr) });
      fetchRequests(); fetchBooks();    
    } catch (err) { alert('Error approving'); }
  };

  const handleConfirmReturn = async (borrowID) => {
    if(!window.confirm("Confirm return?")) return;
    try {
      const res = await api.post('/return', { borrowID });
      alert(res.data.message);
      fetchRequests(); fetchBooks();
    } catch (err) { alert('Error returning'); }
  };

  const handleManualReturn = async () => {
    if(!returnId) return alert("Enter ID");
    try {
        const res = await api.post('/return', { borrowID: returnId });
        alert(res.data.message);
        setReturnId('');
        fetchBooks();
    } catch (err) { alert('Error returning'); }
  };

  return (
    <div className="container">
      <h1>Librarian Dashboard</h1>

      {/* REQUESTS TABLE */}
      <div className="section warning">
        <h3>🔔 Tasks</h3>
        {requests.length === 0 ? <p>No pending tasks.</p> : (
          <table className="task-table">
            <thead>
              <tr>
                <th>User</th><th>Book</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(req => (
                <tr key={req.borrowID}>
                  <td>{req.borrowerName}</td>
                  <td>{req.bookTitle}</td>
                  <td>
                    {req.status === 'pending' ? (
                      <button onClick={() => handleApprove(req.borrowID)} className="btn-success btn-sm">Approve</button>
                    ) : (
                      <button onClick={() => handleConfirmReturn(req.borrowID)} className="btn-info btn-sm">Confirm Return</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* PROCESS RETURN */}
      <div className="section">
        <h3>↩️ Quick Return</h3>
        <div className="form-row">
           <input placeholder="Borrow ID" value={returnId} onChange={e => setReturnId(e.target.value)} />
           <button onClick={handleManualReturn} className="btn-primary">Return</button>
        </div>
      </div>

      {/* ADD / EDIT BOOK FORM */}
      <div ref={formRef} className={`section ${isEditing ? 'primary' : ''}`}>
        <h3 style={{ textAlign: 'center', color: isEditing ? '#007bff' : 'black' }}>
            {isEditing ? '✏️ Edit Book' : '📚 Add New Book'}
        </h3>
        
        <form onSubmit={handleFormSubmit} className="form-group">
          <input placeholder="ISBN" value={formData.bookISBN} onChange={e => setFormData({...formData, bookISBN: e.target.value})} required />
          <input placeholder="Title" value={formData.bookTitle} onChange={e => setFormData({...formData, bookTitle: e.target.value})} required />
          <input placeholder="Author" value={formData.bookAuthor} onChange={e => setFormData({...formData, bookAuthor: e.target.value})} required />
          <input placeholder="Genre" value={formData.bookGenre} onChange={e => setFormData({...formData, bookGenre: e.target.value})} required />
          
          <div className="form-row">
            <label>Total Copies:</label>
            <input type="number" min="1" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} required className="short-input"/>
          </div>

          <div className="form-row">
            <button type="submit" className={`btn-primary ${isEditing ? 'btn-primary' : 'btn-success'}`} style={{flex: 1}}>
                {isEditing ? 'Update Book' : 'Add Book'}
            </button>
            
            {isEditing && (
                <button type="button" onClick={cancelEdit} className="btn-secondary">
                    Cancel
                </button>
            )}
          </div>
        </form>
      </div>

      {/* CATALOG */}
      <h3>All Books</h3>
      <ul className="book-list">
        {books.map(book => (
          <li key={book.bookID} className="book-list-item">
            <span>
              <strong className="text-bold">{book.bookTitle}</strong> <span className="text-muted">by {book.bookAuthor}</span>
              <br/>
              <span className="text-muted">Copies: {book.availableCopies} / {book.totalCopies}</span>
            </span>
            
            <div>
              <button 
                onClick={() => startEdit(book)} 
                className="btn-warning btn-sm mr-2"
              >
                Edit
              </button>
              
              <button 
                onClick={() => handleDelete(book.bookID, book.availableCopies, book.totalCopies)} 
                className="btn-danger btn-sm"
                style={{ opacity: (book.availableCopies === book.totalCopies) ? 1 : 0.6 }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}