import { useState } from 'react';
import { hapticSelection } from '../../telegram/telegramWebApp';
import AdminHeader from '../components/AdminHeader';
import FormatsManagementScreen from './FormatsManagementScreen';
import PostersManagementScreen from './PostersManagementScreen';
import PartnersManagementScreen from './PartnersManagementScreen';
import '../../styles/admin.css';
import './ContentScreen.css';

type ContentTab = 'formats' | 'posters' | 'partners';

export default function ContentScreen() {
  const [activeTab, setActiveTab] = useState<ContentTab>('formats');

  const renderContent = () => {
    switch (activeTab) {
      case 'formats':
        return <FormatsManagementScreen />;
      case 'posters':
        return <PostersManagementScreen />;
      case 'partners':
        return <PartnersManagementScreen />;
      default:
        return null;
    }
  };

  return (
    <div className="admin-screen content-screen">
      <AdminHeader />

      <div className="content-tabs">
        <button
          className={`content-tab ${activeTab === 'formats' ? 'content-tab--active' : ''}`}
          onClick={() => { hapticSelection(); setActiveTab('formats'); }}
        >
          🎭 Форматы
        </button>
        <button
          className={`content-tab ${activeTab === 'posters' ? 'content-tab--active' : ''}`}
          onClick={() => { hapticSelection(); setActiveTab('posters'); }}
        >
          📋 Афиши
        </button>
        <button
          className={`content-tab ${activeTab === 'partners' ? 'content-tab--active' : ''}`}
          onClick={() => { hapticSelection(); setActiveTab('partners'); }}
        >
          🤝 Партнеры
        </button>
      </div>

      <div className="content-view">
        {renderContent()}
      </div>
    </div>
  );
}
