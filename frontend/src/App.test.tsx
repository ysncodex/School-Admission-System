import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

const classes = [
  {
    id: 'c1',
    name: 'Class 6 - Morning Shift',
    totalSeats: 120,
    heldSeats: 10,
    confirmedSeats: 100,
    availableSeats: 10,
  },
  {
    id: 'c2',
    name: 'Class 7 - Day Shift',
    totalSeats: 50,
    heldSeats: 0,
    confirmedSeats: 50,
    availableSeats: 0,
  },
];
const ID = '20152691234567890';

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  window.matchMedia =
    window.matchMedia ||
    ((q: string) =>
      ({
        matches: false,
        media: q,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        onchange: null,
        dispatchEvent: () => false,
      }) as MediaQueryList);
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = String(url).endsWith('/classes')
        ? classes
        : [
            {
              holdId: 'h1',
              classId: 'c1',
              className: 'Class 6 - Morning Shift',
              status: 'HELD',
              expiresAt: new Date(Date.now() + 300_000).toISOString(),
            },
          ];
      return new Response(JSON.stringify(body), { status: 200 });
    })
  );
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('App smoke test', () => {
  it('renders classes, disables full class, and lets a saved student see applications', async () => {
    renderApp();
    expect(await screen.findByText('Class 6 - Morning Shift')).toBeInTheDocument();
    expect(screen.getByText('Fully booked', { selector: 'button' })).toBeDisabled();
    expect(
      screen.getAllByText('Save your registration number first to reserve.').length
    ).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Birth registration number'), ID);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Registration number saved')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /My applications/ })[0]);
    expect(await screen.findByText('Pay admission fee')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent(/0[45]:\d\d/);
    await waitFor(() => expect(screen.getAllByText('Needs payment').length).toBeGreaterThan(1));
  });

  it('renders the admin view', async () => {
    renderApp();
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: /Admin/ })[0]);
    expect(await screen.findByText('Add a class or shift')).toBeInTheDocument();
    expect(screen.getByLabelText('Total seats')).toHaveValue(120);
  });
});
