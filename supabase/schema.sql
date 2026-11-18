-- =====================================================================
--  Prono Rugby — schéma Supabase
--  À coller tel quel dans Supabase > SQL Editor > New query > Run.
--  Le script peut être relancé : il supprime puis recrée tout.
--  ATTENTION : le relancer efface aussi les pronos déjà saisis.
-- =====================================================================

drop view if exists public.leaderboard;
drop view if exists public.prediction_points;
drop table if exists public.boosters cascade;
drop table if exists public.predictions cascade;
drop table if exists public.bonus_predictions cascade;
drop table if exists public.matches cascade;
drop table if exists public.tournament_results cascade;
drop table if exists public.league_secret cascade;
drop table if exists public.profiles cascade;
drop function if exists public.is_admin();
drop function if exists public.join_league(text, text);
drop function if exists public.match_score(int, int, int, int);
drop function if exists public.bonus_lock_at();
drop function if exists public.touch_updated_at() cascade;
drop domain if exists public.team cascade;

-- ---------------------------------------------------------------------
--  Barème (modifiable ici)
--    Bon vainqueur (ou match nul)         : 3 pts
--    + écart à 5 pts près                 : +2 pts
--    + score exact                        : +5 pts
--    Booster (1 match par journée)        : points x2
--    Pronos bonus : vainqueur du Tournoi  : 10 pts
--                   cuillère de bois      : 5 pts
-- ---------------------------------------------------------------------
create function public.match_score(ph int, pa int, rh int, ra int)
returns int language sql immutable as $$
  select case
    when ph is null or pa is null or rh is null or ra is null then null
    when sign(ph - pa) <> sign(rh - ra) then 0
    else 3
      + case when abs((ph - pa) - (rh - ra)) <= 5 then 2 else 0 end
      + case when ph = rh and pa = ra then 5 else 0 end
  end
$$;

-- Équipes : FRA, ENG, IRL, SCO, WAL, ITA
create domain public.team as text
  check (value in ('FRA', 'ENG', 'IRL', 'SCO', 'WAL', 'ITA'));

-- ---------------------------------------------------------------------
--  Tables
-- ---------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  pseudo     text not null unique check (char_length(trim(pseudo)) between 2 and 20),
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

-- Code d'invitation de la ligue : invisible depuis l'appli.
create table public.league_secret (
  id          int primary key default 1 check (id = 1),
  invite_code text not null
);
insert into public.league_secret (invite_code) values ('CHANGE-MOI');

create table public.matches (
  id         bigint generated always as identity primary key,
  round      int not null check (round between 1 and 5),
  kickoff    timestamptz not null,
  home       public.team not null,
  away       public.team not null check (away <> home),
  venue      text,
  home_score int check (home_score between 0 and 200),
  away_score int check (away_score between 0 and 200),
  check ((home_score is null) = (away_score is null))
);
create index on public.matches (kickoff);

create table public.predictions (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  match_id   bigint not null references public.matches (id) on delete cascade,
  home_score int not null check (home_score between 0 and 200),
  away_score int not null check (away_score between 0 and 200),
  updated_at timestamptz not null default now(),
  primary key (user_id, match_id)
);

-- Un booster par joueur et par journée.
create table public.boosters (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  round    int not null check (round between 1 and 5),
  match_id bigint not null references public.matches (id) on delete cascade,
  primary key (user_id, round)
);

create table public.bonus_predictions (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  winner       public.team,
  wooden_spoon public.team,
  updated_at   timestamptz not null default now()
);

create table public.tournament_results (
  id           int primary key default 1 check (id = 1),
  winner       public.team,
  wooden_spoon public.team
);
insert into public.tournament_results default values;

-- ---------------------------------------------------------------------
--  Fonctions utilitaires
-- ---------------------------------------------------------------------
create function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false)
$$;

-- Les pronos bonus se ferment au coup d'envoi du premier match.
create function public.bonus_lock_at()
returns timestamptz language sql stable security definer set search_path = public as $$
  select coalesce(min(kickoff), 'infinity'::timestamptz) from matches
$$;

-- Inscription dans la ligue avec le code d'invitation.
create function public.join_league(p_code text, p_pseudo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Non connecté';
  end if;
  if not exists (
    select 1 from league_secret
    where upper(trim(invite_code)) = upper(trim(p_code))
  ) then
    raise exception 'Code d''invitation incorrect';
  end if;
  if exists (select 1 from profiles where lower(pseudo) = lower(trim(p_pseudo)) and id <> auth.uid()) then
    raise exception 'Ce pseudo est déjà pris';
  end if;
  insert into profiles (id, pseudo) values (auth.uid(), trim(p_pseudo))
  on conflict (id) do update set pseudo = excluded.pseudo;
end
$$;

-- updated_at automatique
create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end
$$;
create trigger predictions_touch before update on public.predictions
  for each row execute function public.touch_updated_at();
create trigger bonus_touch before update on public.bonus_predictions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
--  Sécurité (Row Level Security)
--  L'heure de verrouillage est celle du serveur, pas du téléphone.
-- ---------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.league_secret      enable row level security;
alter table public.matches            enable row level security;
alter table public.predictions        enable row level security;
alter table public.boosters           enable row level security;
alter table public.bonus_predictions  enable row level security;
alter table public.tournament_results enable row level security;

-- Profils : tout le monde voit les pseudos ; on ne peut modifier que son pseudo.
create policy "profils visibles" on public.profiles
  for select to authenticated using (true);
create policy "modifier son pseudo" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (pseudo) on public.profiles to authenticated;

-- league_secret : aucune policy => inaccessible depuis l'appli.
revoke all on public.league_secret from anon, authenticated;

-- Matchs : lecture pour tous les joueurs, écriture pour les admins.
create policy "matchs visibles" on public.matches
  for select to authenticated using (true);
create policy "admin gère les matchs" on public.matches
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Pronos : on voit les siens, et ceux des autres une fois le match commencé.
create policy "voir pronos" on public.predictions
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.matches m where m.id = match_id and m.kickoff <= now())
  );
create policy "créer son prono avant le coup d'envoi" on public.predictions
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.matches m where m.id = match_id and m.kickoff > now())
  );
create policy "modifier son prono avant le coup d'envoi" on public.predictions
  for update to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from public.matches m where m.id = match_id and m.kickoff > now())
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.matches m where m.id = match_id and m.kickoff > now())
  );
create policy "supprimer son prono avant le coup d'envoi" on public.predictions
  for delete to authenticated using (
    user_id = auth.uid()
    and exists (select 1 from public.matches m where m.id = match_id and m.kickoff > now())
  );

-- Boosters : se déplacent librement tant que ni l'ancien ni le nouveau match n'a commencé.
create policy "voir boosters" on public.boosters
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.matches m where m.id = match_id and m.kickoff <= now())
  );
create policy "poser son booster" on public.boosters
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.matches m
                where m.id = match_id and m.round = boosters.round and m.kickoff > now())
  );
create policy "déplacer son booster" on public.boosters
  for update to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from public.matches m where m.id = match_id and m.kickoff > now())
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.matches m
                where m.id = match_id and m.round = boosters.round and m.kickoff > now())
  );
create policy "retirer son booster" on public.boosters
  for delete to authenticated using (
    user_id = auth.uid()
    and exists (select 1 from public.matches m where m.id = match_id and m.kickoff > now())
  );

-- Pronos bonus : modifiables jusqu'au premier coup d'envoi, puis visibles par tous.
create policy "voir pronos bonus" on public.bonus_predictions
  for select to authenticated using (user_id = auth.uid() or now() >= public.bonus_lock_at());
create policy "créer prono bonus" on public.bonus_predictions
  for insert to authenticated with check (user_id = auth.uid() and now() < public.bonus_lock_at());
create policy "modifier prono bonus" on public.bonus_predictions
  for update to authenticated
  using (user_id = auth.uid() and now() < public.bonus_lock_at())
  with check (user_id = auth.uid() and now() < public.bonus_lock_at());

-- Résultat final du Tournoi : lecture pour tous, écriture admin.
create policy "résultat visible" on public.tournament_results
  for select to authenticated using (true);
create policy "admin saisit le résultat" on public.tournament_results
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
--  Vues de calcul des points (respectent les règles ci-dessus)
-- ---------------------------------------------------------------------
create view public.prediction_points with (security_invoker = true) as
select
  p.user_id,
  p.match_id,
  m.round,
  p.home_score,
  p.away_score,
  (b.match_id is not null) as boosted,
  public.match_score(p.home_score, p.away_score, m.home_score, m.away_score)
    * case when b.match_id is not null then 2 else 1 end as points,
  (m.home_score is not null and p.home_score = m.home_score and p.away_score = m.away_score) as exact
from public.predictions p
join public.matches m on m.id = p.match_id
left join public.boosters b on b.user_id = p.user_id and b.match_id = p.match_id;

create view public.leaderboard with (security_invoker = true) as
with match_pts as (
  select user_id,
         sum(points)                           as pts,
         count(*) filter (where points > 0)    as good,
         count(*) filter (where exact)         as exact
  from public.prediction_points
  where points is not null
  group by user_id
),
bonus_pts as (
  select bp.user_id,
         case when tr.winner is not null and bp.winner = tr.winner then 10 else 0 end
       + case when tr.wooden_spoon is not null and bp.wooden_spoon = tr.wooden_spoon then 5 else 0 end as pts
  from public.bonus_predictions bp
  cross join public.tournament_results tr
)
select
  pr.id     as user_id,
  pr.pseudo,
  coalesce(mp.pts, 0) + coalesce(bo.pts, 0) as total,
  coalesce(mp.pts, 0)                       as match_points,
  coalesce(bo.pts, 0)                       as bonus_points,
  coalesce(mp.good, 0)                      as good_results,
  coalesce(mp.exact, 0)                     as exact_scores
from public.profiles pr
left join match_pts mp on mp.user_id = pr.id
left join bonus_pts bo on bo.user_id = pr.id;

grant select on public.prediction_points, public.leaderboard to authenticated;
