import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navigate, RouterProvider, createBrowserRouter, type RouteObject } from 'react-router';
import { Toaster } from 'sonner';
import { ApiError } from './api/client';
import { BackupPage } from './features/backup/BackupPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { MembersPage } from './features/members/MembersPage';
import { MyTasksPage } from './features/my-tasks/MyTasksPage';
import { KanbanView, ListView, ProjectPage } from './features/project/ProjectPage';
import { ProjectsPage } from './features/projects/ProjectsPage';
import { AppShell } from './layout/AppShell';
import { NotFoundPage, RouteError } from './layout/RouteError';
import { CurrentMemberProvider } from './lib/currentMember';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'progetti', element: <ProjectsPage /> },
      {
        path: 'progetti/:projectId',
        element: <ProjectPage />,
        children: [
          { index: true, element: <Navigate to="kanban" replace /> },
          { path: 'kanban', element: <KanbanView /> },
          { path: 'lista', element: <ListView /> },
        ],
      },
      { path: 'le-mie-attivita', element: <MyTasksPage /> },
      { path: 'membri', element: <MembersPage /> },
      { path: 'backup', element: <BackupPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        // Client errors (4xx) will not fix themselves: do not retry them.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
      },
      mutations: { retry: false },
    },
  });
}

const router = createBrowserRouter(routes);
const queryClient = createQueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CurrentMemberProvider>
        <RouterProvider router={router} />
        <Toaster position="bottom-right" richColors closeButton duration={5000} toastOptions={{ closeButton: true }} />
      </CurrentMemberProvider>
    </QueryClientProvider>
  );
}
