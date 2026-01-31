/**
 * TEMPORARY: Визуальный редактор декора «Почему мы» для мобилки.
 * Включение: ?decorEdit=1 в URL. Перетаскивай элементы, меняй размер (за угол),
 * нажми «Скопировать JSON» и вставь данные в whyMobileDecorFromFigma в HomeScreen.tsx.
 * УДАЛИТЬ: этот файл, импорт в HomeScreen, стили .why-decor-editor-* в home.css.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

type FigmaRect = { x: number; y: number; w: number; h: number; opacity?: number; flipHorizontal?: boolean; flipVertical?: boolean; rotate?: number };
type FigmaEllipsePos = { x: number; y: number; opacity?: number; flipHorizontal?: boolean; flipVertical?: boolean; rotate?: number };
type WhyMobileDecorFigma = {
  ellipse?: FigmaRect;
  vectorTop?: FigmaRect;
  vectorBottom?: FigmaRect;
  vectorWide?: FigmaRect;
  ellipseLeft?: FigmaEllipsePos;
  ellipseRight?: FigmaEllipsePos;
};

export type DecorType = 'ellipse' | 'vectorTop' | 'vectorBottom' | 'vectorWide' | 'ellipseLeft' | 'ellipseRight';
export type WhyMobileDecorItem =
  | ({ type: 'ellipse' | 'vectorTop' | 'vectorBottom' | 'vectorWide'; id: string } & FigmaRect)
  | ({ type: 'ellipseLeft' | 'ellipseRight'; id: string } & FigmaEllipsePos);

const DECOR_TYPES: DecorType[] = ['ellipse', 'vectorTop', 'vectorBottom', 'vectorWide', 'ellipseLeft', 'ellipseRight'];
const HAS_SIZE: DecorType[] = ['ellipse', 'vectorTop', 'vectorBottom', 'vectorWide'];

export function objectToDecorItems(slide: WhyMobileDecorFigma): WhyMobileDecorItem[] {
  const items: WhyMobileDecorItem[] = [];
  for (const key of DECOR_TYPES) {
    const value = slide[key as keyof WhyMobileDecorFigma];
    if (value == null) continue;
    items.push({ type: key, id: key, ...value } as WhyMobileDecorItem);
  }
  return items;
}

type DragState = {
  slideIndex: number;
  id: string;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
  element: HTMLElement;
};

type ResizeState = {
  slideIndex: number;
  id: string;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  element: HTMLElement;
};

type WhyDecorEditorProps = {
  initialDecor: WhyMobileDecorItem[][];
  frame: { width: number; height: number };
  slides: { id: string; alt: string; text: string }[];
  assets: {
    ellipse: string;
    vectorTop: string;
    vectorBottom: string;
    vectorWide: string;
    ellipseLeft: string;
    ellipseRight: string;
  };
};

export function WhyDecorEditor({
  initialDecor,
  frame,
  slides,
  assets,
}: WhyDecorEditorProps) {
  const [decor, setDecor] = useState<WhyMobileDecorItem[][]>(() => initialDecor);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const updateSlideDecor = useCallback(
    (slideIndex: number, id: string, patch: Partial<FigmaRect & FigmaEllipsePos>) => {
      setDecor((prev) =>
        prev.map((slide, i) => {
          if (i !== slideIndex) return slide;
          return slide.map((it) => (it.id === id ? { ...it, ...patch } : it));
        })
      );
    },
    []
  );

  // Keep a stable ref to updateSlideDecor so the global listeners don't re-attach
  const updateSlideDecorRef = useRef(updateSlideDecor);
  updateSlideDecorRef.current = updateSlideDecor;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      const resize = resizeRef.current;
      if (drag?.element) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        drag.element.style.left = `${Math.round(drag.startLeft + dx)}px`;
        drag.element.style.top = `${Math.round(drag.startTop + dy)}px`;
      }
      if (resize?.element) {
        const w = Math.max(20, resize.startW + (e.clientX - resize.startX));
        const h = Math.max(20, resize.startH + (e.clientY - resize.startY));
        resize.element.style.width = `${Math.round(w)}px`;
        resize.element.style.height = `${Math.round(h)}px`;
      }
    };
    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      const resize = resizeRef.current;
      if (drag) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        updateSlideDecorRef.current(drag.slideIndex, drag.id, {
          x: Math.round(drag.startLeft + dx),
          y: Math.round(drag.startTop + dy),
        });
        dragRef.current = null;
      }
      if (resize) {
        updateSlideDecorRef.current(resize.slideIndex, resize.id, {
          w: Math.max(20, Math.round(resize.startW + (e.clientX - resize.startX))),
          h: Math.max(20, Math.round(resize.startH + (e.clientY - resize.startY))),
        });
        resizeRef.current = null;
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const handleCopyJson = useCallback(() => {
    const json = JSON.stringify(decor, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [decor]);

  const toggleVisibility = useCallback(
    (slideIndex: number, id: string) => {
      setDecor((prev) =>
        prev.map((slide, i) => {
          if (i !== slideIndex) return slide;
          return slide.map((it) => {
            if (it.id !== id) return it;
            const op = (it.opacity ?? 1) > 0 ? 0 : 1;
            return { ...it, opacity: op };
          });
        })
      );
    },
    []
  );

  const DEFAULTS: Record<DecorType, FigmaRect | FigmaEllipsePos> = {
    ellipse: { x: 160, y: 200, w: 50, h: 50, opacity: 1 },
    vectorTop: { x: 20, y: 20, w: 120, h: 100, opacity: 1 },
    vectorBottom: { x: 20, y: 120, w: 120, h: 100, opacity: 1 },
    vectorWide: { x: 80, y: 150, w: 220, h: 160, opacity: 1 },
    ellipseLeft: { x: 20, y: 300, opacity: 1 },
    ellipseRight: { x: 300, y: 300, opacity: 1 },
  };

  const addElement = useCallback(
    (slideIndex: number, type: DecorType) => {
      const newId = `${type}_${Date.now()}`;
      const base = DEFAULTS[type];
      const item: WhyMobileDecorItem =
        type === 'ellipseLeft' || type === 'ellipseRight'
          ? { type, id: newId, ...base }
          : { type, id: newId, ...base };
      setDecor((prev) =>
        prev.map((slide, i) => (i === slideIndex ? [...(slide ?? []), item] : slide))
      );
    },
    []
  );

  const removeElement = useCallback(
    (slideIndex: number, id: string) => {
      setSelectedId((prev) => (prev === id ? null : prev));
      setDecor((prev) =>
        prev.map((slide, i) => {
          if (i !== slideIndex) return slide;
          return (slide ?? []).filter((it) => it.id !== id);
        })
      );
    },
    []
  );

  const NUDGE = 5;
  const NUDGE_FINE = 1;
  const ROTATE_STEP = 15;

  // Use refs so the keydown handler never needs to re-attach
  const decorRef = useRef(decor);
  decorRef.current = decor;
  const activeSlideRef = useRef(activeSlideIndex);
  activeSlideRef.current = activeSlideIndex;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const sid = selectedIdRef.current;
      if (sid == null) return;
      const slideIdx = activeSlideRef.current;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeElement(slideIdx, sid);
        setSelectedId(null);
        return;
      }

      const step = e.shiftKey ? NUDGE_FINE : NUDGE;
      const arrowMap: Record<string, { key: 'x' | 'y'; delta: number }> = {
        ArrowLeft: { key: 'x', delta: -step },
        ArrowRight: { key: 'x', delta: step },
        ArrowUp: { key: 'y', delta: -step },
        ArrowDown: { key: 'y', delta: step },
      };
      if (arrowMap[e.key]) {
        e.preventDefault();
        const { key, delta } = arrowMap[e.key];
        setDecor((prev) =>
          prev.map((slide, i) => {
            if (i !== slideIdx) return slide;
            return slide.map((it) => {
              if (it.id !== sid) return it;
              return { ...it, [key]: ((it as FigmaRect)[key] ?? 0) + delta };
            });
          })
        );
        return;
      }

      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setDecor((prev) =>
          prev.map((slide, i) => {
            if (i !== slideIdx) return slide;
            return slide.map((it) => (it.id === sid ? { ...it, flipHorizontal: !it.flipHorizontal } : it));
          })
        );
        return;
      }
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        setDecor((prev) =>
          prev.map((slide, i) => {
            if (i !== slideIdx) return slide;
            return slide.map((it) => (it.id === sid ? { ...it, flipVertical: !it.flipVertical } : it));
          })
        );
        return;
      }
      if (e.key === '[' || e.key === ']') {
        e.preventDefault();
        const dir = e.key === '[' ? -ROTATE_STEP : ROTATE_STEP;
        setDecor((prev) =>
          prev.map((slide, i) => {
            if (i !== slideIdx) return slide;
            return slide.map((it) => (it.id === sid ? { ...it, rotate: (it.rotate ?? 0) + dir } : it));
          })
        );
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [removeElement]);

  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const preventScroll = (e: WheelEvent) => {
      // Only block scroll when actively dragging/resizing inside the canvas
      if (dragRef.current || resizeRef.current) {
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', preventScroll, { passive: false });
    return () => el.removeEventListener('wheel', preventScroll);
  }, []);

  const slideDecor = decor[activeSlideIndex] ?? [];
  const selectedItem = slideDecor.find((it) => it.id === selectedId);
  const fw = frame.width;
  const fh = frame.height;

  const getAsset = (type: DecorType) =>
    type === 'ellipse'
      ? assets.ellipse
      : type === 'vectorTop'
        ? assets.vectorTop
        : type === 'vectorBottom'
          ? assets.vectorBottom
          : type === 'vectorWide'
            ? assets.vectorWide
            : type === 'ellipseLeft'
              ? assets.ellipseLeft
              : assets.ellipseRight;

  return (
    <div className="why-decor-editor" ref={containerRef}>
      <div className="why-decor-editor__toolbar">
        <span className="why-decor-editor__label">Редактор декора (временно)</span>
        <div className="why-decor-editor__tabs">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`why-decor-editor__tab${activeSlideIndex === i ? ' is-active' : ''}`}
              onClick={() => setActiveSlideIndex(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="why-decor-editor__actions">
          <span className="why-decor-editor__actions-label" title="Сначала кликни по фигуре на красном холсте">
            Отражение и поворот:
          </span>
          <button
            type="button"
            className="why-decor-editor__btn why-decor-editor__btn--tool"
            disabled={selectedId == null}
            onClick={() => selectedId != null && updateSlideDecor(activeSlideIndex, selectedId, { flipHorizontal: !selectedItem?.flipHorizontal })}
            title={selectedId == null ? 'Сначала выбери элемент (клик по фигуре на холсте)' : 'Отражение по горизонтали (H)'}
          >
            ↔ Гориз.
          </button>
          <button
            type="button"
            className="why-decor-editor__btn why-decor-editor__btn--tool"
            disabled={selectedId == null}
            onClick={() => selectedId != null && updateSlideDecor(activeSlideIndex, selectedId, { flipVertical: !selectedItem?.flipVertical })}
            title={selectedId == null ? 'Сначала выбери элемент (клик по фигуре на холсте)' : 'Отражение по вертикали (V)'}
          >
            ↕ Верт.
          </button>
          <button
            type="button"
            className="why-decor-editor__btn why-decor-editor__btn--tool"
            disabled={selectedId == null}
            onClick={() => selectedId != null && updateSlideDecor(activeSlideIndex, selectedId, { rotate: (selectedItem?.rotate ?? 0) - ROTATE_STEP })}
            title={selectedId == null ? 'Сначала выбери элемент' : 'Поворот −15° ([)'}
          >
            ↶ −15°
          </button>
          <button
            type="button"
            className="why-decor-editor__btn why-decor-editor__btn--tool"
            disabled={selectedId == null}
            onClick={() => selectedId != null && updateSlideDecor(activeSlideIndex, selectedId, { rotate: (selectedItem?.rotate ?? 0) + ROTATE_STEP })}
            title={selectedId == null ? 'Сначала выбери элемент' : 'Поворот +15° (])'}
          >
            ↷ +15°
          </button>
          {selectedId != null && (
            <button
              type="button"
              className="why-decor-editor__btn why-decor-editor__btn--danger"
              onClick={() => removeElement(activeSlideIndex, selectedId)}
            >
              Удалить «{selectedItem?.id ?? selectedId}»
            </button>
          )}
          <button type="button" className="why-decor-editor__btn" onClick={handleCopyJson}>
            {copied ? 'Скопировано!' : 'Скопировать JSON'}
          </button>
        </div>
        <div className="why-decor-editor__list">
          <span className="why-decor-editor__list-label">На слайде:</span>
          {slideDecor.map((item) => (
            <span key={item.id} className="why-decor-editor__list-item">
              <button
                type="button"
                className={`why-decor-editor__list-btn${selectedId === item.id ? ' is-selected' : ''}`}
                onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
              >
                {item.type}{slideDecor.filter((it) => it.type === item.type).length > 1 ? ` (${item.id})` : ''}
              </button>
              <button
                type="button"
                className="why-decor-editor__list-remove"
                onClick={() => removeElement(activeSlideIndex, item.id)}
                title="Удалить"
              >
                Удалить
              </button>
            </span>
          ))}
        </div>
        <div className="why-decor-editor__add">
          <span className="why-decor-editor__add-label">Добавить (можно один тип несколько раз):</span>
          {DECOR_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className="why-decor-editor__add-btn"
              onClick={() => addElement(activeSlideIndex, type)}
              title={`Добавить ${type}`}
            >
              + {type}
            </button>
          ))}
        </div>
      </div>
      <div
        className="why-decor-editor__canvas-wrap"
        ref={canvasWrapRef}
        role="region"
        aria-label="Холст редактора"
      >
      <span className="why-decor-editor__canvas-label">
        {fw}×{fh}px — границы как на мобилке (внутри белой рамки)
      </span>
      <div
        className="why-decor-editor__canvas"
        style={{ width: fw, height: fh }}
      >
        {slideDecor.map((item) => {
          const isEllipse = item.type === 'ellipseLeft' || item.type === 'ellipseRight';
          const rect = item as FigmaRect;
          const hasSize = HAS_SIZE.includes(item.type) && 'w' in item && 'h' in item;
          const flipH = item.flipHorizontal ?? false;
          const flipV = item.flipVertical ?? false;
          const rot = item.rotate ?? 0;
          const transformParts: string[] = [];
          if (flipH) transformParts.push('scaleX(-1)');
          if (flipV) transformParts.push('scaleY(-1)');
          if (rot !== 0) transformParts.push(`rotate(${rot}deg)`);
          const transform = transformParts.length > 0 ? transformParts.join(' ') : undefined;
          const style: React.CSSProperties = isEllipse
            ? { left: (item as FigmaEllipsePos).x, top: (item as FigmaEllipsePos).y, opacity: item.opacity ?? 1, transform }
            : {
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
                opacity: rect.opacity ?? 1,
                transform,
              };

          const onPointerDownDrag = (e: React.PointerEvent) => {
            if ((e.target as HTMLElement).closest('.why-decor-editor__shape-actions, .why-decor-editor__resize-handle')) return;
            e.preventDefault();
            const el = e.currentTarget as HTMLElement;
            dragRef.current = {
              slideIndex: activeSlideIndex,
              id: item.id,
              startX: e.clientX,
              startY: e.clientY,
              startLeft: isEllipse ? (item as FigmaEllipsePos).x : rect.x,
              startTop: isEllipse ? (item as FigmaEllipsePos).y : rect.y,
              element: el,
            };
            el.setPointerCapture?.(e.pointerId);
          };

          const onResizeDown = (e: React.PointerEvent) => {
            e.stopPropagation();
            const shapeEl = (e.target as HTMLElement).closest('.why-decor-editor__shape') as HTMLElement;
            if (!shapeEl) return;
            resizeRef.current = {
              slideIndex: activeSlideIndex,
              id: item.id,
              startX: e.clientX,
              startY: e.clientY,
              startW: rect.w,
              startH: rect.h,
              element: shapeEl,
            };
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          };

          const isVerticalEllipse = item.type === 'ellipseLeft' || item.type === 'ellipseRight';

          return (
            <div
              key={item.id}
              className={`why-decor-editor__shape${isVerticalEllipse ? ' why-decor-editor__shape--ellipse-v' : ''}${selectedId === item.id ? ' is-selected' : ''}`}
              style={style}
              onPointerDown={onPointerDownDrag}
              onClick={(e) => { if ((e.target as HTMLElement).closest('.why-decor-editor__shape-actions, .why-decor-editor__resize-handle')) return; e.stopPropagation(); setSelectedId(item.id); }}
            >
              <img alt="" src={getAsset(item.type)} className={isVerticalEllipse ? 'why-decor-editor__ellipse-img' : ''} />
              <div className="why-decor-editor__shape-actions">
                <button
                  type="button"
                  className="why-decor-editor__shape-btn"
                  onClick={(e) => { e.stopPropagation(); toggleVisibility(activeSlideIndex, item.id); }}
                  title="Скрыть/показать"
                >
                  {(item.opacity ?? 1) > 0 ? '👁' : '👁‍🗨'}
                </button>
                <button
                  type="button"
                  className="why-decor-editor__shape-btn why-decor-editor__shape-btn--remove"
                  onClick={(e) => { e.stopPropagation(); removeElement(activeSlideIndex, item.id); }}
                  title="Удалить"
                >
                  Уд.
                </button>
              </div>
              {hasSize && (
                <div
                  className="why-decor-editor__resize-handle"
                  onPointerDown={onResizeDown}
                  title="Тяни для размера"
                />
              )}
            </div>
          );
        })}
      </div>
      </div>
      <p className="why-decor-editor__hint">
        <strong>Как переворачивать:</strong> кликни по фигуре на красном холсте → станут активными кнопки «↔ Гориз.» и «↕ Верт.» в панели выше. Тяни фигуру — двигается, за угол — размер. Скролл страницы работает нормально.
      </p>
    </div>
  );
}
