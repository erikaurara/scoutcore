import React, { useEffect, useState } from 'react';
import { FavoriteItem, isFavorite, toggleFavorite } from '../services/favorites';

type Props = {
  item: FavoriteItem;
  compact?: boolean;
};

export const FavoriteButton: React.FC<Props> = ({ item, compact = false }) => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => setActive(isFavorite(item.kind, item.id));
    sync();
    window.addEventListener('scoutcore:favorites-changed', sync);
    return () => window.removeEventListener('scoutcore:favorites-changed', sync);
  }, [item.kind, item.id]);

  return (
    <button
      type="button"
      aria-label={active ? `Remove ${item.name} from favorites` : `Add ${item.name} to favorites`}
      title={active ? 'Remove from favorites' : 'Add to favorites'}
      onClick={(event) => {
        event.stopPropagation();
        setActive(toggleFavorite(item));
      }}
      className={`inline-flex items-center justify-center rounded-full border transition-all ${
        compact ? 'w-8 h-8' : 'px-3 py-2 gap-2 text-xs font-bold'
      } ${
        active
          ? 'bg-[#00f0ff]/15 border-[#00f0ff]/60 text-[#00f0ff]'
          : 'bg-[#171f33] border-[#3b494b]/40 text-[#849495] hover:text-[#00f0ff] hover:border-[#00f0ff]/40'
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{active ? 'star' : 'star_outline'}</span>
      {!compact && (active ? 'FAVORITED' : 'FAVORITE')}
    </button>
  );
};
