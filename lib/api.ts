const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://app-lvdqzury.fly.dev";

export interface PhotoUploadResponse {
  filename: string;
  path: string;
  url: string;
  size_bytes: number;
}

export interface VCRequestPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string | null;
  city: string | null;
  state: string | null;
  concern: string;
  consent_acknowledged: boolean;
  photos: string[];
}

export interface VCRequestResponse {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string | null;
  city: string | null;
  state: string | null;
  concern: string;
  consent_acknowledged: boolean;
  photos: string[];
  status: string;
  notes: string;
  deck_id: number | null;
  consultation_id: number | null;
  created_at: string;
  updated_at: string;
  patient_name: string;
}

export async function uploadPhoto(file: File): Promise<PhotoUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/vc/photos/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Photo upload failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function createVCRequest(
  payload: VCRequestPayload
): Promise<VCRequestResponse> {
  const res = await fetch(`${API_BASE}/vc/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request submission failed (${res.status}): ${text}`);
  }

  return res.json();
}

// --- Admin / Staff Dashboard API ---

export interface VCRequestListItem {
  id: number;
  first_name?: string;
  last_name?: string;
  patient_name: string;
  email: string;
  phone: string;
  date_of_birth?: string | null;
  city?: string | null;
  state?: string | null;
  concern?: string;
  message?: string;
  consent_acknowledged?: boolean;
  photos: string[];
  status: string;
  notes?: string;
  deck_id?: number | null;
  consultation_id?: number | null;
  created_at?: string;
  submitted_at?: string;
  updated_at?: string;
}

export interface VCRequestListResponse {
  total: number;
  requests: VCRequestListItem[];
}

function authHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function adminLogin(password: string): Promise<{ token: string; expires_at: string }> {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function listVCRequests(
  status?: string,
  token?: string
): Promise<VCRequestListResponse> {
  const params = new URLSearchParams();
  if (status && status !== "all") params.set("status", status);
  const url = `${API_BASE}/vc/requests${params.toString() ? "?" + params.toString() : ""}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list requests (${res.status}): ${text}`);
  }
  return res.json();
}

export async function getVCRequest(
  id: number,
  token?: string
): Promise<VCRequestListItem> {
  const res = await fetch(`${API_BASE}/vc/requests/${id}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get request (${res.status}): ${text}`);
  }
  return res.json();
}

export async function updateVCRequest(
  id: number,
  updates: Record<string, unknown>,
  token?: string
): Promise<VCRequestListItem> {
  const res = await fetch(`${API_BASE}/vc/requests/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update request (${res.status}): ${text}`);
  }
  return res.json();
}

export function photoUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}

// --- Slide / Deck Builder API ---

export interface SlideItem {
  slide_number: number;
  condition: string;
  solution: string;
  complexity: number | null;
  tone: string[];
  duration: string;
  cost_bracket: string;
  cost_numeric: number | null;
  treatments: string[];
  concerns: string[];
  gender: string;
  is_celebrity_case: boolean;
  slide_type: string;
  image_count: number;
  images: string[];
  text_content: string[];
  full_slide_image?: string | null;
}

export interface RecordingDeck {
  id: number;
  name: string;
  slide_numbers: number[];
  created_at: string;
}

export function slideImageUrl(filename: string): string {
  return `${API_BASE}/vc/images/${filename}`;
}

export async function listAllSlides(): Promise<{ total: number; slides: SlideItem[] }> {
  const res = await fetch(`${API_BASE}/slides`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list slides (${res.status}): ${text}`);
  }
  return res.json();
}

export async function searchSlides(params: {
  treatments?: string;
  concerns?: string;
  limit?: number;
}): Promise<{ total: number; slides: SlideItem[] }> {
  const sp = new URLSearchParams();
  if (params.treatments) sp.set("treatments", params.treatments);
  if (params.concerns) sp.set("concerns", params.concerns);
  if (params.limit) sp.set("limit", String(params.limit));
  const res = await fetch(`${API_BASE}/vc/slides/search?${sp.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to search slides (${res.status}): ${text}`);
  }
  return res.json();
}

export async function getSlideDetail(slideNumber: number): Promise<SlideItem> {
  const res = await fetch(`${API_BASE}/vc/slides/${slideNumber}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get slide (${res.status}): ${text}`);
  }
  return res.json();
}

export async function listRecordingDecks(): Promise<{ total: number; decks: RecordingDeck[] }> {
  const res = await fetch(`${API_BASE}/recording-decks`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list decks (${res.status}): ${text}`);
  }
  return res.json();
}

export async function createRecordingDeck(
  name: string,
  slideNumbers: number[]
): Promise<RecordingDeck> {
  const res = await fetch(`${API_BASE}/recording-decks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, slide_numbers: slideNumbers }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create deck (${res.status}): ${text}`);
  }
  return res.json();
}

export async function deleteRecordingDeck(deckId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/recording-decks/${deckId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete deck (${res.status}): ${text}`);
  }
}

// --- Video / Consultation API ---

export interface VideoUploadResponse {
  filename: string;
  path: string;
  url: string;
  size_bytes: number;
}

export interface Consultation {
  id: number;
  request_id: number | null;
  patient_name: string;
  email?: string;
  phone?: string;
  video_url: string;
  video_source: string;
  status: string;
  script_status?: string;
  summary_slide_data?: {
    items?: Array<{
      treatment: string;
      visits?: string;
      investment?: string;
    }>;
    notes?: string;
  } | null;
  sent_at?: string | null;
  watch_count?: number;
  last_watched_at?: string | null;
  follow_up_dates?: string[];
  created_at: string;
  updated_at?: string;
}

export async function uploadVideo(file: File): Promise<VideoUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/vc/videos/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Video upload failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function createConsultation(data: {
  request_id: number;
  patient_name: string;
  email?: string;
  phone?: string;
  video_url: string;
  video_source?: string;
  slide_numbers?: number[];
  summary_slide_data?: {
    items?: Array<{
      treatment: string;
      visits?: string;
      investment?: string;
    }>;
    notes?: string;
  } | null;
}): Promise<Consultation> {
  const res = await fetch(`${API_BASE}/vc/consultations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create consultation (${res.status}): ${text}`);
  }
  return res.json();
}

export async function getConsultation(id: number): Promise<Consultation> {
  const res = await fetch(`${API_BASE}/vc/consultations/${id}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get consultation (${res.status}): ${text}`);
  }
  return res.json();
}

export function videoUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}

export async function approveConsultation(id: number): Promise<Consultation> {
  const res = await fetch(`${API_BASE}/vc/consultations/${id}/approve-script`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to approve (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.consultation || data;
}

export async function sendConsultation(consultationId: number, requestId: number): Promise<{ consultation: Consultation; request: VCRequestListItem }> {
  // Sequential: advance request status first, then mark consultation as sent
  const req = await updateVCRequest(requestId, { status: "sent" });
  const consultRes = await fetch(`${API_BASE}/vc/consultations/${consultationId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "sent", sent_at: new Date().toISOString() }),
  });
  if (!consultRes.ok) throw new Error(`Failed to update consultation: ${await consultRes.text()}`);
  const consult = await consultRes.json() as Consultation;
  return { consultation: consult, request: req };
}

export async function resendConsultation(id: number): Promise<Consultation> {
  const res = await fetch(`${API_BASE}/vc/consultations/${id}/resend`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to resend (${res.status}): ${text}`);
  }
  return res.json();
}

export async function recordConsultationWatch(id: number): Promise<Consultation> {
  const res = await fetch(`${API_BASE}/vc/consultations/${id}/watch`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to record consultation watch (${res.status}): ${text}`);
  }
  return res.json();
}
