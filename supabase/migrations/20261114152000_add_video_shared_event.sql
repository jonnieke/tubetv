-- Allow video_shared in analytics_events event_name check constraint
alter table public.analytics_events
  drop constraint if exists analytics_events_event_name_check;

alter table public.analytics_events
  add constraint analytics_events_event_name_check
  check (event_name in (
    'catalogue_view',
    'playback_start',
    'playback_error',
    'playback_first_frame',
    'playback_complete',
    'playback_buffer',
    'episode_next',
    'paywall_view',
    'paywall_initiated',
    'paywall_completed',
    'paywall_failed',
    'pass_restored',
    'checkout_start',
    'checkout_submitted',
    'subscription_activated',
    'checkout_failed',
    'qualified_view',
    'video_shared'
  ));
