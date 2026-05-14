// realtime.js
import { supabase } from './supabase';

export class RealtimeManager {
  constructor() {
    this.channels = {};
    this.listeners = {};
    this.isConnected = false;
    this.reconnectAttempts = {};
    this.maxReconnectAttempts = 5;
  }

  subscribe(channelName, config, onEvent) {
    if (this.channels[channelName]) {
      console.log(`Channel ${channelName} already exists, returning existing`);
      return this.channels[channelName];
    }

    this.reconnectAttempts[channelName] = 0;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: config.event || '*',
          schema: config.schema || 'public',
          table: config.table,
          filter: config.filter
        },
        (payload) => {
          console.log(`📨 Event received on ${channelName}:`, payload.eventType);
          if (onEvent) onEvent(payload);
          this.notifyListeners(channelName, payload);
        }
      )
      .subscribe((status) => {
        switch (status) {
          case 'SUBSCRIBED':
            this.isConnected = true;
            this.reconnectAttempts[channelName] = 0;
            console.log(`✅ Connected to ${channelName}`);
            break;
          case 'CHANNEL_ERROR':
            console.error(`❌ Error on channel ${channelName}`);
            this.handleReconnect(channelName, config, onEvent);
            break;
          case 'CLOSED':
            console.log(`🔒 Channel ${channelName} closed`);
            this.isConnected = false;
            this.handleReconnect(channelName, config, onEvent);
            break;
          case 'TIMED_OUT':
            console.warn(`⏰ Channel ${channelName} timed out`);
            this.handleReconnect(channelName, config, onEvent);
            break;
          default:
            console.log(`Status for ${channelName}: ${status}`);
        }
      });

    this.channels[channelName] = channel;
    return channel;
  }

  handleReconnect(channelName, config, onEvent) {
    if (this.reconnectAttempts[channelName] >= this.maxReconnectAttempts) {
      console.error(`Max reconnection attempts reached for ${channelName}`);
      return;
    }

    this.reconnectAttempts[channelName]++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts[channelName]), 30000);
    
    console.log(`🔄 Attempting reconnect for ${channelName} in ${delay}ms (attempt ${this.reconnectAttempts[channelName]})`);
    
    setTimeout(() => {
      this.unsubscribe(channelName);
      this.subscribe(channelName, config, onEvent);
    }, delay);
  }

  reconnect(channelName, config, onEvent) {
    this.unsubscribe(channelName);
    return this.subscribe(channelName, config, onEvent);
  }

  unsubscribe(channelName) {
    if (this.channels[channelName]) {
      try {
        supabase.removeChannel(this.channels[channelName]);
      } catch (error) {
        console.warn(`Error removing channel ${channelName}:`, error);
      }
      delete this.channels[channelName];
      delete this.reconnectAttempts[channelName];
    }
  }

  unsubscribeAll() {
    Object.keys(this.channels).forEach(channel => {
      this.unsubscribe(channel);
    });
    this.isConnected = false;
  }

  addListener(channelName, id, callback) {
    if (!this.listeners[channelName]) {
      this.listeners[channelName] = {};
    }
    this.listeners[channelName][id] = callback;
    return () => this.removeListener(channelName, id);
  }

  removeListener(channelName, id) {
    if (this.listeners[channelName]) {
      delete this.listeners[channelName][id];
      if (Object.keys(this.listeners[channelName]).length === 0) {
        delete this.listeners[channelName];
      }
    }
  }

  notifyListeners(channelName, payload) {
    if (this.listeners[channelName]) {
      Object.entries(this.listeners[channelName]).forEach(([id, callback]) => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in listener ${id} for ${channelName}:`, error);
        }
      });
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      activeChannels: this.getActiveChannels(),
      attemptCounts: this.reconnectAttempts
    };
  }

  getActiveChannels() {
    return Object.keys(this.channels);
  }

  isChannelActive(channelName) {
    return !!this.channels[channelName];
  }
}

export const realtimeManager = new RealtimeManager();