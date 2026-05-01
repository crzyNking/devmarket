// src/hooks/useRealtimeMessages.js
import { useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useAppContext } from '../contexts/AppContext';

export function useRealtimeMessages() {
  const { state, dispatch } = useAppContext();

  useEffect(() => {
    if (!state.currentUser) return;

    let messageChannel;
    let notificationChannel;

    try {
      // Subscribe to new messages
      messageChannel = supabase
        .channel('realtime-messages')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `to_user=eq.${state.currentUser.id}`
        }, (payload) => {
          console.log('🔔 New real-time message:', payload.new);
          const newMsg = payload.new;
          
          // Add message to state
          dispatch({ type: 'ADD_MESSAGE', payload: newMsg });
          
          // Add to conversation
          dispatch({ 
            type: 'ADD_TO_CONVERSATION', 
            payload: { 
              conversationId: newMsg.from_user, 
              message: newMsg 
            } 
          });
          
          // Show notification
          dispatch({ 
            type: 'ADD_NOTIFICATION', 
            payload: {
              message: `💬 New message from ${newMsg.from_name || 'Someone'}: "${newMsg.message?.substring(0, 50)}${newMsg.message?.length > 50 ? '...' : ''}"`,
              type: 'info',
              time: new Date().toLocaleTimeString(),
              read: false
            }
          });
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `from_user=eq.${state.currentUser.id}`
        }, (payload) => {
          console.log('📨 Message status updated:', payload.new);
          dispatch({ type: 'UPDATE_MESSAGE', payload: payload.new });
        })
        .subscribe((status) => {
          console.log('Message channel status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Connected to real-time messages');
          }
        });

      // Subscribe to notifications
      notificationChannel = supabase
        .channel('realtime-notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${state.currentUser.id}`
        }, (payload) => {
          console.log('🔔 New notification:', payload.new);
          dispatch({ 
            type: 'ADD_NOTIFICATION', 
            payload: {
              ...payload.new,
              read: false,
              time: new Date(payload.new.created_at).toLocaleTimeString()
            }
          });
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Connected to real-time notifications');
          }
        });

      dispatch({ type: 'SET_REALTIME_CONNECTED', payload: true });

    } catch (error) {
      console.error('Error setting up real-time:', error);
    }

    return () => {
      if (messageChannel) supabase.removeChannel(messageChannel);
      if (notificationChannel) supabase.removeChannel(notificationChannel);
    };
  }, [state.currentUser?.id, dispatch]);

  return { isConnected: state.realtimeConnected };
}