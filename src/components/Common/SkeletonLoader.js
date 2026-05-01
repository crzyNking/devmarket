// src/components/Common/SkeletonLoader.js
import React from 'react';

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-image"></div>
      <div className="skeleton-card-content">
        <div className="skeleton skeleton-title"></div>
        <div className="skeleton skeleton-text"></div>
        <div className="skeleton skeleton-text short"></div>
        <div className="skeleton-card-footer">
          <div className="skeleton skeleton-avatar"></div>
          <div className="skeleton skeleton-text small"></div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonChat() {
  return (
    <div className="skeleton-chat">
      <div className="skeleton-chat-header">
        <div className="skeleton skeleton-avatar large"></div>
        <div>
          <div className="skeleton skeleton-text medium"></div>
          <div className="skeleton skeleton-text small"></div>
        </div>
      </div>
      <div className="skeleton-chat-messages">
        {[1, 2, 3].map(i => (
          <div key={i} className={`skeleton-message ${i % 2 === 0 ? 'received' : 'sent'}`}>
            <div className="skeleton skeleton-bubble"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonProfile() {
  return (
    <div className="skeleton-profile">
      <div className="skeleton-profile-header">
        <div className="skeleton skeleton-avatar xlarge"></div>
        <div>
          <div className="skeleton skeleton-title"></div>
          <div className="skeleton skeleton-text"></div>
        </div>
      </div>
      <div className="skeleton-stats">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton skeleton-stat"></div>
        ))}
      </div>
    </div>
  );
}