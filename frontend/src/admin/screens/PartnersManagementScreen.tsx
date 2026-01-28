import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import AdminHeader from '../components/AdminHeader';
import Modal from '../components/Modal';
import FileUpload from '../components/FileUpload';
import '../../styles/admin.css';
import './PartnersManagementScreen.css';

interface Partner {
  id: string;
  name: string;
  logoUrl: string;
  website?: string;
  order: number;
}

interface PartnerInput {
  name: string;
  logoUrl: string;
  website?: string;
  order: number;
}

export default function PartnersManagementScreen() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
      // Mock data
      const mockPartners: Partner[] = [
        {
          id: '1',
          name: 'Partner Company',
          logoUrl: '',
          website: 'https://partner.com',
          order: 1,
        },
      ];
      setPartners(mockPartners);
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
      order: partners.length + 1,
    });
    setShowModal(true);
  };

  const handleEdit = (partner: Partner) => {
    setEditingPartner(partner);
    setFormData({ ...partner });
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
      console.log('Deleting partner:', id);
      toast.success('Партнер удален');
      await loadPartners();
    } catch (error) {
      console.error('Error deleting partner:', error);
      toast.error('Не удалось удалить партнера');
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
        console.log('Updating partner:', editingPartner.id, formData);
        toast.success('Партнер обновлен');
      } else {
        console.log('Creating partner:', formData);
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

        {partners.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty__icon">🤝</div>
            <h3 className="admin-empty__title">Нет партнеров</h3>
            <p className="admin-empty__text">Добавьте первого партнера</p>
          </div>
        ) : (
          <div className="partners-grid">
            {partners.map((partner) => (
              <div key={partner.id} className="partner-card">
                {partner.logoUrl ? (
                  <div className="partner-card__logo">
                    <img src={partner.logoUrl} alt={partner.name} />
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
            ))}
          </div>
        )}

        <button className="admin-fab" onClick={handleAdd} aria-label="Добавить партнера">
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
