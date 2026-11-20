-- Allow microdrama viral funnel & hybrid unlock events in analytics_events
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
    'microdrama_swipe_next',
    'episode_comment_posted',
    'ad_unlock_started',
    'ad_unlock_completed',
    'share_unlock_completed',
    'foryou_impression',
    'foryou_watch_series',
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
