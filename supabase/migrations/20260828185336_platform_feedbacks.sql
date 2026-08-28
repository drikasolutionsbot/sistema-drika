CREATE TABLE IF NOT EXISTS public.platform_feedbacks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text,
    message text NOT NULL,
    rating integer CHECK (rating >= 1 AND rating <= 5),
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.platform_feedbacks ENABLE ROW LEVEL SECURITY;

-- Allow anyone (including unauthenticated users) to insert feedbacks
CREATE POLICY "Anyone can insert platform feedbacks"
ON public.platform_feedbacks FOR INSERT
WITH CHECK (true);

-- Allow only super admins to view feedbacks
CREATE POLICY "Super admins can view platform feedbacks"
ON public.platform_feedbacks FOR SELECT
USING (auth.uid() IN (SELECT id FROM admin_users));
