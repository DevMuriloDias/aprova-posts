-- Bucket privado para as mídias dos posts.
-- Estrutura dos caminhos: <owner_id>/<client_id>/<post_id>/<arquivo>
-- Cada social media só lê e grava dentro da própria pasta (<owner_id>/).
-- O cliente final verá as mídias por URLs assinadas geradas no servidor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  false,
  104857600, -- 100 MB
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;

create policy "Social media vê as próprias mídias no storage"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Social media envia mídias para a própria pasta"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Social media atualiza as próprias mídias no storage"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Social media apaga as próprias mídias no storage"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
