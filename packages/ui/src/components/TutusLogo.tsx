interface Props {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const heights = {
  sm: 28,
  md: 36,
  lg: 52,
  xl: 80,
};

export function TutusLogo({ className = '', size = 'md' }: Props) {
  const h = heights[size];

  return (
    <img
      src="/assets/Tutus_Logo.png"
      alt="Tutus — Find what shouldn't be possible"
      height={h}
      className={`object-contain ${className}`}
      style={{ height: `${h}px`, width: 'auto' }}
      draggable={false}
    />
  );
}
