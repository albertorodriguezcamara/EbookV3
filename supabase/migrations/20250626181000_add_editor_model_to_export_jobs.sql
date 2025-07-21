ALTER TABLE public.export_jobs
ADD COLUMN editor_model_id UUID REFERENCES public.ai_models(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.export_jobs.editor_model_id IS 'Specifies a particular AI model to use for this export job, overriding the book''s default editor model.';
