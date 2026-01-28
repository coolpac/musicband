import { useState } from 'react';
import AdminHeader from '../components/AdminHeader';
import SongsManagementScreen from './SongsManagementScreen';
import FormatsManagementScreen from './FormatsManagementScreen';
import PostersManagementScreen from './PostersManagementScreen';
import PartnersManagementScreen from './PartnersManagementScreen';
import '../../styles/admin.css';
import './ContentScreen.css';

type ContentTab = 'songs' | 'formats' | 'posters' | 'partners';

export default function ContentScreen() {
  const [activeTab, setActiveTab] = useState<ContentTab>('songs');

  const renderContent = () => {
    switch (activeTab) {
      case 'songs':
        return <SongsManagementScreen />;
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
          className={`content-tab ${activeTab === 'songs' ? 'content-tab--active' : ''}`}
          onClick={() => setActiveTab('songs')}
        >
          🎵 Песни
        </button>
        <button
          className={`content-tab ${activeTab === 'formats' ? 'content-tab--active' : ''}`}
          onClick={() => setActiveTab('formats')}
        >
          🎭 Форматы
        </button>
        <button
          className={`content-tab ${activeTab === 'posters' ? 'content-tab--active' : ''}`}
          onClick={() => setActiveTab('posters')}
        >
          📋 Афиши
        </button>
        <button
          className={`content-tab ${activeTab === 'partners' ? 'content-tab--active' : ''}`}
          onClick={() => setActiveTab('partners')}
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
