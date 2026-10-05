import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { useAuth } from './context/AuthContext';

jest.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: jest.fn(),
}));
jest.mock('./components/AppShell', () => {
  const { Outlet } = require('react-router-dom');
  return () => <Outlet />;
});
jest.mock('./pages/Home', () => () => <h1>Home page</h1>);
jest.mock('./pages/Login', () => () => <h1>Login page</h1>);
jest.mock('./pages/Signup', () => () => <h1>Signup page</h1>);
jest.mock('./pages/Dashboard', () => () => <h1>Workouts page</h1>);
jest.mock('./pages/Nutrition', () => () => <h1>Nutrition page</h1>);
jest.mock('./pages/Profile', () => () => <h1>Profile page</h1>);
jest.mock('./pages/Insights', () => () => <h1>Insights page</h1>);

const open = (path) => render(
  <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <App />
  </MemoryRouter>
);

test.each(['/', '/dashboard', '/nutrition', '/profile', '/insights'])(
  'requires login for %s', (path) => {
    useAuth.mockReturnValue({ user: null, loading: false });
    open(path);
    expect(screen.getByRole('heading', { name: 'Login page' })).toBeInTheDocument();
  }
);

test('waits for authentication before mounting protected pages', () => {
  useAuth.mockReturnValue({ user: null, loading: true });
  open('/dashboard');
  expect(screen.getByText('Loading...')).toBeInTheDocument();
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
});

test('renders protected pages for signed-in users', () => {
  useAuth.mockReturnValue({ user: { uid: 'test' }, loading: false });
  open('/dashboard');
  expect(screen.getByRole('heading', { name: 'Workouts page' })).toBeInTheDocument();
});

test('recovers from unknown URLs', () => {
  useAuth.mockReturnValue({ user: { uid: 'test' }, loading: false });
  open('/missing');
  expect(screen.getByRole('heading', { name: 'Home page' })).toBeInTheDocument();
});
