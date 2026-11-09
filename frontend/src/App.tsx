import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  GraduationCap,
  Info,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  RefreshCw,
  School,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { admissionApi, ApiError } from './api/client';
import { isValidStudentId, normalizeStudentId } from './lib/student';
import { formatRemainingTime, getRemainingSeconds } from './lib/time';
import type { AdmissionClass, ApplicationStatus, StudentApplication } from './types/admission';

type View = 'admissions' | 'applications' | 'admin';
type Notice = { kind: 'success' | 'error' | 'info'; message: string } | null;

const navigation: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'admissions', label: 'Admissions', icon: LayoutDashboard },
  { id: 'applications', label: 'My applications', icon: GraduationCap },
  { id: 'admin', label: 'School admin', icon: School },
];

function StatusPill({ status }: { status: ApplicationStatus }) {
  const config: Record<ApplicationStatus, { label: string; className: string }> = {
    HELD: { label: 'Seat on hold', className: 'status-held' },
    CONFIRMED: { label: 'Confirmed', className: 'status-confirmed' },
    EXPIRED: { label: 'Expired', className: 'status-expired' },
    CANCELLED: { label: 'Cancelled', className: 'status-cancelled' },
  };
  const item = config[status];
  return (
    <span className={`status-pill ${item.className}`}>
      <span className="status-dot" />
      {item.label}
    </span>
  );
}

function ClassCard({
  item,
  studentReady,
  pending,
  onApply,
}: {
  item: AdmissionClass;
  studentReady: boolean;
  pending: boolean;
  onApply: (classId: string) => void;
}) {
  const fill =
    item.totalSeats > 0
      ? Math.min(100, ((item.heldSeats + item.confirmedSeats) / item.totalSeats) * 100)
      : 0;
  const isFull = item.availableSeats <= 0;

  return (
    <article className="class-card">
      <div className="class-card-topline">
        <span className="class-tag">ADMISSION · 2026–27</span>
        <span className={`availability ${isFull ? 'availability-full' : ''}`}>
          <span className="availability-dot" />
          {isFull ? 'Fully booked' : `${item.availableSeats} seats left`}
        </span>
      </div>
      <div className="class-title-row">
        <div className="class-icon">
          <GraduationCap size={22} strokeWidth={1.8} />
        </div>
        <div className="class-name-wrap">
          <h3>{item.name}</h3>
          <p>First come, first served</p>
        </div>
      </div>
      <div className="seat-summary">
        <div>
          <strong>{item.availableSeats}</strong>
          <span>Available</span>
        </div>
        <div>
          <strong>{item.heldSeats}</strong>
          <span>On hold</span>
        </div>
        <div>
          <strong>{item.confirmedSeats}</strong>
          <span>Confirmed</span>
        </div>
        <div>
          <strong>{item.totalSeats}</strong>
          <span>Total seats</span>
        </div>
      </div>
      <div className="capacity-track" aria-label={`${Math.round(fill)} percent of seats reserved`}>
        <span style={{ width: `${fill}%` }} />
      </div>
      <div className="class-card-footer">
        <span className="capacity-caption">{Math.round(fill)}% of seats allocated</span>
        <button
          className="button button-primary button-compact"
          disabled={isFull || !studentReady || pending}
          onClick={() => onApply(item.id)}
          title={!studentReady ? 'Enter your 17-digit birth registration number first' : undefined}
        >
          {pending ? <LoaderCircle className="spin" size={15} /> : null}
          Apply now <ArrowRight size={15} />
        </button>
      </div>
      {!studentReady && <p className="card-hint">Enter your student number above to apply.</p>}
    </article>
  );
}

function ApplicationCard({
  application,
  onConfirm,
  onCancel,
  confirming,
  cancelling,
  onRefresh,
}: {
  application: StudentApplication;
  onConfirm: (holdId: string) => void;
  onCancel: (holdId: string) => void;
  confirming: boolean;
  cancelling: boolean;
  onRefresh: () => void;
}) {
  const [remaining, setRemaining] = useState(() => getRemainingSeconds(application.expiresAt));
  const [expiryNotified, setExpiryNotified] = useState(false);
  const isHeld = application.status === 'HELD' && remaining > 0;
  const effectiveStatus: ApplicationStatus =
    application.status === 'HELD' && remaining <= 0 ? 'EXPIRED' : application.status;

  useEffect(() => {
    const tick = () => setRemaining(getRemainingSeconds(application.expiresAt));
    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, [application.expiresAt]);

  useEffect(() => {
    if (application.status === 'HELD' && remaining === 0 && !expiryNotified) {
      setExpiryNotified(true);
      onRefresh();
    }
  }, [application.status, remaining, expiryNotified, onRefresh]);

  return (
    <article className="application-card">
      <div className="application-card-main">
        <div className="application-icon">
          <GraduationCap size={20} />
        </div>
        <div className="application-info">
          <h3>{application.className}</h3>
          <p>
            Application ID <span className="mono">{application.holdId}</span>
          </p>
          <div className="application-meta">
            <StatusPill status={effectiveStatus} />
            {isHeld && (
              <span className="timer-caption">
                Complete payment in <strong>{formatRemainingTime(remaining)}</strong>
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="application-actions">
        {isHeld ? (
          <>
            <button
              className="button button-primary"
              onClick={() => onConfirm(application.holdId)}
              disabled={confirming || cancelling}
            >
              {confirming ? <LoaderCircle className="spin" size={15} /> : <CreditCard size={15} />}
              Pay admission fee
            </button>
            <button
              className="button button-quiet"
              onClick={() => onCancel(application.holdId)}
              disabled={confirming || cancelling}
            >
              {cancelling ? <LoaderCircle className="spin" size={15} /> : <X size={15} />} Cancel
            </button>
          </>
        ) : effectiveStatus === 'CONFIRMED' ? (
          <span className="confirmed-note">
            <CheckCircle2 size={16} /> Admission secured
          </span>
        ) : (
          <span className="muted-small">No action required</span>
        )}
      </div>
    </article>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <CircleHelp size={25} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export default function App() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('admissions');
  const [studentId, setStudentId] = useState(
    () => window.localStorage.getItem('school-admission-student-id') ?? ''
  );
  const [studentDraft, setStudentDraft] = useState(
    () => window.localStorage.getItem('school-admission-student-id') ?? ''
  );
  const [notice, setNotice] = useState<Notice>(null);
  const [className, setClassName] = useState('');
  const [totalSeats, setTotalSeats] = useState('120');

  const studentReady = isValidStudentId(studentId);
  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: admissionApi.getClasses,
    refetchInterval: 4_000,
  });
  const applicationsQuery = useQuery({
    queryKey: ['applications', studentId],
    queryFn: () => admissionApi.getMyApplications(studentId),
    enabled: studentReady,
    refetchInterval: studentReady ? 3_000 : false,
  });

  const refreshAdmissionData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['classes'] }),
      queryClient.invalidateQueries({ queryKey: ['applications', studentId] }),
    ]);
  };

  const showNotice = (next: Notice) => {
    setNotice(next);
    if (next)
      window.setTimeout(
        () => setNotice((current) => (current?.message === next.message ? null : current)),
        5_000
      );
  };

  const holdMutation = useMutation({
    mutationFn: (classId: string) => admissionApi.createHold(classId, studentId),
    onSuccess: async () => {
      showNotice({
        kind: 'success',
        message: 'Your seat is on hold. Complete the simulated fee payment before the timer ends.',
      });
      await refreshAdmissionData();
      setView('applications');
    },
    onError: (error) =>
      showNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Could not reserve this seat.',
      }),
  });

  const confirmMutation = useMutation({
    mutationFn: (holdId: string) => admissionApi.confirmHold(holdId, studentId),
    onSuccess: async () => {
      showNotice({ kind: 'success', message: 'Payment successful. Your admission is confirmed.' });
      await refreshAdmissionData();
    },
    onError: (error) =>
      showNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Could not confirm this admission.',
      }),
  });

  const cancelMutation = useMutation({
    mutationFn: (holdId: string) => admissionApi.cancelHold(holdId, studentId),
    onSuccess: async () => {
      showNotice({
        kind: 'info',
        message: 'Your reservation was cancelled and the seat has been released.',
      });
      await refreshAdmissionData();
    },
    onError: (error) =>
      showNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Could not cancel this reservation.',
      }),
  });

  const createClassMutation = useMutation({
    mutationFn: () =>
      admissionApi.createClass({ name: className.trim(), totalSeats: Number(totalSeats) }),
    onSuccess: async (created) => {
      setClassName('');
      setTotalSeats('120');
      showNotice({ kind: 'success', message: `${created.name} was added successfully.` });
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      setView('admissions');
    },
    onError: (error) =>
      showNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Could not create the class.',
      }),
  });

  const sortedApplications = useMemo(() => applicationsQuery.data ?? [], [applicationsQuery.data]);
  const classStats = useMemo(() => {
    const items = classesQuery.data ?? [];
    return {
      classes: items.length,
      available: items.reduce((sum, item) => sum + item.availableSeats, 0),
      confirmed: items.reduce((sum, item) => sum + item.confirmedSeats, 0),
    };
  }, [classesQuery.data]);

  const saveStudentId = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeStudentId(studentDraft);
    if (!isValidStudentId(normalized)) {
      showNotice({ kind: 'error', message: 'Enter a valid 17-digit birth registration number.' });
      return;
    }
    setStudentId(normalized);
    setStudentDraft(normalized);
    window.localStorage.setItem('school-admission-student-id', normalized);
    showNotice({ kind: 'success', message: 'Student identity saved on this device.' });
  };

  const submitClass = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (className.trim().length < 3) {
      showNotice({ kind: 'error', message: 'Enter a class name with at least 3 characters.' });
      return;
    }
    if (
      !Number.isInteger(Number(totalSeats)) ||
      Number(totalSeats) < 1 ||
      Number(totalSeats) > 100_000
    ) {
      showNotice({
        kind: 'error',
        message: 'Seat capacity must be a whole number between 1 and 100,000.',
      });
      return;
    }
    createClassMutation.mutate();
  };

  const retryQueries = () => {
    void classesQuery.refetch();
    if (studentReady) void applicationsQuery.refetch();
  };

  const pendingClassId = holdMutation.isPending ? holdMutation.variables : undefined;
  const pageTitle =
    view === 'admissions'
      ? 'Find your place.'
      : view === 'applications'
        ? 'Your applications.'
        : 'Manage admissions.';
  const pageSubtitle =
    view === 'admissions'
      ? 'Choose a class and reserve an available seat. Places are allocated in application order.'
      : view === 'applications'
        ? 'Track your reservations and complete the admission fee payment before a hold expires.'
        : 'Create class and shift groups, and keep an eye on available capacity.';

  return (
    <div className="app-shell">
      <header className="site-header">
        <a
          className="brand"
          href="#home"
          onClick={(event) => {
            event.preventDefault();
            setView('admissions');
          }}
        >
          <span className="brand-mark">
            <School size={22} strokeWidth={1.8} />
          </span>
          <span className="brand-copy">
            <strong>Northstar School</strong>
            <small>ADMISSION PORTAL</small>
          </span>
        </a>
        <div className="header-right">
          <span className="cycle-label">
            <span className="live-dot" />
            Admissions open <span className="cycle-divider">·</span> 2026–27
          </span>
          <div className="header-avatar">NS</div>
        </div>
      </header>

      <main className="page-container">
        <section className="welcome-row">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />A CLEARER WAY TO BEGIN
            </div>
            <h1>{pageTitle}</h1>
            <p className="page-subtitle">{pageSubtitle}</p>
          </div>
          <div className="secure-note">
            <ShieldCheck size={17} />
            <span>
              Fair, first-come
              <br />
              first-served admission
            </span>
          </div>
        </section>

        <section className="identity-panel" aria-label="Student identification">
          <div className="identity-icon">
            <Users size={20} />
          </div>
          <div className="identity-copy">
            <strong>Student identification</strong>
            <span>Use your 17-digit birth registration number to manage applications.</span>
          </div>
          <form className="identity-form" onSubmit={saveStudentId}>
            <label className="sr-only" htmlFor="student-id">
              Birth registration number
            </label>
            <input
              id="student-id"
              value={studentDraft}
              onChange={(event) =>
                setStudentDraft(event.target.value.replace(/[^0-9]/g, '').slice(0, 17))
              }
              inputMode="numeric"
              autoComplete="off"
              placeholder="17-digit number"
              maxLength={17}
              aria-describedby="student-id-hint"
            />
            <button className="button button-dark button-small" type="submit">
              {studentReady ? 'Update ID' : 'Continue'} <ChevronRight size={15} />
            </button>
          </form>
        </section>
        <p className="identity-hint" id="student-id-hint">
          {studentReady ? (
            <>
              <CheckCircle2 size={13} /> Student number saved on this device. Your applications will
              appear below.
            </>
          ) : (
            <>
              <AlertCircle size={13} /> Your number stays in this browser and is sent only with your
              admission requests.
            </>
          )}
        </p>

        <nav className="page-nav" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? 'nav-item-active' : ''}`}
              onClick={() => setView(id)}
            >
              <Icon size={17} strokeWidth={1.9} />
              {label}
              {id === 'applications' &&
                studentReady &&
                sortedApplications.some((item) => item.status === 'HELD') && (
                  <span className="nav-count">
                    {sortedApplications.filter((item) => item.status === 'HELD').length}
                  </span>
                )}
            </button>
          ))}
          <button
            className="nav-refresh"
            onClick={retryQueries}
            title="Refresh data"
            aria-label="Refresh data"
          >
            <RefreshCw size={16} className={classesQuery.isFetching ? 'spin' : ''} />
          </button>
        </nav>

        {notice && (
          <div className={`notice notice-${notice.kind}`} role="status">
            {notice.kind === 'success' ? (
              <CheckCircle2 size={17} />
            ) : notice.kind === 'error' ? (
              <AlertCircle size={17} />
            ) : (
              <CircleHelp size={17} />
            )}
            <span>{notice.message}</span>
            <button onClick={() => setNotice(null)} aria-label="Dismiss notification">
              <X size={16} />
            </button>
          </div>
        )}

        {view === 'admissions' && (
          <>
            <section className="stats-row">
              <div className="stat-card">
                <span className="stat-icon stat-icon-green">
                  <School size={18} />
                </span>
                <div>
                  <strong>{classStats.classes}</strong>
                  <small>Classes & shifts</small>
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-icon stat-icon-blue">
                  <Users size={18} />
                </span>
                <div>
                  <strong>{classStats.available}</strong>
                  <small>Available seats</small>
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-icon stat-icon-violet">
                  <Check size={18} />
                </span>
                <div>
                  <strong>{classStats.confirmed}</strong>
                  <small>Confirmed admissions</small>
                </div>
              </div>
              <div className="refresh-caption">
                <span className="live-dot" />
                Live seat updates · every 4 seconds
              </div>
            </section>

            <section className="content-grid">
              <div className="main-column">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">AVAILABLE OPTIONS</span>
                    <h2>Choose a class</h2>
                  </div>
                  <span className="result-count">
                    {classesQuery.data?.length ?? 0}{' '}
                    {classesQuery.data?.length === 1 ? 'option' : 'options'}
                  </span>
                </div>
                {classesQuery.isLoading ? (
                  <div className="loading-state">
                    <LoaderCircle className="spin" size={22} />
                    Loading available classes…
                  </div>
                ) : classesQuery.isError ? (
                  <EmptyState
                    title="Classes could not be loaded"
                    description={
                      classesQuery.error instanceof ApiError
                        ? classesQuery.error.message
                        : 'Check that the backend is running, then try again.'
                    }
                    action={
                      <button className="button button-secondary" onClick={retryQueries}>
                        <RefreshCw size={15} /> Try again
                      </button>
                    }
                  />
                ) : (classesQuery.data?.length ?? 0) === 0 ? (
                  <EmptyState
                    title="Admissions are being prepared"
                    description="There are no classes published yet. The school admin can add class and shift groups from the School admin section."
                    action={
                      <button className="button button-secondary" onClick={() => setView('admin')}>
                        <Plus size={15} /> Create the first class
                      </button>
                    }
                  />
                ) : (
                  <div className="class-list">
                    {classesQuery.data?.map((item) => (
                      <ClassCard
                        key={item.id}
                        item={item}
                        studentReady={studentReady}
                        pending={pendingClassId === item.id}
                        onApply={(classId) => holdMutation.mutate(classId)}
                      />
                    ))}
                  </div>
                )}
              </div>

              <aside className="side-column">
                <div className="guide-card">
                  <div className="guide-top">
                    <span className="guide-icon">
                      <Clock3 size={19} />
                    </span>
                    <span className="guide-label">HOW IT WORKS</span>
                  </div>
                  <h3>
                    Your seat.
                    <br />
                    Your next step.
                  </h3>
                  <p>When you apply, a seat is held in your name for a limited time.</p>
                  <ol className="guide-steps">
                    <li>
                      <span>01</span>
                      <div>
                        <strong>Choose a class</strong>
                        <small>Pick an available shift.</small>
                      </div>
                    </li>
                    <li>
                      <span>02</span>
                      <div>
                        <strong>Reserve your seat</strong>
                        <small>Your hold starts immediately.</small>
                      </div>
                    </li>
                    <li>
                      <span>03</span>
                      <div>
                        <strong>Confirm admission</strong>
                        <small>Complete the fee step before expiry.</small>
                      </div>
                    </li>
                  </ol>
                  <div className="guide-foot">
                    <ShieldCheck size={15} /> No lottery. Applications are processed in order.
                  </div>
                </div>
                <div className="help-card">
                  <div className="help-icon">
                    <CircleHelp size={17} />
                  </div>
                  <div>
                    <strong>Need a hand?</strong>
                    <p>
                      Keep your birth registration number ready. You can return to this page and
                      continue where you left off.
                    </p>
                  </div>
                </div>
              </aside>
            </section>
          </>
        )}

        {view === 'applications' && (
          <section className="applications-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">YOUR ADMISSION JOURNEY</span>
                <h2>Application history</h2>
              </div>
              {studentReady && (
                <span className="result-count">{sortedApplications.length} records</span>
              )}
            </div>
            {!studentReady ? (
              <EmptyState
                title="Identify yourself to continue"
                description="Enter your 17-digit birth registration number above. Your application history will be loaded automatically."
              />
            ) : applicationsQuery.isLoading ? (
              <div className="loading-state">
                <LoaderCircle className="spin" size={22} />
                Loading your applications…
              </div>
            ) : applicationsQuery.isError ? (
              <EmptyState
                title="Applications could not be loaded"
                description={
                  applicationsQuery.error instanceof Error
                    ? applicationsQuery.error.message
                    : 'Please try again.'
                }
                action={
                  <button className="button button-secondary" onClick={retryQueries}>
                    <RefreshCw size={15} /> Try again
                  </button>
                }
              />
            ) : sortedApplications.length === 0 ? (
              <EmptyState
                title="No applications yet"
                description="Once you reserve a seat, it will appear here with its status and countdown."
                action={
                  <button className="button button-primary" onClick={() => setView('admissions')}>
                    Browse classes <ArrowRight size={15} />
                  </button>
                }
              />
            ) : (
              <>
                <div className="application-summary">
                  <div>
                    <strong>
                      {sortedApplications.filter((item) => item.status === 'HELD').length}
                    </strong>
                    <span>On hold</span>
                  </div>
                  <div>
                    <strong>
                      {sortedApplications.filter((item) => item.status === 'CONFIRMED').length}
                    </strong>
                    <span>Confirmed</span>
                  </div>
                  <div>
                    <strong>
                      {sortedApplications.filter((item) => item.status === 'EXPIRED').length}
                    </strong>
                    <span>Expired</span>
                  </div>
                </div>
                <div className="application-list">
                  {sortedApplications.map((application) => (
                    <ApplicationCard
                      key={application.holdId}
                      application={application}
                      confirming={
                        confirmMutation.isPending &&
                        confirmMutation.variables === application.holdId
                      }
                      cancelling={
                        cancelMutation.isPending && cancelMutation.variables === application.holdId
                      }
                      onConfirm={(holdId) => confirmMutation.mutate(holdId)}
                      onCancel={(holdId) => cancelMutation.mutate(holdId)}
                      onRefresh={() => {
                        void refreshAdmissionData();
                      }}
                    />
                  ))}
                </div>
                <p className="application-footnote">
                  <Info size={14} /> The admission fee step is simulated for this assignment; no
                  real payment is collected.
                </p>
              </>
            )}
          </section>
        )}

        {view === 'admin' && (
          <section className="admin-layout">
            <div className="admin-panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">SCHOOL ADMINISTRATION</span>
                  <h2>Create a class or shift</h2>
                </div>
              </div>
              <p className="admin-intro">
                Each class and shift is a separate admission group with its own seat capacity and
                first-come, first-served queue.
              </p>
              <form className="admin-form" onSubmit={submitClass}>
                <div className="field-group">
                  <label htmlFor="class-name">Class & shift name</label>
                  <input
                    id="class-name"
                    value={className}
                    onChange={(event) => setClassName(event.target.value)}
                    placeholder="e.g. Class 6 - Morning Shift"
                    maxLength={100}
                    required
                    minLength={3}
                  />
                  <small>Use a clear name so guardians can identify the correct shift.</small>
                </div>
                <div className="field-group">
                  <label htmlFor="seat-capacity">Total available seats</label>
                  <input
                    id="seat-capacity"
                    type="number"
                    min="1"
                    max="100000"
                    step="1"
                    value={totalSeats}
                    onChange={(event) => setTotalSeats(event.target.value)}
                    required
                  />
                  <small>Maximum number of held and confirmed applications combined.</small>
                </div>
                <div className="admin-form-actions">
                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={createClassMutation.isPending}
                  >
                    {createClassMutation.isPending ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <Plus size={16} />
                    )}{' '}
                    Publish class
                  </button>
                  <span>Class changes are saved to the database.</span>
                </div>
              </form>
            </div>
            <aside className="admin-side-panel">
              <div className="admin-side-icon">
                <ShieldCheck size={21} />
              </div>
              <h3>Capacity stays protected.</h3>
              <p>
                Seat allocation is checked inside a PostgreSQL transaction. Simultaneous
                applications cannot push a class above its published capacity.
              </p>
              <div className="admin-mini-stats">
                <div>
                  <strong>{classStats.classes}</strong>
                  <span>Published classes</span>
                </div>
                <div>
                  <strong>{classStats.available}</strong>
                  <span>Open seats</span>
                </div>
              </div>
            </aside>
            <div className="admin-table-wrap">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">PUBLISHED GROUPS</span>
                  <h2>Class overview</h2>
                </div>
                <span className="result-count">Auto-refreshes</span>
              </div>
              {classesQuery.data && classesQuery.data.length > 0 ? (
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Class / shift</th>
                        <th>Total seats</th>
                        <th>Held</th>
                        <th>Confirmed</th>
                        <th>Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classesQuery.data.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.name}</strong>
                            <small className="mono">{item.id}</small>
                          </td>
                          <td>{item.totalSeats}</td>
                          <td>{item.heldSeats}</td>
                          <td>{item.confirmedSeats}</td>
                          <td>
                            <span
                              className={
                                item.availableSeats === 0 ? 'table-full' : 'table-available'
                              }
                            >
                              {item.availableSeats}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="table-empty">No published classes yet.</p>
              )}
            </div>
          </section>
        )}

        <footer className="site-footer">
          <div className="footer-brand">
            <span className="footer-mark">
              <School size={16} />
            </span>
            <strong>Northstar School</strong>
          </div>
          <span>Admission Portal · 2026–27</span>
          <span className="footer-live">
            <span className="live-dot" />
            Seat availability refreshes automatically
          </span>
        </footer>
      </main>
    </div>
  );
}
