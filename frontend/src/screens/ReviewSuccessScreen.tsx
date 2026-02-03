import { motion } from 'framer-motion';
import { hapticImpact } from '../telegram/telegramWebApp';
import reviewSuccessImage from '../assets/figma/review-success-image.webp';
import '../styles/review.css';

type ReviewSuccessScreenProps = {
  onBackHome?: () => void;
};

export default function ReviewSuccessScreen({ onBackHome }: ReviewSuccessScreenProps) {
  return (
    <main className="screen screen--review-success">
      <div className="review-success-container">
        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: 'spring' }}
          className="review-success-title"
        >
          Уууася, грацие!*
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="review-success-image-wrapper"
        >
          <div className="review-success-image-gradient review-success-image-gradient--top"></div>
          <img
            alt="Благодарность"
            className="review-success-image"
            src={reviewSuccessImage}
          />
          <div className="review-success-image-gradient review-success-image-gradient--bottom"></div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="review-success-bottom"
        >
          <p className="review-success-note">
            *благодарим за ваше внимание и отзыв
          </p>
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.7 }}
            className="btn btn-primary review-success-button"
            onClick={() => { hapticImpact('light'); onBackHome?.(); }}
            type="button"
          >
            На главную
          </motion.button>
        </motion.div>
      </div>
    </main>
  );
}
