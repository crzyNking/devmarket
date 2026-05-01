import React from 'react';
import { useAppContext } from '../../contexts/AppContext';

export function ConversationList({ conversations, activeConv, onSelect }) {
  return (
    <div className="conversations-sidebar">
      <h3>Conversations</h3>
      {conversations.length === 0 ? (
        <div className="empty-conversations"><span>💬</span><p>No conversations yet</p></div>
      ) : (
        <div className="conversations-list">
          {conversations.map(conv => (
            <div
              key={conv.userId}
              className={`conversation-item ${activeConv?.userId === conv.userId ? 'active' : ''} ${conv.unreadCount > 0 ? 'unread' : ''}`}
              onClick={() => onSelect(conv)}
            >
              <img
                src={conv.userAvatar || `https://ui-avatars.com/api/?name=${conv.userName}&background=667eea&color=fff&size=40`}
                alt={conv.userName}
                className="conversation-avatar"
              />
              <div className="conversation-info">
                <div className="conversation-header">
                  <strong>{conv.userName}</strong>
                  <span className="conversation-time">{new Date(conv.lastMessageTime).toLocaleDateString()}</span>
                </div>
                <p className="conversation-preview">{conv.lastMessage?.substring(0, 50)}</p>
              </div>
              {conv.unreadCount > 0 && <span className="unread-badge">{conv.unreadCount}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}