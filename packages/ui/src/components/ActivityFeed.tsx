import { useEffect, useRef } from 'react';
import { ActivityEvent } from '../types';

interface Props {
  events: ActivityEvent[];
}

export function ActivityFeed({ events }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col h-80">
      <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">Activity</h3>
      <div ref={containerRef} className="flex-1 overflow-y-auto space-y-1.5 font-mono text-xs">
        {events.length === 0 && (
          <p className="text-gray-600 italic">Waiting for investigation to start...</p>
        )}
        {events.map((event) => (
          <div key={event.id} className="flex gap-2">
            <span className="text-gray-600 flex-shrink-0">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
            <span
              className={
                event.type === 'success'
                  ? 'text-green-400'
                  : event.type === 'warning'
                  ? 'text-yellow-400'
                  : event.type === 'error'
                  ? 'text-red-400'
                  : 'text-gray-300'
              }
            >
              {event.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
