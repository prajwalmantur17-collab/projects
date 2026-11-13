-- New notification kinds for driver hire requests.
alter type public.notification_kind add value if not exists 'driver_request_created';
alter type public.notification_kind add value if not exists 'driver_request_accepted';
alter type public.notification_kind add value if not exists 'driver_request_declined';
alter type public.notification_kind add value if not exists 'driver_request_cancelled';
