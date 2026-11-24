export default function SiteFooter() {
  return (
    <footer className="border-t border-black/10 bg-black/5 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center">
      <p className="text-xs text-[var(--wood-text)]/70">
        &copy; {new Date().getFullYear()} llysSmart &middot; EduQuest Platform
        <span className="mx-1.5">&middot;</span>
        Inspired by Puput (ex Sasima)
        <span className="mx-1.5">&middot;</span>
        Powered by <span className="font-semibold">RachmandaCode</span> &amp; AI
      </p>
    </footer>
  );
}
