import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { useAppContext } from '../../contexts/AppContext';

export function ChatArea({ conversation }) {
  const { state, dispatch } = useAppContext();
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  if (!conversation) {
    return (
      <div className="chat-area">
        <div className="chat-empty"><span>💬</span><h3>Select a conversation</h3><p>Choose from the sidebar</p></div>
      </div>
    );
  }

  const handleSend = async () => {
    if (!replyMessage.trim()) return;
    setSending(true);
    try {
      const msgData = {
        from_user: state.currentUser.id, to_user: conversation.userId,
        from_name: state.profile?.name || state.currentUser.email,
        from_avatar: state.profile?.avatar_url,
        to_name: conversation.userName, to_avatar: conversation.userAvatar,
        subject: 'Re: Conversation', message: replyMessage, read: false,
        created_at: new Date().toISOString()
      };
      await supabase.from('messages').insert([msgData]);

      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '✅ Reply sent!', type: 'success', time: new Date().toLocaleTimeString(), read: false }});
      setReplyMessage('');

      const { data } = await supabase.from('messages').select('*')
        .or(`from_user.eq.${state.currentUser.id},to_user.eq.${state.currentUser.id}`)
        .order('created_at', { ascending: false });
      if (data) dispatch({ type: 'SET_MESSAGES', payload: data });
    } catch (error) { console.error('Error:', error); }
    setSending(false);
  };

  return (
    <div className="chat-area">
      <div className="chat-header">
        <img src={conversation.userAvatar || `https://ui-avatars.com/api/?name=${conversation.userName}&background=667eea&color=fff&size=40`} alt={conversation.userName} className="chat-avatar" />
        <div><strong>{conversation.userName}</strong></div>
      </div>
      <div className="chat-messages">
        {conversation.messages?.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map(msg => (
          <div key={msg.id} className={`chat-message ${msg.from_user === state.currentUser.id ? 'sent' : 'received'}`}>
            <div className="message-bubble">
              <p>{msg.message}</p>
              <small className="message-time">{new Date(msg.created_at).toLocaleString()}</small>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-area">
        <textarea
          placeholder="Type your reply..."
          value={replyMessage}
          onChange={e => setReplyMessage(e.target.value)}
          className="chat-textarea"
          rows="2"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        />
        <button className="btn-primary btn-sm" onClick={handleSend} disabled={sending || !replyMessage.trim()}>
          {sending ? '...' : '📤 Send'}
        </button>
      </div>
    </div>
  );
}