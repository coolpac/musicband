import topbarLogo from '../assets/figma/topbar-left.svg';
import './Header.css';

export default function Header() {
  return (
    <header className="app-header">
      <div className="app-topbar">
        <img alt="ВГУП" className="app-topbar-logo" src={topbarLogo} />
      </div>
    </header>
  );
}
