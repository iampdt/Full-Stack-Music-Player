-- Reset app data while keeping schema.
TRUNCATE TABLE
  public.liked_songs,
  public.songs,
  public.subscriptions,
  public.customers,
  public.users,
  public.prices,
  public.products
RESTART IDENTITY CASCADE;

-- Re-seed minimal public catalog rows.
-- These paths assume storage objects already exist in buckets:
-- songs/seed/demo-track.mp3
-- images/seed/cover-1.jpg, cover-2.jpg, cover-3.jpg
INSERT INTO public.songs (id, title, author, song_path, image_path, user_id)
VALUES
  (1, 'Morning Drive', 'Studio Pilot', 'seed/demo-track.mp3', 'seed/cover-1.jpg', NULL),
  (2, 'City Lights', 'Neon Echo', 'seed/demo-track.mp3', 'seed/cover-2.jpg', NULL),
  (3, 'Late Night Loop', 'After Hours', 'seed/demo-track.mp3', 'seed/cover-3.jpg', NULL);
