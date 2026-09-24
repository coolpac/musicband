import { Button } from '../components/ui/Button';
import './pages.css';

/** Served with a real HTTP 404 by the SSR server (see seo/meta.ts → statusForRoute). */
export function NotFoundPage() {
  return (
    <section className="site-page site-notfound">
      <div className="site-container site-notfound__inner">
        <p className="site-notfound__code" aria-hidden="true">
          404
        </p>
        <h1 className="site-page__title">Такой страницы нет</h1>
        <p className="site-notfound__text">Возможно, ссылка устарела. Зато музыка — на месте.</p>
        <div className="site-notfound__actions">
          <Button to="/" size="lg">
            На главную
          </Button>
          <Button to="/booking" size="lg" variant="outline">
            Выбрать дату
          </Button>
        </div>
      </div>
    </section>
  );
}
