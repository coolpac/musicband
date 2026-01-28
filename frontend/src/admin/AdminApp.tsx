import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import TabBar, { AdminTab } from './components/TabBar';
import DashboardScreen from './screens/DashboardScreen';
import VotingManagementScreen from './screens/VotingManagementScreen';
import ContentScreen from './screens/ContentScreen';
import '../styles/admin.css';
import '../styles/admin-tabbar.css';

export default function AdminApp() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  const renderScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardScreen />;

      case 'voting':
        return <VotingManagementScreen />;

      case 'bookings':
        return (
          <div className="admin-screen">
            <div className="admin-content">
              <h1 className="admin-title">Управление бронями</h1>
              <div className="admin-empty">
                <div className="admin-empty__icon">📅</div>
                <h3 className="admin-empty__title">Скоро здесь появятся брони</h3>
                <p className="admin-empty__text">
                  Все подтвержденные заявки, заявки в ожидании и история будут здесь
                </p>
              </div>
            </div>
          </div>
        );

      case 'content':
        return <ContentScreen />;

      case 'settings':
        return (
          <div className="admin-screen">
            <div className="admin-content">
              <h1 className="admin-title">Настройки</h1>
              <div className="admin-empty">
                <div className="admin-empty__icon">⚙️</div>
                <h3 className="admin-empty__title">Настройки системы</h3>
                <p className="admin-empty__text">
                  Управление агентами, отзывами и общими настройками
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="admin-app">
      {renderScreen()}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'linear-gradient(160deg, rgba(255, 255, 255, 0.1), rgba(0, 0, 0, 0.3))',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: 'white',
            borderRadius: '15px',
            padding: '16px',
          },
          success: {
            iconTheme: {
              primary: '#4ade80',
              secondary: 'white',
            },
          },
          error: {
            iconTheme: {
              primary: '#f87171',
              secondary: 'white',
            },
          },
        }}
      />
    </div>
  );
}
