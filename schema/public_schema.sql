--
-- PostgreSQL database dump
--

\restrict EpwdsSkVplIryg5HGRi1j2B6VfccuA4441sKCdYF8vxNTzPcMhwefGk4hHgc57b

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "public";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: activity_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."activity_level" AS ENUM (
    'sedentary',
    'light',
    'moderate',
    'active',
    'very_active'
);


--
-- Name: ai_job_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."ai_job_status" AS ENUM (
    'queued',
    'processing',
    'done',
    'error'
);


--
-- Name: gender; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."gender" AS ENUM (
    'male',
    'female',
    'other',
    'prefer_not_to_say'
);


--
-- Name: meal_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."meal_type" AS ENUM (
    'breakfast',
    'lunch',
    'dinner',
    'snack',
    'drink',
    'other'
);


--
-- Name: nutrition_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."nutrition_method" AS ENUM (
    'ai_model',
    'barcode',
    'manual'
);


--
-- Name: plan_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "public"."plan_status" AS ENUM (
    'draft',
    'sent',
    'done',
    'skipped'
);


--
-- Name: _usage_today(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."_usage_today"() RETURNS TABLE("limit_per_day" integer, "used" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    coalesce(l.daily_limit, 0) as limit_per_day,
    coalesce(d.used_credits, 0) as used
  from auth.users u
  join public.usage_limits l on l.user_id = u.id
  left join public.usage_daily d
    on d.user_id = u.id and d.day = current_date
  where u.id = auth.uid();
$$;


--
-- Name: can_consume(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."can_consume"("needed_credits" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  lim int;
  used_val int;
begin
  if auth.uid() is null then
    return false; -- nepřihlášený nemá nárok
  end if;

  select t.limit_per_day, t.used
    into lim, used_val
  from public._usage_today() t;

  if lim is null then
    return false; -- nemá nastavený limit
  end if;

  return (used_val + greatest(needed_credits,0)) <= lim;
end;
$$;


--
-- Name: can_make_request("uuid", integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."can_make_request"("p_user" "uuid", "p_min_budget" integer) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with lim as (
    select coalesce(l.daily_limit, 2000) as lim
    from usage_limits l where l.user_id = p_user
  ), used as (
    select coalesce(u.tokens_used,0) as used
    from usage_daily u where u.user_id = p_user and u.day = current_date
  )
  select (coalesce((select lim from lim), 2000) - coalesce((select used from used), 0)) >= p_min_budget;
$$;


--
-- Name: compute_and_save_targets_for_me("text", numeric, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."compute_and_save_targets_for_me"("p_goal_override" "text" DEFAULT NULL::"text", "p_protein_g_per_kg" numeric DEFAULT 1.6, "p_steps_target" integer DEFAULT NULL::integer) RETURNS TABLE("user_id" "uuid", "kcal_target" integer, "protein_g_target" integer, "steps_target" integer, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
declare
  v_user uuid := auth.uid();
  v_profile record;
  v_weight numeric;
  v_age_years int;
  v_bmr numeric;
  v_activity_factor numeric := 1.2;
  v_goal text;
  v_kcal_adj_factor numeric := 0;  -- -0.15 = -15%, +0.10 = +10% atd.
  v_kcal_target int;
  v_protein_target int;
  v_steps_target int;
begin
  -- profil
  select
    p.id,
    p.gender,
    p.birth_date,
    p.height_cm,
    p.activity_level,
    coalesce(p_goal_override, p.goal) as goal
  into v_profile
  from public.profiles p
  where p.id = v_user;

  if v_profile.id is null then
    raise exception 'Profile not found for user %', v_user;
  end if;

  -- věk
  if v_profile.birth_date is not null then
    v_age_years := date_part('year', age(v_profile.birth_date))::int;
  else
    v_age_years := 30; -- rozumný default, když chybí datum narození
  end if;

  -- váha
  v_weight := public.current_weight_kg(v_user);
  if v_weight is null then
    raise exception 'No weight available for user % (need entries.weight_kg or profiles.initial_weight_kg)', v_user;
  end if;

  -- BMR (Mifflin–St Jeor)
  -- male:    10*w + 6.25*h - 5*age + 5
  -- female:  10*w + 6.25*h - 5*age - 161
  -- other/prefer_not_to_say -> použijeme unisex průměr (offset -78)
  if v_profile.gender::text = 'male' then
    v_bmr := 10*v_weight + 6.25*coalesce(v_profile.height_cm, 170) - 5*v_age_years + 5;
  elsif v_profile.gender::text = 'female' then
    v_bmr := 10*v_weight + 6.25*coalesce(v_profile.height_cm, 165) - 5*v_age_years - 161;
  else
    v_bmr := 10*v_weight + 6.25*coalesce(v_profile.height_cm, 168) - 5*v_age_years - 78;
  end if;

  -- Aktivita
  v_activity_factor := case v_profile.activity_level::text
    when 'sedentary'   then 1.2
    when 'light'       then 1.375
    when 'moderate'    then 1.55
    when 'active'      then 1.725
    when 'very_active' then 1.9
    else 1.2
  end;

  -- Cíl (deficit/surplus)
  v_goal := coalesce(v_profile.goal, '');
  v_kcal_adj_factor := case
    when lower(v_goal) like '%lose%'        then -0.15  -- hubnutí
    when lower(v_goal) like '%gain%'        then  0.10  -- nabírání
    when lower(v_goal) like '%maintain%'    then  0.00
    when lower(v_goal) like '%health%'      then  0.00
    else 0.00
  end;

  -- Výpočet
  v_kcal_target := round( (v_bmr * v_activity_factor) * (1 + v_kcal_adj_factor) )::int;
  v_protein_target := ceil( v_weight * p_protein_g_per_kg )::int;

  -- Steps – ponech, nebo nastav z parametru
  select coalesce(p_steps_target, t.steps_target, 8000) into v_steps_target
  from public.targets t
  where t.user_id = v_user
  limit 1;

  -- UPSERT do targets
  insert into public.targets (user_id, kcal_target, protein_g_target, steps_target, updated_at)
  values (v_user, v_kcal_target, v_protein_target, v_steps_target, now())
  on conflict (user_id) do update set
    kcal_target = excluded.kcal_target,
    protein_g_target = excluded.protein_g_target,
    steps_target = excluded.steps_target,
    updated_at = now();

  return query
  select t.user_id, t.kcal_target, t.protein_g_target, t.steps_target, t.updated_at
  from public.targets t
  where t.user_id = v_user;
end;
$$;


--
-- Name: consume(integer, "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."consume"("needed_credits" integer, "kind" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  can_use bool;
  inc_text int := 0;
  inc_vision int := 0;
begin
  if auth.uid() is null then
    return false;
  end if;

  -- mapování druhu volání na čítače
  if kind = 'vision' then
    inc_vision := 1;
  elsif kind = 'text' then
    inc_text := 1;
  end if;

  -- ověř limit
  can_use := public.can_consume(needed_credits);
  if not can_use then
    return false;
  end if;

  -- upsert dnešního záznamu
  insert into public.usage_daily (user_id, day, used_credits, text_calls, vision_calls)
  values (auth.uid(), current_date, greatest(needed_credits,0), inc_text, inc_vision)
  on conflict (user_id, day) do update
    set used_credits = usage_daily.used_credits + greatest(excluded.used_credits,0),
        text_calls   = usage_daily.text_calls   + excluded.text_calls,
        vision_calls = usage_daily.vision_calls + excluded.vision_calls;

  return true;
end;
$$;


--
-- Name: consume_tokens("uuid", integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."consume_tokens"("p_user" "uuid", "p_tokens" integer) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  insert into usage_daily as u (user_id, day, tokens_used)
  values (p_user, current_date, 0)
  on conflict (user_id, day) do nothing;

  with lim as (
    select coalesce(l.daily_limit, 2000) as lim
    from usage_limits l where l.user_id = p_user
  ), upd as (
    update usage_daily u
    set tokens_used = u.tokens_used + p_tokens
    where u.user_id = p_user and u.day = current_date
      and (u.tokens_used + p_tokens) <= coalesce((select lim from lim), 2000)
    returning 1
  )
  select exists(select 1 from upd);
$$;


--
-- Name: create_meal_with_image("public"."meal_type", timestamp with time zone, "text", "text", "text", integer, integer, integer, "text", "jsonb"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."create_meal_with_image"("p_meal_type" "public"."meal_type", "p_meal_datetime" timestamp with time zone, "p_note" "text", "p_storage_path" "text", "p_thumb_path" "text" DEFAULT NULL::"text", "p_bytes" integer DEFAULT NULL::integer, "p_width" integer DEFAULT NULL::integer, "p_height" integer DEFAULT NULL::integer, "p_sha256" "text" DEFAULT NULL::"text", "p_exif" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_meal uuid;
begin
  insert into public.meal_logs (id, user_id, meal_datetime, meal_type, note, source)
  values (gen_random_uuid(), auth.uid(), coalesce(p_meal_datetime, now()), p_meal_type, p_note, 'photo')
  returning id into v_meal;

  insert into public.meal_images (meal_id, storage_path, thumb_path, bytes, width, height, sha256, exif)
  values (v_meal, p_storage_path, p_thumb_path, p_bytes, p_width, p_height, p_sha256, p_exif);

  insert into public.ai_jobs (meal_id, status) values (v_meal, 'queued');

  return v_meal;
end $$;


--
-- Name: current_weight_kg("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."current_weight_kg"("p_user_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce(
    (
      select e.weight_kg
      from public.entries e
      where e.user_id = p_user_id and e.weight_kg is not null
      order by e.date desc nulls last, e.inserted_at desc nulls last
      limit 1
    ),
    (
      select p.initial_weight_kg
      from public.profiles p
      where p.id = p_user_id
    )
  );
$$;


--
-- Name: generate_today_plan_for_me("text", integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."generate_today_plan_for_me"("p_model_version" "text" DEFAULT 'planner-v1'::"text", "p_meals" integer DEFAULT NULL::integer) RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_user uuid := auth.uid();
  v_targets record;
  v_pref record;
  v_plan_id uuid;
  v_kcal int; v_protein int;
  v_kcal_adj int;
  v_meals int := coalesce(p_meals, 3);
  v_inputs jsonb;
begin
  -- načti cíle a preference
  select t.kcal_target, t.protein_g_target into v_targets
  from public.targets t where t.user_id = v_user;

  select * into v_pref from public.user_preferences where user_id = v_user;

  if v_targets.kcal_target is null then
    perform public.compute_and_save_targets_for_me(); -- fallback
    select t.kcal_target, t.protein_g_target into v_targets
    from public.targets t where t.user_id = v_user;
  end if;

  -- úprava dle včerejška (jednoduchá regulace, cap ±10 %)
  with y as (
    select * from public.yesterday_snapshot where user_id = v_user
  )
  select
    case
      when y.kcal_yday is null then v_targets.kcal_target
      else greatest( round(v_targets.kcal_target * (1 + least(greatest((v_targets.kcal_target - y.kcal_yday)/nullif(v_targets.kcal_target,0), -0.1), 0.1)) )::int, 1200)
    end as kcal_today,
    v_targets.protein_g_target as protein_today
  into v_kcal, v_protein
  from y;

  v_inputs := jsonb_build_object('targets', v_targets, 'yesterday', (select row_to_json(y) from public.yesterday_snapshot y where y.user_id=v_user));

  -- vytvoř kostru plánu
  insert into public.meal_plans (user_id, plan_date, kcal_target, protein_g_target, status)
  values (v_user, current_date, v_kcal, v_protein, 'draft')
  on conflict (user_id, plan_date) do update set
    kcal_target = excluded.kcal_target,
    protein_g_target = excluded.protein_g_target,
    updated_at = now()
  returning id into v_plan_id;

  -- jednoduché rozdělení makro-cíle do jídel (40/35/25 % pro 3 jídla)
  -- výběr jídel z katalogu necháme na workeru/AI (viz níž); tady jen rezervujeme sloty
  delete from public.meal_plan_items where plan_id = v_plan_id;

  insert into public.meal_plan_items (plan_id, meal_type, instructions)
  select v_plan_id, mt, 'AI to fill'
  from (values ('breakfast'::meal_type), ('lunch'), ('dinner')) as t(mt)
  limit v_meals;

  -- audit
  insert into public.recommendation_runs (user_id, run_for_date, model_version, inputs, outputs)
  values (v_user, current_date, p_model_version, v_inputs, jsonb_build_object('plan_id', v_plan_id));

  return v_plan_id;
end $$;


--
-- Name: recompute_targets_after_new_entry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."recompute_targets_after_new_entry"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.user_id = auth.uid() and new.weight_kg is not null then
    perform public.compute_and_save_targets_for_me();
  end if;
  return new;
end;
$$;


--
-- Name: recompute_targets_after_profile_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."recompute_targets_after_profile_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.compute_and_save_targets_for_me(); -- běží pro auth.uid()
  return new;
exception when others then
  -- nechybuj uživateli UI kvůli přepočtu; případně loguj do tabulky
  return new;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end $$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end $$;


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: ai_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ai_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meal_id" "uuid" NOT NULL,
    "status" "public"."ai_job_status" DEFAULT 'queued'::"public"."ai_job_status" NOT NULL,
    "error_message" "text",
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: meal_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."meal_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "meal_datetime" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meal_type" "public"."meal_type" NOT NULL,
    "note" "text",
    "source" "text" DEFAULT 'photo'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "meal_logs_source_check" CHECK (("source" = ANY (ARRAY['photo'::"text", 'text'::"text", 'both'::"text"])))
);


--
-- Name: meal_nutrition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."meal_nutrition" (
    "meal_id" "uuid" NOT NULL,
    "method" "public"."nutrition_method" DEFAULT 'ai_model'::"public"."nutrition_method" NOT NULL,
    "kcal" numeric(6,1),
    "protein_g" numeric(6,2),
    "carbs_g" numeric(6,2),
    "fat_g" numeric(6,2),
    "fiber_g" numeric(6,2),
    "sugar_g" numeric(6,2),
    "sodium_mg" numeric(8,2),
    "confidence" numeric(4,3),
    "model_version" "text",
    "ingredients" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "meal_nutrition_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric)))
);


--
-- Name: daily_nutrition_totals; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."daily_nutrition_totals" AS
 SELECT "ml"."user_id",
    ("date_trunc"('day'::"text", "ml"."meal_datetime"))::"date" AS "day",
    ("sum"(COALESCE("n"."kcal", (0)::numeric)))::numeric(10,1) AS "kcal",
    ("sum"(COALESCE("n"."protein_g", (0)::numeric)))::numeric(10,2) AS "protein_g",
    ("sum"(COALESCE("n"."carbs_g", (0)::numeric)))::numeric(10,2) AS "carbs_g",
    ("sum"(COALESCE("n"."fat_g", (0)::numeric)))::numeric(10,2) AS "fat_g",
    "count"(*) AS "meals_count"
   FROM ("public"."meal_logs" "ml"
     LEFT JOIN "public"."meal_nutrition" "n" ON (("n"."meal_id" = "ml"."id")))
  GROUP BY "ml"."user_id", (("date_trunc"('day'::"text", "ml"."meal_datetime"))::"date");


--
-- Name: entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "weight_kg" numeric(5,2),
    "notes" "text",
    "sleep_hours" numeric(4,1),
    "steps" integer,
    "inserted_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."entries" FORCE ROW LEVEL SECURITY;


--
-- Name: foods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."foods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "base_portion_grams" integer,
    "kcal_per_100" numeric(6,1),
    "protein_g_per_100" numeric(5,2),
    "carbs_g_per_100" numeric(5,2),
    "fat_g_per_100" numeric(5,2),
    "fiber_g_per_100" numeric(5,2),
    "tags" "jsonb",
    "allergens" "jsonb",
    "recipe" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: meal_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."meal_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meal_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "bytes" integer,
    "width" integer,
    "height" integer,
    "sha256" "text",
    "exif" "jsonb",
    "thumb_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: meal_plan_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."meal_plan_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "meal_type" "public"."meal_type" NOT NULL,
    "food_id" "uuid",
    "portion_grams" integer,
    "kcal" numeric(6,1),
    "protein_g" numeric(6,2),
    "carbs_g" numeric(6,2),
    "fat_g" numeric(6,2),
    "instructions" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: meal_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."meal_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan_date" "date" NOT NULL,
    "kcal_target" integer,
    "protein_g_target" integer,
    "status" "public"."plan_status" DEFAULT 'draft'::"public"."plan_status" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: meals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."meals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "moment" "text" NOT NULL,
    "text" "text" NOT NULL,
    "calories" integer,
    "protein_g" integer,
    "carbs_g" integer,
    "fat_g" integer,
    "user_id" "uuid" NOT NULL,
    CONSTRAINT "meals_moment_check" CHECK (("moment" = ANY (ARRAY['breakfast'::"text", 'lunch'::"text", 'dinner'::"text", 'snack'::"text"])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."profiles" (
    "id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "goal" "text" DEFAULT 'lose'::"text",
    "height_cm" integer,
    "dietary_flags" "jsonb",
    "first_name" "text",
    "last_name" "text",
    "gender" "public"."gender",
    "birth_date" "date",
    "address" "jsonb",
    "initial_weight_kg" numeric(5,2),
    "activity_level" "public"."activity_level",
    "consent_terms_at" timestamp with time zone,
    "consent_privacy_at" timestamp with time zone,
    "onboarding_completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "profiles_goal_check" CHECK (("goal" = ANY (ARRAY['lose'::"text", 'maintain'::"text", 'gain'::"text"])))
);

ALTER TABLE ONLY "public"."profiles" FORCE ROW LEVEL SECURITY;


--
-- Name: recommendation_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."recommendation_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "run_for_date" "date" NOT NULL,
    "model_version" "text",
    "inputs" "jsonb",
    "outputs" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: rn_ping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."rn_ping" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "note" "text"
);


--
-- Name: targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."targets" (
    "user_id" "uuid" NOT NULL,
    "kcal_target" integer,
    "protein_g_target" integer,
    "steps_target" integer,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: usage_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."usage_daily" (
    "user_id" "uuid" NOT NULL,
    "day" "date" DEFAULT CURRENT_DATE NOT NULL,
    "tokens_used" integer DEFAULT 0 NOT NULL,
    "used_credits" integer DEFAULT 0 NOT NULL,
    "text_calls" integer DEFAULT 0 NOT NULL,
    "vision_calls" integer DEFAULT 0 NOT NULL
);


--
-- Name: usage_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."usage_limits" (
    "user_id" "uuid" NOT NULL,
    "daily_limit" integer DEFAULT 2000 NOT NULL,
    "plan" "text" DEFAULT 'free'::"text"
);


--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."user_preferences" (
    "user_id" "uuid" NOT NULL,
    "cuisines" "jsonb",
    "dislikes" "jsonb",
    "allergens" "jsonb",
    "eating_window" "jsonb",
    "meals_per_day" integer DEFAULT 3,
    "budget_level" integer DEFAULT 2,
    "cooking_time_minutes" integer DEFAULT 20,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_preferences_budget_level_check" CHECK ((("budget_level" >= 1) AND ("budget_level" <= 3)))
);


--
-- Name: workouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."workouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "duration_min" integer NOT NULL,
    "intensity" "text" DEFAULT 'mid'::"text",
    "kcal" integer,
    "user_id" "uuid" NOT NULL,
    CONSTRAINT "workouts_intensity_check" CHECK (("intensity" = ANY (ARRAY['low'::"text", 'mid'::"text", 'high'::"text"])))
);

ALTER TABLE ONLY "public"."workouts" FORCE ROW LEVEL SECURITY;


--
-- Name: yesterday_snapshot; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."yesterday_snapshot" AS
 SELECT "id" AS "user_id",
    ( SELECT "dt"."kcal"
           FROM "public"."daily_nutrition_totals" "dt"
          WHERE (("dt"."user_id" = "p"."id") AND ("dt"."day" = (CURRENT_DATE - 1)))) AS "kcal_yday",
    ( SELECT "dt"."protein_g"
           FROM "public"."daily_nutrition_totals" "dt"
          WHERE (("dt"."user_id" = "p"."id") AND ("dt"."day" = (CURRENT_DATE - 1)))) AS "protein_yday",
    ( SELECT "sum"("e"."steps") AS "sum"
           FROM "public"."entries" "e"
          WHERE (("e"."user_id" = "p"."id") AND ("e"."date" = (CURRENT_DATE - 1)))) AS "steps_yday",
    "public"."current_weight_kg"("id") AS "weight_now"
   FROM "public"."profiles" "p";


--
-- Name: ai_jobs ai_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ai_jobs"
    ADD CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id");


--
-- Name: entries entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_pkey" PRIMARY KEY ("id");


--
-- Name: entries entries_user_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_user_id_date_key" UNIQUE ("user_id", "date");


--
-- Name: foods foods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."foods"
    ADD CONSTRAINT "foods_pkey" PRIMARY KEY ("id");


--
-- Name: meal_images meal_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."meal_images"
    ADD CONSTRAINT "meal_images_pkey" PRIMARY KEY ("id");


--
-- Name: meal_logs meal_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."meal_logs"
    ADD CONSTRAINT "meal_logs_pkey" PRIMARY KEY ("id");


--
-- Name: meal_nutrition meal_nutrition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."meal_nutrition"
    ADD CONSTRAINT "meal_nutrition_pkey" PRIMARY KEY ("meal_id");


--
-- Name: meal_plan_items meal_plan_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."meal_plan_items"
    ADD CONSTRAINT "meal_plan_items_pkey" PRIMARY KEY ("id");


--
-- Name: meal_plans meal_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."meal_plans"
    ADD CONSTRAINT "meal_plans_pkey" PRIMARY KEY ("id");


--
-- Name: meal_plans meal_plans_user_id_plan_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."meal_plans"
    ADD CONSTRAINT "meal_plans_user_id_plan_date_key" UNIQUE ("user_id", "plan_date");


--
-- Name: meals meals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."meals"
    ADD CONSTRAINT "meals_pkey" PRIMARY KEY ("id");


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");


--
-- Name: recommendation_runs recommendation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."recommendation_runs"
    ADD CONSTRAINT "recommendation_runs_pkey" PRIMARY KEY ("id");


--
-- Name: rn_ping rn_ping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."rn_ping"
    ADD CONSTRAINT "rn_ping_pkey" PRIMARY KEY ("id");


--
-- Name: targets targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."targets"
    ADD CONSTRAINT "targets_pkey" PRIMARY KEY ("user_id");


--
-- Name: usage_daily usage_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."usage_daily"
    ADD CONSTRAINT "usage_daily_pkey" PRIMARY KEY ("user_id", "day");


--
-- Name: usage_daily usage_daily_user_day_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."usage_daily"
    ADD CONSTRAINT "usage_daily_user_day_key" UNIQUE ("user_id", "day");


--
-- Name: usage_limits usage_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."usage_limits"
    ADD CONSTRAINT "usage_limits_pkey" PRIMARY KEY ("user_id");


--
-- Name: usage_limits usage_limits_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."usage_limits"
    ADD CONSTRAINT "usage_limits_user_id_key" UNIQUE ("user_id");


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id");


--
-- Name: workouts workouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."workouts"
    ADD CONSTRAINT "workouts_pkey" PRIMARY KEY ("id");


--
-- Name: ai_jobs_meal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ai_jobs_meal_idx" ON "public"."ai_jobs" USING "btree" ("meal_id");


--
-- Name: ai_jobs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ai_jobs_status_idx" ON "public"."ai_jobs" USING "btree" ("status");


--
-- Name: entries_user_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "entries_user_date_idx" ON "public"."entries" USING "btree" ("user_id", "date");


--
-- Name: foods_tags_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "foods_tags_idx" ON "public"."foods" USING "gin" ("tags");


--
-- Name: idx_entries_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_entries_user_date" ON "public"."entries" USING "btree" ("user_id", "date");


--
-- Name: idx_meals_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_meals_entry" ON "public"."meals" USING "btree" ("entry_id");


--
-- Name: idx_workouts_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_workouts_entry" ON "public"."workouts" USING "btree" ("entry_id");


--
-- Name: meal_images_meal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "meal_images_meal_idx" ON "public"."meal_images" USING "btree" ("meal_id");


--
-- Name: workouts_user_entry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workouts_user_entry_idx" ON "public"."workouts" USING "btree" ("user_id", "entry_id");


--
-- Name: entries entries_recompute_targets; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "entries_recompute_targets" AFTER INSERT ON "public"."entries" FOR EACH ROW EXECUTE FUNCTION "public"."recompute_targets_after_new_entry"();


--
-- Name: meal_logs meal_logs_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "meal_logs_touch" BEFORE UPDATE ON "public"."meal_logs" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();


--
-- Name: meal_nutrition meal_nutrition_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "meal_nutrition_touch" BEFORE UPDATE ON "public"."meal_nutrition" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();


--
-- Name: profiles profiles_recompute_targets; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "profiles_recompute_targets" AFTER UPDATE OF "height_cm", "gender", "activity_level", "goal", "initial_weight_kg", "birth_date" ON "public"."profiles" FOR EACH ROW WHEN (("new"."id" = "auth"."uid"())) EXECUTE FUNCTION "public"."recompute_targets_after_profile_update"();


--
-- Name: profiles profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


--
-- Name: ai_jobs ai_jobs_meal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ai_jobs"
    ADD CONSTRAINT "ai_jobs_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "public"."meal_logs"("id") ON DELETE CASCADE;


--
-- Name: entries entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: meal_images meal_images_meal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."meal_images"
    ADD CONSTRAINT "meal_images_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "public"."meal_logs"("id") ON DELETE CASCADE;


--
-- Name: meal_logs meal_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."meal_logs"
    ADD CONSTRAINT "meal_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: meal_nutrition meal_nutrition_meal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."meal_nutrition"
    ADD CONSTRAINT "meal_nutrition_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "public"."meal_logs"("id") ON DELETE CASCADE;


--
-- Name: meal_plan_items meal_plan_items_food_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."meal_plan_items"
    ADD CONSTRAINT "meal_plan_items_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id");


--
-- Name: meal_plan_items meal_plan_items_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."meal_plan_items"
    ADD CONSTRAINT "meal_plan_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE CASCADE;


--
-- Name: meal_plans meal_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."meal_plans"
    ADD CONSTRAINT "meal_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: meals meals_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."meals"
    ADD CONSTRAINT "meals_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE CASCADE;


--
-- Name: meals meals_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."meals"
    ADD CONSTRAINT "meals_user_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: recommendation_runs recommendation_runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."recommendation_runs"
    ADD CONSTRAINT "recommendation_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: targets targets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."targets"
    ADD CONSTRAINT "targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: usage_daily usage_daily_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."usage_daily"
    ADD CONSTRAINT "usage_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: usage_limits usage_limits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."usage_limits"
    ADD CONSTRAINT "usage_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: user_preferences user_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: workouts workouts_entry_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."workouts"
    ADD CONSTRAINT "workouts_entry_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE CASCADE;


--
-- Name: workouts workouts_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."workouts"
    ADD CONSTRAINT "workouts_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE CASCADE;


--
-- Name: workouts workouts_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."workouts"
    ADD CONSTRAINT "workouts_user_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: ai_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ai_jobs" ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_jobs ai_jobs_i; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ai_jobs_i" ON "public"."ai_jobs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."meal_logs" "ml"
  WHERE (("ml"."id" = "ai_jobs"."meal_id") AND ("ml"."user_id" = "auth"."uid"())))));


--
-- Name: ai_jobs ai_jobs_r; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ai_jobs_r" ON "public"."ai_jobs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."meal_logs" "ml"
  WHERE (("ml"."id" = "ai_jobs"."meal_id") AND ("ml"."user_id" = "auth"."uid"())))));


--
-- Name: rn_ping anon insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anon insert" ON "public"."rn_ping" FOR INSERT WITH CHECK (true);


--
-- Name: rn_ping anon select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anon select" ON "public"."rn_ping" FOR SELECT USING (true);


--
-- Name: entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."entries" ENABLE ROW LEVEL SECURITY;

--
-- Name: meal_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."meal_images" ENABLE ROW LEVEL SECURITY;

--
-- Name: meal_images meal_images_rw; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "meal_images_rw" ON "public"."meal_images" USING ((EXISTS ( SELECT 1
   FROM "public"."meal_logs" "ml"
  WHERE (("ml"."id" = "meal_images"."meal_id") AND ("ml"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."meal_logs" "ml"
  WHERE (("ml"."id" = "meal_images"."meal_id") AND ("ml"."user_id" = "auth"."uid"())))));


--
-- Name: meal_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."meal_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: meal_logs meal_logs_rw; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "meal_logs_rw" ON "public"."meal_logs" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: meal_nutrition; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."meal_nutrition" ENABLE ROW LEVEL SECURITY;

--
-- Name: meal_nutrition meal_nutrition_rw; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "meal_nutrition_rw" ON "public"."meal_nutrition" USING ((EXISTS ( SELECT 1
   FROM "public"."meal_logs" "ml"
  WHERE (("ml"."id" = "meal_nutrition"."meal_id") AND ("ml"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."meal_logs" "ml"
  WHERE (("ml"."id" = "meal_nutrition"."meal_id") AND ("ml"."user_id" = "auth"."uid"())))));


--
-- Name: meal_plan_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."meal_plan_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: meal_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."meal_plans" ENABLE ROW LEVEL SECURITY;

--
-- Name: meals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."meals" ENABLE ROW LEVEL SECURITY;

--
-- Name: entries own entries delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own entries delete" ON "public"."entries" FOR DELETE USING (("user_id" = "auth"."uid"()));


--
-- Name: entries own entries insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own entries insert" ON "public"."entries" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: entries own entries select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own entries select" ON "public"."entries" FOR SELECT USING (("user_id" = "auth"."uid"()));


--
-- Name: entries own entries update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own entries update" ON "public"."entries" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: meals own meals delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own meals delete" ON "public"."meals" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."entries" "e"
  WHERE (("e"."id" = "meals"."entry_id") AND ("e"."user_id" = "auth"."uid"())))));


--
-- Name: meals own meals insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own meals insert" ON "public"."meals" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."entries" "e"
  WHERE (("e"."id" = "meals"."entry_id") AND ("e"."user_id" = "auth"."uid"())))));


--
-- Name: meals own meals select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own meals select" ON "public"."meals" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."entries" "e"
  WHERE (("e"."id" = "meals"."entry_id") AND ("e"."user_id" = "auth"."uid"())))));


--
-- Name: meals own meals update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own meals update" ON "public"."meals" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."entries" "e"
  WHERE (("e"."id" = "meals"."entry_id") AND ("e"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."entries" "e"
  WHERE (("e"."id" = "meals"."entry_id") AND ("e"."user_id" = "auth"."uid"())))));


--
-- Name: profiles own profile insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own profile insert" ON "public"."profiles" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));


--
-- Name: profiles own profile select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own profile select" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));


--
-- Name: profiles own profile update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own profile update" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));


--
-- Name: entries own rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own rows" ON "public"."entries" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: meals own rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own rows" ON "public"."meals" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: profiles own rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own rows" ON "public"."profiles" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));


--
-- Name: targets own rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own rows" ON "public"."targets" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: usage_daily own rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own rows" ON "public"."usage_daily" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: usage_limits own rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own rows" ON "public"."usage_limits" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: workouts own rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own rows" ON "public"."workouts" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: targets own targets delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own targets delete" ON "public"."targets" FOR DELETE USING (("user_id" = "auth"."uid"()));


--
-- Name: targets own targets insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own targets insert" ON "public"."targets" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: targets own targets select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own targets select" ON "public"."targets" FOR SELECT USING (("user_id" = "auth"."uid"()));


--
-- Name: targets own targets update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own targets update" ON "public"."targets" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: workouts own workouts delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own workouts delete" ON "public"."workouts" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."entries" "e"
  WHERE (("e"."id" = "workouts"."entry_id") AND ("e"."user_id" = "auth"."uid"())))));


--
-- Name: workouts own workouts insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own workouts insert" ON "public"."workouts" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."entries" "e"
  WHERE (("e"."id" = "workouts"."entry_id") AND ("e"."user_id" = "auth"."uid"())))));


--
-- Name: workouts own workouts select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own workouts select" ON "public"."workouts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."entries" "e"
  WHERE (("e"."id" = "workouts"."entry_id") AND ("e"."user_id" = "auth"."uid"())))));


--
-- Name: workouts own workouts update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own workouts update" ON "public"."workouts" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."entries" "e"
  WHERE (("e"."id" = "workouts"."entry_id") AND ("e"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."entries" "e"
  WHERE (("e"."id" = "workouts"."entry_id") AND ("e"."user_id" = "auth"."uid"())))));


--
-- Name: meal_plan_items plan_items_rw; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "plan_items_rw" ON "public"."meal_plan_items" USING ((EXISTS ( SELECT 1
   FROM "public"."meal_plans" "p"
  WHERE (("p"."id" = "meal_plan_items"."plan_id") AND ("p"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."meal_plans" "p"
  WHERE (("p"."id" = "meal_plan_items"."plan_id") AND ("p"."user_id" = "auth"."uid"())))));


--
-- Name: meal_plans plans_rw; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "plans_rw" ON "public"."meal_plans" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: user_preferences prefs_rw; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "prefs_rw" ON "public"."user_preferences" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));


--
-- Name: profiles profiles_upsert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles_upsert_own" ON "public"."profiles" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));


--
-- Name: profiles read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));


--
-- Name: usage_daily read own usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read own usage" ON "public"."usage_daily" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: recommendation_runs reco_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reco_read_own" ON "public"."recommendation_runs" FOR SELECT USING (("user_id" = "auth"."uid"()));


--
-- Name: recommendation_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."recommendation_runs" ENABLE ROW LEVEL SECURITY;

--
-- Name: rn_ping; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."rn_ping" ENABLE ROW LEVEL SECURITY;

--
-- Name: targets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."targets" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));


--
-- Name: profiles upsert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "upsert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));


--
-- Name: usage_daily; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."usage_daily" ENABLE ROW LEVEL SECURITY;

--
-- Name: usage_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."usage_limits" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;

--
-- Name: workouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."workouts" ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict EpwdsSkVplIryg5HGRi1j2B6VfccuA4441sKCdYF8vxNTzPcMhwefGk4hHgc57b

