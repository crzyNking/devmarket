// src/components/Common/AvatarUpload.js
import React, { useState, useRef } from 'react';
import { supabase } from '../../utils/supabase';
import { useAppContext } from '../../contexts/AppContext';

export function AvatarUpload({ currentAvatar, userName, onAvatarUpdate, size = 'large' }) {
  const { state, dispatch } = useAppContext();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset error
    setError(null);

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, GIF, WebP)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target.result);
    };
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${state.currentUser.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError, data } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        
        // If bucket doesn't exist, use fallback
        if (uploadError.message.includes('bucket') || uploadError.message.includes('not found')) {
          const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'User')}&background=667eea&color=fff&size=200`;
          await updateAvatarInDB(fallbackUrl);
          onAvatarUpdate?.(fallbackUrl);
          dispatch({ type: 'UPDATE_AVATAR', payload: fallbackUrl });
          return;
        }
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Save to database
      await updateAvatarInDB(publicUrl);
      
      // Update local state
      dispatch({ type: 'UPDATE_AVATAR', payload: publicUrl });
      onAvatarUpdate?.(publicUrl);
      
      dispatch({ 
        type: 'ADD_NOTIFICATION', 
        payload: {
          message: '✅ Profile picture updated successfully!',
          type: 'success',
          time: new Date().toLocaleTimeString(),
          read: false
        }
      });

      setPreview(null);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setError('Failed to upload image. Please try again.');
      
      // Fallback
      const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'User')}&background=667eea&color=fff&size=200`;
      await updateAvatarInDB(fallbackUrl);
      dispatch({ type: 'UPDATE_AVATAR', payload: fallbackUrl });
      onAvatarUpdate?.(fallbackUrl);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const updateAvatarInDB = async (avatarUrl) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: state.currentUser.id,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating avatar in DB:', error);
    }
  };

  const displayAvatar = preview || currentAvatar || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'User')}&background=667eea&color=fff&size=200`;

  const sizeClasses = {
    small: 'avatar-small',
    medium: 'avatar-medium', 
    large: 'avatar-large',
    xlarge: 'avatar-xlarge'
  };

  return (
    <div className="avatar-upload-container">
      <div 
        className={`avatar-preview-wrapper ${sizeClasses[size]} ${uploading ? 'uploading' : ''}`}
        onClick={() => !uploading && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            !uploading && fileInputRef.current?.click();
          }
        }}
        aria-label="Change profile picture"
      >
        <img 
          src={displayAvatar} 
          alt={userName} 
          className={`avatar-image ${sizeClasses[size]}`}
          onError={(e) => { 
            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'User')}&background=667eea&color=fff&size=200`; 
          }}
        />
        <div className="avatar-upload-overlay">
          <span className="upload-icon">📷</span>
          <span className="upload-text">Change Photo</span>
        </div>
        {uploading && (
          <div className="avatar-upload-spinner">
            <div className="mini-spinner"></div>
          </div>
        )}
      </div>
      
      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/jpeg,image/png,image/gif,image/webp" 
        onChange={handleFileSelect} 
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      
      {uploading && (
        <div className="upload-status">
          <span className="upload-status-text">Uploading...</span>
        </div>
      )}
      
      {error && (
        <div className="upload-error">
          <span>⚠️</span> {error}
        </div>
      )}
    </div>
  );
}