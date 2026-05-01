import React, { useState } from 'react';
import { supabase } from '../../utils/supabase';
import { useAppContext } from '../../contexts/AppContext';
import { ConfirmDialog } from '../Common/ConfirmDialog';

export function ListingCard({ listing }) {
  const { state, dispatch } = useAppContext();
  const [showContact, setShowContact] = useState(false);
  const [message, setMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isFavorited = (state.favorites || []).some(f => f.id === listing.id);
  const isOwner = state.currentUser && listing.user_id === state.currentUser.id;

  const handleContact = async () => {
    if (!state.currentUser) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Please login to contact sellers', type: 'warning', time: new Date().toLocaleTimeString(), read: false }});
      return;
    }
    if (isOwner) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'This is your own listing', type: 'warning', time: new Date().toLocaleTimeString(), read: false }});
      return;
    }
    if (showContact && message.trim()) {
      try {
        await supabase.from('messages').insert([{
          from_user: state.currentUser.id, to_user: listing.user_id,
          from_name: state.profile?.name || state.currentUser.email,
          from_avatar: state.profile?.avatar_url,
          to_name: listing.seller_name || listing.seller,
          to_avatar: listing.seller_avatar || listing.sellerAvatar,
          subject: `Inquiry about ${listing.title}`,
          message, read: false, listing_id: listing.id,
          created_at: new Date().toISOString()
        }]);
        dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `Message sent about "${listing.title}"`, type: 'success', time: new Date().toLocaleTimeString(), read: false }});
      } catch (error) { console.error('Error:', error); }
      setShowContact(false); setMessage('');
    } else {
      setShowContact(!showContact);
    }
  };

  const toggleFavorite = async () => {
    if (!state.currentUser) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Please login to save favorites', type: 'warning', time: new Date().toLocaleTimeString(), read: false }});
      return;
    }
    dispatch({ type: 'TOGGLE_FAVORITE', payload: listing });
    try {
      if (isFavorited) {
        await supabase.from('favorites').delete().eq('user_id', state.currentUser.id).eq('listing_id', listing.id);
      } else {
        await supabase.from('favorites').insert([{ user_id: state.currentUser.id, listing_id: listing.id, created_at: new Date().toISOString() }]);
      }
    } catch (error) { console.error('Error:', error); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await supabase.from('listings').delete().eq('id', listing.id);
      dispatch({ type: 'DELETE_LISTING', payload: listing.id });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `✅ Listing deleted`, type: 'success', time: new Date().toLocaleTimeString(), read: false }});
    } catch (error) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `❌ Failed to delete`, type: 'error', time: new Date().toLocaleTimeString(), read: false }});
    }
    setDeleting(false); setShowDeleteConfirm(false);
  };

  return (
    <>
      <div className="listing-card">
        <div className="card-image">
          {listing.imageUrl ? <img src={listing.imageUrl} alt={listing.title} loading="lazy" /> : <div className="placeholder-image"><span>🌐</span></div>}
          <span className="category-badge">{listing.category}</span>
          <button className={`favorite-button ${isFavorited ? 'active' : ''}`} onClick={toggleFavorite}>{isFavorited ? '⭐' : '☆'}</button>
          {isOwner && <button className="delete-button" onClick={() => setShowDeleteConfirm(true)}>🗑️</button>}
        </div>
        <div className="card-content">
          <div className="card-header"><h3>{listing.title}</h3><span className="price-tag">{listing.price}</span></div>
          <p className="description">{listing.description?.substring(0, 150)}{listing.description?.length > 150 ? '...' : ''}</p>
          <div className="card-meta">
            <span className="seller-info">
              <img src={listing.sellerAvatar || `https://ui-avatars.com/api/?name=${listing.seller}&background=667eea&color=fff&size=28`} alt={listing.seller} />
              {listing.seller}
            </span>
            <span className="rating">⭐ {listing.rating || 'New'}</span>
          </div>
          <div className="card-stats"><span>👁 {listing.views || 0}</span><span>💬 {listing.inquiries || 0}</span><span>{listing.date}</span></div>
          {showContact && <textarea placeholder="Write your message..." value={message} onChange={e => setMessage(e.target.value)} className="contact-message" rows="3" />}
          <div className="card-actions">
            {listing.url && <a href={listing.url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">🔗 View</a>}
            <button onClick={handleContact} className="btn-primary btn-sm" disabled={isOwner}>{isOwner ? '👤 Your Listing' : showContact ? '📤 Send' : '📧 Contact'}</button>
          </div>
        </div>
      </div>
      <ConfirmDialog isOpen={showDeleteConfirm} title="Delete Listing" message={`Delete "${listing.title}"?`} onConfirm={handleDelete} onCancel={() => setShowDeleteConfirm(false)} confirmText="Delete" type="danger" />
    </>
  );
}