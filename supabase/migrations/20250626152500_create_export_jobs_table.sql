CREATE TABLE public.export_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status text DEFAULT 'pending'::text NOT NULL,
    status_message text,
    format text NOT NULL, -- e.g., 'pdf', 'docx'
    color_scheme text NOT NULL, -- e.g., 'color', 'sepia', 'bw'
    export_options jsonb, -- To store dedication, isbn, acknowledgements
    download_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to manage their own export jobs" ON public.export_jobs
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Assuming the moddatetime function from supabase/functions-helpers or similar exists
-- to automatically update the updated_at column on changes.
CREATE TRIGGER handle_updated_at
BEFORE UPDATE ON public.export_jobs
FOR EACH ROW
EXECUTE FUNCTION moddatetime (updated_at);

COMMENT ON TABLE public.export_jobs IS 'Tracks status and details of book export requests.';
COMMENT ON COLUMN public.export_jobs.export_options IS 'Stores optional user-provided text like dedication, ISBN, and acknowledgements.';
