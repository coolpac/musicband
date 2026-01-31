import { useState } from 'react';
import { FileIcon, VideoIcon, ImageIcon, MusicIcon } from '../assets/icons';
import AdminHeader from '../components/AdminHeader';
import { OptimizedImage } from '../../components/OptimizedImage';
import { getOptimizedImageProps } from '../../types/image';
import '../../styles/admin.css';

type EditCategory = 'tracks' | 'videos' | 'images' | 'files';

type Track = {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string;
};

export default function EditScreen() {
  const [activeCategory, setActiveCategory] = useState<EditCategory>('tracks');
  const [tracks] = useState<Track[]>([
    {
      id: '1',
      title: 'Черный дельфин',
      artist: 'Гио Пика',
    },
    {
      id: '2',
      title: 'Никого не жалко',
      artist: 'Бумер',
    },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);

  const categories = [
    { id: 'tracks' as EditCategory, icon: MusicIcon, label: 'Треки' },
    { id: 'videos' as EditCategory, icon: VideoIcon, label: 'Видео' },
    { id: 'images' as EditCategory, icon: ImageIcon, label: 'Фото' },
    { id: 'files' as EditCategory, icon: FileIcon, label: 'Файлы' },
  ];

  return (
    <div className="admin-screen">
      <AdminHeader showBack onBack={() => window.history.back()} />
      <main className="admin-content">
        <h1 className="admin-title">Редактировать</h1>

        {/* Category Tabs */}
        <div className="admin-tabs">
          {categories.map((category) => {
            const Icon = category.icon;
            const isActive = activeCategory === category.id;

            return (
              <button
                key={category.id}
                type="button"
                className={`admin-tab ${isActive ? 'admin-tab--active' : ''}`}
                onClick={() => setActiveCategory(category.id)}
              >
                <Icon active={isActive} />
              </button>
            );
          })}
        </div>

        {/* Tracks List */}
        {activeCategory === 'tracks' && (
          <>
            <div className="admin-section-header">
              <h2 className="admin-section-title">Добавить трек +</h2>
            </div>

            <div className="admin-list">
              {tracks.map((track) => {
                const coverProps = getOptimizedImageProps(track.coverUrl);
                return (
                <div key={track.id} className="admin-list-item">
                  <div className="admin-list-item__avatar">
                    {coverProps ? (
                      <OptimizedImage
                        {...coverProps}
                        alt={track.title}
                        loading="lazy"
                        sizes="80px"
                        objectFit="cover"
                      />
                    ) : (
                      <MusicIcon />
                    )}
                  </div>
                  <div className="admin-list-item__content">
                    <h3 className="admin-list-item__title">{track.title}</h3>
                    <p className="admin-list-item__subtitle">{track.artist}</p>
                  </div>
                  <div className="admin-list-item__actions">
                    <button
                      className="admin-list-item__action admin-list-item__action--edit"
                      type="button"
                      aria-label="Редактировать"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button
                      className="admin-list-item__action admin-list-item__action--delete"
                      type="button"
                      aria-label="Удалить"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M3 6H5H21" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
              })}
            </div>
          </>
        )}

        {activeCategory !== 'tracks' && (
          <div className="admin-empty">
            <div className="admin-empty__icon">📁</div>
            <h3 className="admin-empty__title">Пусто</h3>
            <p className="admin-empty__text">Здесь пока нет элементов</p>
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <button
        className="admin-fab"
        type="button"
        aria-label="Добавить"
        onClick={() => setShowAddModal(true)}
      >
        +
      </button>

      {/* Add Track Modal */}
      {showAddModal && (
        <div className="admin-modal" onClick={() => setShowAddModal(false)}>
          <div className="admin-modal__content" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal__header">
              <h2 className="admin-modal__title">Добавление трека</h2>
              <button
                className="admin-modal__close"
                type="button"
                onClick={() => setShowAddModal(false)}
              >
                ×
              </button>
            </div>

            <form className="admin-form">
              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="track-title">
                  Название песни
                </label>
                <input
                  id="track-title"
                  type="text"
                  className="admin-form-input"
                  placeholder="Введите название"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="track-artist">
                  Исполнитель
                </label>
                <input
                  id="track-artist"
                  type="text"
                  className="admin-form-input"
                  placeholder="Введите исполнителя"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="track-cover">
                  Обложка
                </label>
                <button type="button" className="admin-form-file">
                  Иконка загрузки
                </button>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="track-lyrics">
                  Текст песни
                </label>
                <textarea
                  id="track-lyrics"
                  className="admin-form-input admin-form-textarea"
                  placeholder="Введите текст песни"
                />
              </div>

              <button type="submit" className="admin-btn admin-btn--full">
                Сохранить
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
