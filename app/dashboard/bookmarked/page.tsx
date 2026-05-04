'use client';

import BookmarkedFeeds from '@/components/BookmarkedFeeds';
import RightSidebar from '@/components/RightSidebar';

export default function BookmarkedPage() {
  return (
    <div className="flex w-full gap-8 relative items-start">
      <div className="flex-1 max-w-2xl min-w-0">
        <BookmarkedFeeds />
      </div>
      
      <div className="hidden xl:block w-[320px] flex-shrink-0">
        <RightSidebar />
      </div>
    </div>
  );
}
