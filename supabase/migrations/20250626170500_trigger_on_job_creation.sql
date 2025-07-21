-- This script sets up the automation to trigger the HTML generation function
-- whenever a new export job is created.

-- 1. Create the function that will be called by the trigger.
CREATE OR REPLACE FUNCTION public.trigger_generate_book_html()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- We only want to trigger this for new jobs in 'pending' state.
  IF NEW.status = 'pending' THEN
    -- Perform an HTTP POST request to the 'generate-book-html' Edge Function.
    PERFORM net.http_post(
      url := supabase_url() || '/functions/v1/debug-trigger',
      headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || supabase_service_role_key()
      ),
      body := jsonb_build_object('record', NEW)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Create the trigger on the 'export_jobs' table.
-- This trigger will fire AFTER a row is INSERTED.
CREATE TRIGGER on_export_job_created
  AFTER INSERT ON public.export_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_generate_book_html();

COMMENT ON FUNCTION public.trigger_generate_book_html IS 'Invokes the generate-book-html Edge Function when a new export job is created.';
COMMENT ON TRIGGER on_export_job_created ON public.export_jobs IS 'After a new export job is inserted, triggers the process to generate the book HTML.';
