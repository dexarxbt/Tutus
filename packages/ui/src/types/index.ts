export type Phase =
  | 'authenticating'
  | 'exploring'
  | 'discovering'
  | 'analyzing'
  | 'verifying'
  | 'collecting-evidence'
  | 'generating-finding'
  | 'complete';

export interface Finding {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: 'high' | 'medium' | 'low';
  actor: { email: string; role: string };
  expectedPrivilege: string;
  actualPrivilege: string;
  impact: string;
  reproductionSteps: ReproductionStep[];
  evidence: Evidence;
  timestamp: string;
}

export interface ReproductionStep {
  step: number;
  action: string;
  target: string;
  details?: string;
}

export interface Evidence {
  screenshots: Screenshot[];
  request: CapturedRequest | null;
  response: CapturedResponse | null;
}

export interface Screenshot {
  name: string;
  data: string;
  timestamp: string;
}

export interface CapturedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
}

export interface CapturedResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface DiscoveredAction {
  id: string;
  label: string;
  url: string;
  method: string;
  pageUrl: string;
  source: string;
}

export type ServerMessage =
  | { type: 'phase_changed'; phase: Phase; timestamp: string }
  | { type: 'activity'; message: string; details?: string; timestamp: string }
  | { type: 'page_discovered'; url: string; title: string }
  | { type: 'action_discovered'; action: DiscoveredAction }
  | { type: 'verification_result'; action: string; result: 'confirmed' | 'denied' | 'failed' }
  | { type: 'finding_ready'; finding: Finding }
  | { type: 'screenshot'; name: string; data: string }
  | { type: 'error'; message: string }
  | { type: 'investigation_started'; id: string }
  | { type: 'investigation_complete'; id: string };

export interface ActivityEvent {
  id: number;
  message: string;
  details?: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface ReplayResult {
  success: boolean;
  verified: boolean;
  screenshots: Screenshot[];
  request: CapturedRequest | null;
  response: CapturedResponse | null;
  error?: string;
  timestamp: string;
}

export type ViewState = 'input' | 'investigating' | 'finding';
