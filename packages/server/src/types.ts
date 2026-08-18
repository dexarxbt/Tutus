export interface Credentials {
  username: string;
  password: string;
}

export interface InvestigationRequest {
  url: string;
  username: string;
  password: string;
}

export type Phase =
  | 'authenticating'
  | 'exploring'
  | 'discovering'
  | 'analyzing'
  | 'verifying'
  | 'collecting-evidence'
  | 'generating-finding'
  | 'complete';

export interface PageNode {
  url: string;
  title: string;
  links: string[];
  forms: FormInfo[];
  buttons: ButtonInfo[];
}

export interface FormInfo {
  action: string;
  method: string;
  fields: FormField[];
  submitText: string;
  pageUrl: string;
}

export interface FormField {
  name: string;
  type: string;
  id: string;
  placeholder: string;
  value: string;
}

export interface ButtonInfo {
  text: string;
  type: string;
  selector: string;
  pageUrl: string;
}

export interface DiscoveredAction {
  id: string;
  label: string;
  url: string;
  method: string;
  fields: FormField[];
  pageUrl: string;
  source: 'form' | 'button' | 'link';
}

export interface RankedAction {
  action: DiscoveredAction;
  score: number;
  factors: string[];
}

export interface VerificationResult {
  action: DiscoveredAction;
  status: 'confirmed' | 'denied' | 'failed';
  httpStatus: number | null;
  responseBody: string;
  request: CapturedRequest | null;
  response: CapturedResponse | null;
  error?: string;
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

export interface Screenshot {
  name: string;
  data: string; // base64
  timestamp: string;
}

export interface Evidence {
  screenshots: Screenshot[];
  request: CapturedRequest | null;
  response: CapturedResponse | null;
}

export interface ReproductionStep {
  step: number;
  action: string;
  target: string;
  details?: string;
}

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

export interface InvestigationState {
  id: string;
  target: { url: string; credentials: Credentials };
  phase: Phase;
  sitemap: PageNode[];
  actions: DiscoveredAction[];
  rankedActions: RankedAction[];
  verificationResults: VerificationResult[];
  finding: Finding | null;
  timeline: TimelineEvent[];
  startedAt: string;
}

export interface TimelineEvent {
  type: string;
  message: string;
  details?: string;
  timestamp: string;
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
