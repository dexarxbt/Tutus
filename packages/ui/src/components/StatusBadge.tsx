interface Props {
  severity: 'critical' | 'high' | 'medium' | 'low';
  className?: string;
}

const styles = {
  critical: 'bg-state-critical-bg text-state-critical border-state-critical/20',
  high: 'bg-state-high-bg text-state-high border-state-high/20',
  medium: 'bg-state-medium-bg text-state-medium border-state-medium/20',
  low: 'bg-blue-50 text-blue-700 border-blue-200/60',
};

export function StatusBadge({ severity, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-micro font-semibold uppercase tracking-wider border rounded ${styles[severity]} ${className}`}
    >
      {severity}
    </span>
  );
}
