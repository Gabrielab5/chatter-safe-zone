
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Audit logs function called:', req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      console.error('Missing environment variables');
      return new Response(JSON.stringify({ 
        error: 'Server configuration error',
        logs: [],
        pagination: { page: 1, limit: 50, total: 0, pages: 0 }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // For POST requests (logging events), we don't need authentication
    if (req.method === 'POST') {
      console.log('Processing POST request for audit logging');
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      let body;
      try {
        body = await req.json();
        console.log('Logging audit event:', body);
      } catch (error) {
        console.error('Invalid JSON in request body:', error);
        return new Response(JSON.stringify({ 
          error: 'Invalid request body',
          success: false 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Handle IP address - use null instead of "unknown" for inet column
      let ipAddress = null;
      if (body.ip_address && body.ip_address !== 'unknown' && body.ip_address !== '') {
        ipAddress = body.ip_address;
      }
      
      const { data, error } = await supabase
        .from('audit_logs')
        .insert({
          event_type: body.event_type,
          event_data: body.event_data || {},
          ip_address: ipAddress,
          user_agent: body.user_agent || null,
          user_id: null // We'll set this later when we have user context
        });

      if (error) {
        console.error('Database insert error:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to log event',
          success: false 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // For GET requests (viewing logs), require authentication
    if (req.method === 'GET') {
      console.log('Processing GET request for audit logs');
      
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        console.error('No authorization header provided');
        return new Response(JSON.stringify({ 
          error: 'Authentication required',
          logs: [],
          pagination: { page: 1, limit: 50, total: 0, pages: 0 }
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.replace('Bearer ', '');
      
      // Create client with anon key for user authentication
      const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      });
      
      const { data: { user }, error: authError } = await userSupabase.auth.getUser(token);
      
      if (authError || !user) {
        console.error('Authentication failed:', authError);
        return new Response(JSON.stringify({ 
          error: 'Invalid authentication',
          logs: [],
          pagination: { page: 1, limit: 50, total: 0, pages: 0 }
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if user is admin (simplified check - you may want to enhance this)
      const isAdmin = user.email?.includes('admin') || 
                     user.user_metadata?.full_name?.toLowerCase().includes('admin') ||
                     user.email === 'mohamed.alfker4@gmail.com'; // Allow your specific email
      
      if (!isAdmin) {
        console.error('User is not admin:', user.email);
        return new Response(JSON.stringify({ 
          error: 'Unauthorized: Admin access required',
          logs: [],
          pagination: { page: 1, limit: 50, total: 0, pages: 0 }
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Use service role key for database queries
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Parse query parameters
      const url = new URL(req.url);
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
      const eventType = url.searchParams.get('eventType');
      const userId = url.searchParams.get('userId');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');

      console.log('Query parameters:', { page, limit, eventType, userId, startDate, endDate });

      // Build the query
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          profiles:user_id (
            email,
            full_name
          )
        `)
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      // Apply filters
      if (eventType && eventType !== 'all' && eventType.trim() !== '') {
        query = query.eq('event_type', eventType);
      }
      
      if (userId && userId.trim() !== '') {
        query = query.eq('user_id', userId);
      }
      
      if (startDate && startDate.trim() !== '') {
        query = query.gte('created_at', startDate);
      }
      
      if (endDate && endDate.trim() !== '') {
        query = query.lte('created_at', endDate);
      }

      const { data: logs, error: logsError } = await query;

      if (logsError) {
        console.error('Logs query error:', logsError);
        return new Response(JSON.stringify({ 
          error: 'Failed to fetch audit logs',
          logs: [],
          pagination: { page, limit, total: 0, pages: 0 }
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get total count for pagination
      let countQuery = supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true });

      // Apply same filters for count
      if (eventType && eventType !== 'all' && eventType.trim() !== '') {
        countQuery = countQuery.eq('event_type', eventType);
      }
      if (userId && userId.trim() !== '') {
        countQuery = countQuery.eq('user_id', userId);
      }
      if (startDate && startDate.trim() !== '') {
        countQuery = countQuery.gte('created_at', startDate);
      }
      if (endDate && endDate.trim() !== '') {
        countQuery = countQuery.lte('created_at', endDate);
      }

      const { count, error: countError } = await countQuery;
      
      if (countError) {
        console.error('Count query error:', countError);
        // Continue without count rather than failing
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      console.log('Returning logs:', { count: logs?.length || 0, total: totalCount });

      return new Response(JSON.stringify({
        logs: logs || [],
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: totalPages
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Method not allowed
    return new Response(JSON.stringify({ 
      error: 'Method not allowed',
      logs: [],
      pagination: { page: 1, limit: 50, total: 0, pages: 0 }
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Audit logs function error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      logs: [],
      pagination: { page: 1, limit: 50, total: 0, pages: 0 }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
