import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import TabBar, { AdminTab } from './components/TabBar';
import DashboardScreen from './screens/DashboardScreen';
import VotingManagementScreen from './screens/VotingManagementScreen';
import SongsManagementScreen from './screens/SongsManagementScreen';
import BookingsManagementScreen from './screens/BookingsManagementScreen';
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

      case 'songs':
        return <SongsManagementScreen />;

      case 'bookings':
        return <BookingsManagementScreen />;

      case 'content':
        return <ContentScreen />;

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
