-- =====================================================================
--  Calendrier du Tournoi des 6 Nations 2027 (hommes)
--  Heures en heure UK (GMT = UTC à ces dates). L'appli les affiche
--  automatiquement à l'heure française.
--  Sources : annonces du 9 mars 2026 (Six Nations / fédérations).
--  À revérifier sur sixnationsrugby.com avant le début du Tournoi :
--  l'admin peut corriger une date directement dans l'appli.
-- =====================================================================

insert into public.matches (round, kickoff, home, away) values
  -- Journée 1
  (1, '2027-02-05 20:10+00', 'IRL', 'ENG'),
  (1, '2027-02-06 14:10+00', 'SCO', 'ITA'),
  (1, '2027-02-06 16:40+00', 'FRA', 'WAL'),
  -- Journée 2
  (2, '2027-02-13 14:10+00', 'ITA', 'IRL'),
  (2, '2027-02-13 16:40+00', 'SCO', 'WAL'),
  (2, '2027-02-14 15:10+00', 'ENG', 'FRA'),
  -- Journée 3
  (3, '2027-02-20 14:10+00', 'WAL', 'IRL'),
  (3, '2027-02-20 16:40+00', 'ENG', 'ITA'),
  (3, '2027-02-21 15:10+00', 'FRA', 'SCO'),
  -- Journée 4
  (4, '2027-03-05 20:10+00', 'SCO', 'IRL'),
  (4, '2027-03-06 14:10+00', 'ITA', 'FRA'),
  (4, '2027-03-06 16:40+00', 'WAL', 'ENG'),
  -- Journée 5 (Super Saturday)
  (5, '2027-03-13 14:10+00', 'ITA', 'WAL'),
  (5, '2027-03-13 16:40+00', 'ENG', 'SCO'),
  (5, '2027-03-13 20:10+00', 'IRL', 'FRA');
