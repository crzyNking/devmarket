import { supabase } from './supabase';

export class RealtimeManager {
  constructor() {
    this.channels = {};
    this.listeners = {};
    this.isConnected = false;
  }

  subscribe(channelName, config, onEvent) {
    if (this.channels[channelName]) {
      return this.channels[channelName];
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: config.event,
          schema: config.schema,
          table: config.table,
          filter: config.filter
        },
        (payload) => {
          if (onEvent) onEvent(payload);
          this.notifyListeners(channelName, payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.isConnected = true;
          console.log(`✅ Connected to ${channelName}`);
        }
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.isConnected = false;
          console.log(`❌ Disconnected from ${channelName}, attempting reconnect...`);
          setTimeout(() => this.reconnect(channelName, config, onEvent), 3000);
        }
      });

    this.channels[channelName] = channel;
    return channel;
  }

  reconnect(channelName, config, onEvent) {
    this.unsubscribe(channelName);
    return this.subscribe(channelName, config, onEvent);
  }

  unsubscribe(channelName) {
    if (this.channels[channelName]) {
      supabase.removeChannel(this.channels[channelName]);
      delete this.channels[channelName];
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
  }

  removeListener(channelName, id) {
    if (this.listeners[channelName]) {
      delete this.listeners[channelName][id];
    }
  }

  notifyListeners(channelName, payload) {
    if (this.listeners[channelName]) {
      Object.values(this.listeners[channelName]).forEach(callback => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in listener for ${channelName}:`, error);
        }
      });
    }
  }

  getConnectionStatus() {
    return this.isConnected;
  }

  getActiveChannels() {
    return Object.keys(this.channels);
  }

  isChannelActive(channelName) {
    return !!this.channels[channelName];
  }
}

export const realtimeManager = new RealtimeManager();