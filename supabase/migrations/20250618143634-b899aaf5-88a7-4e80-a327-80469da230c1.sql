
-- Create user_presence table for online status tracking
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  is_online boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for user_presence
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_presence
CREATE POLICY "Anyone can view user presence" 
  ON public.user_presence 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can manage their own presence" 
  ON public.user_presence 
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Enable realtime for user_presence
ALTER TABLE public.user_presence REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.user_presence;
