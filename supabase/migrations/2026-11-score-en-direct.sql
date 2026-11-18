-- =====================================================================
--  Migration « score en direct » (novembre 2026)
--  À lancer UNE fois dans Supabase > SQL Editor si ta base a été créée
--  avec une version précédente de schema.sql. Ne supprime aucune donnée.
--  (Inutile pour une installation neuve : schema.sql contient déjà tout.)
-- =====================================================================

alter table public.matches add column if not exists status text not null default 'scheduled';
alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches add constraint matches_status_check check (status in ('scheduled', 'live', 'final'));
alter table public.matches add column if not exists live_clock text;
alter table public.matches add column if not exists result_updated_at timestamptz;
update public.matches set status = 'final' where home_score is not null and status = 'scheduled';

drop view if exists public.leaderboard;
drop view if exists public.prediction_points;

create view public.prediction_points with (security_invoker = true) as
select
  p.user_id,
  p.match_id,
  m.round,
  p.home_score,
  p.away_score,
  p.home_tries,
  p.away_tries,
  p.home_yellows,
  p.away_yellows,
  (b.match_id is not null) as boosted,
  public.match_points(
    p.home_score, p.away_score, p.home_tries, p.away_tries, p.home_yellows, p.away_yellows,
    m.home_score, m.away_score, m.home_tries, m.away_tries, m.home_yellows, m.away_yellows
  ) * case when b.match_id is not null then 2 else 1 end as points,
  (m.home_score is not null and sign(p.home_score - p.away_score) = sign(m.home_score - m.away_score)) as good,
  (m.home_score is not null and p.home_score = m.home_score and p.away_score = m.away_score) as exact,
  (m.status = 'live') as provisional
from public.predictions p
join public.matches m on m.id = p.match_id
left join public.boosters b on b.user_id = p.user_id and b.match_id = p.match_id;

create view public.leaderboard with (security_invoker = true) as
with match_pts as (
  select user_id,
         sum(points)                     as pts,
         count(*) filter (where good)    as good,
         count(*) filter (where exact)   as exact,
         sum(points) filter (where provisional) as live_pts
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
  coalesce(mp.exact, 0)                     as exact_scores,
  coalesce(mp.live_pts, 0)                  as live_points  -- dont points provisoires (matchs en cours)
from public.profiles pr
left join match_pts mp on mp.user_id = pr.id
left join bonus_pts bo on bo.user_id = pr.id;

grant select on public.prediction_points, public.leaderboard to authenticated;
