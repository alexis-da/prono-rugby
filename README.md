# 🏉 Prono Rugby

Jeu de pronostics entre potes pour le Tournoi des 6 Nations, dans l'esprit de « Mon Petit Prono ».

- Chacun pronostique le score de chaque match, et s'il le veut le nombre d'essais et de cartons jaunes de chaque équipe. Tout reste modifiable jusqu'au coup d'envoi.
- Les pronos des autres deviennent visibles au coup d'envoi.
- Un **booster ×2** à placer sur un seul match de tout le Tournoi.
- Des **pronos bonus** : vainqueur du Tournoi et cuillère de bois.
- Un classement général et un classement par journée.
- **Score en direct** : pendant les matchs, le score, les essais, les cartons et les points (provisoires) s'affichent en direct, avec un classement provisoire. Tout devient définitif au coup de sifflet final, et rien n'est à saisir. L'admin peut toujours corriger à la main, et sa saisie est prioritaire.
- Une page **Admin** pour saisir ou corriger les résultats. Les points sont calculés automatiquement.
- L'inscription demande un **code d'invitation**.
- Pensée pour le téléphone, avec un mode sombre automatique.

## Barème

| Situation | Points |
|---|---|
| Bon vainqueur (ou match nul) | 3 |
| + écart de points à 5 près | +2 |
| + score exact | +5 |
| Nombre d'essais exact (par équipe) | +2 |
| Nombre de cartons jaunes exact (par équipe) | +1 |
| ⚡ Booster (1 seul match dans le Tournoi) | ×2 |
| Bonus : vainqueur du Tournoi | 10 |
| Bonus : cuillère de bois | 5 |

Les essais et les cartons rapportent des points même si le vainqueur est faux. Le maximum est de 16 pts par match, 32 avec le booster.

Pour modifier le barème, change la fonction `match_points` dans `supabase/schema.sql` (et les points bonus dans la vue `leaderboard`). Mets aussi à jour le texte des règles dans `src/pages/InfosPage.tsx`.

## Architecture

- **Front** : React + Vite (site statique), hébergé gratuitement sur Vercel.
- **Back** : Supabase gratuit (base Postgres + comptes utilisateurs).
- Toutes les règles sont appliquées **côté base de données** : verrouillage à l'heure du serveur, pronos cachés, droits admin. Modifier l'heure de son téléphone ou bricoler le navigateur ne permet donc pas de tricher.

```
supabase/schema.sql     tables, règles de sécurité, calcul des points
supabase/seed_2027.sql  calendrier du Tournoi 2027 (15 matchs)
supabase/migrations/    mises à jour d'une base déjà installée
supabase/functions/sync-results/index.ts
                        récupération automatique des résultats (ESPN)
src/                    l'application
```

## Mise en ligne (environ 20 minutes, gratuit)

### 1. Supabase

1. Crée un compte sur [supabase.com](https://supabase.com), puis **New project**. Choisis la région Europe (Paris ou Frankfurt).
2. Dans **SQL Editor > New query**, colle le contenu de `supabase/schema.sql` puis clique sur **Run**.
3. Nouvelle requête : colle `supabase/seed_2027.sql` puis **Run**. Le calendrier 2027 est chargé.
4. Choisis le code d'invitation de ta ligue :
   ```sql
   update league_secret set invite_code = 'TON-CODE';
   ```
5. Dans **Authentication > Sign In / Providers > Email**, désactive **Confirm email**. Sinon chaque pote doit valider un email, et l'envoi d'emails gratuit de Supabase est limité à quelques messages par heure.
6. Dans **Project Settings > API**, note l'**URL du projet** et la clé publique (**anon public**, ou **publishable key** sur les nouveaux projets).

> ⚠️ Relancer `schema.sql` **efface toutes les données**. Ne le fais qu'au départ.

### 2. Vercel

1. Crée un compte sur [vercel.com](https://vercel.com) avec ton compte GitHub, puis **Add New > Project** et importe le dépôt `prono-rugby`.
2. Vercel détecte Vite tout seul. Dans **Environment Variables**, ajoute :
   - `VITE_SUPABASE_URL` : l'URL du projet Supabase
   - `VITE_SUPABASE_ANON_KEY` : la clé publique
3. Clique sur **Deploy**. Tu obtiens une adresse du type `prono-rugby-xxx.vercel.app`.
4. Retourne dans Supabase, **Authentication > URL Configuration**, et mets cette adresse dans **Site URL**. Ça sert au lien « Mot de passe oublié ».

### 3. Résultats automatiques (5 minutes)

La fonction `sync-results` interroge l'API publique d'ESPN (gratuite, sans clé) **chaque minute**. Elle suit les matchs en direct : score, essais, cartons jaunes et chrono, avec des points provisoires. Au coup de sifflet final, elle enregistre le résultat définitif. Elle ne touche jamais un résultat que l'admin a saisi à la main.

1. Dans Supabase, va dans **Edge Functions > Deploy a new function > Via Editor**.
2. Nomme-la exactement `sync-results`, remplace le code d'exemple par le contenu de `supabase/functions/sync-results/index.ts`, puis clique sur **Deploy**.
3. Dans les réglages de la fonction (**Details**), désactive **Verify JWT** (« Enforce JWT verification »). La fonction ne fait que lire des résultats publics, et elle refuse de tourner plus d'une fois par minute.
4. Programme-la chaque minute : **Integrations > Cron**. Active l'intégration si besoin, puis **Create job** :
   - Nom : `sync-results`
   - Planning : `* * * * *` (chaque minute)
   - Type : **Supabase Edge Function**, fonction `sync-results`, méthode `POST`

   Si ton tableau de bord ne propose pas ce type, tu peux faire la même chose en SQL (**SQL Editor**). Il faut d'abord activer les extensions `pg_cron` et `pg_net` dans **Database > Extensions**, et remplacer `TON-PROJET` :
   ```sql
   select cron.schedule('sync-results', '* * * * *', $$
     select net.http_post(url := 'https://TON-PROJET.supabase.co/functions/v1/sync-results')
   $$);
   ```
5. Pour vérifier, ouvre l'onglet **Admin** de l'appli et clique sur **Synchroniser maintenant**. La ligne « Dernière synchro » doit se mettre à jour. Hors période de match, elle affiche « Aucun match à synchroniser ».

> Les données viennent d'une API ESPN **non officielle** : elle peut changer sans prévenir. Si un résultat manque ou paraît faux, l'admin le saisit à la main dans l'onglet **Admin** : il passe alors en « Saisi à la main » et n'est plus jamais écrasé. Le bouton « Repasser en automatique » rend la main à la synchro.

### 4. Lancer la ligue

1. Ouvre l'appli, crée ton compte et rejoins la ligue avec ton code.
2. Passe-toi admin dans **SQL Editor** :
   ```sql
   update profiles set is_admin = true where pseudo = 'TonPseudo';
   ```
3. Envoie l'adresse et le code d'invitation à tes potes. Astuce : sur téléphone, « Ajouter à l'écran d'accueil » donne une icône comme une vraie appli.

### Pendant le Tournoi

- Les scores s'affichent en direct pendant les matchs, et le classement provisoire se met à jour toutes les 30 secondes. Tout devient définitif au coup de sifflet final.
- Si un résultat manque, va dans l'onglet **Admin** pour le saisir à la main (score, essais et cartons jaunes de chaque équipe), ou clique sur **Synchroniser maintenant**.
- À la fin, saisis le vainqueur et la cuillère de bois dans **Admin** pour attribuer les points bonus.
- Si un horaire change, utilise le bouton **Horaire** de l'admin.

> ℹ️ Un projet Supabase gratuit **se met en pause après 7 jours sans activité**. Si l'appli ne répond plus avant le Tournoi, clique sur **Restore** dans le tableau de bord Supabase. Pendant le Tournoi, l'activité suffit à le garder éveillé.

## Mettre à jour une installation existante

Quand une nouvelle version ajoute un fichier dans `supabase/migrations/`, lance-le **une fois** dans **SQL Editor**. Les migrations ne suppriment aucune donnée, contrairement à `schema.sql`. Si la fonction `sync-results` a changé, recolle son code dans l'éditeur Supabase et redéploie-la.

## Développement local

```bash
npm install
cp .env.example .env.local   # puis remplis les deux valeurs
npm run dev
```

## Calendrier 2027

Les 15 matchs du Tournoi 2027 (5 février – 13 mars) sont dans `supabase/seed_2027.sql`, en heure UK. L'appli les affiche à l'heure française. Revérifie-les sur [sixnationsrugby.com](https://www.sixnationsrugby.com) avant le début : l'admin peut corriger un horaire directement dans l'appli.
