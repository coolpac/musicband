import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { hapticImpact } from '../telegram/telegramWebApp';
import '../styles/format.css';
import { Format } from '../types/format';
import { getFormatById } from '../services/formatService';
import formatIcon from '../assets/figma/format-icon.svg';
import { OptimizedImage } from '../components/OptimizedImage';
import { getOptimizedImageProps } from '../types/image';

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
          <button className="btn btn-primary" onClick={() => { hapticImpact('light'); onBack(); }} type="button">
            Назад
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="screen screen--format-detail">
      <button className="format-back-btn" onClick={() => { hapticImpact('light'); onBack(); }} type="button">
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
              {(() => {
                const imgProps = getOptimizedImageProps(format.imageUrl);
                return imgProps ? (
                  <OptimizedImage
                    {...imgProps}
                    alt={format.name}
                    className="format-detail-bg-image"
                    loading="eager"
                    sizes="100vw"
                    objectFit="cover"
                  />
                ) : null;
              })()}
              <div className="format-detail-overlay"></div>
            </>
          )}
        </div>

        <div className="format-detail-content">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="format-detail-title"
          >
            {format.name}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="format-detail-short-description"
          >
            {format.shortDescription}
          </motion.p>

          {format.status === 'available' && (
            <>
              {format.suitableFor && format.suitableFor.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="format-detail-card glass"
                >
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
                </motion.div>
              )}

              {!format.suitableFor && format.description && (
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="format-detail-description"
                >
                  {format.description}
                </motion.p>
              )}

              {format.performers && format.performers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="format-detail-card glass"
                >
                  <div className="format-detail-performers">
                    {format.performers.map((performer, index) => (
                      <div key={index} className="format-detail-performer">
                        <strong>{performer.name}</strong> — {performer.role}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="btn btn-primary format-detail-cta"
          onClick={() => { hapticImpact('light'); onRequestPrice(); }}
          type="button"
        >
          Получить прайс
        </motion.button>
      </div>
    </main>
  );
}
