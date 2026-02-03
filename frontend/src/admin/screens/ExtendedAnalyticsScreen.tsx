import AdminHeader from '../components/AdminHeader';
import '../../styles/admin.css';
import './ExtendedAnalyticsScreen.css';

export default function ExtendedAnalyticsScreen() {
  return (
    <div className="admin-screen extended-analytics-screen">
      <AdminHeader showBack onBack={() => window.history.back()} />
      <div className="admin-content">
        <h1 className="admin-title">Расширенная аналитика</h1>
        <div className="analytics-placeholder" aria-live="polite">
          <p className="analytics-placeholder__text">В разработке</p>
        </div>
      </div>
    </div>
  );
}
