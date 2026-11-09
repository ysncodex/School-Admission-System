import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Armchair,
  BadgeCheck,
  CheckCircle2,
  GraduationCap,
  Info,
  LayoutDashboard,
  Plus,
  RefreshCw,
  School,
  Timer,
  X,
} from 'lucide-react';
import { admissionApi, ApiError } from './api/client';
import { isValidStudentId, normalizeStudentId } from './lib/student';
import { AdminView } from './components/Admin';
import { ClassCard, Hero, IdentityPanel } from './components/Admissions';
import { ApplicationsView } from './components/Applications';
import { buttonClass, EmptyState, LoadingState, SectionHeading } from './components/ui';

type View = 'admissions' | 'applications' | 'admin';
type Notice = { kind: 'success' | 'error' | 'info'; message: string } | null;

const STORAGE_KEY = 'school-admission-student-id';

const navigation: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'admissions', label: 'Classes', icon: LayoutDashboard },
  { id: 'applications', label: 'My applications', icon: GraduationCap },
  { id: 'admin', label: 'Admin', icon: School },
];

const titles: Record<Exclude<View, 'admissions'>, { title: string; subtitle: string }> = {
  applications: {
    title: 'Your applications',
    subtitle: 'Track every reservation and pay the admission fee before the timer runs out.',
  },
  admin: {
    title: 'Manage admissions',
    subtitle: 'Add classes and shifts, and watch seat capacity fill up in real time.',
  },
};

function NoticeToast({ notice, onClose }: { notice: NonNullable<Notice>; onClose: () => void }) {
  const styles = {
    success: 'bg-forest text-white',
    error: 'bg-clay text-white',
    info: 'bg-ink text-white',
  }[notice.kind];
  const Icon =
    notice.kind === 'error' ? AlertCircle : notice.kind === 'success' ? CheckCircle2 : Info;
  return (
    <div
      role="status"
      className={`fixed inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg md:inset-x-auto md:bottom-8 md:right-8 md:w-[24rem] ${styles}`}
    >
      <Icon size={22} className="mt-0.5 shrink-0" />
      <span className="flex-1 leading-snug">{notice.message}</span>
      <button onClick={onClose} aria-label="Dismiss notification" className="-m-2 p-2 opacity-80">
        <X size={18} />
      </button>
    </div>
  );
}

export default function App() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('admissions');
  const [studentId, setStudentId] = useState(() => window.localStorage.getItem(STORAGE_KEY) ?? '');
  const [notice, setNotice] = useState<Notice>(null);

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

  const refreshAdmissionData = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['classes'] }),
      queryClient.invalidateQueries({ queryKey: ['applications', studentId] }),
    ]);
  }, [queryClient, studentId]);

  const showNotice = (next: Notice) => {
    setNotice(next);
    if (next)
      window.setTimeout(
        () => setNotice((current) => (current?.message === next.message ? null : current)),
        5_000
      );
  };

  const errorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

  const holdMutation = useMutation({
    mutationFn: (classId: string) => admissionApi.createHold(classId, studentId),
    onSuccess: async () => {
      showNotice({
        kind: 'success',
        message: 'Seat reserved. Pay the admission fee before the timer ends.',
      });
      await refreshAdmissionData();
      setView('applications');
    },
    onError: (error) =>
      showNotice({ kind: 'error', message: errorMessage(error, 'Could not reserve this seat.') }),
  });

  const confirmMutation = useMutation({
    mutationFn: (holdId: string) => admissionApi.confirmHold(holdId, studentId),
    onSuccess: async () => {
      showNotice({ kind: 'success', message: 'Payment received. Your admission is confirmed.' });
      await refreshAdmissionData();
    },
    onError: (error) =>
      showNotice({
        kind: 'error',
        message: errorMessage(error, 'Could not confirm this admission.'),
      }),
  });

  const cancelMutation = useMutation({
    mutationFn: (holdId: string) => admissionApi.cancelHold(holdId, studentId),
    onSuccess: async () => {
      showNotice({ kind: 'info', message: 'Reservation cancelled. The seat is open again.' });
      await refreshAdmissionData();
    },
    onError: (error) =>
      showNotice({
        kind: 'error',
        message: errorMessage(error, 'Could not cancel this reservation.'),
      }),
  });

  const createClassMutation = useMutation({
    mutationFn: (payload: { name: string; totalSeats: number }) =>
      admissionApi.createClass(payload),
    onSuccess: async (created) => {
      showNotice({ kind: 'success', message: `${created.name} published.` });
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: (error) =>
      showNotice({ kind: 'error', message: errorMessage(error, 'Could not create the class.') }),
  });

  const confirmHold = useCallback(
    (holdId: string) => confirmMutation.mutate(holdId),
    [confirmMutation.mutate]
  );
  const cancelHold = useCallback(
    (holdId: string) => cancelMutation.mutate(holdId),
    [cancelMutation.mutate]
  );

  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const applications = useMemo(() => applicationsQuery.data ?? [], [applicationsQuery.data]);
  const heldCount = useMemo(
    () => applications.filter((a) => a.status === 'HELD').length,
    [applications]
  );

  const saveStudentId = (raw: string) => {
    const normalized = normalizeStudentId(raw);
    if (!isValidStudentId(normalized)) {
      showNotice({ kind: 'error', message: 'Enter a valid 17-digit birth registration number.' });
      return false;
    }
    setStudentId(normalized);
    window.localStorage.setItem(STORAGE_KEY, normalized);
    showNotice({ kind: 'success', message: 'Registration number saved on this device.' });
    return true;
  };

  const createClass = async (name: string, totalSeats: string) => {
    const seats = Number(totalSeats);
    if (name.trim().length < 3) {
      showNotice({ kind: 'error', message: 'Enter a class name with at least 3 characters.' });
      return false;
    }
    if (!Number.isInteger(seats) || seats < 1 || seats > 100_000) {
      showNotice({ kind: 'error', message: 'Seats must be a whole number from 1 to 100,000.' });
      return false;
    }
    try {
      await createClassMutation.mutateAsync({ name: name.trim(), totalSeats: seats });
      setView('admissions');
      return true;
    } catch {
      return false; // onError already showed the message
    }
  };

  const retryQueries = () => {
    void classesQuery.refetch();
    if (studentReady) void applicationsQuery.refetch();
  };

  const pendingClassId = holdMutation.isPending ? holdMutation.variables : undefined;
  const showIdentity = view !== 'admin';

  const scrollToClasses = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .getElementById('classes')
      ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const tryAgain: ReactNode = (
    <button className={buttonClass('secondary')} onClick={retryQueries}>
      <RefreshCw size={18} /> Try again
    </button>
  );

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <button
            className="flex items-center gap-3.5 rounded-xl text-left focus-visible:ring-2 focus-visible:ring-forest"
            onClick={() => setView('admissions')}
            aria-label="Northstar School home"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-forest-dark text-forest-mint sm:size-10">
              <School size={21} strokeWidth={1.8} />
            </span>
            <span className="leading-tight">
              <strong className="block font-display text-base font-extrabold sm:text-lg">
                Northstar School
              </strong>
              <small className="text-xs text-muted">Admissions 2026–27</small>
            </span>
          </button>

          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
              {navigation.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  aria-current={view === id ? 'page' : undefined}
                  className={`flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-forest ${
                    view === id
                      ? 'bg-forest-dark text-white shadow-sm'
                      : 'text-muted hover:bg-paper hover:text-ink'
                  }`}
                >
                  <Icon size={19} />
                  {label}
                  {id === 'applications' && studentReady && heldCount > 0 && (
                    <span className="grid min-w-5 place-items-center rounded-full bg-amber-bright px-1.5 text-xs font-bold text-night">
                      {heldCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <button
              onClick={retryQueries}
              aria-label="Refresh data"
              title="Refresh data"
              className="grid size-10 place-items-center rounded-xl border border-line bg-white text-muted hover:bg-paper focus-visible:ring-2 focus-visible:ring-forest"
            >
              <RefreshCw size={20} className={classesQuery.isFetching ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-32 pt-6 sm:px-8 md:pb-20 md:pt-8">
        {view === 'admissions' ? (
          <Hero classes={classes} onBrowse={scrollToClasses} />
        ) : (
          <div className="mb-7 md:mb-8">
            <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {titles[view].title}
            </h1>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted">
              {titles[view].subtitle}
            </p>
          </div>
        )}

        {showIdentity && (
          <div className={view === 'admissions' ? 'mt-6' : 'mb-10'}>
            <IdentityPanel studentId={studentId} onSave={saveStudentId} />
          </div>
        )}

        {view === 'admissions' && (
          <>
            <section id="classes" className="mt-8 scroll-mt-24">
              <SectionHeading
                title="Choose a class"
                description="Seats are shown live. Reserve one and you have a short time to pay."
                aside={`${classes.length} ${classes.length === 1 ? 'option' : 'options'}`}
              />
              {classesQuery.isLoading ? (
                <LoadingState label="Loading classes…" />
              ) : classesQuery.isError ? (
                <EmptyState
                  title="Classes could not be loaded"
                  description={
                    classesQuery.error instanceof ApiError
                      ? classesQuery.error.message
                      : 'Check that the backend is running, then try again.'
                  }
                  action={tryAgain}
                />
              ) : classes.length === 0 ? (
                <EmptyState
                  title="No classes yet"
                  description="Admissions are being prepared. The school admin can add classes and shifts from the Admin tab."
                  action={
                    <button className={buttonClass('secondary')} onClick={() => setView('admin')}>
                      <Plus size={18} /> Add the first class
                    </button>
                  }
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {classes.map((item) => (
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
            </section>

            <section className="mt-10" aria-labelledby="how-it-works">
              <h2
                id="how-it-works"
                className="mb-4 font-display text-2xl font-bold tracking-tight sm:text-3xl"
              >
                How it works
              </h2>
              <ol className="grid gap-4 md:grid-cols-3">
                {[
                  [
                    Armchair,
                    'Reserve a seat',
                    'Pick a class with open seats. Your seat is held the moment you apply.',
                  ],
                  [
                    Timer,
                    'Pay before the timer ends',
                    'You get a short window to pay the admission fee. After that the seat is released.',
                  ],
                  [
                    BadgeCheck,
                    'Admission confirmed',
                    'Once payment goes through, your place is secured. No lottery.',
                  ],
                ].map(([Icon, title, body], i) => {
                  const StepIcon = Icon as typeof Armchair;
                  return (
                    <li
                      key={title as string}
                      className="rounded-xl border border-line bg-white p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="grid size-10 place-items-center rounded-lg bg-forest-soft text-forest">
                          <StepIcon size={24} />
                        </span>
                        <span className="font-display text-3xl font-extrabold text-line">
                          {i + 1}
                        </span>
                      </div>
                      <h3 className="mt-4 font-display text-lg font-bold">{title as string}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted">{body as string}</p>
                    </li>
                  );
                })}
              </ol>
            </section>
          </>
        )}

        {view === 'applications' && (
          <ApplicationsView
            studentReady={studentReady}
            applications={applications}
            isLoading={applicationsQuery.isLoading}
            error={applicationsQuery.error}
            confirmingId={confirmMutation.isPending ? confirmMutation.variables : undefined}
            cancellingId={cancelMutation.isPending ? cancelMutation.variables : undefined}
            onConfirm={confirmHold}
            onCancel={cancelHold}
            onHoldExpired={refreshAdmissionData}
            onRetry={retryQueries}
            onBrowse={() => setView('admissions')}
          />
        )}

        {view === 'admin' && (
          <AdminView
            classes={classes}
            pending={createClassMutation.isPending}
            onCreate={createClass}
            liveStatus={
              classesQuery.isError
                ? 'disconnected'
                : classesQuery.isFetching
                  ? 'syncing'
                  : 'connected'
            }
          />
        )}

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-sm text-muted">
          <span className="font-semibold text-ink/70">Northstar School Admission Portal</span>
          <span
            className="flex items-center gap-2"
            role="status"
            aria-label={
              classesQuery.isError
                ? 'Live seat status disconnected'
                : classesQuery.isFetching
                  ? 'Live seat status synchronizing'
                  : 'Live seat status connected'
            }
          >
            <span
              className={`size-2 rounded-full ${
                classesQuery.isError
                  ? 'bg-clay'
                  : classesQuery.isFetching
                    ? 'bg-amber-bright'
                    : 'bg-forest'
              }`}
            />
            Live seat status:{' '}
            {classesQuery.isError ? 'Disconnected' : classesQuery.isFetching ? 'Syncing' : 'Connected'}
          </span>
        </footer>
      </main>

      {/* Mobile bottom tabs */}
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {navigation.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            aria-current={view === id ? 'page' : undefined}
            className={`relative flex min-h-[72px] flex-col items-center justify-center gap-1.5 text-[13px] font-semibold ${
              view === id ? 'text-forest-dark' : 'text-muted'
            }`}
          >
            {view === id && (
              <span className="absolute inset-x-8 top-0 h-1 rounded-b-full bg-forest" />
            )}
            <span className="relative">
              <Icon size={26} strokeWidth={view === id ? 2.2 : 1.7} />
              {id === 'applications' && studentReady && heldCount > 0 && (
                <span className="absolute -right-3 -top-2 grid min-w-5 place-items-center rounded-full bg-amber-bright px-1 text-xs font-bold leading-5 text-night">
                  {heldCount}
                </span>
              )}
            </span>
            {label}
          </button>
        ))}
      </nav>

      {notice && <NoticeToast notice={notice} onClose={() => setNotice(null)} />}
    </div>
  );
}
