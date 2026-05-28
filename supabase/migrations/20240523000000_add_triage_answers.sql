-- Migration to add answers column to triage table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.triage 
ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.triage.answers IS 'Stores detailed questionnaire responses from the triage form.';
