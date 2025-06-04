
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    if (req.method === 'POST') {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      const conversationId = formData.get('conversationId') as string;

      if (!file || !conversationId) {
        throw new Error('Missing file or conversation ID');
      }

      if (file.size > MAX_FILE_SIZE) {
        throw new Error('File size exceeds 10MB limit');
      }

      // Verify user has access to conversation
      const { data: participant } = await supabase
        .from('conversation_participants')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .single();

      if (!participant) {
        throw new Error('Unauthorized access to conversation');
      }

      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${conversationId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      // Save file metadata to database
      const { data: fileData, error: dbError } = await supabase
        .from('file_uploads')
        .insert({
          conversation_id: conversationId,
          uploaded_by: user.id,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          storage_path: fileName
        })
        .select()
        .single();

      if (dbError) {
        // Clean up uploaded file if database insert fails
        await supabase.storage.from('chat-files').remove([fileName]);
        throw dbError;
      }

      // Log audit event
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        event_type: 'file_uploaded',
        event_data: { 
          conversation_id: conversationId,
          file_name: file.name,
          file_size: file.size 
        },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown'
      });

      return new Response(JSON.stringify(fileData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const fileId = url.searchParams.get('fileId');

      if (!fileId) {
        throw new Error('Missing file ID');
      }

      // Get file metadata
      const { data: fileData, error: fileError } = await supabase
        .from('file_uploads')
        .select('*')
        .eq('id', fileId)
        .single();

      if (fileError || !fileData) {
        throw new Error('File not found');
      }

      // Verify user has access to conversation
      const { data: participant } = await supabase
        .from('conversation_participants')
        .select('*')
        .eq('conversation_id', fileData.conversation_id)
        .eq('user_id', user.id)
        .single();

      if (!participant) {
        throw new Error('Unauthorized access to file');
      }

      // Generate signed URL for download
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('chat-files')
        .createSignedUrl(fileData.storage_path, 3600); // 1 hour expiry

      if (signedUrlError) {
        throw signedUrlError;
      }

      return new Response(JSON.stringify({
        ...fileData,
        download_url: signedUrlData.signedUrl
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error('Method not allowed');

  } catch (error) {
    console.error('File upload error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
