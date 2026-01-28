import reviewSuccessImage from '../assets/figma/review-success-image.png';
import '../styles/review.css';

type ReviewSuccessScreenProps = {
  onBackHome?: () => void;
};

export default function ReviewSuccessScreen({ onBackHome }: ReviewSuccessScreenProps) {
  return (
    <main className="screen screen--review-success">
      <div className="review-success-container">
        <h1 className="review-success-title">Уууася, грацие!*</h1>
        <div className="review-success-image-wrapper">
          <div className="review-success-image-gradient review-success-image-gradient--top"></div>
          <img
            alt="Благодарность"
            className="review-success-image"
            src={reviewSuccessImage}
          />
          <div className="review-success-image-gradient review-success-image-gradient--bottom"></div>
        </div>
        <p className="review-success-note">*благодарим за ваше внимание и отзыв</p>
        <button className="btn btn-primary review-success-button" onClick={onBackHome} type="button">
          На главную
        </button>
      </div>
    </main>
  );
}
