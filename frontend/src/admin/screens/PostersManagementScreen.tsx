import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { hapticImpact } from '../../telegram/telegramWebApp';
import AdminHeader from '../components/AdminHeader';
import Modal from '../components/Modal';
import FileUpload from '../components/FileUpload';
import { OptimizedImage } from '../../components/OptimizedImage';
import { getOptimizedImageProps } from '../../types/image';
import {
  getAdminPosters,
  createAdminPoster,
  updateAdminPoster,
  deleteAdminPoster,
  uploadPosterImage,
  type AdminPoster,
} from '../../services/adminPosterService';
import '../../styles/admin.css';
import './PostersManagementScreen.css';

interface PosterInput {
  title: string;
  description?: string;
  imageUrl: string;
  link?: string;
  order?: number;
}

export default function PostersManagementScreen() {
  const [posters, setPosters] = useState<AdminPoster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPoster, setEditingPoster] = useState<AdminPoster | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  const [formData, setFormData] = useState<PosterInput>({
    title: '',
    description: '',
    imageUrl: '',
    link: '',
  });

  const sortPosters = (list: AdminPoster[]) =>
    [...list].sort((a, b) => {
      if ((a.order ?? 0) !== (b.order ?? 0)) return (a.order ?? 0) - (b.order ?? 0);
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    });

  useEffect(() => {
    loadPosters();
  }, []);

  const loadPosters = async () => {
    setIsLoading(true);
    try {
      const list = await getAdminPosters();
      setPosters(sortPosters(list));
    } catch (error) {
      console.error('Error loading posters:', error);
      toast.error('Не удалось загрузить афиши');
      setPosters([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = () => {
    hapticImpact('light');
    setEditingPoster(null);
    setFormData({
      title: '',
      description: '',
      imageUrl: '',
      link: '',
      order: posters.length + 1,
    });
    setShowModal(true);
  };

  const handleMovePoster = async (posterId: string, direction: 'up' | 'down') => {
    if (isReordering) return;
    const currentIndex = posters.findIndex((p) => p.id === posterId);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= posters.length) return;

    const reordered = [...posters];
    const temp = reordered[currentIndex];
    reordered[currentIndex] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    const normalized = reordered.map((poster, index) => ({
      ...poster,
      order: index + 1,
    }));

    const changed = normalized.filter((poster, index) => poster.order !== (posters[index].order ?? index + 1));
    setPosters(normalized);
    setIsReordering(true);

    try {
      await Promise.all(
        changed.map((poster) =>
          updateAdminPoster(poster.id, { order: poster.order })
        )
      );
    } catch (error) {
      console.error('Error reordering posters:', error);
      toast.error('Не удалось сохранить порядок афиш');
      await loadPosters();
    } finally {
      setIsReordering(false);
    }
  };

  const handleEdit = (poster: AdminPoster) => {
    hapticImpact('light');
    setEditingPoster(poster);
    setFormData({
      title: poster.title,
      description: poster.description ?? '',
      imageUrl: poster.imageUrl ?? '',
      link: poster.link ?? '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    hapticImpact('light');
    const poster = posters.find((p) => p.id === id);
    if (!poster) return;

    const confirmed = window.confirm(
      `Вы уверены, что хотите удалить "${poster.title}"?`
    );
    if (!confirmed) return;

    try {
      await deleteAdminPoster(id);
      toast.success('Афиша удалена');
      await loadPosters();
    } catch (error) {
      console.error('Error deleting poster:', error);
      toast.error('Не удалось удалить афишу');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title?.trim()) {
      toast.error('Введите название афиши');
      return;
    }
    if (!formData.imageUrl) {
      toast.error('Загрузите изображение афиши');
      return;
    }

    setIsSaving(true);
    try {
      let imageUrl = formData.imageUrl;
      if (imageUrl.startsWith('data:')) {
        imageUrl = await uploadPosterImage(imageUrl);
      }

      if (editingPoster) {
        await updateAdminPoster(editingPoster.id, {
          title: formData.title.trim(),
          description: formData.description?.trim() || undefined,
          imageUrl,
          link: formData.link?.trim() || undefined,
        });
        toast.success('Афиша обновлена');
      } else {
        await createAdminPoster({
          title: formData.title.trim(),
          description: formData.description?.trim() || undefined,
          imageUrl,
          link: formData.link?.trim() || undefined,
          order: formData.order,
        });
        toast.success('Афиша добавлена');
      }

      setShowModal(false);
      await loadPosters();
    } catch (error) {
      console.error('Error saving poster:', error);
      const msg = error instanceof Error ? error.message : 'Не удалось сохранить афишу';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (url: string) => {
    setFormData({ ...formData, imageUrl: url });
  };

  if (isLoading) {
    return (
      <div className="admin-screen">
        <AdminHeader showBack onBack={() => window.history.back()} />
        <div className="admin-content">
          <div className="admin-loading">Загрузка...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-screen">
      <AdminHeader showBack onBack={() => window.history.back()} />

      <div className="admin-content">
        <h1 className="admin-title">Управление афишами</h1>

        {posters.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty__icon">📋</div>
            <h3 className="admin-empty__title">Нет афиш</h3>
            <p className="admin-empty__text">Добавьте первую афишу</p>
          </div>
        ) : (
          <div className="posters-list">
            {posters.map((poster, index) => {
              const imgProps = getOptimizedImageProps(poster.imageUrl ?? undefined);
              return (
              <div key={poster.id} className="poster-item">
                {imgProps ? (
                  <div className="poster-item__image">
                    <OptimizedImage
                      {...imgProps}
                      alt={poster.title}
                      loading="lazy"
                      sizes="(max-width: 440px) 100vw, 200px"
                      objectFit="cover"
                    />
                  </div>
                ) : (
                  <div className="poster-item__placeholder">📋</div>
                )}

                <div className="poster-item__content">
                  <h3 className="poster-item__title">
                    {poster.title}
                    <span className="poster-order-pill">#{poster.order ?? '-'}</span>
                  </h3>
                  {poster.description && (
                    <p className="poster-item__description">{poster.description}</p>
                  )}
                  {poster.link && (
                    <a
                      href={poster.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="poster-item__link"
                    >
                      {poster.link}
                    </a>
                  )}
                </div>

                <div className="poster-item__actions">
                  <div className="poster-order-controls">
                    <button
                      type="button"
                      className="poster-order-btn"
                      aria-label={`Поднять ${poster.title}`}
                      disabled={isReordering || index === 0}
                      onClick={() => handleMovePoster(poster.id, 'up')}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2.5L12 8.5H2L7 2.5Z" fill="currentColor"/></svg>
                    </button>
                    <button
                      type="button"
                      className="poster-order-btn"
                      aria-label={`Опустить ${poster.title}`}
                      disabled={isReordering || index === posters.length - 1}
                      onClick={() => handleMovePoster(poster.id, 'down')}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 11.5L2 5.5H12L7 11.5Z" fill="currentColor"/></svg>
                    </button>
                  </div>
                  <button
                    className="admin-btn admin-btn--secondary"
                    onClick={() => handleEdit(poster)}
                  >
                    Редактировать
                  </button>
                  <button
                    className="admin-btn admin-btn--danger"
                    onClick={() => handleDelete(poster.id)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            );
            })}
          </div>
        )}

        <button className="admin-fab" onClick={handleAdd} aria-label="Добавить афишу">
          +
        </button>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingPoster ? 'Редактировать афишу' : 'Добавить афишу'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="admin-form">
          <div className="admin-form-group">
            <label className="admin-form-label">Название*</label>
            <input
              type="text"
              className="admin-form-input"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Название афиши"
              required
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Описание</label>
            <textarea
              className="admin-form-input admin-form-textarea"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Краткое описание..."
              rows={3}
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Изображение*</label>
            <FileUpload
              currentImage={formData.imageUrl}
              onUpload={handleImageUpload}
              accept="image/*"
              maxSize={5}
              preset="poster"
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Ссылка</label>
            <input
              type="url"
              className="admin-form-input"
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
              placeholder="https://example.com"
            />
          </div>

          <div className="admin-form-actions">
            <button
              type="submit"
              className="admin-btn admin-btn--full"
              disabled={isSaving}
            >
              {isSaving ? 'Сохранение...' : editingPoster ? 'Обновить' : 'Добавить'}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--secondary admin-btn--full"
              onClick={() => { hapticImpact('light'); setShowModal(false); }}
              disabled={isSaving}
            >
              Отмена
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
