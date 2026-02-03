import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import toast from 'react-hot-toast';
import AdminHeader from '../components/AdminHeader';
import Modal from '../components/Modal';
import FileUpload from '../components/FileUpload';
import { OptimizedImage } from '../../components/OptimizedImage';
import { getOptimizedImageProps } from '../../types/image';
import { getTracks, createTrack, updateTrack, deleteTrack, Track, TrackInput } from '../../services/adminService';
import '../../styles/admin.css';
import './SongsManagementScreen.css';

interface SortableItemProps {
  song: Track;
  onEdit: (song: Track) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}

function SortableItem({ song, onEdit, onDelete, onToggleActive }: SortableItemProps) {
  const coverProps = getOptimizedImageProps(song.coverUrl);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: song.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`song-item ${isDragging ? 'song-item--dragging' : ''}`}
    >
      {/* Drag Handle */}
      <div className="song-item__drag-handle" {...attributes} {...listeners}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 5H11V7H9V5ZM13 5H15V7H13V5ZM9 11H11V13H9V11ZM13 11H15V13H13V11ZM9 17H11V19H9V17ZM13 17H15V19H13V17Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* Song Info */}
      <div className="song-item__info">
        {coverProps && (
          <div className="song-item__cover">
            <OptimizedImage
              {...coverProps}
              alt={song.title}
              loading="lazy"
              sizes="(max-width: 440px) 100vw, 120px"
              objectFit="cover"
            />
          </div>
        )}
        <div className="song-item__text">
          <div className="song-item__title">{song.title}</div>
          <div className="song-item__artist">{song.artist}</div>
        </div>
      </div>

      {/* Toggle Active */}
      <label className="song-item__toggle" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={song.isActive}
          onChange={(e) => onToggleActive(song.id, e.target.checked)}
          className="song-toggle-checkbox"
        />
        <span className="song-toggle-slider"></span>
      </label>

      {/* Actions */}
      <div className="song-item__actions">
        <button
          className="song-item__action song-item__action--edit"
          onClick={() => onEdit(song)}
          aria-label="Редактировать"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M14.166 2.5C14.3849 2.28113 14.6447 2.10752 14.9307 1.98906C15.2167 1.87061 15.5232 1.80957 15.8327 1.80957C16.1422 1.80957 16.4487 1.87061 16.7347 1.98906C17.0206 2.10752 17.2804 2.28113 17.4993 2.5C17.7182 2.71887 17.8918 2.97871 18.0103 3.26466C18.1287 3.55061 18.1898 3.85711 18.1898 4.16667C18.1898 4.47623 18.1287 4.78272 18.0103 5.06867C17.8918 5.35462 17.7182 5.61446 17.4993 5.83333L6.24935 17.0833L1.66602 18.3333L2.91602 13.75L14.166 2.5Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          className="song-item__action song-item__action--delete"
          onClick={() => onDelete(song.id)}
          aria-label="Удалить"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M2.5 5H4.16667H17.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M6.66602 5.00016V3.3335C6.66602 2.89147 6.84161 2.46754 7.15417 2.15498C7.46673 1.84242 7.89066 1.66683 8.33268 1.66683H11.666C12.108 1.66683 12.532 1.84242 12.8445 2.15498C13.1571 2.46754 13.3327 2.89147 13.3327 3.3335V5.00016M15.8327 5.00016V16.6668C15.8327 17.1089 15.6571 17.5328 15.3445 17.8453C15.032 18.1579 14.608 18.3335 14.166 18.3335H5.83268C5.39065 18.3335 4.96673 18.1579 4.65417 17.8453C4.34161 17.5328 4.16602 17.1089 4.16602 16.6668V5.00016H15.8327Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function SongsManagementScreen() {
  const [songs, setSongs] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSong, setEditingSong] = useState<Track | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<TrackInput>({
    title: '',
    artist: '',
    coverUrl: '',
    artistImageUrl: '',
    lyrics: '',
    isActive: false,
    orderIndex: 0,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    setIsLoading(true);
    try {
      const data = await getTracks();
      // Сортируем по orderIndex
      const sorted = [...data].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      setSongs(sorted);
    } catch (error) {
      console.error('Error loading songs:', error);
      toast.error('Не удалось загрузить песни');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setSongs((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);

      // Обновляем orderIndex для всех песен
      const updatedItems = newItems.map((item, index) => ({
        ...item,
        orderIndex: index,
      }));

      // Сохраняем изменения на сервере (в фоне)
      saveOrderChanges(updatedItems);

      return updatedItems;
    });

    toast.success('Порядок изменен');
  };

  const saveOrderChanges = async (updatedSongs: Track[]) => {
    try {
      // В реальном приложении здесь будет batch update
      for (const song of updatedSongs) {
        await updateTrack(song.id, { orderIndex: song.orderIndex });
      }
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error('Не удалось сохранить порядок');
    }
  };

  const handleAdd = () => {
    setEditingSong(null);
    setFormData({
      title: '',
      artist: '',
      coverUrl: '',
      artistImageUrl: '',
      lyrics: '',
      isActive: false,
      orderIndex: songs.length,
    });
    setShowModal(true);
  };

  const handleEdit = (song: Track) => {
    setEditingSong(song);
    setFormData({
      title: song.title,
      artist: song.artist,
      coverUrl: song.coverUrl,
      artistImageUrl: song.artistImageUrl,
      lyrics: song.lyrics,
      isActive: song.isActive,
      orderIndex: song.orderIndex,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const song = songs.find((s) => s.id === id);
    if (!song) return;

    const confirmed = window.confirm(
      `Вы уверены, что хотите удалить "${song.title}"? Это действие нельзя отменить.`
    );

    if (!confirmed) return;

    try {
      await deleteTrack(id);
      toast.success('Песня удалена');
      await loadSongs();
    } catch (error) {
      console.error('Error deleting song:', error);
      toast.error('Не удалось удалить песню');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateTrack(id, { isActive });
      setSongs((prev) =>
        prev.map((song) =>
          song.id === id ? { ...song, isActive } : song
        )
      );
      toast.success(isActive ? 'Песня активирована' : 'Песня деактивирована');
    } catch (error) {
      console.error('Error toggling active:', error);
      toast.error('Не удалось изменить статус');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.artist) {
      toast.error('Заполните название и исполнителя');
      return;
    }

    setIsSaving(true);
    try {
      if (editingSong) {
        await updateTrack(editingSong.id, formData);
        toast.success('Песня обновлена');
      } else {
        await createTrack(formData);
        toast.success('Песня добавлена');
      }

      setShowModal(false);
      await loadSongs();
    } catch (error) {
      console.error('Error saving song:', error);
      toast.error('Не удалось сохранить песню');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (url: string) => {
    setFormData({ ...formData, coverUrl: url });
  };

  const handleArtistImageUpload = (url: string) => {
    setFormData({ ...formData, artistImageUrl: url });
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
        <h1 className="admin-title">Управление песнями</h1>

        {songs.length === 0 ? (
          <div className="admin-empty">
            <div className="admin-empty__icon">🎵</div>
            <h3 className="admin-empty__title">Нет песен</h3>
            <p className="admin-empty__text">Добавьте первую песню</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={songs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="songs-list">
                {songs.map((song) => (
                  <SortableItem
                    key={song.id}
                    song={song}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleActive={handleToggleActive}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* FAB */}
        <button className="admin-fab" onClick={handleAdd} aria-label="Добавить песню">
          +
        </button>
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingSong ? 'Редактировать песню' : 'Добавить песню'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="admin-form">
          <div className="admin-form-group">
            <label className="admin-form-label">Название*</label>
            <input
              type="text"
              className="admin-form-input"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Название песни"
              required
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Исполнитель*</label>
            <input
              type="text"
              className="admin-form-input"
              value={formData.artist}
              onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
              placeholder="Имя исполнителя"
              required
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Обложка</label>
            <FileUpload
              currentImage={formData.coverUrl}
              onUpload={handleImageUpload}
              accept="image/*"
              maxSize={5}
              preset="cover"
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Изображение исполнителя</label>
            <FileUpload
              currentImage={formData.artistImageUrl}
              onUpload={handleArtistImageUpload}
              accept="image/*"
              maxSize={5}
              preset="cover"
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Текст песни</label>
            <textarea
              className="admin-form-input admin-form-textarea"
              value={formData.lyrics}
              onChange={(e) => setFormData({ ...formData, lyrics: e.target.value })}
              placeholder="Текст песни..."
              rows={8}
            />
          </div>

          <div className="admin-form-group">
            <label className="song-form-toggle-label">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="song-form-checkbox"
              />
              <span>Активна для голосования</span>
            </label>
          </div>

          <div className="admin-form-actions">
            <button
              type="submit"
              className="admin-btn admin-btn--full"
              disabled={isSaving}
            >
              {isSaving ? 'Сохранение...' : editingSong ? 'Обновить' : 'Добавить'}
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
