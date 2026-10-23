'use client';

import { useFeed } from '@/app/contexts/FeedContext';

export default function TimelineDot({
  articleId,
  isBreaking,
}: {
  articleId: string;
  isBreaking: boolean;
}) {
  const { activeArticleId } = useFeed();
  const active = activeArticleId === articleId;

  return (
    <div className="relative flex w-5 shrink-0 justify-center pt-1">
      <div className="absolute top-0 bottom-0 w-px bg-dim" aria-hidden />
      <span
        className={`relative z-[1] mt-1.5 h-3 w-3 rounded-full border-2 ${
          active
            ? 'border-accent bg-accent shadow-[0_0_0_4px_var(--accent-soft)]'
            : isBreaking
              ? 'animate-[pulse-dot_1.5s_ease-in-out_infinite] border-accent bg-accent'
              : 'border-dim bg-bg'
        }`}
      />
    </div>
  );
}
