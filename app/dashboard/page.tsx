'use client';

import Feed from '@/components/Feed';
import RightSidebar from '@/components/RightSidebar';

export default function DashboardPage() {
  return (
    <div className="flex w-full gap-8 relative items-start">
      {/* Main Feed Column */}
      <div className="flex-1 max-w-2xl min-w-0">
        <Feed />
      </div>
      
      {/* Network Intelligence Panel (Hidden on small screens) */}
      <div className="hidden xl:block w-[320px] flex-shrink-0">
        <RightSidebar />
      </div>
    </div>
  );
}
