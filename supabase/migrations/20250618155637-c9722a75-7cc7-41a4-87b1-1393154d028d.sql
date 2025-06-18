
-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can view files from their conversations" ON public.file_uploads;
DROP POLICY IF EXISTS "Users can upload files to their conversations" ON public.file_uploads;
DROP POLICY IF EXISTS "Users can update their own file uploads" ON public.file_uploads;
DROP POLICY IF EXISTS "Users can delete their own file uploads" ON public.file_uploads;

DROP POLICY IF EXISTS "Users can view messages from their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;

DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Enable RLS on critical tables that are missing proper policies
ALTER TABLE public.session_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Session Keys RLS Policies - Critical for encryption key protection
CREATE POLICY "Users can view their own session keys" 
  ON public.session_keys 
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own session keys" 
  ON public.session_keys 
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own session keys" 
  ON public.session_keys 
  FOR UPDATE 
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own session keys" 
  ON public.session_keys 
  FOR DELETE 
  USING (user_id = auth.uid());

-- File Uploads RLS Policies - Ensure restricted file access
CREATE POLICY "Users can view files from their conversations" 
  ON public.file_uploads 
  FOR SELECT 
  USING (
    uploaded_by = auth.uid() OR 
    public.user_participates_in_conversation(conversation_id)
  );

CREATE POLICY "Users can upload files to their conversations" 
  ON public.file_uploads 
  FOR INSERT 
  WITH CHECK (
    uploaded_by = auth.uid() AND 
    public.user_participates_in_conversation(conversation_id)
  );

CREATE POLICY "Users can update their own file uploads" 
  ON public.file_uploads 
  FOR UPDATE 
  USING (uploaded_by = auth.uid());

CREATE POLICY "Users can delete their own file uploads" 
  ON public.file_uploads 
  FOR DELETE 
  USING (uploaded_by = auth.uid());

-- Messages RLS Policies - Secure message access
CREATE POLICY "Users can view messages from their conversations" 
  ON public.messages 
  FOR SELECT 
  USING (public.user_participates_in_conversation(conversation_id));

CREATE POLICY "Users can send messages to their conversations" 
  ON public.messages 
  FOR INSERT 
  WITH CHECK (
    sender_id = auth.uid() AND 
    public.user_participates_in_conversation(conversation_id)
  );

CREATE POLICY "Users can update their own messages" 
  ON public.messages 
  FOR UPDATE 
  USING (sender_id = auth.uid());

CREATE POLICY "Users can delete their own messages" 
  ON public.messages 
  FOR DELETE 
  USING (sender_id = auth.uid());

-- User Presence RLS Policies - Control exposure of user activity data
CREATE POLICY "Users can view all user presence" 
  ON public.user_presence 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can update their own presence" 
  ON public.user_presence 
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own presence status" 
  ON public.user_presence 
  FOR UPDATE 
  USING (user_id = auth.uid());

-- Create admin role check function for audit logs
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (
      email LIKE '%@admin.%' OR 
      full_name ILIKE '%admin%'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Audit Logs RLS Policies - Admin access control
CREATE POLICY "Admins can view all audit logs" 
  ON public.audit_logs 
  FOR SELECT 
  USING (public.is_admin_user());

CREATE POLICY "Users can view their own audit logs" 
  ON public.audit_logs 
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "System can insert audit logs" 
  ON public.audit_logs 
  FOR INSERT 
  WITH CHECK (true);
