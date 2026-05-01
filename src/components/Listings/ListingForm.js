import React, { useState } from 'react';
import { supabase } from '../../utils/supabase';
import { useAppContext } from '../../contexts/AppContext';

export function ListingForm({ type, onClose }) {
  const { state, dispatch } = useAppContext();
  const [submitting, setSubmitting] = useState(false);

  const [listingForm, setListingForm] = useState({
    title: '', description: '', price: '', url: '', imageUrl: '', category: 'website'
  });

  const [appForm, setAppForm] = useState({
    appName: '', description: '', platform: '', appUrl: '', contact: '', features: '', price: ''
  });

  const [codeForm, setCodeForm] = useState({
    title: '', description: '', language: '', code: '', tags: ''
  });

  const handleSubmitListing = async (e) => {
    e.preventDefault();
    if (!listingForm.title || !listingForm.description || !listingForm.price) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Please fill all required fields', type: 'warning', time: new Date().toLocaleTimeString(), read: false }});
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('listings').insert([{
        title: listingForm.title, description: listingForm.description,
        price: listingForm.price, url: listingForm.url || null,
        image_url: listingForm.imageUrl || null, category: listingForm.category,
        seller_name: state.profile?.name, seller_avatar: state.profile?.avatar_url,
        user_id: state.currentUser.id, views: 0, inquiries: 0, rating: 0,
        created_at: new Date().toISOString()
      }]).select().single();

      if (error) throw error;
      dispatch({ type: 'ADD_LISTING', payload: { ...data, seller: data.seller_name, sellerAvatar: data.seller_avatar, imageUrl: data.image_url, date: new Date().toLocaleDateString() }});
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `✅ Listing published!`, type: 'success', time: new Date().toLocaleTimeString(), read: false }});
      onClose();
    } catch (error) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `❌ ${error.message}`, type: 'error', time: new Date().toLocaleTimeString(), read: false }});
    }
    setSubmitting(false);
  };

  const handleSubmitApp = async (e) => {
    e.preventDefault();
    if (!appForm.appName || !appForm.description || !appForm.platform) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Please fill all required fields', type: 'warning', time: new Date().toLocaleTimeString(), read: false }});
      return;
    }
    setSubmitting(true);
    try {
      const featuresArray = appForm.features.split(',').map(f => f.trim()).filter(f => f);
      const { data, error } = await supabase.from('apps').insert([{
        app_name: appForm.appName, description: appForm.description,
        platform: appForm.platform, app_url: appForm.appUrl || null,
        contact: appForm.contact, features: featuresArray, price: appForm.price || 'Free',
        developer_name: state.profile?.name, developer_avatar: state.profile?.avatar_url,
        user_id: state.currentUser.id, rating: 0, downloads: 0, created_at: new Date().toISOString()
      }]).select().single();

      if (error) throw error;
      dispatch({ type: 'ADD_APP', payload: { ...data, appName: data.app_name, appUrl: data.app_url, developer: data.developer_name, developerAvatar: data.developer_avatar, date: new Date().toLocaleDateString() }});
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `✅ App published!`, type: 'success', time: new Date().toLocaleTimeString(), read: false }});
      onClose();
    } catch (error) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `❌ ${error.message}`, type: 'error', time: new Date().toLocaleTimeString(), read: false }});
    }
    setSubmitting(false);
  };

  const handleSubmitCode = async (e) => {
    e.preventDefault();
    if (!codeForm.title || !codeForm.description || !codeForm.language || !codeForm.code) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Please fill all required fields', type: 'warning', time: new Date().toLocaleTimeString(), read: false }});
      return;
    }
    setSubmitting(true);
    try {
      const tagsArray = codeForm.tags.split(',').map(t => t.trim()).filter(t => t);
      const { data, error } = await supabase.from('code_snippets').insert([{
        title: codeForm.title, description: codeForm.description,
        language: codeForm.language, code: codeForm.code, tags: tagsArray,
        author_name: state.profile?.name, author_avatar: state.profile?.avatar_url,
        user_id: state.currentUser.id, likes: 0, created_at: new Date().toISOString()
      }]).select().single();

      if (error) throw error;
      dispatch({ type: 'ADD_CODE_SNIPPET', payload: { ...data, author: data.author_name, authorAvatar: data.author_avatar, likedBy: [], date: new Date().toLocaleDateString() }});
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `✅ Code shared!`, type: 'success', time: new Date().toLocaleTimeString(), read: false }});
      onClose();
    } catch (error) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `❌ ${error.message}`, type: 'error', time: new Date().toLocaleTimeString(), read: false }});
    }
    setSubmitting(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={e => e.stopPropagation()}>
        <div className="listing-form-header">
          <span className="listing-form-icon">{type === 'listing' ? '📢' : type === 'app' ? '📱' : '💻'}</span>
          <h2>{type === 'listing' ? 'Create Listing' : type === 'app' ? 'Advertise App' : 'Share Code'}</h2>
        </div>

        {type === 'listing' && (
          <form onSubmit={handleSubmitListing} className="listing-form-styled">
            <div className="form-group"><label>Title *</label><input type="text" value={listingForm.title} onChange={e => setListingForm({...listingForm, title: e.target.value})} required /></div>
            <div className="form-group"><label>Category</label><select value={listingForm.category} onChange={e => setListingForm({...listingForm, category: e.target.value})}>
              <option value="website">Website</option><option value="portfolio">Portfolio</option><option value="ecommerce">E-Commerce</option><option value="blog">Blog</option><option value="saas">SaaS</option>
            </select></div>
            <div className="form-group"><label>Description *</label><textarea value={listingForm.description} onChange={e => setListingForm({...listingForm, description: e.target.value})} rows="3" required /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group"><label>Price *</label><input type="text" value={listingForm.price} onChange={e => setListingForm({...listingForm, price: e.target.value})} required /></div>
              <div className="form-group"><label>Website URL</label><input type="url" value={listingForm.url} onChange={e => setListingForm({...listingForm, url: e.target.value})} /></div>
            </div>
            <div className="form-group"><label>Image URL (optional)</label><input type="url" value={listingForm.imageUrl} onChange={e => setListingForm({...listingForm, imageUrl: e.target.value})} /></div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Publishing...' : '📤 Publish'}</button>
            </div>
          </form>
        )}

        {type === 'app' && (
          <form onSubmit={handleSubmitApp} className="listing-form-styled">
            <div className="form-group"><label>App Name *</label><input type="text" value={appForm.appName} onChange={e => setAppForm({...appForm, appName: e.target.value})} required /></div>
            <div className="form-group"><label>Description *</label><textarea value={appForm.description} onChange={e => setAppForm({...appForm, description: e.target.value})} rows="3" required /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group"><label>Platform *</label><select value={appForm.platform} onChange={e => setAppForm({...appForm, platform: e.target.value})} required>
                <option value="">Select</option><option value="Web">Web</option><option value="iOS">iOS</option><option value="Android">Android</option><option value="Desktop">Desktop</option>
              </select></div>
              <div className="form-group"><label>Price</label><input type="text" value={appForm.price} onChange={e => setAppForm({...appForm, price: e.target.value})} /></div>
            </div>
            <div className="form-group"><label>App URL</label><input type="url" value={appForm.appUrl} onChange={e => setAppForm({...appForm, appUrl: e.target.value})} /></div>
            <div className="form-group"><label>Contact Email *</label><input type="email" value={appForm.contact} onChange={e => setAppForm({...appForm, contact: e.target.value})} required /></div>
            <div className="form-group"><label>Features (comma-separated) *</label><input type="text" value={appForm.features} onChange={e => setAppForm({...appForm, features: e.target.value})} required /></div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Publishing...' : '📱 Publish'}</button>
            </div>
          </form>
        )}

        {type === 'code' && (
          <form onSubmit={handleSubmitCode} className="listing-form-styled">
            <div className="form-group"><label>Title *</label><input type="text" value={codeForm.title} onChange={e => setCodeForm({...codeForm, title: e.target.value})} required /></div>
            <div className="form-group"><label>Description *</label><textarea value={codeForm.description} onChange={e => setCodeForm({...codeForm, description: e.target.value})} rows="3" required /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group"><label>Language *</label><select value={codeForm.language} onChange={e => setCodeForm({...codeForm, language: e.target.value})} required>
                <option value="">Select</option>
                {['JavaScript', 'Python', 'React', 'Node.js', 'HTML/CSS', 'TypeScript', 'Java', 'C++', 'PHP'].map(l => <option key={l} value={l}>{l}</option>)}
              </select></div>
              <div className="form-group"><label>Tags (comma-separated)</label><input type="text" value={codeForm.tags} onChange={e => setCodeForm({...codeForm, tags: e.target.value})} /></div>
            </div>
            <div className="form-group"><label>Code *</label><textarea value={codeForm.code} onChange={e => setCodeForm({...codeForm, code: e.target.value})} rows="8" style={{ fontFamily: 'monospace' }} required /></div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Publishing...' : '💻 Publish'}</button>
            </div>
          </form>
        )}

        <button className="btn-close" onClick={onClose}>✕</button>
      </div>
    </div>
  );
}