import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import AdminHeader from '../components/AdminHeader';
import Modal from '../components/Modal';
import FileUpload from '../components/FileUpload';
import '../../styles/admin.css';
import './FormatsManagementScreen.css';

// Types
interface Format {
  id: string;
  name: string;
  shortDescription: string;
  fullDescription?: string;
  imageUrl?: string;
  suitableFor: string[];
  performers: { name: string; role: string }[];
  status: 'available' | 'coming-soon';
  order: number;
}

interface FormatInput {
  name: string;
  shortDescription: string;
  fullDescription?: string;
  imageUrl?: string;
  suitableFor: string[];
  performers: { name: string; role: string }[];
  status: 'available' | 'coming-soon';
  order: number;
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

  // Temp inputs for arrays
  const [suitableInput, setSuitableInput] = useState('');
  const [performerName, setPerformerName] = useState('');
  const [performerRole, setPerformerRole] = useState('');

  useEffect(() => {
    loadFormats();
  }, []);

  const loadFormats = async () => {
    setIsLoading(true);
    try {
      // Mock data
      const mockFormats: Format[] = [
        {
          id: '1',
          name: 'Дуэт',
          shortDescription: 'Концерт в формате дуэта',
          fullDescription: 'Живое исполнение песен в формате дуэта',
          imageUrl: '',
          suitableFor: ['Свадьбы', 'Корпоративы', 'Юбилеи'],
          performers: [
            { name: 'Гио Пика', role: 'Вокал' },
            { name: 'DJ', role: 'Диджей' },
          ],
          status: 'available',
          order: 1,
        },
        {
          id: '2',
          name: 'Соло',
          shortDescription: 'Сольное выступление',
          fullDescription: 'Сольное живое исполнение',
          imageUrl: '',
          suitableFor: ['Частные мероприятия', 'Клубы'],
          performers: [{ name: 'Гио Пика', role: 'Вокал' }],
          status: 'available',
          order: 2,
        },
      ];

      setFormats(mockFormats);
    } catch (error) {
      console.error('Error loading formats:', error);
      toast.error('Не удалось загрузить форматы');
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
    setFormData({ ...format });
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
      // API call
      console.log('Deleting format:', id);
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
      if (editingFormat) {
        console.log('Updating format:', editingFormat.id, formData);
        toast.success('Формат обновлен');
      } else {
        console.log('Creating format:', formData);
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

  const handleAddSuitable = () => {
    if (!suitableInput.trim()) return;
    setFormData({
      ...formData,
      suitableFor: [...formData.suitableFor, suitableInput.trim()],
    });
    setSuitableInput('');
  };

  const handleRemoveSuitable = (index: number) => {
    setFormData({
      ...formData,
      suitableFor: formData.suitableFor.filter((_, i) => i !== index),
    });
  };

  const handleAddPerformer = () => {
    if (!performerName.trim() || !performerRole.trim()) {
      toast.error('Заполните имя и роль');
      return;
    }
    setFormData({
      ...formData,
      performers: [
        ...formData.performers,
        { name: performerName.trim(), role: performerRole.trim() },
      ],
    });
    setPerformerName('');
    setPerformerRole('');
  };

  const handleRemovePerformer = (index: number) => {
    setFormData({
      ...formData,
      performers: formData.performers.filter((_, i) => i !== index),
    });
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
            {formats.map((format) => (
              <div key={format.id} className="format-card">
                {format.imageUrl ? (
                  <div className="format-card__image">
                    <img src={format.imageUrl} alt={format.name} />
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
                    >
                      {format.status === 'available' ? 'Доступен' : 'Скоро'}
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
            ))}
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
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Подходит для</label>
            <div className="array-input">
              <input
                type="text"
                className="admin-form-input"
                value={suitableInput}
                onChange={(e) => setSuitableInput(e.target.value)}
                placeholder="Например: Свадьбы"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSuitable();
                  }
                }}
              />
              <button
                type="button"
                className="admin-btn"
                onClick={handleAddSuitable}
              >
                Добавить
              </button>
            </div>
            {formData.suitableFor.length > 0 && (
              <div className="array-list">
                {formData.suitableFor.map((item, index) => (
                  <div key={index} className="array-item">
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSuitable(index)}
                      className="array-item__remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Исполнители</label>
            <div className="performer-input">
              <input
                type="text"
                className="admin-form-input"
                value={performerName}
                onChange={(e) => setPerformerName(e.target.value)}
                placeholder="Имя исполнителя"
              />
              <input
                type="text"
                className="admin-form-input"
                value={performerRole}
                onChange={(e) => setPerformerRole(e.target.value)}
                placeholder="Роль"
              />
              <button
                type="button"
                className="admin-btn"
                onClick={handleAddPerformer}
              >
                Добавить
              </button>
            </div>
            {formData.performers.length > 0 && (
              <div className="array-list">
                {formData.performers.map((performer, index) => (
                  <div key={index} className="array-item">
                    <span>
                      {performer.name} — {performer.role}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemovePerformer(index)}
                      className="array-item__remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Статус</label>
            <select
              className="admin-form-input admin-form-select"
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as 'available' | 'coming-soon',
                })
              }
            >
              <option value="available">Доступен</option>
              <option value="coming-soon">Скоро</option>
            </select>
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
