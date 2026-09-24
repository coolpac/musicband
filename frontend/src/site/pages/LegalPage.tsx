import { useSection } from '../content/SiteDataContext';
import { Link } from '../router/Router';
import './pages.css';

interface LegalPageProps {
  doc: 'privacy' | 'terms' | 'offer';
}

/**
 * Admin-authored legal text. Rendered as text nodes only — «## » lines become subheadings,
 * blank lines split paragraphs — so nothing typed in the admin can inject markup.
 */
export function LegalPage({ doc }: LegalPageProps) {
  const { title, body } = useSection('legal')[doc];
  const blocks = body
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <article className="site-page site-legal">
      <div className="site-container site-legal__inner">
        <nav aria-label="Хлебные крошки" className="site-crumbs">
          <Link to="/">Главная</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{title}</span>
        </nav>
        <h1 className="site-page__title">{title}</h1>
        <div className="site-legal__body">
          {blocks.map((block, i) =>
            block.startsWith('## ') ? (
              <h2 key={i}>{block.slice(3)}</h2>
            ) : (
              <p key={i}>
                {block.split('\n').map((line, j, all) => (
                  <span key={j}>
                    {line}
                    {j < all.length - 1 ? <br /> : null}
                  </span>
                ))}
              </p>
            )
          )}
        </div>
      </div>
    </article>
  );
}
