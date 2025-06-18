
-- Drop all existing policies that might be causing recursion or conflicts
DROP POLICY IF EXISTS "Users can view their own conversation participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can insert their own conversation participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can update their own conversation participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can delete their own conversation participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update conversations they created" ON public.conversations;
DROP POLICY IF EXISTS "Users can update conversations they created or participate in" ON public.conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON public.conversations;

-- Create a security definer function to check conversation participation
-- This prevents recursion by using a function that runs with elevated privileges
CREATE OR REPLACE FUNCTION public.user_participates_in_conversation(conversation_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_participants 
    WHERE conversation_id = conversation_uuid 
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create non-recursive policies for conversation_participants
-- These policies only check the user_id directly without referencing other tables
CREATE POLICY "Users can view their own participation records" 
  ON public.conversation_participants 
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own participation records" 
  ON public.conversation_participants 
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own participation records" 
  ON public.conversation_participants 
  FOR UPDATE 
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own participation records" 
  ON public.conversation_participants 
  FOR DELETE 
  USING (user_id = auth.uid());

-- Create simplified policies for conversations using the security definer function
CREATE POLICY "Users can view participating conversations" 
  ON public.conversations 
  FOR SELECT 
  USING (public.user_participates_in_conversation(id));

CREATE POLICY "Users can create new conversations" 
  ON public.conversations 
  FOR INSERT 
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update owned conversations" 
  ON public.conversations 
  FOR UPDATE 
  USING (
    created_by = auth.uid() OR 
    public.user_participates_in_conversation(id)
  );
