import { motion } from 'framer-motion';
import { useState } from 'react';
import { hapticImpact, hapticSelection } from '../telegram/telegramWebApp';
import reviewFormBg from '../assets/figma/review-form-bg.webp';
import '../styles/review.css';

type ReviewFormScreenProps = {
  onSubmit?: (rating: number, text: string) => void;
};

export default function ReviewFormScreen({ onSubmit }: ReviewFormScreenProps) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');

  const handleStarClick = (index: number) => {
    hapticSelection();
    setRating(index + 1);
  };

  const handleSubmit = () => {
    if (rating > 0) {
      hapticImpact('medium');
      onSubmit?.(rating, text);
    }
  };

  const renderStars = () => {
    return Array.from({ length: 5 }, (_, i) => (
      <button
        key={i}
        type="button"
        className={`review-form-star ${i < rating ? 'review-form-star--filled' : ''}`}
        onClick={() => handleStarClick(i)}
        aria-label={`Оценить ${i + 1} звезд${i === 0 ? 'а' : i < 4 ? 'ы' : ''}`}
      >
        ★
      </button>
    ));
  };

  return (
    <main className="screen screen--review-form">
      <div className="review-form-hero">
        <img alt="" className="review-form-bg-image" src={reviewFormBg} />
      </div>
      <div className="review-form-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="review-form-card"
        >
          <h1 className="review-form-title">Оставить отзыв</h1>
          <textarea
            className="review-form-textarea"
            placeholder="Введите ваш белый текст"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
          />
          <div className="review-form-rating">
            {renderStars()}
          </div>
        </motion.div>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="btn btn-primary review-form-submit"
          onClick={handleSubmit}
          type="button"
          disabled={rating === 0}
        >
          Отправить
        </motion.button>
      </div>
    </main>
  );
}
