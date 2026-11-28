-- Keep the approved action immutable. Editing a draft cancels its job and creates a new review.
CREATE OR REPLACE FUNCTION extenda_protect_scheduled_approval() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF (NEW.user_id, NEW.action, NEW.timezone, NEW.recurrence, NEW.approved_payload, NEW.approval, NEW.idempotency_key)
        IS DISTINCT FROM
       (OLD.user_id, OLD.action, OLD.timezone, OLD.recurrence, OLD.approved_payload, OLD.approval, OLD.idempotency_key)
        OR (NEW.due_at IS DISTINCT FROM OLD.due_at AND NOT (OLD.status = 'running' AND NEW.status = 'pending')) THEN
        RAISE EXCEPTION 'Cancel the scheduled action and review a new payload or time';
    END IF;
    RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER scheduled_approval_guard BEFORE UPDATE ON scheduled_jobs
FOR EACH ROW EXECUTE FUNCTION extenda_protect_scheduled_approval();
