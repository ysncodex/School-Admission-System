export type ApplicationStatus = 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';

export interface AdmissionClass {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
}

export interface CreatedClass {
  id: string;
  name: string;
  totalSeats: number;
}

export interface AdmissionHold {
  holdId: string;
  classId: string;
  studentId: string;
  status: ApplicationStatus;
  expiresAt: string;
}

export interface StudentApplication {
  holdId: string;
  classId: string;
  className: string;
  status: ApplicationStatus;
  expiresAt: string;
}

export interface ApiProblem {
  title?: string;
  detail?: string;
  status?: number;
}
