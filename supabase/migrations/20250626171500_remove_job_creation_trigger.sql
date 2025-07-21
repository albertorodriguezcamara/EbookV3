-- This script removes the trigger and function responsible for auto-starting HTML generation.

-- 1. Drop the trigger from the 'export_jobs' table.
DROP TRIGGER IF EXISTS on_export_job_created ON public.export_jobs;

-- 2. Drop the trigger function.
DROP FUNCTION IF EXISTS public.trigger_generate_book_html();
