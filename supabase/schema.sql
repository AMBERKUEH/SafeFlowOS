-- SafeFlow OS Supabase schema
-- Run this in Supabase SQL Editor.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Stores uploaded roster/source documents. File bytes should live in Supabase
-- Storage; this table stores searchable metadata and processing results.
create table if not exists public.uploaded_documents (
  id uuid primary key default gen_random_uuid(),
  original_filename text not null,
  storage_bucket text not null default 'schedule-documents',
  storage_path text not null unique,
  mime_type text,
  file_size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  upload_status text not null default 'uploaded'
    check (upload_status in ('uploaded', 'processing', 'processed', 'failed')),
  extracted_text text,
  extraction_summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_uploaded_documents_updated_at
before update on public.uploaded_documents
for each row execute function public.set_updated_at();

-- Master nurse profile table.
create table if not exists public.nurses (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  name text not null,
  skill_level text not null check (skill_level in ('N1', 'N2', 'N3', 'N4')),
  ward text not null check (ward in ('ER', 'ICU', 'General', 'Pediatrics', 'Surgery')),
  unavailable_days text[] not null default '{}'::text[],
  is_active boolean not null default true,
  is_on_call boolean not null default false,
  fatigue_score int not null default 0 check (fatigue_score between 0 and 100),
  source_document_id uuid references public.uploaded_documents(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nurses_ward_idx on public.nurses(ward);
create index if not exists nurses_skill_level_idx on public.nurses(skill_level);

create trigger set_nurses_updated_at
before update on public.nurses
for each row execute function public.set_updated_at();

-- One generated schedule version. Keep schedules immutable where possible:
-- create a new row when regenerating after emergency leave.
create table if not exists public.nurse_schedules (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid references public.uploaded_documents(id) on delete set null,
  version int not null default 1,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'superseded', 'archived')),
  schedule_start_date date,
  schedule_end_date date,
  staffing_requirements jsonb not null default '{}'::jsonb,
  compliance_status text not null default 'UNKNOWN'
    check (compliance_status in ('PASSED', 'FAILED', 'UNKNOWN')),
  compliance_score int not null default 0 check (compliance_score between 0 and 100),
  compliance_reasons text[] not null default '{}'::text[],
  compliance_warnings text[] not null default '{}'::text[],
  generated_by_agent text not null default 'SafeFlow OS Orchestrator',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nurse_schedules_status_idx on public.nurse_schedules(status);

create trigger set_nurse_schedules_updated_at
before update on public.nurse_schedules
for each row execute function public.set_updated_at();

-- Individual shift assignments for a schedule.
create table if not exists public.schedule_assignments (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.nurse_schedules(id) on delete cascade,
  nurse_id uuid not null references public.nurses(id) on delete restrict,
  shift_day text not null check (shift_day in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  shift_type text not null check (shift_type in ('morning', 'afternoon', 'night')),
  department text not null check (department in ('ER', 'ICU', 'General', 'Pediatrics', 'Surgery')),
  assignment_status text not null default 'assigned'
    check (assignment_status in ('assigned', 'removed', 'replacement', 'pending_approval')),
  source_event_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(schedule_id, nurse_id, shift_day)
);

create index if not exists schedule_assignments_schedule_idx on public.schedule_assignments(schedule_id);
create index if not exists schedule_assignments_nurse_idx on public.schedule_assignments(nurse_id);
create index if not exists schedule_assignments_day_shift_idx on public.schedule_assignments(shift_day, shift_type);

create trigger set_schedule_assignments_updated_at
before update on public.schedule_assignments
for each row execute function public.set_updated_at();

-- Structured emergency leave requests.
create table if not exists public.emergency_leave_requests (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.nurse_schedules(id) on delete set null,
  nurse_id uuid not null references public.nurses(id) on delete restrict,
  replacement_nurse_id uuid references public.nurses(id) on delete set null,
  department text not null check (department in ('ER', 'ICU', 'General', 'Pediatrics', 'Surgery')),
  shift_day text not null check (shift_day in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  shift_type text not null check (shift_type in ('morning', 'afternoon', 'night')),
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'schedule_regenerated')),
  head_nurse_approval_status text not null default 'pending'
    check (head_nurse_approval_status in ('pending', 'approved', 'rejected', 'not_required')),
  action_taken text,
  repair_notes text[] not null default '{}'::text[],
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists emergency_leave_schedule_idx on public.emergency_leave_requests(schedule_id);
create index if not exists emergency_leave_nurse_idx on public.emergency_leave_requests(nurse_id);

create trigger set_emergency_leave_requests_updated_at
before update on public.emergency_leave_requests
for each row execute function public.set_updated_at();

-- Patient surge / overflow assessment from the Orchestrator.
create table if not exists public.overflow_events (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.nurse_schedules(id) on delete set null,
  department text not null check (department in ('ER', 'ICU', 'General', 'Pediatrics', 'Surgery')),
  current_day text check (current_day in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  current_shift text check (current_shift in ('morning', 'afternoon', 'night')),
  incoming_patients int not null default 0 check (incoming_patients >= 0),
  high_risk_patients int not null default 0 check (high_risk_patients >= 0),
  load_level text not null check (load_level in ('NORMAL', 'ELEVATED', 'HIGH', 'CRITICAL')),
  risk_queue_status text not null default 'STABLE',
  department_staffing jsonb not null default '{}'::jsonb,
  orchestrator_decision text not null,
  head_nurse_approval_required boolean not null default true,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected', 'not_required')),
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_overflow_events_updated_at
before update on public.overflow_events
for each row execute function public.set_updated_at();

create table if not exists public.overflow_transfers (
  id uuid primary key default gen_random_uuid(),
  overflow_event_id uuid not null references public.overflow_events(id) on delete cascade,
  nurse_id uuid not null references public.nurses(id) on delete restrict,
  from_department text not null,
  to_department text not null,
  transfer_status text not null default 'pending_head_nurse_approval'
    check (transfer_status in ('pending_head_nurse_approval', 'approved', 'rejected', 'completed')),
  reason text,
  notification_status text not null default 'not_sent'
    check (notification_status in ('not_sent', 'sent', 'failed', 'acknowledged')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_overflow_transfers_updated_at
before update on public.overflow_transfers
for each row execute function public.set_updated_at();

-- General audit trail for agent actions and human approvals.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  actor_type text not null check (actor_type in ('agent', 'user', 'system')),
  actor_id uuid,
  agent_name text,
  action text not null,
  reason text,
  confidence numeric(4, 3),
  human_approval_status text not null default 'not_required'
    check (human_approval_status in ('pending', 'approved', 'rejected', 'not_required')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);

-- Storage bucket for uploaded roster PDFs / documents.
insert into storage.buckets (id, name, public)
values ('schedule-documents', 'schedule-documents', false)
on conflict (id) do nothing;

-- RLS: enable by default. For production, tighten policies by hospital/tenant.
alter table public.uploaded_documents enable row level security;
alter table public.nurses enable row level security;
alter table public.nurse_schedules enable row level security;
alter table public.schedule_assignments enable row level security;
alter table public.emergency_leave_requests enable row level security;
alter table public.overflow_events enable row level security;
alter table public.overflow_transfers enable row level security;
alter table public.audit_logs enable row level security;

-- Demo authenticated-user policies.
create policy "authenticated read uploaded documents" on public.uploaded_documents
for select to authenticated using (true);
create policy "authenticated write uploaded documents" on public.uploaded_documents
for all to authenticated using (true) with check (true);

create policy "authenticated read nurses" on public.nurses
for select to authenticated using (true);
create policy "authenticated write nurses" on public.nurses
for all to authenticated using (true) with check (true);

create policy "authenticated read schedules" on public.nurse_schedules
for select to authenticated using (true);
create policy "authenticated write schedules" on public.nurse_schedules
for all to authenticated using (true) with check (true);

create policy "authenticated read assignments" on public.schedule_assignments
for select to authenticated using (true);
create policy "authenticated write assignments" on public.schedule_assignments
for all to authenticated using (true) with check (true);

create policy "authenticated read emergency leave" on public.emergency_leave_requests
for select to authenticated using (true);
create policy "authenticated write emergency leave" on public.emergency_leave_requests
for all to authenticated using (true) with check (true);

create policy "authenticated read overflow events" on public.overflow_events
for select to authenticated using (true);
create policy "authenticated write overflow events" on public.overflow_events
for all to authenticated using (true) with check (true);

create policy "authenticated read overflow transfers" on public.overflow_transfers
for select to authenticated using (true);
create policy "authenticated write overflow transfers" on public.overflow_transfers
for all to authenticated using (true) with check (true);

create policy "authenticated read audit logs" on public.audit_logs
for select to authenticated using (true);
create policy "authenticated write audit logs" on public.audit_logs
for insert to authenticated with check (true);
