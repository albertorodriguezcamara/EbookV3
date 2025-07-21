-- Add image_url column to public.chapters table
ALTER TABLE public.chapters
ADD COLUMN IF NOT EXISTS image_url TEXT NULL;

COMMENT ON COLUMN public.chapters.image_url IS 'URL of the AI-generated image for this chapter, stored in Supabase Storage.';
