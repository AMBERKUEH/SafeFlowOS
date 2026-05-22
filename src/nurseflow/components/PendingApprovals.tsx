import { Check, Clock, UserCheck, X } from 'lucide-react';

export interface PendingApproval {
  id: string;
  type: 'overflow' | 'emergency_leave';
  title: string;
  subtitle: string;
  status: 'pending' | 'approved' | 'declined';
  timestamp: string;
  items: Array<{
    label: string;
    detail: string;
  }>;
}

interface PendingApprovalsProps {
  approvals: PendingApproval[];
  onStatusChange: (id: string, status: 'approved' | 'declined') => void;
}

const statusStyles = {
  pending: 'bg-secondary/10 text-secondary border-secondary/20',
  approved: 'bg-primary/10 text-primary border-primary/20',
  declined: 'bg-error-container text-error border-error/20',
};

export function PendingApprovals({ approvals, onStatusChange }: PendingApprovalsProps) {
  const pendingCount = approvals.filter((approval) => approval.status === 'pending').length;

  return (
    <div className="h-full overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
      <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
            <UserCheck size={18} />
          </div>
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Pending Approval</h3>
            <p className="text-[12px] text-on-surface-variant">{pendingCount} awaiting head nurse</p>
          </div>
        </div>
        <span className="rounded-full border border-outline-variant px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant">
          {approvals.length}
        </span>
      </div>

      <div className="max-h-[34rem] space-y-3 overflow-y-auto p-4">
        {approvals.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant bg-surface-container-low/40 px-4 text-center">
            <Clock size={22} className="mb-3 text-on-surface-variant" />
            <p className="text-sm font-medium text-on-surface">No pending approvals</p>
            <p className="mt-1 text-[12px] text-on-surface-variant">Emergency leave and overflow requests appear here.</p>
          </div>
        ) : (
          approvals.map((approval) => (
            <div key={approval.id} className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                      {approval.type === 'overflow' ? 'Overflow' : 'Emergency Leave'}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusStyles[approval.status]}`}>
                      {approval.status}
                    </span>
                  </div>
                  <p className="truncate text-sm font-semibold text-on-surface">{approval.title}</p>
                  <p className="mt-0.5 text-[12px] text-on-surface-variant">{approval.subtitle}</p>
                </div>
                <span className="shrink-0 text-[11px] text-on-surface-variant">{approval.timestamp}</span>
              </div>

              <div className="space-y-2">
                {approval.items.map((item, idx) => (
                  <div key={`${approval.id}-${idx}`} className="rounded-md bg-surface-container-lowest px-3 py-2">
                    <p className="text-[12px] font-medium text-on-surface">{item.label}</p>
                    <p className="mt-0.5 text-[11px] text-on-surface-variant">{item.detail}</p>
                  </div>
                ))}
              </div>

              {approval.status === 'pending' && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onStatusChange(approval.id, 'approved')}
                    className="flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-on-primary"
                  >
                    <Check size={14} />
                    Approve
                  </button>
                  <button
                    onClick={() => onStatusChange(approval.id, 'declined')}
                    className="flex items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-on-surface"
                  >
                    <X size={14} />
                    Decline
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
