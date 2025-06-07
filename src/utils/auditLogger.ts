
import { supabase } from '@/integrations/supabase/client';

export interface AuditEvent {
  eventType: string;
  eventData?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export const logAuthEvent = async (event: AuditEvent) => {
  try {
    // Get user's IP address (in a real app, you'd get this from server)
    const ipAddress = event.ipAddress || 'unknown';
    
    // Get user agent
    const userAgent = event.userAgent || navigator.userAgent;
    
    await supabase.functions.invoke('audit-logs', {
      body: {
        event_type: event.eventType,
        event_data: event.eventData,
        ip_address: ipAddress,
        user_agent: userAgent
      }
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
};

// Helper functions for specific auth events
export const logLoginAttempt = (email: string, success: boolean, error?: string) => {
  logAuthEvent({
    eventType: success ? 'login_success' : 'login_failure',
    eventData: {
      email,
      error: error || undefined,
      timestamp: new Date().toISOString()
    }
  });
};

export const logRegistration = (email: string, success: boolean, error?: string) => {
  logAuthEvent({
    eventType: success ? 'registration_success' : 'registration_failure',
    eventData: {
      email,
      error: error || undefined,
      timestamp: new Date().toISOString()
    }
  });
};

export const logGoogleAuth = (success: boolean, error?: string) => {
  logAuthEvent({
    eventType: success ? 'google_auth_success' : 'google_auth_failure',
    eventData: {
      provider: 'google',
      error: error || undefined,
      timestamp: new Date().toISOString()
    }
  });
};

export const logLogout = () => {
  logAuthEvent({
    eventType: 'logout',
    eventData: {
      timestamp: new Date().toISOString()
    }
  });
};
