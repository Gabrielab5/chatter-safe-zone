
-- Add public_key column to profiles table for E2EE functionality
ALTER TABLE public.profiles 
ADD COLUMN public_key TEXT;

-- Add comment to document the column purpose
COMMENT ON COLUMN public.profiles.public_key IS 'Stores the user''s public key in JWK format for end-to-end encryption';
