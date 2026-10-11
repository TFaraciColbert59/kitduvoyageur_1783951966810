-- ============================================================================
-- T25 — Réponses acceptées (Q&A) : validation par le demandeur, contrôle des
-- pairs, un gain par QUESTION.
--
-- Règles :
--   • seul le DEMANDEUR accepte ; il ne peut pas accepter sa propre réponse
--     (demandeur ≠ répondant) ;
--   • une seule réponse acceptée par question (index partiel unique) ;
--   • contrôle anti-collusion calibré : une même paire (demandeur, répondant)
--     ne peut pas cumuler plus de 2 acceptations sur 30 jours ;
--   • désaccord/correction : la décision reste tracée (accepted_by/at), un
--     recours peut révoquer (is_accepted repassé à false → nouvelle
--     acceptation possible, claim par question inchangé).
-- Exécution : service_role uniquement.
-- ============================================================================

ALTER TABLE public.qa_answers
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS qa_answers_one_accepted_per_question
  ON public.qa_answers (question_id)
  WHERE is_accepted;

CREATE OR REPLACE FUNCTION public.accept_qa_answer(
  p_answer_id uuid,
  p_actor_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_answer RECORD; v_question RECORD; v_recent integer;
BEGIN
  SELECT id, question_id, author_id, is_accepted INTO v_answer
  FROM public.qa_answers WHERE id = p_answer_id FOR UPDATE;
  IF v_answer.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reponse_introuvable');
  END IF;
  IF v_answer.is_accepted = true THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'deja_accepte');
  END IF;

  SELECT id, author_id INTO v_question
  FROM public.qa_questions WHERE id = v_answer.question_id FOR UPDATE;
  IF v_question.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'question_introuvable');
  END IF;

  IF p_actor_id IS DISTINCT FROM v_question.author_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'demandeur_requis');
  END IF;
  IF v_answer.author_id = v_question.author_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'auto_reponse');
  END IF;

  -- Contrôle calibré : pas de blocage des nouveaux membres, mais une même
  -- paire ne peut pas s'échanger plus de 2 acceptations par 30 jours.
  SELECT count(*) INTO v_recent
  FROM public.qa_answers a
  JOIN public.qa_questions q ON q.id = a.question_id
  WHERE a.is_accepted = true
    AND q.author_id = v_question.author_id
    AND a.author_id = v_answer.author_id
    AND a.accepted_at > now() - interval '30 days';
  IF v_recent >= 2 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'collusion_paire');
  END IF;

  UPDATE public.qa_answers
  SET is_accepted = true, accepted_at = now(), accepted_by = p_actor_id
  WHERE id = p_answer_id;

  UPDATE public.qa_questions SET is_solved = true WHERE id = v_answer.question_id;

  RETURN jsonb_build_object('ok', true, 'questionId', v_answer.question_id, 'answerAuthor', v_answer.author_id);
END $$;
REVOKE ALL ON FUNCTION public.accept_qa_answer(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_qa_answer(uuid, uuid) TO service_role;
