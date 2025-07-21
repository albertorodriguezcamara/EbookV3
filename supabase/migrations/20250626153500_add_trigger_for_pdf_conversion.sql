-- This script sets up the automation to trigger the PDF conversion function
-- whenever an export job's HTML has been successfully generated.

-- 1. Create the function that will be called by the trigger.
CREATE OR REPLACE FUNCTION public.trigger_convert_html_to_pdf()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- We only want to trigger this when the status changes TO 'html_generated'
  -- This prevents loops and ensures it only runs when intended.
  IF OLD.status IS DISTINCT FROM 'html_generated' AND NEW.status = 'html_generated' THEN
    -- Perform an HTTP POST request to the 'convert-html-to-pdf' Edge Function.
    PERFORM net.http_post(
      url := supabase_url() || '/functions/v1/convert-html-to-pdf',
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
-- This trigger will fire AFTER a row is UPDATED.
CREATE TRIGGER on_export_job_html_generated
  AFTER UPDATE ON public.export_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_convert_html_to_pdf();

COMMENT ON FUNCTION public.trigger_convert_html_to_pdf IS 'Invokes the convert-html-to-pdf Edge Function when an export job status becomes html_generated.';
COMMENT ON TRIGGER on_export_job_html_generated ON public.export_jobs IS 'After an export job is updated, triggers the process to convert the book HTML to PDF.';
