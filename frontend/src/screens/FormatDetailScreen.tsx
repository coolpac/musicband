import { useState, useEffect } from 'react';
import { Format } from '../types/format';
import { getFormatById } from '../services/formatService';
import formatIcon from '../assets/figma/format-icon.svg';

type FormatDetailScreenProps = {
  formatId: string;
  onBack: () => void;
  onRequestPrice: () => void;
};

export default function FormatDetailScreen({
  formatId,
  onBack,
  onRequestPrice,
}: FormatDetailScreenProps) {
  const [format, setFormat] = useState<Format | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFormat = async () => {
      try {
        const data = await getFormatById(formatId);
        setFormat(data || null);
      } catch (error) {
        console.error('Failed to load format:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFormat();
  }, [formatId]);

  if (loading) {
    return (
      <main className="screen screen--format-detail">
        <div className="format-detail-container">
          <div className="format-loading">Загрузка...</div>
        </div>
      </main>
    );
  }

  if (!format) {
    return (
      <main className="screen screen--format-detail">
        <div className="format-detail-container">
          <p>Формат не найден</p>
          <button className="btn btn-primary" onClick={onBack} type="button">
            Назад
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="screen screen--format-detail">
      <button className="format-back-btn" onClick={onBack} type="button">
        Назад
      </button>
      <div className="format-detail-container">
        <div className="format-detail-hero">
          {format.status === 'coming-soon' ? (
            <div className="format-coming-soon-card format-coming-soon-card--detail">
              <img alt="Иконка замка" className="format-lock-icon" src={formatIcon} />
            </div>
          ) : (
            <>
              {format.imageUrl && (
                <img
                  alt={format.name}
                  className="format-detail-bg-image"
                  src={format.imageUrl}
                />
              )}
              <div className="format-detail-overlay"></div>
            </>
          )}
        </div>

        <div className="format-detail-content">
          <h1 className="format-detail-title">{format.name}</h1>
          <p className="format-detail-short-description">{format.shortDescription}</p>

          {format.status === 'available' && (
            <>
              {format.suitableFor && format.suitableFor.length > 0 && (
                <div className="format-detail-card glass">
                  <h2 className="format-detail-card-title">Где подходит?</h2>
                  <ul className="format-detail-list">
                    {format.suitableFor.map((item, index) => (
                      <li key={index} className="format-detail-list-item">
                        {item}
                      </li>
                    ))}
                  </ul>
                  {format.description && (
                    <p className="format-detail-description">{format.description}</p>
                  )}
                </div>
              )}

              {!format.suitableFor && format.description && (
                <p className="format-detail-description">{format.description}</p>
              )}

              {format.performers && format.performers.length > 0 && (
                <div className="format-detail-card glass">
                  <div className="format-detail-performers">
                    {format.performers.map((performer, index) => (
                      <div key={index} className="format-detail-performer">
                        <strong>{performer.name}</strong> — {performer.role}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <button className="btn btn-primary format-detail-cta" onClick={onRequestPrice} type="button">
          Получить прайс
        </button>
      </div>
    </main>
  );
}
