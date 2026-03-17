import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import AdminHeader from '../components/AdminHeader';
import Modal from '../components/Modal';
import FileUpload from '../components/FileUpload';
import { OptimizedImage } from '../../components/OptimizedImage';
import { getOptimizedImageProps } from '../../types/image';
import {
  getAdminPartners,
  createAdminPartner,
  updateAdminPartner,
  deleteAdminPartner,
  reorderAdminPartners,
  MAX_PARTNERS,
  type AdminPartner,
} from '../../services/adminPartnersService';
import '../../styles/admin.css';
import './PartnersManagementScreen.css';

interface PartnerInput {
  name: string;
  logoUrl: string;
  website?: string;
  order: number;
}

export default function PartnersManagementScreen() {
  const [partners, setPartners] = useState<AdminPartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<AdminPartner | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [reordering, setReordering] = useState(false);

  const [formData, setFormData] = useState<PartnerInput>({
    name: '',
    logoUrl: '',
    website: '',
    order: 0,
  });

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    setIsLoading(true);
    try {
      const list = await getAdminPartners();
      setPartners(list);
    } catch (error) {
      console.error('Error loading partners:', error);
      toast.error('Не удалось загрузить партнеров');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingPartner(null);
    setFormData({
      name: '',
      logoUrl: '',
      website: '',
      order: partners.length,
    });
    setShowModal(true);
  };

  const handleEdit = (partner: AdminPartner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      logoUrl: partner.logoUrl,
      website: partner.website ?? '',
      order: partner.order,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const partner = partners.find((p) => p.id === id);
    if (!partner) return;

    const confirmed = window.confirm(
      `Вы уверены, что хотите удалить "${partner.name}"?`
    );
    if (!confirmed) return;

    try {
      await deleteAdminPartner(id);
      toast.success('Партнер удален');
      await loadPartners();
    } catch (error) {
      console.error('Error deleting partner:', error);
      toast.error('Не удалось удалить партнера');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= partners.length) return;

    const next = [...partners];
    const [removed] = next.splice(index, 1);
    next.splice(newIndex, 0, removed);

    setReordering(true);
    try {
      await reorderAdminPartners(next.map((p) => p.id));
      setPartners(next);
      toast.success('Порядок обновлен');
    } catch (error) {
      console.error('Error reordering partners:', error);
      toast.error('Не удалось изменить порядок');
    } finally {
      setReordering(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.logoUrl) {
      toast.error('Заполните название и загрузите логотип');
      return;
    }

    setIsSaving(true);
    try {
      if (editingPartner) {
        await updateAdminPartner(editingPartner.id, {
          name: formData.name,
          logoUrl: formData.logoUrl,
          website: formData.website || undefined,
          order: formData.order,
        });
        toast.success('Партнер обновлен');
      } else {
        await createAdminPartner({
          name: formData.name,
          logoUrl: formData.logoUrl,
          website: formData.website || undefined,
          order: formData.order,
        });
        toast.success('Партнер добавлен');
      }

      setShowModal(false);
      await loadPartners();
    } catch (error) {
      console.error('Error saving partner:', error);
      toast.error('Не удалось сохранить партнера');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (url: string) => {
    setFormData({ ...formData, logoUrl: url });
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
        <h1 className="admin-title">Управление партнерами</h1>
        {partners.length > 0 && (
          <p className="admin-title-hint">Максимум {MAX_PARTNERS} партнеров. Порядок можно менять кнопками ↑ ↓.</p>
        )}

        {partners.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty__icon">🤝</div>
            <h3 className="admin-empty__title">Нет партнеров</h3>
            <p className="admin-empty__text">Добавьте первого партнера</p>
          </div>
        ) : (
          <div className="partners-grid">
            {partners.map((partner, index) => {
              const logoProps = getOptimizedImageProps(partner.logoUrl);
              return (
              <div key={partner.id} className="partner-card">
                <div className="partner-card__order">
                  <button
                    type="button"
                    className="partner-card__order-btn"
                    onClick={() => handleMove(index, 'up')}
                    disabled={reordering || index === 0}
                    aria-label="Поднять выше"
                    title="Поднять выше"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2.5L12 8.5H2L7 2.5Z" fill="currentColor"/></svg>
                  </button>
                  <span className="partner-card__order-num">{index + 1}</span>
                  <button
                    type="button"
                    className="partner-card__order-btn"
                    onClick={() => handleMove(index, 'down')}
                    disabled={reordering || index === partners.length - 1}
                    aria-label="Опустить ниже"
                    title="Опустить ниже"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 11.5L2 5.5H12L7 11.5Z" fill="currentColor"/></svg>
                  </button>
                </div>
                {logoProps ? (
                  <div className="partner-card__logo">
                    <OptimizedImage
                      {...logoProps}
                      alt={partner.name}
                      loading="lazy"
                      sizes="(max-width: 440px) 100vw, 160px"
                      objectFit="contain"
                    />
                  </div>
                ) : (
                  <div className="partner-card__placeholder">🤝</div>
                )}

                <div className="partner-card__content">
                  <h3 className="partner-card__title">{partner.name}</h3>
                  {partner.website && (
                    <a
                      href={partner.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="partner-card__link"
                    >
                      {partner.website}
                    </a>
                  )}

                  <div className="partner-card__actions">
                    <button
                      className="admin-btn admin-btn--secondary"
                      onClick={() => handleEdit(partner)}
                    >
                      Редактировать
                    </button>
                    <button
                      className="admin-btn admin-btn--danger"
                      onClick={() => handleDelete(partner.id)}
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

        <button
          className="admin-fab"
          onClick={handleAdd}
          disabled={partners.length >= MAX_PARTNERS}
          aria-label={partners.length >= MAX_PARTNERS ? `Максимум ${MAX_PARTNERS} партнеров` : 'Добавить партнера'}
          title={partners.length >= MAX_PARTNERS ? `Максимум ${MAX_PARTNERS} партнеров` : undefined}
        >
          +
        </button>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingPartner ? 'Редактировать партнера' : 'Добавить партнера'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="admin-form">
          <div className="admin-form-group">
            <label className="admin-form-label">Название*</label>
            <input
              type="text"
              className="admin-form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Название компании"
              required
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Логотип*</label>
            <FileUpload
              currentImage={formData.logoUrl}
              onUpload={handleImageUpload}
              accept="image/*"
              maxSize={3}
              preset="logo"
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Сайт</label>
            <input
              type="url"
              className="admin-form-input"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://example.com"
            />
          </div>

          <div className="admin-form-actions">
            <button
              type="submit"
              className="admin-btn admin-btn--full"
              disabled={isSaving}
            >
              {isSaving ? 'Сохранение...' : editingPartner ? 'Обновить' : 'Добавить'}
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
