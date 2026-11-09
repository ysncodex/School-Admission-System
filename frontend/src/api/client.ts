import { API_BASE_URL } from '../lib/config';
import type {
  AdmissionClass,
  AdmissionHold,
  ApiProblem,
  CreatedClass,
  StudentApplication,
} from '../types/admission';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, studentId?: string): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body) headers.set('Content-Type', 'application/json');
  if (studentId) headers.set('X-Student-Id', studentId);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(
      'Could not reach the admission server. Check that the application is running.',
      0
    );
  }

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const problem = (await response.json()) as ApiProblem;
      message = problem.detail || problem.title || message;
    } catch {
      // Keep the readable fallback when the server did not return JSON.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const admissionApi = {
  getClasses: () => request<AdmissionClass[]>('/classes'),
  createClass: (payload: { name: string; totalSeats: number }) =>
    request<CreatedClass>('/classes', { method: 'POST', body: JSON.stringify(payload) }),
  createHold: (classId: string, studentId: string) =>
    request<AdmissionHold>(
      `/classes/${encodeURIComponent(classId)}/holds`,
      { method: 'POST' },
      studentId
    ),
  getHold: (holdId: string) =>
    request<{ holdId: string; classId: string; status: string; expiresAt: string }>(
      `/holds/${encodeURIComponent(holdId)}`
    ),
  confirmHold: (holdId: string, studentId: string) =>
    request<{ holdId: string; status: string }>(
      `/holds/${encodeURIComponent(holdId)}/confirm`,
      { method: 'POST' },
      studentId
    ),
  cancelHold: (holdId: string, studentId: string) =>
    request<void>(`/holds/${encodeURIComponent(holdId)}`, { method: 'DELETE' }, studentId),
  getMyApplications: (studentId: string) =>
    request<StudentApplication[]>('/me/holds', {}, studentId),
};
