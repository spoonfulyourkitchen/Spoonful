import { useAdminLoginAlerts } from '../lib/admin-login';

export function AdminAlertsGate(): null {
  useAdminLoginAlerts();
  return null;
}

export default AdminAlertsGate;
