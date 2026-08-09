import { Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage.jsx'
import AdminDonationsPage from './pages/admin/AdminDonationsPage.jsx'
import AdminOrganisationsPage from './pages/admin/AdminOrganisationsPage.jsx'
import AdminUsersPage from './pages/admin/AdminUsersPage.jsx'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx'
import LoginPage from './pages/auth/LoginPage.jsx'
import RegisterPage from './pages/auth/RegisterPage.jsx'
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx'
import DonationFormPage from './pages/donor/DonationFormPage.jsx'
import DonationRequestsPage from './pages/donor/DonationRequestsPage.jsx'
import MyDonationsPage from './pages/donor/MyDonationsPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import DonationDetailPage from './pages/public/DonationDetailPage.jsx'
import DonationsPage from './pages/public/DonationsPage.jsx'
import HomePage from './pages/public/HomePage.jsx'
import MyReservationsPage from './pages/recipient/MyReservationsPage.jsx'
import DashboardPage from './pages/shared/DashboardPage.jsx'
import ProfilePage from './pages/shared/ProfilePage.jsx'
import UnauthorizedPage from './pages/UnauthorizedPage.jsx'
import ProtectedRoute from './routes/ProtectedRoute.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="donations" element={<DonationsPage />} />
        <Route path="donations/:id" element={<DonationDetailPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="unauthorized" element={<UnauthorizedPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<DashboardPage />} />
        </Route>

        <Route element={<ProtectedRoute roles={['DONOR', 'RECIPIENT']} />}>
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route element={<ProtectedRoute roles={['DONOR']} />}>
          <Route path="my-donations" element={<MyDonationsPage />} />
          <Route path="donations/new" element={<DonationFormPage />} />
          <Route path="donations/:id/edit" element={<DonationFormPage />} />
          <Route path="donations/:id/requests" element={<DonationRequestsPage />} />
        </Route>

        <Route element={<ProtectedRoute roles={['RECIPIENT']} />}>
          <Route path="my-reservations" element={<MyReservationsPage />} />
        </Route>

        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route path="admin" element={<DashboardPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="admin/organisations" element={<AdminOrganisationsPage />} />
          <Route path="admin/categories" element={<AdminCategoriesPage />} />
          <Route path="admin/donations" element={<AdminDonationsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
