import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import AdminHeader from '../components/AdminHeader';
import Modal from '../components/Modal';
import FileUpload from '../components/FileUpload';
import {
  getAdminFormats,
  createAdminFormat,
  updateAdminFormat,
  deleteAdminFormat,
  type AdminFormat,
} from '../../services/adminFormatService';
import { OptimizedImage } from '../../components/OptimizedImage';
import { getOptimizedImageProps } from '../../types/image';
import '../../styles/admin.css';
import './FormatsManagementScreen.css';

/** UI status: available = показывать в бронировании, coming-soon = скрыт */
type FormatStatusUI = 'available' | 'coming-soon';

interface Format extends Omit<AdminFormat, 'description'> {
  shortDescription: string;
  description?: string | null;
  fullDescription?: string;
  suitableFor: string[];
  performers: { name: string; role: string }[];
  status: FormatStatusUI;
}

interface FormatInput {
  name: string;
  shortDescription: string;
  fullDescription?: string;
  imageUrl?: string;
  suitableFor: string[];
  performers: { name: string; role: string }[];
  status: FormatStatusUI;
  order: number;
}

function fromApi(f: AdminFormat): Format {
  return {
    ...f,
    shortDescription: f.shortDescription ?? '',
    fullDescription: f.description ?? '',
    suitableFor: Array.isArray(f.suitableFor) ? (f.suitableFor as string[]) : [],
    performers: Array.isArray(f.performers)
      ? (f.performers as { name: string; role: string }[])
      : [],
    status: f.status === 'hidden' ? 'coming-soon' : 'available',
  };
}

function toApiStatus(ui: FormatStatusUI): 'available' | 'hidden' {
  return ui === 'coming-soon' ? 'hidden' : 'available';
}

export default function FormatsManagementScreen() {
  const [formats, setFormats] = useState<Format[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingFormat, setEditingFormat] = useState<Format | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<FormatInput>({
    name: '',
    shortDescription: '',
    fullDescription: '',
    imageUrl: '',
    suitableFor: [],
    performers: [],
    status: 'available',
    order: 0,
  });

  useEffect(() => {
    loadFormats();
  }, []);

  const loadFormats = async () => {
    setIsLoading(true);
    try {
      const list = await getAdminFormats();
      setFormats(list.map(fromApi));
    } catch (error) {
      console.warn('Backend unavailable, showing demo data:', error);
      setFormats(DEMO_FORMATS);
      toast('Бэкенд недоступен. Показаны демо-данные.', { icon: 'ℹ️' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingFormat(null);
    setFormData({
      name: '',
      shortDescription: '',
      fullDescription: '',
      imageUrl: '',
      suitableFor: [],
      performers: [],
      status: 'available',
      order: formats.length + 1,
    });
    setShowModal(true);
  };

  const handleEdit = (format: Format) => {
    setEditingFormat(format);
    setFormData({
      name: format.name,
      shortDescription: format.shortDescription,
      fullDescription: format.fullDescription ?? format.description ?? '',
      imageUrl: format.imageUrl ?? '',
      suitableFor: format.suitableFor,
      performers: format.performers,
      status: format.status,
      order: format.order,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const format = formats.find((f) => f.id === id);
    if (!format) return;

    const confirmed = window.confirm(
      `Вы уверены, что хотите удалить "${format.name}"?`
    );

    if (!confirmed) return;

    try {
      await deleteAdminFormat(id);
      toast.success('Формат удален');
      await loadFormats();
    } catch (error) {
      console.error('Error deleting format:', error);
      toast.error('Не удалось удалить формат');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.shortDescription) {
      toast.error('Заполните название и описание');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.fullDescription || undefined,
        shortDescription: formData.shortDescription,
        imageUrl: formData.imageUrl || undefined,
        suitableFor: formData.suitableFor,
        performers: formData.performers,
        status: toApiStatus(formData.status),
        order: formData.order,
      };

      if (editingFormat) {
        await updateAdminFormat(editingFormat.id, payload);
        toast.success('Формат обновлен');
      } else {
        await createAdminFormat(payload);
        toast.success('Формат добавлен');
      }

      setShowModal(false);
      await loadFormats();
    } catch (error) {
      console.error('Error saving format:', error);
      toast.error('Не удалось сохранить формат');
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
        <h1 className="admin-title">Управление форматами</h1>

        {formats.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty__icon">🎭</div>
            <h3 className="admin-empty__title">Нет форматов</h3>
            <p className="admin-empty__text">Добавьте первый формат</p>
          </div>
        ) : (
          <div className="formats-grid">
            {formats.map((format) => {
              const imgProps = getOptimizedImageProps(format.imageUrl);
              return (
              <div key={format.id} className="format-card">
                {imgProps ? (
                  <div className="format-card__image">
                    <OptimizedImage
                      {...imgProps}
                      alt={format.name}
                      loading="lazy"
                      sizes="(max-width: 440px) 100vw, 280px"
                      objectFit="cover"
                    />
                  </div>
                ) : (
                  <div className="format-card__placeholder">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <path
                        d="M8 42V6H40V42L24 34L8 42Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}

                <div className="format-card__content">
                  <div className="format-card__header">
                    <h3 className="format-card__title">{format.name}</h3>
                    <span
                      className={`format-badge format-badge--${format.status}`}
                      title={format.status === 'available' ? 'Показывается в бронировании' : 'Скрыт из бронирования'}
                    >
                      {format.status === 'available' ? 'В бронировании' : 'Скрыт'}
                    </span>
                  </div>

                  <p className="format-card__description">
                    {format.shortDescription}
                  </p>

                  {format.suitableFor.length > 0 && (
                    <div className="format-card__tags">
                      {format.suitableFor.slice(0, 3).map((item, index) => (
                        <span key={index} className="format-tag">
                          {item}
                        </span>
                      ))}
                      {format.suitableFor.length > 3 && (
                        <span className="format-tag">
                          +{format.suitableFor.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="format-card__actions">
                    <button
                      className="admin-btn admin-btn--secondary"
                      onClick={() => handleEdit(format)}
                    >
                      Редактировать
                    </button>
                    <button
                      className="admin-btn admin-btn--danger"
                      onClick={() => handleDelete(format.id)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}

        {/* FAB */}
        <button className="admin-fab" onClick={handleAdd} aria-label="Добавить формат">
          +
        </button>
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingFormat ? 'Редактировать формат' : 'Добавить формат'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="admin-form">
          <div className="admin-form-group">
            <label className="admin-form-label">Название*</label>
            <input
              type="text"
              className="admin-form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Дуэт, Соло, Трио..."
              required
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Краткое описание*</label>
            <input
              type="text"
              className="admin-form-input"
              value={formData.shortDescription}
              onChange={(e) =>
                setFormData({ ...formData, shortDescription: e.target.value })
              }
              placeholder="Короткое описание формата"
              required
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Полное описание</label>
            <textarea
              className="admin-form-input admin-form-textarea"
              value={formData.fullDescription}
              onChange={(e) =>
                setFormData({ ...formData, fullDescription: e.target.value })
              }
              placeholder="Детальное описание формата..."
              rows={4}
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Изображение</label>
            <FileUpload
              currentImage={formData.imageUrl}
              onUpload={handleImageUpload}
              accept="image/*"
              maxSize={5}
              preset="format"
            />
          </div>

          <div className="admin-form-group">
            <div className="admin-form-toggle-row">
              <label className="admin-form-label admin-form-toggle-label">
                Показывать в бронировании
              </label>
              <label className="admin-toggle">
                <input
                  type="checkbox"
                  checked={formData.status === 'available'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: (e.target.checked ? 'available' : 'coming-soon') as FormatStatusUI,
                    })
                  }
                  className="admin-toggle__input"
                />
                <span className="admin-toggle__slider" />
              </label>
            </div>
            <span className="admin-form-hint">
              {formData.status === 'available'
                ? 'Формат доступен для выбора при заявке'
                : 'Формат скрыт из выбора в бронировании'}
            </span>
          </div>

          <div className="admin-form-actions">
            <button
              type="submit"
              className="admin-btn admin-btn--full"
              disabled={isSaving}
            >
              {isSaving ? 'Сохранение...' : editingFormat ? 'Обновить' : 'Добавить'}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--secondary admin-btn--full"
              onClick={() => setShowModal(false)}
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
